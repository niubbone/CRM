/**
 * Service Worker Registration
 * CRM Studio Smart
 */

(function() {
  'use strict';

  // Check service worker support
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported in this browser');
    return;
  }

  /**
   * Register Service Worker
   */
  async function registerServiceWorker() {
    try {
      // Se c'era già un SW controllante, un controllerchange = aggiornamento
      // (serve reload). Se non c'era (primo install), NON ricaricare.
      const hadController = !!navigator.serviceWorker.controller;

      // Auto-detect base path for GitHub Pages
      const basePath = window.location.pathname.split('/')[1] ? `/${window.location.pathname.split('/')[1]}/` : '/';
      const swPath = basePath === '/' ? '/service-worker.js' : `${basePath}service-worker.js`;
      
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: basePath,
        type: 'module'
      });

      console.log('✅ Service Worker registered:', registration.scope);

      // Check for updates every 5 minutes
      setInterval(() => {
        registration.update();
      }, 5 * 60 * 1000);

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('🔄 Service Worker update found');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available - passa il nuovo SW in attesa
            showUpdateNotification(registration);
          }
        });
      });

      // Listen for controller change (new SW activated).
      // Guard anti-loop: ricarica UNA sola volta, e mai al primo install.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing || !hadController) return;
        refreshing = true;
        console.log('🔄 New Service Worker activated — reload (una volta)');
        window.location.reload();
      });

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  }

  /**
   * Show update notification to user
   */
  function showUpdateNotification(registration) {
    const updateBanner = document.createElement('div');
    updateBanner.id = 'sw-update-banner';
    updateBanner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #667eea;
        color: white;
        padding: 15px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      ">
        <p style="margin: 0 0 10px 0;">
          <strong>🎉 Nuova versione disponibile!</strong>
        </p>
        <button id="sw-update-btn" style="
          background: white;
          color: #667eea;
          border: none;
          padding: 8px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">
          Aggiorna Ora
        </button>
        <button id="sw-dismiss-btn" style="
          background: transparent;
          color: white;
          border: 1px solid white;
          padding: 8px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-left: 10px;
        ">
          Più Tardi
        </button>
      </div>
    `;

    document.body.appendChild(updateBanner);

    // Update button
    document.getElementById('sw-update-btn').addEventListener('click', () => {
      // Manda SKIP_WAITING al nuovo SW in attesa (non al vecchio controller)
      const waitingWorker = registration.waiting;
      if (waitingWorker) {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      }
    });

    // Dismiss button
    document.getElementById('sw-dismiss-btn').addEventListener('click', () => {
      updateBanner.remove();
    });
  }

  /**
   * Check online/offline status
   */
  function setupOnlineOfflineDetection() {
    let offlineBanner = null;

    window.addEventListener('offline', () => {
      console.log('📴 Offline mode');
      
      offlineBanner = document.createElement('div');
      offlineBanner.id = 'offline-banner';
      offlineBanner.innerHTML = `
        <div style="
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #ff6b6b;
          color: white;
          padding: 10px;
          text-align: center;
          z-index: 10000;
        ">
          📴 Modalità Offline - Alcune funzioni potrebbero non essere disponibili
        </div>
      `;
      document.body.appendChild(offlineBanner);
    });

    window.addEventListener('online', () => {
      console.log('🌐 Online mode');
      
      if (offlineBanner) {
        offlineBanner.remove();
        offlineBanner = null;
      }

      // Show success message
      const onlineBanner = document.createElement('div');
      onlineBanner.innerHTML = `
        <div style="
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #51cf66;
          color: white;
          padding: 10px;
          text-align: center;
          z-index: 10000;
        ">
          🌐 Connessione ripristinata
        </div>
      `;
      document.body.appendChild(onlineBanner);

      setTimeout(() => {
        onlineBanner.remove();
      }, 3000);
    });

    // Initial status
    if (!navigator.onLine) {
      window.dispatchEvent(new Event('offline'));
    }
  }

  /**
   * Expose SW utilities globally
   */
  window.ServiceWorkerUtils = {
    /**
     * Clear all caches
     */
    clearCache: async function() {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
        console.log('Cache cleared');
      }
    },

    /**
     * Get SW version
     */
    getVersion: async function() {
      return new Promise((resolve) => {
        if (!navigator.serviceWorker.controller) {
          resolve(null);
          return;
        }

        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.version);
        };

        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_VERSION' },
          [messageChannel.port2]
        );
      });
    },

    /**
     * Force update
     */
    forceUpdate: async function() {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        registration.update();
      }
    }
  };

  /**
   * Initialize on page load
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      registerServiceWorker();
      setupOnlineOfflineDetection();
    });
  } else {
    registerServiceWorker();
    setupOnlineOfflineDetection();
  }

})();
