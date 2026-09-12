import React, { useState } from 'react';
import { api } from '../api.js';
import { useSpace, go } from '../lib/useSpace.js';
import { Icon, Logo } from '../icons.jsx';
import { TrustCard, DeviceTile, RevealModal } from '../components.jsx';

export default function GuestPortal() {
  const { s, connected } = useSpace();
  const [reveal, setReveal] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!s) return <div className="loading"><span className="spin" /> Connecting…</div>;

  const guest = s.controller === 'GUEST';
  const attested = s.stack && s.stack.trusted && guest;
  async function run(fn) { setBusy(true); try { await fn(); } finally { setBusy(false); } }

  return (
    <div className="portal">
      <PortalNav label="Your stay" sub={`Space ${s.space}`} connected={connected} />

      <div className="portal-body narrow">
        {/* Arrival / attestation hero */}
        <div className={'arrival ' + (attested ? 'ok' : '')}>
          <span className="arrival-ic">{attested ? <Icon.shieldCheck size={40} /> : <Icon.shield size={40} />}</span>
          <div className="arrival-txt">
            <div className="arrival-h">{attested ? 'This space is verified private' : guest ? 'Provisioning your space…' : 'Welcome — verify this space'}</div>
            <div className="arrival-d">
              {attested ? 'Your trusted software is attested and running. The host cannot access your data or devices.'
                : 'Check in to reset the hub, install your trusted stack, and prove it’s private before you rely on it.'}
            </div>
            {attested && <button className="link" onClick={() => setReveal({ title: 'Attestation record', kind: 'attest', data: s.attestation })}>View attestation record →</button>}
          </div>
          {!guest && <button className="cta" disabled={busy} onClick={() => run(() => api.checkin('trusted'))}>{busy ? 'Checking in…' : 'Check in'}</button>}
          {guest && <button className="cta ghost" disabled={busy} onClick={() => run(api.checkout)}>Check out</button>}
        </div>

        {guest && (<>
          <Section title="Your devices">
            <div className="devices">
              {s.devices.map((d) => (
                <DeviceTile key={d.id} d={d} canControl
                  onToggle={(a) => api.device(d.id, a)}
                  onCamera={() => api.camera('GUEST').then((r) => setReveal({ title: 'Camera feed', kind: 'camera', data: { ...r, as: 'GUEST' } }))} />
              ))}
            </div>
          </Section>

          <Section title="Automation rules" sub="Travel with you to any SpaceLord space">
            <div className="rules">
              {s.rules.map((r) => (
                <label key={r.id} className={'rule ' + (r.on ? 'on' : '')}>
                  <input type="checkbox" checked={r.on} onChange={() => api.toggleRule(r.id)} /><span>{r.text}</span>
                </label>
              ))}
            </div>
            <div className="row-btns">
              <button className="mini" onClick={() => api.simulate('motion-night')}><Icon.moon size={14} /> Motion after dark</button>
              <button className="mini" onClick={() => api.simulate('face-match')}><Icon.face size={14} /> Camera sees me</button>
            </div>
          </Section>

          {/* Consent: tenant controls host access */}
          <Section title="Host access permissions" sub="The host is locked out unless you allow it">
            <ConsentRow icon={Icon.eye} label="Camera feed" scope="camera" granted={s.consent.camera} />
            <ConsentRow icon={Icon.database} label="Private data" scope="storage" granted={s.consent.storage} />
            <p className="consent-note">Grants are scoped, logged in the ledger, and revocable at any time.</p>
          </Section>

          <Section title="Your private data">
            <div className="privacy-row">
              <div><div className="pr-h"><Icon.database size={15} /> Encrypted storage</div>
                <div className="pr-d">AES-256-GCM · the host has no key</div></div>
              <button className="mini good" onClick={() => api.storage('GUEST').then((d) => setReveal({ title: 'Your data (decrypted)', kind: 'storage', data: d }))}>
                <Icon.eye size={14} /> View my data</button>
            </div>
          </Section>
        </>)}

        {(guest || s.hasReceipt) && (
          <button className="wide-btn" onClick={() => api.receipt().then((r) => setReveal({ title: 'Trust Receipt', kind: 'receipt', data: r }))}>
            <Icon.receipt size={16} /> {guest ? 'Preview my Trust Receipt' : 'Download my Trust Receipt'}</button>
        )}
      </div>

      {reveal && <RevealModal reveal={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

function ConsentRow({ icon: I, label, scope, granted }) {
  return (
    <div className="consent-row">
      <div className="cr-left"><span className="cr-ic"><I size={16} /></span>{label}</div>
      <div className="cr-right">
        <span className={'cr-state ' + (granted ? 'on' : '')}>{granted ? 'Host allowed' : 'Locked'}</span>
        <button className={'toggle ' + (granted ? 'on' : '')} onClick={() => api.consent(scope, !granted)}>
          <span className="knob" /></button>
      </div>
    </div>
  );
}

export function PortalNav({ label, sub, connected }) {
  return (
    <header className="pnav">
      <button className="brand" onClick={() => go('#/')}>
        <Logo size={30} />
        <div><div className="title">SpaceLord</div><div className="sub">{label}</div></div>
      </button>
      <div className="pnav-right">
        <span className="pnav-sub">{sub}</span>
        <span className={'conn ' + (connected ? 'up' : 'down')} title={connected ? 'Live' : 'Reconnecting'} />
      </div>
    </header>
  );
}

export function Section({ title, sub, children }) {
  return (
    <section className="psec">
      <div className="psec-head"><span className="psec-t">{title}</span>{sub && <span className="psec-s">{sub}</span>}</div>
      {children}
    </section>
  );
}
