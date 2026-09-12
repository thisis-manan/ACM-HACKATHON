import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import os from 'os';
import { Engine } from './engine.js';

function lanIp() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const a of iface) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return 'localhost';
}

const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors());
app.use(express.json());

const engine = new Engine();

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

engine.setBroadcast((msg) => {
  const data = JSON.stringify(msg);
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(data); });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'state', state: engine.publicState() }));
});

// ---- REST API -------------------------------------------------------------
app.get('/api/state', (_req, res) => res.json(engine.publicState()));

app.post('/api/checkin', async (req, res) => {
  res.json(await engine.checkin(req.body || {}));
});

app.post('/api/device/:id/:action', (req, res) => {
  res.json(engine.deviceCommand('GUEST', req.params.id, req.params.action));
});

app.post('/api/simulate/:event', (req, res) => {
  res.json(engine.simulate(req.params.event));
});

app.post('/api/rule/:id/toggle', (req, res) => {
  res.json(engine.toggleRule(req.params.id));
});

app.get('/api/storage', (req, res) => {
  res.json(engine.viewStorage((req.query.as || 'GUEST').toUpperCase()));
});

app.get('/api/camera', (req, res) => {
  res.json(engine.cameraAccess((req.query.as || 'GUEST').toUpperCase()));
});

app.post('/api/attack/hijack', (_req, res) => res.json(engine.attackHijack()));

app.post('/api/migrate', async (_req, res) => res.json(await engine.migrate()));

app.post('/api/checkout', async (_req, res) => res.json(await engine.checkout()));

app.post('/api/factory-reset', (_req, res) => { engine.reset(false); res.json({ ok: true }); });

app.get('/api/receipt', (_req, res) => {
  if (engine.guest) return res.json(engine.generateReceipt());
  if (engine.lastReceipt) return res.json(engine.lastReceipt);
  res.json({ error: 'No stay to certify yet — check in first.' });
});

app.get('/api/netinfo', (_req, res) => res.json({ ip: lanIp(), clientPort: 5173 }));

server.listen(PORT, () => {
  console.log(`SpaceLord server on http://localhost:${PORT}  (ws://localhost:${PORT}/ws)`);
});
