/**
 * Service Worker - CRM Studio Smart
 *
 * Strategia di caching:
 * - Static assets (HTML, CSS, JS): Cache-first
 * - API calls: Network-first con fallback cache
 * - Immagini: Cache-first con update in background
 */

import { VERSION } from './version.js';

// ⚠️ Aggiorna questo numero ad ogni release — forza il browser a rilevare il nuovo SW
const SW_BUILD = '4.29.1';

const CACHE_VERSION = `crm-v${SW_BUILD}`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// API caching: azioni di lettura cacheable con TTL
const CACHEABLE_ACTIONS = new Set([
  'get_data', 'get_timesheet_da_fatturare', 'get_last_warning',
  'get_canoni', 'get_canoni_da_fatturare', 'get_canoni_stats'
]);
const API_TTL       = 5 * 60 * 1000; // 5 minuti (default letture)
const API_TTL_SHORT = 2 * 60 * 1000; // 2 minuti (get_last_warning)

// Auto-detect base path (per GitHub Pages: /REPO/ o localhost: /)
const BASE_PATH = self.location.pathname.split('/').filter(p => p)[0] ? `/${self.location.pathname.split('/').filter(p => p)[0]}/` : '/';

// Files da cachare all'installazione
const STATIC_FILES = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
  
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
  `${BASE_PATH}css/home.css`,

  // JavaScript
  `${BASE_PATH}js/api.js`,
  `${BASE_PATH}js/clienti.js`,
  `${BASE_PATH}js/config.js`,
  `${BASE_PATH}js/home.js`,
  `${BASE_PATH}js/main.js`,
  `${BASE_PATH}js/proforma-list.js`,
  `${BASE_PATH}js/proforma.js`,
  `${BASE_PATH}js/timesheet.js`,
  `${BASE_PATH}js/utilities.js`,
  `${BASE_PATH}js/utils.js`,
  `${BASE_PATH}js/vendite.js`
];

// API endpoint da cachare (per offline fallback)
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxodRCMoPa9VW2nphsazv8Ux72mebjCSKd48c0HKoCOsrG5Z-ZJFyzCWHt6qhCgPxkU/exec';

/**
 * INSTALL - Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker v' + CACHE_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // cache:'reload' obbliga a scaricare dalla rete. Senza, queste fetch
        // passano dalla cache HTTP del browser (GitHub Pages serve tutto con
        // max-age=600) e un SW appena installato dopo un deploy si porta
        // dentro i file VECCHI, congelandoli per l'intera vita della cache.
        return cache.addAll(STATIC_FILES.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => {
        console.log('[SW] Static cache complete');
      })
      .catch((error) => {
        console.error('[SW] Cache failed (non-blocking):', error);
      })
      .finally(() => {
        // skipWaiting sempre, anche se il caching fallisce
        self.skipWaiting();
      })
  );
});

/**
 * ACTIVATE - Cleanup old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName.startsWith('crm-') && cacheName !== STATIC_CACHE && cacheName !== API_CACHE && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Cleanup complete');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

/**
 * FETCH - Intercept network requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // API REQUESTS - Network first, fallback to cache
  if (url.origin === new URL(API_BASE_URL).origin) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // INDEX.HTML - Network first (così gli aggiornamenti HTML sono sempre immediati)
  if (url.pathname === BASE_PATH || url.pathname.endsWith('/index.html') || url.pathname === BASE_PATH.slice(0, -1)) {
    event.respondWith(
      fetch(request).then(response => {
        const clone = response.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // STATIC ASSETS (JS/CSS) - Cache first, fallback to network
  if (STATIC_FILES.some(file => url.pathname === file || url.pathname.endsWith(file))) {
    event.respondWith(handleStaticRequest(request));
    return;
  }
  
  // OTHER REQUESTS - Network first with cache fallback
  event.respondWith(handleRuntimeRequest(request));
});

/**
 * Estrae il parametro action dalla URL dell'API
 */
function getApiAction(url) {
  return new URL(url).searchParams.get('action');
}

/**
 * Restituisce il TTL in ms per l'action specificata
 */
function getApiTTL(action) {
  return action === 'get_last_warning' ? API_TTL_SHORT : API_TTL;
}

/**
 * Verifica se una risposta cached è ancora fresca (entro il TTL)
 */
function isCacheFresh(cachedResponse, ttlMs) {
  const dateHeader = cachedResponse.headers.get('date');
  if (!dateHeader) return false;
  return (Date.now() - new Date(dateHeader).getTime()) < ttlMs;
}

/**
 * Handle API requests
 * - Write actions: solo rete, mai cache
 * - Read actions: stale-while-revalidate con TTL
 *   - Cache fresca → risposta immediata + aggiornamento in background
 *   - Cache scaduta/assente → rete, poi cache
 *   - Offline → cache disponibile o 503
 */
async function handleApiRequest(request) {
  const action = getApiAction(request.url);

  // Write actions: sempre rete, niente cache
  if (!CACHEABLE_ACTIONS.has(action)) {
    try {
      return await fetch(request);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Offline', offline: true }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Read actions: stale-while-revalidate con TTL
  const cached = await caches.match(request);
  const ttl = getApiTTL(action);

  if (cached && isCacheFresh(cached, ttl)) {
    // Cache fresca: restituisci subito, aggiorna in background
    fetch(request).then(r => {
      if (r.ok) caches.open(API_CACHE).then(c => c.put(request, r));
    }).catch(() => {});
    return cached;
  }

  // Cache scaduta o assente: vai in rete
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Offline: restituisci cache scaduta se disponibile
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.append('X-Offline-Response', 'true');
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers
      });
    }
    return new Response(
      JSON.stringify({ success: false, error: 'Offline - nessuna cache disponibile', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle static assets
 * Strategy: Cache-first (instant load)
 */
async function handleStaticRequest(request) {
  // Cerca solo nella cache corretta (non in cache vecchie)
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Update cache in background (stale-while-revalidate)
    fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse);
      }
    }).catch(() => {});

    return cachedResponse;
  }
  
  // Cache miss - fetch from network
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Static asset fetch failed:', error);
    throw error;
  }
}

/**
 * Handle runtime requests
 * Strategy: Network-first with cache fallback
 */
async function handleRuntimeRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // Try cache fallback
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // No cache available
    throw error;
  }
}

/**
 * SYNC - Background sync per operazioni offline
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  }
});

/**
 * Sync offline data quando torna online
 */
async function syncOfflineData() {
  // TODO: Implementare sync delle operazioni fatte offline
  // Es: timesheet inseriti offline da sincronizzare
  console.log('[SW] Syncing offline data...');
}

/**
 * MESSAGE - Comunicazione con main thread
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
  
  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

console.log('[SW] Service Worker loaded');
