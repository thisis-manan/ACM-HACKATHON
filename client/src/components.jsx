import React from 'react';
import { Icon, DeviceIcon } from './icons.jsx';

export function Btn({ icon: I, kind = '', children, ...rest }) {
  return (
    <button className={'btn ' + kind} {...rest}>
      {I && <span className="bi"><I size={17} /></span>}
      <span className="bt">{children}</span>
    </button>
  );
}

export function Panel({ n, title, action, children, danger, dim }) {
  return (
    <div className={'panel ' + (danger ? 'panel-danger ' : '') + (dim ? 'dim' : '')}>
      <div className="panel-head">
        <span className="ph-title">{n && <span className="pn">{n}</span>}{title}</span>
        {action}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

export function TrustCard({ s, onShowAttest }) {
  const trusted = s.stack.trusted;
  const status = s.stack.owner ? 'neutral' : trusted ? 'good' : 'bad';
  return (
    <div className={'trust ' + status}>
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
          {s.attestation && onShowAttest && <button className="link" onClick={onShowAttest}>Attestation record →</button>}
        </div>
      </div>
    </div>
  );
}

export function DeviceTile({ d, canControl, onToggle, onCamera }) {
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
      {canControl && (
        <div className="tactions">
          {d.type === 'lock' && (<>
            <button className="mini" onClick={() => onToggle('unlock')}>Unlock</button>
            <button className="mini" onClick={() => onToggle('lock')}>Lock</button></>)}
          {d.type === 'light' && (<>
            <button className="mini" onClick={() => onToggle('on')}>On</button>
            <button className="mini" onClick={() => onToggle('off')}>Off</button></>)}
          {d.type === 'camera' && <button className="mini" onClick={onCamera}>Open feed</button>}
        </div>
      )}
    </div>
  );
}

export function downloadJSON(data, name = 'spacelord-trust-receipt.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

export function CipherView({ blob }) {
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

export function RevealModal({ reveal, onClose }) {
  const { kind, data, title } = reveal;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">{title}<button className="x" onClick={onClose}><Icon.x size={16} /></button></div>
        <div className="modal-body">
          {kind === 'storage' && data.plaintext && (
            <div className="ok-box"><div className={'ok-title ' + (data.consented ? 'warnt' : '')}>
              {data.consented ? <><Icon.unlock size={16} /> Read with tenant consent</> : <><Icon.check size={16} /> Decrypted with the guest’s key</>}</div>
              <pre>{JSON.stringify(data.plaintext, null, 2)}</pre></div>)}
          {kind === 'storage' && data.locked && <CipherView blob={data.blob} />}
          {kind === 'cipher' && <CipherView blob={data.blob} />}

          {kind === 'camera' && (data.allowed ? (
            <div className={'ok-box ' + (data.consented ? 'warnbox' : '')}>
              <div className="ok-title">{data.consented ? 'Camera feed — tenant granted consent' : data.as === 'OWNER' ? 'Host viewing their own vacant space' : 'Live feed — guest authorized'}</div>
              <div className="camfeed"><span className="rec" /> LIVE · living room</div></div>
          ) : (
            <div className="deny-box"><div className="deny-title"><Icon.x size={18} /> Access denied</div>
              <p>The camera is bound to the guest-controlled hub. The host holds no valid signing
                 key for it and the tenant has not granted consent — the feed is unreachable.</p></div>))}

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
              <p>Scan with your phone (same Wi-Fi) to open the tenant portal and check in.</p>
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
                {data.payload.securityEvents.slice(-6).map((e, i) => (<div key={i} className={'rc-ev ' + e.level}>{e.event}</div>))}
              </div>
              <div className="rc-sig"><span>Ed25519 signature</span><code>{data.signature.slice(0, 48)}…</code></div>
              {data.entryHash && <div className="rc-sig"><span>Ledger entry hash</span><code>{data.entryHash.slice(0, 40)}…</code></div>}
              <button className="mini good rc-dl" onClick={() => downloadJSON(data)}><Icon.download size={14} /> Download receipt (.json)</button>
            </div>
          ) : <p className="muted">{data.error}</p>)}
        </div>
      </div>
    </div>
  );
}
