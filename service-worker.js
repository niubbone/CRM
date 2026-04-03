/**
 * Service Worker - CRM Studio Smart
 * Minimal: nessun caching, solo notifica aggiornamento e installabilità PWA
 */

import { VERSION } from './version.js';

// Aggiorna ad ogni release per triggerare la notifica di aggiornamento
const SW_BUILD = '4.5.5';

self.addEventListener('install', () => {
  // Nessun caching — passa direttamente ad attesa
  console.log('[SW] Installed v' + SW_BUILD);
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated v' + SW_BUILD);
  event.waitUntil(self.clients.claim());
});

// Tutte le richieste vanno direttamente alla rete
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: `crm-v${SW_BUILD}` });
  }
});
