import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useSpace } from '../lib/useSpace.js';
import { Icon } from '../icons.jsx';
import { RevealModal, downloadJSON } from '../components.jsx';
import { PortalNav, Section } from './GuestPortal.jsx';

export default function HostPortal() {
  const { s, connected, onEvent } = useSpace();
  const [ledger, setLedger] = useState([]);
  const [anchor, setAnchor] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadLedger = () => api.ledger().then((r) => { setLedger(r.entries || []); setAnchor(r.anchor || null); });
  useEffect(() => { loadLedger(); }, []);
  useEffect(() => onEvent((e) => { if (e.kind === 'receipt' || e.kind === 'checkout') loadLedger(); }), []);

  if (!s) return <div className="loading"><span className="spin" /> Connecting…</div>;
  const occupied = s.phase === 'OCCUPIED';
  async function run(fn) { setBusy(true); try { await fn(); } finally { setBusy(false); } }

  return (
    <div className="portal host">
      <PortalNav label="Operator console" sub={`${ledger.length} certified stays`} connected={connected} />

      <div className="portal-body">
        {/* Property header */}
        <div className="property">
          <span className="prop-ic"><Icon.building size={26} /></span>
          <div className="prop-main">
            <div className="prop-h">Cedar Street Loft</div>
            <div className="prop-sub">2118 Cedar St · Space {s.space} · {s.devices.length} smart devices</div>
          </div>
          <div className="prop-status">
            <span className={'occ ' + (occupied ? 'busy' : 'free')}>
              <span className="cdot" />{occupied ? `Occupied · ${s.guest?.name || 'Guest'}` : 'Vacant'}</span>
            <span className="prop-rate">$128 / night</span>
          </div>
        </div>

        <div className="host-grid">
          <div className="host-col">
            {/* Privacy-by-design */}
            <Section title="Guest privacy" sub="Privacy by design">
              {occupied ? (
                <>
                  <PrivacyItem icon={Icon.database} label="Guest data" scope="storage"
                    consent={s.consent.storage} onView={() => api.storage('OWNER').then((d) => setReveal({ title: 'Access guest data', kind: d.locked ? 'cipher' : 'storage', data: d }))} />
                  <PrivacyItem icon={Icon.eye} label="Camera feed" scope="camera"
                    consent={s.consent.camera} onView={() => api.camera('OWNER').then((d) => setReveal({ title: 'Access camera', kind: 'camera', data: { ...d, as: 'OWNER' } }))} />
                  <p className="consent-note">While occupied, the space answers to the guest. You can only view data the tenant explicitly grants — every access is logged.</p>
                </>
              ) : <div className="empty">Space is vacant — no guest data to protect.</div>}
            </Section>

            {/* Devices inventory */}
            <Section title="Device inventory">
              <div className="inv">
                {s.devices.map((d) => (
                  <div key={d.id} className="inv-row">
                    <span className="inv-name">{d.abstraction}</span>
                    <span className="inv-model">{d.model}</span>
                    <span className="inv-bind">bound → {d.boundTo}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Operator actions */}
            <Section title="Space management">
              <div className="row-btns">
                <button className="mini" disabled={busy || occupied} onClick={() => run(api.factoryReset)}><Icon.refresh size={14} /> Provision / reset</button>
                <button className="mini bad" disabled={busy || !occupied} onClick={() => run(api.checkout)}><Icon.logout size={14} /> Reclaim space</button>
              </div>
              <p className="consent-note">Reclaim forces a secure reset (space recoverability): the guest’s keys and data are shredded and control returns to you.</p>
            </Section>
          </div>

          {/* Compliance ledger — the X factor */}
          <div className="host-col">
            <Section title="Privacy compliance ledger" sub="Tamper-evident · signed">
              {ledger.length === 0 ? (
                <div className="empty">No certified stays yet. Complete a check-out to append a signed receipt.</div>
              ) : (
                <div className="ledger">
                  {ledger.map((e, i) => (
                    <div key={i} className="lentry">
                      <div className="le-top">
                        <span className="le-idx">#{i + 1}</span>
                        <span className="le-date">{new Date(e.payload.issuedAt).toLocaleString()}</span>
                        <span className="le-ok"><Icon.check size={13} /> Signed</span>
                      </div>
                      <div className="le-grid">
                        <span>Attested</span><b>{e.payload.attestation?.stack || '—'}</b>
                        <span>Attacks blocked</span><b>{e.payload.attacksDefended}</b>
                        <span>Consent grants</span><b>{e.payload.consentGrants?.length || 0}</b>
                      </div>
                      <div className="le-chain"><Icon.link size={12} /> {e.prevHash.slice(0, 10)}… → {e.entryHash.slice(0, 10)}…</div>
                      <button className="mini" onClick={() => downloadJSON(e, `receipt-${i + 1}.json`)}><Icon.download size={13} /> Export</button>
                    </div>
                  ))}
                  <div className="ledger-foot"><Icon.shieldCheck size={14} /> Each entry is Ed25519-signed and hash-chained to the previous — any edit breaks the chain.</div>
                </div>
              )}
              <div className="anchor-box">
                {anchor ? (
                  <div className="anchor-done">
                    <div className="anchor-h"><Icon.link size={14} /> Ledger root notarized · {anchor.chain}</div>
                    <div className="anchor-line">root <code>{anchor.root.slice(0, 22)}…</code></div>
                    <div className="anchor-line">tx <code>{anchor.txid.slice(0, 24)}…</code> · {new Date(anchor.at).toLocaleTimeString()}</div>
                  </div>
                ) : (
                  <p className="consent-note">Publish only the ledger’s root hash for third-party notarization — no private data leaves the system.</p>
                )}
                <button className="mini" disabled={ledger.length === 0} onClick={() => api.anchor().then(setAnchor)}>
                  <Icon.link size={13} /> {anchor ? 'Re-anchor root hash' : 'Anchor to public chain'}</button>
              </div>
            </Section>
          </div>
        </div>
      </div>

      {reveal && <RevealModal reveal={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

function PrivacyItem({ icon: I, label, consent, onView }) {
  return (
    <div className="privacy-row">
      <div><div className="pr-h"><I size={15} /> {label}</div>
        <div className="pr-d">{consent ? 'Tenant granted access' : 'Locked — no tenant consent'}</div></div>
      {consent
        ? <button className="mini warn" onClick={onView}><Icon.unlock size={14} /> View (consented)</button>
        : <span className="locked-chip"><Icon.lock size={13} /> Locked</span>}
    </div>
  );
}
