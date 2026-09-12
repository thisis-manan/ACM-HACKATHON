import React, { useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api.js';
import { useSpace, go } from '../lib/useSpace.js';
import { Icon, Logo } from '../icons.jsx';
import { RevealModal } from '../components.jsx';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Presenter() {
  const { s, connected } = useSpace();
  const [caption, setCaption] = useState(null);
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState(null); // last host access result
  const [reveal, setReveal] = useState(null);
  const [stop, setStop] = useState(false);

  if (!s) return <div className="loading"><span className="spin" /> Connecting…</div>;
  const guest = s.controller === 'GUEST';
  const occupied = s.phase === 'OCCUPIED';

  async function hostTry(kind) {
    if (kind === 'storage') { const d = await api.storage('OWNER'); setProbe(d.locked ? { deny: 'Guest data → ciphertext only' } : { allow: 'Guest data read (tenant consented)' }); }
    if (kind === 'camera') { const d = await api.camera('OWNER'); setProbe(d.allowed ? { allow: 'Camera feed (tenant consented)' } : { deny: 'Camera feed → access denied' }); }
    if (kind === 'hijack') { await api.hijack(); setProbe({ deny: 'Door unlock → rejected (binding)' }); }
  }

  async function autoDemo() {
    setStop(false); setBusy(true); setProbe(null);
    const steps = [
      ['Vacant space under host control', api.factoryReset, 1100],
      ['A malicious host tries to boot tampered software…', () => api.checkin('tampered'), 900],
      ['Rejected. The guest checks in with their trusted stack', () => api.checkin('trusted'), 900],
      ['Guest automation — motion after dark turns on the light', () => api.simulate('motion-night'), 1200],
      ['Guest automation — the guest’s face unlocks the door', () => api.simulate('face-match'), 1300],
      ['Host tries to read the guest’s data → ciphertext only', () => hostTry('storage'), 1500],
      ['Host tries to open the camera → denied', () => hostTry('camera'), 1500],
      ['Host tries to hijack the lock → rejected', () => hostTry('hijack'), 1500],
      ['Tenant GRANTS the host scoped camera access', () => api.consent('camera', true), 1300],
      ['Now the host can view the camera — but it’s logged', () => hostTry('camera'), 1600],
      ['Tenant REVOKES access — host is locked out again', () => api.consent('camera', false), 1300],
      ['Host tries the camera again → denied', () => hostTry('camera'), 1500],
      ['Guest settings migrate to a different space', api.migrate, 900],
      ['Check-out — data shredded, signed receipt appended to ledger', api.checkout, 1200],
      ['Every attack defeated. Privacy proven & certified.', () => Promise.resolve(), 100],
    ];
    for (const [cap, fn, wait] of steps) { if (stop) break; setCaption(cap); try { await fn(); } catch {} await sleep(wait); }
    setCaption(null); setBusy(false);
  }

  async function showQR() {
    const { ip, clientPort } = await api.netinfo();
    const url = `http://${ip}:${clientPort}/#/guest`;
    const img = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#222222', light: '#ffffff' } });
    setReveal({ title: 'Open tenant portal on phone', kind: 'qr', data: { url, img } });
  }

  return (
    <div className="presenter">
      <header className="pnav">
        <button className="brand" onClick={() => go('#/')}><Logo size={30} />
          <div><div className="title">SpaceLord</div><div className="sub">Presenter mode</div></div></button>
        <div className="pnav-right">
          <span className="chip metric"><b>{s.attacksDefended}</b> blocked</span>
          <span className={'conn ' + (connected ? 'up' : 'down')} />
        </div>
      </header>

      {caption && <div className="demobar"><span className="demodot" /> {caption}</div>}

      {/* controls */}
      <div className="pctl">
        {caption
          ? <button className="btn warn" onClick={() => setStop(true)}><span className="bi"><Icon.x size={16} /></span><span className="bt">Stop</span></button>
          : <button className="btn primary" disabled={busy} onClick={autoDemo}><span className="bi"><Icon.play size={16} /></span><span className="bt">Play auto-demo</span></button>}
        <button className="btn" disabled={busy || occupied} onClick={() => api.checkin('tampered')}>Tampered check-in</button>
        <button className="btn" disabled={busy || occupied} onClick={() => api.checkin('trusted')}>Trusted check-in</button>
        <button className="btn" disabled={busy || !guest} onClick={api.migrate}>Migrate</button>
        <button className="btn" disabled={busy || !guest} onClick={api.checkout}>Check-out</button>
        <button className="btn" disabled={busy} onClick={api.factoryReset}>Reset</button>
        <button className="btn" onClick={showQR}><span className="bi"><Icon.phone size={16} /></span><span className="bt">Phone QR</span></button>
      </div>

      {/* two-party proof */}
      <div className="split">
        <div className="side host">
          <div className="side-h"><Icon.building size={16} /> Host view</div>
          <Line k="Control" v={guest ? 'Guest holds the space' : 'You control the space'} bad={guest} />
          <Line k="Guest data" v={s.consent.storage ? 'Readable (consented)' : occupied ? 'Ciphertext only' : '—'} bad={occupied && !s.consent.storage} />
          <Line k="Camera" v={s.consent.camera ? 'Allowed (consented)' : occupied ? 'Denied' : '—'} bad={occupied && !s.consent.camera} />
          <div className="side-try">
            <button className="mini bad" disabled={!occupied} onClick={() => hostTry('storage')}>Try read data</button>
            <button className="mini bad" disabled={!occupied} onClick={() => hostTry('camera')}>Try camera</button>
            <button className="mini bad" disabled={!occupied} onClick={() => hostTry('hijack')}>Try door</button>
          </div>
          {probe && <div className={'probe ' + (probe.deny ? 'deny' : 'allow')}>{probe.deny || probe.allow}</div>}
        </div>

        <div className="side guest">
          <div className="side-h"><Icon.users size={16} /> Guest view</div>
          <Line k="Attestation" v={s.stack.trusted && guest ? 'Verified private' : guest ? 'Provisioning' : 'Not checked in'} good={s.stack.trusted && guest} />
          <Line k="My data" v={occupied ? 'Encrypted, only I hold the key' : '—'} good={occupied} />
          <Line k="Devices" v={guest ? 'Under my control' : '—'} good={guest} />
          <div className="side-try">
            <button className={'mini ' + (s.consent.camera ? 'warn' : '')} disabled={!guest} onClick={() => api.consent('camera', !s.consent.camera)}>
              {s.consent.camera ? 'Revoke camera' : 'Grant camera'}</button>
            <button className={'mini ' + (s.consent.storage ? 'warn' : '')} disabled={!guest} onClick={() => api.consent('storage', !s.consent.storage)}>
              {s.consent.storage ? 'Revoke data' : 'Grant data'}</button>
          </div>
        </div>
      </div>
      {reveal && <RevealModal reveal={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

function Line({ k, v, good, bad }) {
  return <div className="pline"><span>{k}</span><b className={good ? 'good' : bad ? 'bad' : ''}>{v}</b></div>;
}
