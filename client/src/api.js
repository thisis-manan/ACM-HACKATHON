// One place for the backend location so it works over localhost or LAN.
const HOST = location.hostname || 'localhost';
export const API = `http://${HOST}:4000/api`;
export const WS = `ws://${HOST}:4000/ws`;

async function req(path, method = 'POST', body) {
  const r = await fetch(API + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

export const api = {
  state: () => req('/state', 'GET'),
  checkin: (stack) => req('/checkin', 'POST', { guestName: 'Anish', stack }),
  device: (id, action) => req(`/device/${id}/${action}`),
  simulate: (event) => req(`/simulate/${event}`),
  toggleRule: (id) => req(`/rule/${id}/toggle`),
  storage: (as) => req(`/storage?as=${as}`, 'GET'),
  camera: (as) => req(`/camera?as=${as}`, 'GET'),
  hijack: () => req('/attack/hijack'),
  migrate: () => req('/migrate'),
  checkout: () => req('/checkout'),
  factoryReset: () => req('/factory-reset'),
  receipt: () => req('/receipt', 'GET'),
  ledger: () => req('/ledger', 'GET'),
  anchor: () => req('/anchor'),
  consent: (scope, granted) => req(`/consent/${scope}/${granted ? 'grant' : 'revoke'}`),
  netinfo: () => req('/netinfo', 'GET'),
};
