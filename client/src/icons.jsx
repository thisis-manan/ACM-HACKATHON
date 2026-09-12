// Minimal stroke-based icon set (inherits currentColor). Keeps the UI looking
// like a security product rather than an emoji toy.
import React from 'react';

const S = ({ children, size = 18, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const Icon = {
  shield: (p) => <S {...p}><path d="M12 3l7 3v6c0 4.2-2.8 7.5-7 9-4.2-1.5-7-4.8-7-9V6l7-3z" /></S>,
  lock: (p) => <S {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></S>,
  unlock: (p) => <S {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></S>,
  camera: (p) => <S {...p}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.2" /></S>,
  bulb: (p) => <S {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.3 1 2.5h6c0-1.2.2-1.7 1-2.5A6 6 0 0 0 12 3z" /></S>,
  sensor: (p) => <S {...p}><circle cx="12" cy="12" r="2" /><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M6 6a9 9 0 0 0 0 12M18 6a9 9 0 0 1 0 12" /></S>,
  key: (p) => <S {...p}><circle cx="8" cy="8" r="4" /><path d="M11 11l8 8M16 16l2-2M18 18l2-2" /></S>,
  alert: (p) => <S {...p}><path d="M12 3l9 16H3l9-16z" /><path d="M12 10v4M12 17.5v.01" /></S>,
  bug: (p) => <S {...p}><rect x="8" y="7" width="8" height="11" rx="4" /><path d="M12 4v3M5 9l3 1M5 15l3-1M5 20l3.5-2.5M19 9l-3 1M19 15l-3-1M19 20l-3.5-2.5" /></S>,
  suitcase: (p) => <S {...p}><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></S>,
  logout: (p) => <S {...p}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M9 12h9M15 8l4 4-4 4" /></S>,
  refresh: (p) => <S {...p}><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4" /></S>,
  eye: (p) => <S {...p}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></S>,
  eyeOff: (p) => <S {...p}><path d="M4 4l16 16" /><path d="M9.5 5.6A10.8 10.8 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3 3.7M6.5 6.9A17 17 0 0 0 2 12s3.5 6.5 10 6.5a10.6 10.6 0 0 0 3-.4" /></S>,
  database: (p) => <S {...p}><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></S>,
  moon: (p) => <S {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></S>,
  face: (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M9 10v.01M15 10v.01M8.5 14.5a4.5 4.5 0 0 0 7 0" /></S>,
  faceOff: (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M9 10v.01M15 10v.01M9 15.5h6" /></S>,
  check: (p) => <S {...p}><path d="M4 12l5 5 11-11" /></S>,
  x: (p) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>,
  chip: (p) => <S {...p}><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" /></S>,
  activity: (p) => <S {...p}><path d="M3 12h4l2 6 4-14 2 8h6" /></S>,
  play: (p) => <S {...p} fill="currentColor"><path d="M7 5.5v13l11-6.5-11-6.5z" /></S>,
  phone: (p) => <S {...p}><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></S>,
  receipt: (p) => <S {...p}><path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.5V3z" /><path d="M9 8h6M9 12h6" /></S>,
  download: (p) => <S {...p}><path d="M12 4v11M8 11l4 4 4-4M5 20h14" /></S>,
  shieldCheck: (p) => <S {...p}><path d="M12 3l7 3v6c0 4.2-2.8 7.5-7 9-4.2-1.5-7-4.8-7-9V6l7-3z" /><path d="M9 12l2 2 4-4.5" /></S>,
};

export const DeviceIcon = { lock: Icon.lock, camera: Icon.camera, light: Icon.bulb, sensor: Icon.sensor };
