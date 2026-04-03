/**
 * Service Worker - CRM Studio Smart
 *
 * Strategia:
 * - File statici (HTML, CSS, JS): cache-first → caricamento istantaneo
 * - Chiamate API: pass-through alla rete (cache gestita in-memory dal JS)
 * - Aggiornamento: bump SW_BUILD per notificare nuova versione
 */

import { VERSION } from './version.js';

const SW_BUILD = '4.5.5';
const CACHE_NAME = `crm-v${SW_BUILD}`;

const BASE_PATH = self.location.pathname.split('/').filter(p => p)[0]
  ? `/${self.location.pathname.split('/').filter(p => p)[0]}/`
  : '/';

const STATIC_FILES = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}version.js`,
  `${BASE_PATH}sw-register.js`,
  // CSS
  `${BASE_PATH}css/main.css`,
  `${BASE_PATH}css/clienti.css`,
  `${BASE_PATH}css/forms.css`,
  `${BASE_PATH}css/modals.css`,
  `${BASE_PATH}css/proforma-list.css`,
  `${BASE_PATH}css/tables.css`,
  `${BASE_PATH}css/tabs.css`,
  `${BASE_PATH}css/utilities.css`,
  `${BASE_PATH}css/vendite.css`,
  `${BASE_PATH}css/vendite-scaduti.css`,
  // JS
  `${BASE_PATH}js/api.js`,
  `${BASE_PATH}js/clienti.js`,
  `${BASE_PATH}js/config.js`,
  `${BASE_PATH}js/fatture.js`,
  `${BASE_PATH}js/main.js`,
  `${BASE_PATH}js/proforma-list.js`,
  `${BASE_PATH}js/proforma.js`,
  `${BASE_PATH}js/timesheet.js`,
  `${BASE_PATH}js/utilities.js`,
  `${BASE_PATH}js/utils.js`,
  `${BASE_PATH}js/vendite.js`,
];

const API_ORIGIN = 'https://script.google.com';

// INSTALL: scarica e metti in cache tutti i file statici
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v' + SW_BUILD);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .catch(err => console.warn('[SW] Cache parziale:', err))
  );
  // Non chiamare skipWaiting qui: lascia che l'utente veda la notifica di aggiornamento
});

// ACTIVATE: rimuovi cache vecchie
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v' + SW_BUILD);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('crm-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH: cache-first per statici, pass-through per API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API Google → sempre rete
  if (url.origin === API_ORIGIN) {
    event.respondWith(fetch(event.request));
    return;
  }

  // File statici → cache-first
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
  }
});

// MESSAGE: aggiornamento manuale
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'GET_VERSION') event.ports[0].postMessage({ version: CACHE_NAME });
});
