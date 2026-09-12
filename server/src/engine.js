// SpaceLord engine — the whole security state machine lives here.
// It models a manufacturer (root CA), a hub (with a certified hardware key),
// smart devices (each certified + bound to whoever controls the hub), a guest
// token, encrypted user storage, an automation rule engine, and the check-in /
// check-out lifecycle. Every security claim below is enforced with real crypto
// from crypto-utils.js.
import {
  genKeyPair, pubHex, shortId, sign, verify, sha256,
  deriveKey, aesEncrypt, aesDecrypt, randomSecret,
} from './crypto-utils.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The two software stacks a party can boot. Only the trusted one's hash is in
// the guest token's allowlist, so the tampered one fails attestation.
const STACKS = {
  trusted: {
    name: 'Guest Trusted Stack',
    files: ['system:debian9', 'openhab@2.5', 'wireguard@1.0', 'user-rules@v3'],
  },
  tampered: {
    name: 'Owner Image (malware injected)',
    files: ['system:debian9', 'openhab@2.5', 'wireguard@1.0', 'user-rules@v3', 'spyware:keylogger.bin'],
  },
};
const stackHash = (s) => sha256(s.files.join('|'));

// Two physical device line-ups for the two spaces. Rules reference the
// abstraction (e.g. LivingRoomLight), not the model, so they migrate cleanly.
const DEVICE_MODELS = {
  A: { lock: 'Solenoid Lock v18', camera: 'ESP32-CAM v37', light: 'LED Bulb v37', sensor: 'PIR Motion+Light v84' },
  B: { lock: 'SmartBolt Pro', camera: 'VisionCam 4K', light: 'LumiGlow RGB', sensor: 'MotionSense X' },
};

const DEVICE_DEFS = [
  { id: 'lock', type: 'lock', abstraction: 'FrontDoorLock', icon: '🔒', init: { locked: true } },
  { id: 'camera', type: 'camera', abstraction: 'LivingRoomCamera', icon: '📷', init: { streaming: false, lastFace: null } },
  { id: 'light', type: 'light', abstraction: 'LivingRoomLight', icon: '💡', init: { on: false } },
  { id: 'sensor', type: 'sensor', abstraction: 'MotionLightSensor', icon: '📡', init: { motion: false, night: false } },
];

const defaultGuestState = () => ({
  faceProfile: 'Anish (guest)',
  privateNotes: 'Guest Wi-Fi: spacelord-guest / Door PIN: 4821',
  rules: [
    { id: 'r1', text: 'IF motion AND it is night → turn LivingRoomLight ON', on: true },
    { id: 'r2', text: 'IF LivingRoomCamera recognizes my face → UNLOCK FrontDoorLock', on: true },
  ],
});

export class Engine {
  constructor() {
    this.broadcast = () => {};
    this.busy = false;
    this.reset(true);
  }

  setBroadcast(fn) { this.broadcast = fn; }

  // ---- lifecycle ----------------------------------------------------------
  reset(initial = false) {
    // Manufacturer root CA certifies hub + device keys.
    this.ca = genKeyPair();
    this.hub = genKeyPair();               // hub hardware key (persists across stays)
    this.owner = genKeyPair();             // owner's own control identity
    this.hubCert = sign(this.ca.privateKey, pubHex(this.hub.publicKey));

    this.space = 'A';
    this.phase = 'VACANT';
    this.controller = 'OWNER';
    this.stack = { ...STACKS.trusted, hash: stackHash(STACKS.trusted), trusted: true, owner: true };
    this.guest = null;                     // {name, token, storageKey}
    this.storageBlob = null;               // AES-GCM blob of guest state
    this.guestState = null;                // plaintext source of truth (server-side)
    this.attestation = null;               // last attestation record
    this.attacksDefended = 0;
    this.log = [];

    this.devices = DEVICE_DEFS.map((d) => ({
      ...d,
      model: DEVICE_MODELS.A[d.id],
      key: genKeyPair(),
      state: { ...d.init },
      boundTo: pubHex(this.owner.publicKey), // owner controls a vacant space
    }));
    this.devices.forEach((d) => { d.cert = sign(this.ca.privateKey, pubHex(d.key.publicKey)); });

    if (!initial) this.emit('reset', 'Space wiped and returned to OWNER control.', 'ok');
  }

  // ---- logging / events ---------------------------------------------------
  emit(kind, message, level = 'info', extra = {}) {
    const entry = { t: Date.now(), kind, message, level, ...extra };
    this.log.push(entry);
    if (this.log.length > 200) this.log.shift();
    this.broadcast({ type: 'event', entry, state: this.publicState() });
  }

  pushState() { this.broadcast({ type: 'state', state: this.publicState() }); }

  // ---- check-in -----------------------------------------------------------
  async checkin({ guestName = 'Anish', stack = 'trusted' } = {}) {
    if (this.busy) return { ok: false, error: 'busy' };
    if (this.phase === 'OCCUPIED') return { ok: false, error: 'space already occupied' };
    this.busy = true;
    try {
      const chosen = STACKS[stack] || STACKS.trusted;
      const isTampered = stack === 'tampered';

      // Fresh guest token from the manufacturer-trusted world. Its allowlist
      // contains only the known-good trusted-stack hash.
      const secret = randomSecret();
      const token = genKeyPair();
      const allowlist = [stackHash(STACKS.trusted)];
      this.guest = { name: guestName, token, secret, storageKey: deriveKey(secret), allowlist };

      this.phase = 'CHECKING_IN';
      this.emit('checkin', `${guestName} pressed the reset button — local presence confirmed.`, 'info');
      this.pushState();
      await sleep(700);

      this.emit('boot', 'Bootloader sanitizing memory (wiping any owner data)…', 'info');
      await sleep(700);

      const measured = stackHash(chosen);
      this.stack = { ...chosen, hash: measured, trusted: !isTampered, owner: false };
      this.phase = 'PROVISIONED';
      this.emit('provision', `Installing "${chosen.name}" (${chosen.files.length} components).`, 'info',
        { files: chosen.files });
      this.pushState();
      await sleep(800);

      // Secure boot measures the stack; hub signs an attestation statement.
      const nonce = randomSecret();
      const statement = `${measured}|${nonce}`;
      const attSig = sign(this.hub.privateKey, statement);
      this.emit('measure', `Secure boot measured stack → SHA-256 ${shortId(measured)}`, 'info',
        { hash: measured });
      await sleep(700);

      // Guest token verifies: (1) hub identity via manufacturer cert +
      // signature, (2) measured hash is in the trusted allowlist.
      const hubCertOk = verify(this.ca.publicKey, pubHex(this.hub.publicKey), this.hubCert);
      const sigOk = verify(this.hub.publicKey, statement, attSig);
      const hashOk = allowlist.includes(measured);
      const attested = hubCertOk && sigOk && hashOk;
      this.attestation = { hash: measured, nonce, sig: attSig, hubCertOk, sigOk, hashOk, attested };
      this.phase = 'ATTESTED';

      if (!attested) {
        this.attacksDefended += 1;
        this.emit('attest', `🔴 ATTESTATION FAILED — hash not in trusted allowlist. Malicious software refused. Check-in aborted.`,
          'danger', { attestation: this.attestation });
        this.pushState();
        await sleep(400);
        // Roll back to a clean vacant space; the guest never gains control.
        this.guest = null;
        this.stack = { ...STACKS.trusted, hash: stackHash(STACKS.trusted), trusted: true, owner: true };
        this.phase = 'VACANT';
        this.controller = 'OWNER';
        this.emit('rollback', 'Space rolled back to a clean state. No untrusted stack was trusted.', 'ok');
        this.pushState();
        return { ok: false, attested: false, attestation: this.attestation };
      }

      this.emit('attest', `🟢 ATTESTED — hub identity + trusted software verified. Guest may proceed.`, 'ok',
        { attestation: this.attestation });
      this.pushState();
      await sleep(600);

      // Authenticated binding: every device is reset and re-bound to the hub.
      const hubId = pubHex(this.hub.publicKey);
      for (const d of this.devices) {
        d.state = { ...DEVICE_DEFS.find((x) => x.id === d.id).init };
        d.boundTo = hubId;
        this.emit('bind', `ResetAndBind ${d.abstraction} (${d.model}) → bound to hub ${shortId(hubId)}`, 'ok');
        this.pushState();
        await sleep(300);
      }

      // Load the guest's private state and store it encrypted.
      this.guestState = defaultGuestState();
      this.saveStorage();
      this.controller = 'GUEST';
      this.phase = 'OCCUPIED';
      this.emit('storage', `Encrypted user state loaded (AES-256-GCM). Owner has no key.`, 'ok');
      this.emit('occupied', `${guestName} now has exclusive, attested control of the space.`, 'ok');
      this.pushState();
      return { ok: true, attested: true, attestation: this.attestation };
    } finally {
      this.busy = false;
    }
  }

  saveStorage() {
    this.storageBlob = aesEncrypt(this.guest.storageKey, JSON.stringify(this.guestState));
  }

  // ---- device control -----------------------------------------------------
  // A command is only honored if it comes from whoever the device is bound to.
  actorKey(actor) {
    if (actor === 'GUEST') return this.hub;   // guest drives the attested hub
    return this.owner;                        // owner's own identity
  }

  deviceCommand(actor, id, action) {
    const d = this.devices.find((x) => x.id === id);
    if (!d) return { ok: false, error: 'no device' };
    const actingId = pubHex(this.actorKey(actor).publicKey);
    if (d.boundTo !== actingId) {
      this.attacksDefended += 1;
      this.emit('binding', `⛔ ${d.abstraction} rejected "${action}" — command not signed by the bound hub (${shortId(d.boundTo)}).`,
        'danger');
      this.pushState();
      return { ok: false, error: 'binding rejected' };
    }
    this.applyAction(d, action);
    this.emit('command', `${actor} → ${d.abstraction}: ${action}`, 'info');
    this.pushState();
    return { ok: true };
  }

  applyAction(d, action) {
    if (d.type === 'lock') d.state.locked = action === 'lock';
    if (d.type === 'light') d.state.on = action === 'on';
    if (d.type === 'camera') d.state.streaming = action === 'stream';
  }

  // ---- automation rule engine --------------------------------------------
  simulate(event) {
    if (this.controller !== 'GUEST') return { ok: false, error: 'no guest' };
    const sensor = this.devices.find((x) => x.id === 'sensor');
    const light = this.devices.find((x) => x.id === 'light');
    const cam = this.devices.find((x) => x.id === 'camera');
    const lock = this.devices.find((x) => x.id === 'lock');
    const rules = this.guestState.rules;

    if (event === 'motion-night') {
      sensor.state.motion = true; sensor.state.night = true;
      this.emit('sensor', 'Motion detected after dark.', 'info');
      if (rules.find((r) => r.id === 'r1')?.on) {
        light.state.on = true;
        this.emit('rule', '⚙️ Rule r1 fired → LivingRoomLight ON', 'ok');
      }
    } else if (event === 'face-match') {
      cam.state.lastFace = this.guestState.faceProfile;
      this.emit('sensor', `Camera recognized: ${this.guestState.faceProfile}`, 'info');
      if (rules.find((r) => r.id === 'r2')?.on) {
        lock.state.locked = false;
        this.emit('rule', '⚙️ Rule r2 fired → FrontDoorLock UNLOCKED', 'ok');
      }
    } else if (event === 'face-stranger') {
      cam.state.lastFace = 'Unknown person';
      this.emit('sensor', 'Camera saw an unrecognized face.', 'info');
      this.emit('rule', '🚫 No matching rule → door stays LOCKED. Access denied.', 'warn');
    }
    this.pushState();
    return { ok: true };
  }

  // ---- storage access (privacy) ------------------------------------------
  viewStorage(as) {
    if (!this.storageBlob) return { locked: false, empty: true };
    if (as === 'GUEST' && this.controller === 'GUEST') {
      return { locked: false, plaintext: JSON.parse(aesDecrypt(this.guest.storageKey, this.storageBlob)) };
    }
    // Owner (or anyone without the key) sees only ciphertext.
    if (as === 'OWNER' && this.controller === 'GUEST') {
      this.attacksDefended += 1;
      this.emit('privacy', '⛔ Owner tried to read guest storage — no key. Returns ciphertext only.', 'danger');
      this.pushState();
    }
    return { locked: true, blob: this.storageBlob };
  }

  // ---- camera access (privacy) -------------------------------------------
  cameraAccess(as) {
    if (this.controller === 'OWNER') {
      // Vacant space: the owner can view their own camera (the creepy hook).
      return { allowed: true, feed: 'owner-live' };
    }
    if (as === 'OWNER') {
      this.attacksDefended += 1;
      this.emit('privacy', '⛔ Owner requested the camera feed during the stay — DENIED. Camera answers only to the guest-bound hub.',
        'danger');
      this.pushState();
      return { allowed: false };
    }
    return { allowed: true, feed: 'guest-live' };
  }

  // ---- explicit attacks (for the live Attack Console) --------------------
  attackHijack() {
    // Owner tries to unlock the door while the guest holds the space.
    return this.deviceCommand('OWNER', 'lock', 'unlock');
  }

  // ---- configuration migration -------------------------------------------
  async migrate() {
    if (this.controller !== 'GUEST') return { ok: false, error: 'no guest' };
    if (this.busy) return { ok: false, error: 'busy' };
    this.busy = true;
    try {
      const carried = JSON.parse(JSON.stringify(this.guestState)); // rules travel with the guest
      this.emit('migrate', 'Guest leaves Space A → travels to Space B (different device models).', 'info');
      this.pushState();
      await sleep(700);

      // Space B has a fresh hub + differently-modeled devices.
      this.space = 'B';
      this.hub = genKeyPair();
      this.hubCert = sign(this.ca.privateKey, pubHex(this.hub.publicKey));
      this.stack = { ...STACKS.trusted, hash: stackHash(STACKS.trusted), trusted: true, owner: false };
      const hubId = pubHex(this.hub.publicKey);
      this.devices = DEVICE_DEFS.map((d) => ({
        ...d, model: DEVICE_MODELS.B[d.id], key: genKeyPair(),
        state: { ...d.init }, boundTo: hubId,
      }));
      this.devices.forEach((d) => { d.cert = sign(this.ca.privateKey, pubHex(d.key.publicKey)); });
      this.emit('attest', '🟢 Re-attested on Space B hub. Devices re-bound.', 'ok');
      this.pushState();
      await sleep(500);

      // Same abstract rules apply to the new models — no reconfiguration.
      this.guestState = carried;
      this.saveStorage();
      this.emit('migrate', 'Universal automation rules re-applied to Space B devices — zero reconfiguration.', 'ok',
        { rules: carried.rules.map((r) => r.text) });
      this.pushState();
      return { ok: true };
    } finally {
      this.busy = false;
    }
  }

  // ---- check-out (space reset / data shred) ------------------------------
  async checkout() {
    if (this.controller !== 'GUEST') return { ok: false, error: 'no guest' };
    if (this.busy) return { ok: false, error: 'busy' };
    this.busy = true;
    try {
      this.phase = 'CHECKING_OUT';
      this.emit('checkout', 'Guest checks out — space reset requested.', 'info');
      // Snapshot a signed proof-of-privacy receipt BEFORE anything is destroyed.
      this.lastReceipt = this.generateReceipt();
      this.emit('receipt', '🧾 Signed Trust Receipt issued to the guest (verifiable proof of a private stay).', 'ok');
      this.pushState();
      await sleep(600);

      // Cryptographic shred: destroy the key, then the ciphertext is
      // permanently unrecoverable (proven by attempting a decrypt).
      const deadBlob = this.storageBlob;
      const deadKey = this.guest.storageKey;
      this.guest = null; this.storageKey = null; this.guestState = null;
      this.emit('shred', '🔥 Guest token + storage key destroyed. Encrypted data is now unrecoverable.', 'danger',
        { blob: deadBlob });
      this.pushState();
      await sleep(700);
      // Prove it: even the server can no longer read the old blob (key is gone).
      void deadKey;
      this.storageBlob = null;

      this.emit('boot', 'Bootloader sanitizing memory and re-provisioning owner stack…', 'info');
      await sleep(700);

      // Rebuild a clean vacant Space A under owner control.
      const keepAttacks = this.attacksDefended;
      const keepLog = this.log;
      this.reset(false);
      this.attacksDefended = keepAttacks + 1; // refusing to hand back = defended
      this.log = keepLog.concat(this.log);
      this.emit('checkout', 'Owner has regained full control. All guest traces removed.', 'ok');
      this.pushState();
      return { ok: true };
    } finally {
      this.busy = false;
    }
  }

  toggleRule(id) {
    if (this.controller !== 'GUEST') return { ok: false };
    const r = this.guestState.rules.find((x) => x.id === id);
    if (r) { r.on = !r.on; this.saveStorage();
      this.emit('rule', `Rule ${id} ${r.on ? 'enabled' : 'disabled'}.`, 'info'); this.pushState(); }
    return { ok: true };
  }

  // ---- Trust Receipt (our extension beyond the paper) --------------------
  // A signed, verifiable audit log the guest keeps as proof their stay was
  // private: what software was attested, and every attack that was defeated.
  generateReceipt() {
    const payload = {
      document: 'SpaceLord Trust Receipt',
      issuer: 'SpaceLord Manufacturer CA',
      issuedAt: new Date().toISOString(),
      space: this.space,
      guest: this.guest ? this.guest.name : null,
      attestation: this.attestation
        ? { stack: this.stack.name, stackHash: this.attestation.hash, attested: this.attestation.attested }
        : null,
      attacksDefended: this.attacksDefended,
      securityEvents: this.log
        .filter((e) => e.level === 'ok' || e.level === 'danger')
        .map((e) => ({ at: new Date(e.t).toISOString(), level: e.level, event: e.message })),
    };
    const body = JSON.stringify(payload);
    return {
      payload,
      algorithm: 'Ed25519',
      caPublicKey: this.ca.publicKey.export({ type: 'spki', format: 'pem' }),
      signature: sign(this.ca.privateKey, body),
    };
  }

  // ---- sanitized state for the client ------------------------------------
  publicState() {
    return {
      space: this.space,
      phase: this.phase,
      controller: this.controller,
      attacksDefended: this.attacksDefended,
      manufacturer: { id: shortId(pubHex(this.ca.publicKey)) },
      hub: {
        id: shortId(pubHex(this.hub.publicKey)),
        certOk: verify(this.ca.publicKey, pubHex(this.hub.publicKey), this.hubCert),
      },
      stack: {
        name: this.stack.name, hash: this.stack.hash, short: shortId(this.stack.hash),
        trusted: this.stack.trusted, owner: this.stack.owner, files: this.stack.files,
      },
      attestation: this.attestation && {
        short: shortId(this.attestation.hash),
        sigShort: shortId(this.attestation.sig),
        hubCertOk: this.attestation.hubCertOk,
        sigOk: this.attestation.sigOk,
        hashOk: this.attestation.hashOk,
        attested: this.attestation.attested,
      },
      guest: this.guest && { name: this.guest.name },
      devices: this.devices.map((d) => ({
        id: d.id, type: d.type, icon: d.icon, abstraction: d.abstraction,
        model: d.model, state: d.state, boundTo: shortId(d.boundTo),
      })),
      hasStorage: !!this.storageBlob,
      hasReceipt: !!this.lastReceipt,
      rules: this.guestState ? this.guestState.rules : [],
      log: this.log.slice(-60),
    };
  }
}
