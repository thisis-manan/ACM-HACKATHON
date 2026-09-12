import React from 'react';
import { Icon, Logo } from '../icons.jsx';
import { go } from '../lib/useSpace.js';

export default function Landing() {
  return (
    <div className="landing">
      <header className="lnav">
        <div className="brand">
          <Logo size={30} />
          <div className="title">SpaceLord</div>
        </div>
        <button className="lnav-demo" onClick={() => go('#/demo')}><Icon.present size={15} /> Presenter mode</button>
      </header>

      <section className="hero">
        <h1>The smart devices in your rental<br />should answer to <span className="accent">you</span>.</h1>
        <p className="hero-sub">
          SpaceLord hands cryptographic control of a space to whoever is staying there — and
          hands it back, wiped, when they leave. Attested software, encrypted data, and a
          tamper-evident privacy ledger. Trust enforced by cryptography, not by terms of service.
        </p>
        <div className="hero-cta">
          <button className="role-card host" onClick={() => go('#/host')}>
            <span className="role-ic"><Icon.building size={26} /></span>
            <div className="role-txt">
              <div className="role-h">I’m a Host / Operator</div>
              <div className="role-d">Manage your property, prove privacy compliance, and reclaim spaces.</div>
            </div>
            <Icon.arrow size={20} />
          </button>
          <button className="role-card guest" onClick={() => go('#/guest')}>
            <span className="role-ic"><Icon.users size={26} /></span>
            <div className="role-txt">
              <div className="role-h">I’m a Guest / Tenant</div>
              <div className="role-d">Check in, verify the space is private, and control it during your stay.</div>
            </div>
            <Icon.arrow size={20} />
          </button>
        </div>
      </section>

      <section className="lfeat">
        <Feature icon={Icon.shieldCheck} h="Remote attestation"
          d="Your phone verifies the exact software running in the space before you trust it." />
        <Feature icon={Icon.database} h="Encrypted by default"
          d="Your data is AES-256-GCM encrypted. The host has no key — access needs your consent." />
        <Feature icon={Icon.list} h="Compliance ledger"
          d="Every stay produces a signed, hash-chained receipt operators can audit and prove." />
      </section>

      <footer className="lfoot">Prototype of “SpaceLord: Private and Secure Smart Space Sharing” (ACSAC ’22)</footer>
    </div>
  );
}

function Feature({ icon: I, h, d }) {
  return (
    <div className="feat"><span className="feat-ic"><I size={20} /></span>
      <div className="feat-h">{h}</div><div className="feat-d">{d}</div></div>
  );
}
