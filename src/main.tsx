import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/index.css';

import {
  isExpectedSwRegistrationError,
  shouldRegisterServiceWorker,
} from './utils/appGuards';

const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const response = await fetch('/sw.js', {
        cache: 'no-store',
        redirect: 'manual',
        credentials: 'same-origin',
      });

      const canRegister = shouldRegisterServiceWorker({
        ok: response.ok,
        status: response.status,
        redirected: response.redirected,
        type: response.type,
        contentType: response.headers.get('content-type'),
      });

      if (!canRegister) {
        return;
      }

      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (error) {
      if (!isExpectedSwRegistrationError(error)) {
        console.warn('PWA service worker registration skipped:', error);
      }
    }
  });
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
