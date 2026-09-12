# 🛡️ SpaceLord — Private & Secure Smart Space Sharing

**Paper-to-prototype (PID 12) · Cybersecurity track**
Based on *SpaceLord: Private and Secure Smart Space Sharing* (ACSAC '22, Bae, Banerjee, Lee, Peinado).

When you rent an Airbnb / hotel room / coworking desk full of smart devices, the **owner**
still controls the camera, the lock, and your data. SpaceLord flips that: at **check-in**
the space is cryptographically handed to the **guest**, and at **check-out** it is reset and
returned — with **real** attestation, encryption, and key-destruction enforcing every promise.

This prototype turns the paper's ideas into a live, clickable demo where you can **launch the
attacks a malicious owner would try and watch them get defeated in real time.**

---

## ▶️ Run it

```bash
cd spacelord-prototype
npm run setup     # installs root + server + client (first time only)
npm run dev       # starts backend :4000 and UI :5173
```

Open **http://localhost:5173**. (Backend API/WebSocket runs on `:4000`.)

> Everything is in-memory — hit **↺ Factory reset demo** anytime to start clean.

---

## 🔐 The crypto is real (not simulated)

| Primitive | Library | Where |
|---|---|---|
| Ed25519 signatures (hub/device certs, attestation) | Node `crypto` | `server/src/crypto-utils.js` |
| SHA-256 software-stack measurement | Node `crypto` | `engine.js → stackHash()` |
| AES-256-GCM guest storage | Node `crypto` | `engine.js → saveStorage()/viewStorage()` |
| Manufacturer root CA certifying keys | Ed25519 | `engine.js → reset()` |

The UI shows the **actual** hashes and signatures. The "owner view" of storage is the literal
AES-GCM ciphertext — there is no key on the owner side to read it.

---

## 🎬 Demo script (~2 min) — run the buttons top-to-bottom

1. **The hook (owner controls everything).** Start vacant. Click a camera tile → **Open feed**:
   the owner can watch the room. *"This is your Airbnb today — the host controls the camera."*
2. **Beat 1 · Reject malicious software.** Click **☠️ Attack: boot tampered stack** →
   the trust card flashes 🔴 and check-in is **aborted**. Open the attestation record: the
   measured hash isn't in the trusted allowlist. *"You can't be tricked into trusting bad software."*
3. **Check-in for real.** Click **🔑 Guest check-in (trusted stack)** → watch provisioning →
   🟢 **ATTESTED** → devices re-bind to the guest hub → guest takes control.
4. **Automation.** Click **🌙 motion after dark** (light auto-on) and **🙂 camera sees the guest**
   (door auto-unlocks). Then **❓ stranger** → access denied.
5. **Beat 2 · Owner can't spy.** Open **③ Attack Console**:
   - **🕵️ Owner: read guest data** → unreadable AES ciphertext.
   - **📹 Owner: open camera** → ACCESS DENIED.
   - **🔓 Owner: hijack the door** → rejected (not signed by the bound hub).
   Watch the **attacks-defended** counter climb.
6. **The differentiator.** Click **🧳 Migrate guest → Space B**: the guest's rules re-apply to
   completely different device models with zero reconfiguration.
7. **Beat 3 · Cryptographic shred.** Click **🚪 Check-out** → the guest's key is destroyed, the
   encrypted data becomes permanently unrecoverable, and the owner regains control.

---

## 🗣️ Pitch (consumer hook → B2B close)

> "Every smart Airbnb today asks you to trust the host with the camera, the lock, and your data.
> **SpaceLord** makes the *guest* cryptographically in control for the length of their stay —
> attestation proves the software is trustworthy, your data is encrypted so the host literally
> can't read it, and at check-out it's shredded and the space is handed back. We just showed a
> malicious host try five different attacks and fail every one.
> For hosts and hotel/coworking operators, this is how you offer smart rooms **without the
> privacy liability** — trust enforced by cryptography, not by terms of service."

---

## 🧭 How it maps to the paper

| Paper (§) | Prototype |
|---|---|
| Bare-metal provisioning + secure boot (§4) | `checkin()` installs a chosen stack, measures it with SHA-256 |
| Remote attestation (§4.5) | Hub signs `hash(stack)`; guest token verifies signature + allowlist |
| Authenticated binding (§4.6) | Devices store the bound hub key; reject commands from anyone else |
| Encrypted user storage (§4.4) | AES-256-GCM blob; owner has no key |
| Space reset / recoverability — G3 (§4.7) | `checkout()` shreds the key and re-provisions the owner |
| Configuration migration — G2 (§3.2) | `migrate()` carries abstract rules to Space B's different devices |
| User privacy & security — G1 (§7.1) | Owner attacks on storage/camera/devices all fail live |

## 🗂️ Structure
```
server/src/crypto-utils.js  real Ed25519 / AES-GCM / SHA-256 helpers
server/src/engine.js        the security state machine (all logic + threat model)
server/src/server.js        REST + WebSocket transport
client/src/App.jsx          dashboard, attack console, live log, reveal modals
client/src/styles.css       the look
```
