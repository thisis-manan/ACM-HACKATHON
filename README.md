# 🛡️ SpaceLord — Private & Secure Smart Space Sharing

**Paper-to-prototype (PID 12) · Cybersecurity track**
Based on *SpaceLord: Private and Secure Smart Space Sharing* (ACSAC '22 — Bae, Banerjee, Lee, Peinado).

When you rent an Airbnb / hotel room / coworking desk full of smart devices, the **host** still
controls the camera, the lock, and your data. SpaceLord flips that: at **check-in** the space is
cryptographically handed to the **tenant**, and at **check-out** it's reset and returned — with
**real** attestation, encryption, tenant-controlled consent, and a tamper-evident audit ledger.

Everything security-critical uses real cryptography (Node `crypto`): **Ed25519** signatures,
**AES-256-GCM** storage, **SHA-256** measurement. The UI shows the actual hashes and signatures.

---

## ▶️ Run it

```bash
npm run setup     # installs root + server + client (first time only)
npm run dev       # backend :4000  +  UI :5173
```

Open **http://localhost:5173** → you land on a role chooser.

| Route | Who | What |
|---|---|---|
| `#/` | — | Landing / role chooser |
| `#/host` | **Host / Operator** | Property console + **privacy compliance ledger** |
| `#/guest` | **Tenant** | Check in, verify privacy, control devices, **grant/revoke host access** |
| `#/demo` | **Presenter** | Live two-party proof + hands-free auto-demo (all attacks live here) |

The phone QR (Presenter → *Phone QR*) opens `#/guest` on a phone on the same Wi-Fi.

---

## 🧩 The three roles

### Tenant portal (`#/guest`)
- **Attestation on arrival** — "this space is verified private" once the trusted stack is attested.
- Device control + portable **automation rules**.
- **Host access permissions** — Camera / Data toggles. The host is locked out by default; the
  tenant can grant **scoped, logged, revocable** access (e.g. let a plumber see the entry camera).
- **Encrypted storage** — view your own data (decrypted); the host has no key.
- Downloadable **Trust Receipt** at check-out.

### Host / Operator console (`#/host`)
- Property card (occupancy, devices, attestation state).
- **Privacy-by-design panel** — while occupied, guest data/camera render *locked*; the host can
  only view what the tenant explicitly consents to, and every access is recorded.
- **Reclaim space** — forced secure reset (space recoverability, paper G3).
- **Privacy Compliance Ledger (the X factor)** — every stay appends an **Ed25519-signed,
  hash-chained** receipt (`prevHash → entryHash`). Export any receipt as JSON. Optionally
  **anchor the ledger root** to a public chain for third-party notarization (root hash only —
  no private data on-chain; simulated in this prototype).

### Presenter mode (`#/demo`)
- **Live two-party proof** — Host view | Guest view side-by-side on the same live space. Trigger
  the host's access attempts and watch them **denied on the host side while the guest is
  unaffected**; the attacks-blocked counter climbs.
- **Auto-demo** — plays the full story hands-free (tampered-reject → check-in → automation →
  3 blocked attacks → consent grant/revoke → migration → check-out).

---

## 🔐 Security mechanics (all real)

| Primitive | What it enforces | Code |
|---|---|---|
| Ed25519 certs + attestation | Only trusted, measured software is trusted | `engine.js → checkin()` |
| SHA-256 measurement + allowlist | Tampered stack is rejected at check-in | `engine.js → checkin()` |
| Authenticated binding | Devices reject commands not from the bound hub | `engine.js → deviceCommand()` |
| AES-256-GCM storage | Host can't read tenant data (no key) | `engine.js → viewStorage()` |
| Tenant consent | Scoped, revocable, logged host access | `engine.js → setConsent()` |
| Space reset (shred) | Tenant key destroyed → data unrecoverable | `engine.js → checkout()` |
| Signed hash-chained ledger | Tamper-evident compliance audit trail | `engine.js → generateReceipt()` |

---

## 🎬 Demo script (~2.5 min)

1. **Landing** → click **Presenter mode** (`#/demo`).
2. Hit **Play auto-demo** and narrate — it runs the whole story, or drive it manually:
   - **Tampered check-in** → attestation rejects it.
   - **Trusted check-in** → verified private, devices bind.
   - **Try read data / camera / door** (Host view) → denied live; Guest view unaffected.
   - **Grant camera** (Guest view) → host can now view, *but it's logged* → **Revoke** → denied again.
   - **Migrate**, then **Check-out**.
3. Open **`#/host`** → show the **Compliance Ledger** filling up, export a receipt, and
   **Anchor to public chain**.
4. (Optional) Scan the **Phone QR** → check in from a judge's phone.

**Pitch:** *"Trust in a rented smart space, enforced by cryptography instead of terms of service —
the tenant is in control, the host is provably locked out unless the tenant allows it, and every
stay is certified in a tamper-evident ledger."*

---

## 🧱 Structure
```
server/src/crypto-utils.js   Ed25519 / AES-256-GCM / SHA-256 helpers
server/src/engine.js         security state machine (lifecycle, consent, ledger, anchor)
server/src/server.js         REST + WebSocket
client/src/App.jsx           hash router
client/src/routes/           Landing · HostPortal · GuestPortal · Presenter
client/src/components.jsx     shared UI (TrustCard, DeviceTile, RevealModal, …)
client/src/lib/useSpace.js    live WebSocket state hook
```

## 🔗 On blockchain
The ledger is **hash-chained + signed** — blockchain's tamper-evidence without the runtime cost
or a live-demo failure point. There's a natural root of trust (the manufacturer CA), so a signed
local ledger is the right tool. For external verifiability, the **Anchor** button publishes only
the ledger's root hash as a timestamped notarization — the tasteful middle ground.
