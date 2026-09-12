import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api, WS } from './api.js';
import { Icon, DeviceIcon } from './icons.jsx';

const PHASE_LABEL = {
  VACANT: 'Vacant', CHECKING_IN: 'Checking in', PROVISIONED: 'Provisioning',
  ATTESTED: 'Attesting', BOUND: 'Binding devices', OCCUPIED: 'Occupied', CHECKING_OUT: 'Checking out',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Shared live-state hook.
function useSpace() {
  const [s, setS] = useState(null);
  const [connected, setConnected] = useState(false);
  const cbRef = useRef(() => {});
  useEffect(() => {
    let ws;
    const connect = () => {
      ws = new WebSocket(WS);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.state) setS(msg.state);
        if (msg.type === 'event') cbRef.current(msg.entry);
      };
      ws.onclose = () => { setConnected(false); setTimeout(connect, 1000); };
    };
    connect();
    api.state().then(setS);
    return () => ws && ws.close();
  }, []);
  return { s, connected, onEvent: (fn) => (cbRef.current = fn) };
}

export default function App() {
  const isToken = new URLSearchParams(location.search).get('view') === 'token';
  return isToken ? <TokenView /> : <Console />;
}

/* ============================ MAIN CONSOLE ============================ */
function Console() {
  const { s, connected, onEvent } = useSpace();
  const [toast, setToast] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(null); // auto-demo caption or null
  const logRef = useRef(null);
  const stopRef = useRef(false);

  useEffect(() => onEvent((entry) => {
    setToast(entry);
    clearTimeout(setToast._t);
    setToast._t = setTimeout(() => setToast(null), 2500);
  }), []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [s?.log?.length]);

  async function run(fn) { setBusy(true); try { await fn(); } finally { setBusy(false); } }

  async function autoDemo() {
    stopRef.current = false;
    setBusy(true);
    const steps = [
      ['Resetting to a vacant, owner-controlled space', api.factoryReset, 1200],
      ['A malicious host tries to boot tampered software…', () => api.checkin('tampered'), 900],
      ['Attestation rejected it. The guest checks in for real.', () => api.checkin('trusted'), 900],
      ['Guest automation — motion after dark turns on the light', () => api.simulate('motion-night'), 1300],
      ['Guest automation — the guest’s face unlocks the door', () => api.simulate('face-match'), 1500],
      ['Malicious host attack #1 — reading the guest’s private data', () => api.storage('OWNER'), 1500],
      ['Malicious host attack #2 — opening the camera feed', () => api.camera('OWNER'), 1500],
      ['Malicious host attack #3 — hijacking the door lock', api.hijack, 1500],
      ['The guest’s settings migrate to a different space', api.migrate, 900],
      ['Check-out — data shredded, signed Trust Receipt issued', api.checkout, 1000],
      ['Demo complete — every attack defeated, privacy proven', () => Promise.resolve(), 100],
    ];
    for (const [caption, fn, wait] of steps) {
      if (stopRef.current) break;
      setDemo(caption);
      try { await fn(); } catch {}
      await sleep(wait);
    }
    setDemo(null);
    setBusy(false);
  }
  function stopDemo() { stopRef.current = true; }

  async function showQR() {
    const { ip, clientPort } = await api.netinfo();
    const url = `http://${ip}:${clientPort}/?view=token`;
    const img = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#222222', light: '#ffffff' } });
    setReveal({ title: 'Check in from your phone', kind: 'qr', data: { url, img } });
  }

  if (!s) return <div className="loading"><span className="spin" /> Connecting to SpaceLord…</div>;
  const isGuest = s.controller === 'GUEST';
  const occupied = s.phase === 'OCCUPIED';

  return (
    <div className="app">
      <TopBar s={s} connected={connected} />

      <div className="grid">
        <aside className="rail">
          <Panel n="00" title="Present">
            {demo
              ? <Btn icon={Icon.x} kind="warn" onClick={stopDemo}>Stop auto-demo</Btn>
              : <Btn icon={Icon.play} kind="primary" disabled={busy} onClick={autoDemo}>Play auto-demo</Btn>}
            <Btn icon={Icon.phone} disabled={busy} onClick={showQR}>Check in from phone</Btn>
            <Btn icon={Icon.receipt} disabled={!occupied && !s.hasReceipt}
              onClick={() => api.receipt().then((r) => setReveal({ title: 'Trust Receipt', kind: 'receipt', data: r }))}>
              Trust Receipt</Btn>
          </Panel>

          <Panel n="01" title="Lifecycle">
            <Btn icon={Icon.key} kind="primary" disabled={busy || occupied}
              onClick={() => run(() => api.checkin('trusted'))}>Guest check-in</Btn>
            <Btn icon={Icon.bug} kind="danger" disabled={busy || occupied}
              onClick={() => run(() => api.checkin('tampered'))}>Boot tampered stack</Btn>
            <Btn icon={Icon.suitcase} disabled={busy || !isGuest} onClick={() => run(api.migrate)}>Migrate to Space B</Btn>
            <Btn icon={Icon.logout} kind="warn" disabled={busy || !isGuest} onClick={() => run(api.checkout)}>Check-out</Btn>
            <Btn icon={Icon.refresh} kind="ghost" disabled={busy} onClick={() => run(api.factoryReset)}>Reset demo</Btn>
          </Panel>

          <Panel n="02" title="Automation" dim={!isGuest}>
            <Btn icon={Icon.moon} disabled={!isGuest} onClick={() => api.simulate('motion-night')}>Motion after dark</Btn>
            <Btn icon={Icon.face} disabled={!isGuest} onClick={() => api.simulate('face-match')}>Camera sees guest</Btn>
            <Btn icon={Icon.faceOff} disabled={!isGuest} onClick={() => api.simulate('face-stranger')}>Camera sees stranger</Btn>
            <div className="rules">
              {s.rules.map((r) => (
                <label key={r.id} className={'rule ' + (r.on ? 'on' : '')}>
                  <input type="checkbox" checked={r.on} disabled={!isGuest} onChange={() => api.toggleRule(r.id)} />
                  <span>{r.text}</span>
                </label>
              ))}
            </div>
          </Panel>

          <Panel n="03" title="Attack Console" danger>
            <Btn icon={Icon.database} kind="danger" disabled={!occupied}
              onClick={() => api.storage('OWNER').then((d) => setReveal({ title: 'Owner reads guest storage', kind: 'cipher', data: d }))}>Read guest data</Btn>
            <Btn icon={Icon.eye} kind="danger" disabled={!occupied}
              onClick={() => api.camera('OWNER').then((d) => setReveal({ title: 'Owner opens the camera', kind: 'camera', data: { ...d, as: 'OWNER' } }))}>Open camera feed</Btn>
            <Btn icon={Icon.unlock} kind="danger" disabled={!occupied} onClick={() => api.hijack()}>Hijack the door lock</Btn>
          </Panel>
        </aside>

        <main className="center">
          {demo && <div className="demobar"><span className="demodot" /> {demo}</div>}
          <TrustCard s={s} onShowAttest={() => setReveal({ title: 'Attestation record', kind: 'attest', data: s.attestation })} />
          <div className="devices">
            {s.devices.map((d) => (
              <DeviceTile key={d.id} d={d} isGuest={isGuest}
                onCamera={() => api.camera(isGuest ? 'GUEST' : 'OWNER').then((r) =>
                  setReveal({ title: 'Camera feed', kind: 'camera', data: { ...r, as: s.controller } }))}
                onToggle={(action) => api.device(d.id, action)} />
            ))}
          </div>
          <StoragePanel s={s} onView={(as) =>
            api.storage(as).then((d) => setReveal({ title: `Storage viewed as ${as}`, kind: 'storage', data: { ...d, as } }))} />
        </main>

        <section className="logcol">
          <div className="loghead"><Icon.activity size={15} /> Security event log</div>
          <div className="log" ref={logRef}>
            {s.log.map((e, i) => <div key={i} className={'logline ' + e.level}>{e.message}</div>)}
          </div>
        </section>
      </div>

      {toast && <div className={'toast ' + toast.level}>{toast.message}</div>}
      {reveal && <RevealModal reveal={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

/* ============================ PHONE TOKEN VIEW ============================ */
function TokenView() {
  const { s, connected } = useSpace();
  const [busy, setBusy] = useState(false);
  if (!s) return <div className="loading"><span className="spin" /> Connecting…</div>;
  const guest = s.controller === 'GUEST';
  const attested = s.stack && s.stack.trusted && guest;
  return (
    <div className="token">
      <div className="token-brand"><span className="logo"><Icon.shield size={20} /></span> SpaceLord</div>
      <div className="token-sub">Guest Token · Space {s.space}</div>

      <div className={'token-card ' + (attested ? 'ok' : guest ? '' : 'idle')}>
        <div className="token-shield">{attested ? <Icon.shieldCheck size={54} /> : <Icon.shield size={54} />}</div>
        <div className="token-status">
          {attested ? 'Space attested & private' : guest ? 'Provisioning…' : 'Space is vacant'}
        </div>
        <div className="token-hint">
          {attested
            ? 'Your software stack is verified. The host cannot access your data or devices.'
            : 'Tap below to reset the hub and provision your trusted stack.'}
        </div>
        {attested && <div className="token-hash">stack · {s.stack.short}</div>}
      </div>

      {!guest && (
        <button className="token-btn" disabled={busy}
          onClick={async () => { setBusy(true); await api.checkin('trusted'); setBusy(false); }}>
          {busy ? 'Checking in…' : 'Check in to this space'}
        </button>
      )}
      {guest && (
        <button className="token-btn ghost" disabled={busy}
          onClick={async () => { setBusy(true); await api.checkout(); setBusy(false); }}>Check out</button>
      )}

      <div className="token-metric"><b>{s.attacksDefended}</b> attacks blocked during your stay</div>
      <div className={'token-conn ' + (connected ? 'up' : '')}>{connected ? 'Live' : 'Reconnecting…'}</div>
    </div>
  );
}

/* ============================ PIECES ============================ */
function TopBar({ s, connected }) {
  const guest = s.controller === 'GUEST';
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo"><Icon.shield size={20} /></span>
        <div>
          <div className="title">SpaceLord</div>
          <div className="sub">Private &amp; secure smart-space sharing</div>
        </div>
      </div>
      <div className="badges">
        <span className="stat"><span className="stat-k">Space</span><span className="stat-v">{s.space}</span></span>
        <span className="sep" />
        <span className="stat"><span className="stat-k">Status</span><span className="stat-v">{PHASE_LABEL[s.phase] || s.phase}</span></span>
        <span className="sep" />
        <span className="stat"><span className="stat-k">Control</span>
          <span className={'stat-v ' + (guest ? 'g' : 'o')}><span className="cdot" />{guest ? (s.guest?.name || 'Guest') : 'Host'}</span></span>
        <span className="sep" />
        <span className="stat"><span className="stat-k">Blocked</span><span className="stat-v">{s.attacksDefended}</span></span>
        <span className={'conn ' + (connected ? 'up' : 'down')} title={connected ? 'Connected' : 'Reconnecting'} />
      </div>
    </header>
  );
}

function TrustCard({ s, onShowAttest }) {
  const trusted = s.stack.trusted;
  const status = s.stack.owner ? 'neutral' : trusted ? 'good' : 'bad';
  return (
    <div className={'trust ' + status}>
      <span className="trust-bar" />
      <div className="trust-main">
        <div className="k">Running software stack</div>
        <div className="v">{s.stack.name}</div>
        <div className="hash">SHA-256 · {s.stack.short}</div>
      </div>
      <div className="trust-side">
        {s.stack.owner ? <span className="pill neutral">Host default</span>
          : trusted ? <span className="pill good"><Icon.check size={15} /> Attested</span>
            : <span className="pill bad"><Icon.x size={15} /> Untrusted</span>}
        <div className="trust-meta">
          <span><Icon.chip size={13} /> CA <b>{s.manufacturer.id}</b></span>
          <span><Icon.shield size={13} /> Hub <b>{s.hub.id}</b></span>
          {s.attestation && <button className="link" onClick={onShowAttest}>Attestation record →</button>}
        </div>
      </div>
    </div>
  );
}

function DeviceTile({ d, isGuest, onToggle, onCamera }) {
  const DIcon = DeviceIcon[d.type] || Icon.chip;
  const active = d.type === 'lock' ? !d.state.locked : d.type === 'light' ? d.state.on
    : d.type === 'camera' ? d.state.streaming : d.state.motion;
  const status = d.type === 'lock' ? (d.state.locked ? 'Locked' : 'Unlocked')
    : d.type === 'light' ? (d.state.on ? 'On' : 'Off')
    : d.type === 'camera' ? (d.state.lastFace ? `Saw: ${d.state.lastFace}` : 'Idle')
    : (d.state.motion ? 'Motion' : 'Clear');
  return (
    <div className={'tile ' + (active ? 'active' : '')}>
      <div className="tile-top">
        <span className="ticon"><DIcon size={19} /></span>
        <div><div className="tabs">{d.abstraction}</div><div className="tmodel">{d.model}</div></div>
      </div>
      <div className="tstatus"><span className={'sdot ' + (active ? 'on' : '')} />{status}</div>
      <div className="tbind">bound → {d.boundTo}</div>
      <div className="tactions">
        {d.type === 'lock' && isGuest && (<>
          <button className="mini" onClick={() => onToggle('unlock')}>Unlock</button>
          <button className="mini" onClick={() => onToggle('lock')}>Lock</button></>)}
        {d.type === 'light' && isGuest && (<>
          <button className="mini" onClick={() => onToggle('on')}>On</button>
          <button className="mini" onClick={() => onToggle('off')}>Off</button></>)}
        {d.type === 'camera' && <button className="mini" onClick={onCamera}>Open feed</button>}
      </div>
    </div>
  );
}

function StoragePanel({ s, onView }) {
  return (
    <div className="storage">
      <div className="storage-head">
        <span className="sh-title"><Icon.database size={16} /> Guest private storage</span>
        <span className="muted">{s.hasStorage ? 'AES-256-GCM encrypted' : 'empty'}</span>
      </div>
      <div className="storage-actions">
        <button className="mini good" disabled={!s.hasStorage} onClick={() => onView('GUEST')}><Icon.eye size={14} /> View as Guest</button>
        <button className="mini bad" disabled={!s.hasStorage} onClick={() => onView('OWNER')}><Icon.eyeOff size={14} /> View as Host</button>
      </div>
    </div>
  );
}

function RevealModal({ reveal, onClose }) {
  const { kind, data, title } = reveal;
  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'spacelord-trust-receipt.json'; a.click();
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">{title}<button className="x" onClick={onClose}><Icon.x size={16} /></button></div>
        <div className="modal-body">
          {kind === 'storage' && data.plaintext && (
            <div className="ok-box"><div className="ok-title"><Icon.check size={16} /> Decrypted with the guest’s key</div>
              <pre>{JSON.stringify(data.plaintext, null, 2)}</pre></div>)}
          {kind === 'storage' && data.locked && <CipherView blob={data.blob} />}
          {kind === 'cipher' && <CipherView blob={data.blob} />}

          {kind === 'camera' && (data.allowed ? (
            <div className={'ok-box ' + (data.as === 'OWNER' ? 'warnbox' : '')}>
              <div className="ok-title">{data.as === 'OWNER' ? 'Host viewing their own vacant space' : 'Live feed — guest authorized'}</div>
              <div className="camfeed"><span className="rec" /> LIVE · living room</div></div>
          ) : (
            <div className="deny-box"><div className="deny-title"><Icon.x size={18} /> Access denied</div>
              <p>The camera is bound to the guest-controlled hub. The host holds no valid signing
                 key for it during the stay — the feed is unreachable.</p></div>))}

          {kind === 'attest' && data && (
            <div className="attest-box">
              <Row k="Measured stack hash" v={data.short} />
              <Row k="Hub signature" v={data.sigShort} />
              <Check k="Hub certificate valid (manufacturer)" ok={data.hubCertOk} />
              <Check k="Attestation signature valid" ok={data.sigOk} />
              <Check k="Hash in trusted allowlist" ok={data.hashOk} />
              <div className={'verdict ' + (data.attested ? 'good' : 'bad')}>{data.attested ? 'Stack attested' : 'Attestation rejected'}</div>
            </div>)}

          {kind === 'qr' && (
            <div className="qr-box">
              <img src={data.img} alt="QR" className="qr-img" />
              <p>Scan with your phone (same Wi-Fi) to act as the guest token and check in on your own device.</p>
              <code className="qr-url">{data.url}</code>
            </div>)}

          {kind === 'receipt' && (data.payload ? (
            <div className="receipt">
              <div className="ok-title"><Icon.receipt size={16} /> Signed proof of a private stay</div>
              <div className="rc-grid">
                <div><span>Issuer</span><b>{data.payload.issuer}</b></div>
                <div><span>Issued</span><b>{new Date(data.payload.issuedAt).toLocaleString()}</b></div>
                <div><span>Attested stack</span><b>{data.payload.attestation?.stack || '—'}</b></div>
                <div><span>Attacks defended</span><b>{data.payload.attacksDefended}</b></div>
              </div>
              <div className="rc-events">
                {data.payload.securityEvents.slice(-6).map((e, i) => (
                  <div key={i} className={'rc-ev ' + e.level}>{e.event}</div>))}
              </div>
              <div className="rc-sig"><span>Ed25519 signature</span><code>{data.signature.slice(0, 48)}…</code></div>
              <button className="mini good rc-dl" onClick={download}><Icon.download size={14} /> Download receipt (.json)</button>
            </div>
          ) : <p className="muted">{data.error}</p>)}
        </div>
      </div>
    </div>
  );
}

function CipherView({ blob }) {
  return (
    <div className="deny-box"><div className="deny-title"><Icon.x size={18} /> No key — ciphertext only</div>
      <p>The host holds no key for the guest’s storage. This is the raw AES-256-GCM blob —
         unreadable without the guest’s token.</p>
      <pre className="cipher">iv:  {blob?.iv}
tag: {blob?.tag}
ct:  {blob?.data}</pre></div>
  );
}

const Row = ({ k, v }) => <div className="arow"><span>{k}</span><b className="mono">{v}</b></div>;
const Check = ({ k, ok }) => (
  <div className="arow"><span>{k}</span>
    <b className={ok ? 'good' : 'bad'}>{ok ? <><Icon.check size={14} /> pass</> : <><Icon.x size={14} /> fail</>}</b></div>
);

function Btn({ icon: I, kind = '', children, ...rest }) {
  return <button className={'btn ' + kind} {...rest}><span className="bi">{I && <I size={17} />}</span><span className="bt">{children}</span></button>;
}
function Panel({ n, title, children, danger, dim }) {
  return (
    <div className={'panel ' + (danger ? 'panel-danger ' : '') + (dim ? 'dim' : '')}>
      <div className="panel-head"><span className="ph-title"><span className="pn">{n}</span>{title}</span></div>
      <div className="panel-body">{children}</div>
    </div>
  );
}
