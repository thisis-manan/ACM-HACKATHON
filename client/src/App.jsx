import React, { useEffect, useState } from 'react';
import Landing from './routes/Landing.jsx';
import HostPortal from './routes/HostPortal.jsx';
import GuestPortal from './routes/GuestPortal.jsx';
import Presenter from './routes/Presenter.jsx';

function useHashRoute() {
  const [route, setRoute] = useState(location.hash.replace(/^#\/?/, '') || '');
  useEffect(() => {
    const on = () => setRoute(location.hash.replace(/^#\/?/, '') || '');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export default function App() {
  // Back-compat: the old phone link used ?view=token → send it to the tenant portal.
  if (new URLSearchParams(location.search).get('view') === 'token' && !location.hash) location.hash = '#/guest';
  const route = useHashRoute();
  if (route === 'host') return <HostPortal />;
  if (route === 'guest') return <GuestPortal />;
  if (route === 'demo') return <Presenter />;
  return <Landing />;
}
