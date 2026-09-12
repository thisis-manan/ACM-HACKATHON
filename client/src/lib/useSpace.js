import { useEffect, useRef, useState } from 'react';
import { api, WS } from '../api.js';

// Shared live-state hook: subscribes to the hub's WebSocket and mirrors the
// sanitized space state. onEvent(fn) registers a callback for security events.
export function useSpace() {
  const [s, setS] = useState(null);
  const [connected, setConnected] = useState(false);
  const cbRef = useRef(() => {});
  useEffect(() => {
    let ws, dead = false;
    const connect = () => {
      ws = new WebSocket(WS);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.state) setS(msg.state);
        if (msg.type === 'event') cbRef.current(msg.entry);
      };
      ws.onclose = () => { setConnected(false); if (!dead) setTimeout(connect, 1000); };
    };
    connect();
    api.state().then(setS);
    return () => { dead = true; ws && ws.close(); };
  }, []);
  return { s, connected, onEvent: (fn) => (cbRef.current = fn) };
}

export const go = (hash) => { location.hash = hash; };
