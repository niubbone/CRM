/**
 * Version Display - UI Components LIGHT THEME
 */

import { VERSION, VERSION_INFO, CHANGELOG, getVersionString, getFullVersionString, logVersion } from './version.js';

console.log('🔍 version-display.js caricato');

/**
 * Inizializza display versione
 */
export function initVersionDisplay() {
  console.log('🔍 initVersionDisplay() chiamato');
  logVersion();
  updateUtilitiesVersionBox();
  updatePageTitle();
  
  window.CRM_VERSION = VERSION;
  window.CRM_VERSION_INFO = VERSION_INFO;
}

/**
 * Aggiorna/crea box versione in Utilities
 */
function updateUtilitiesVersionBox() {
  console.log('🔍 updateUtilitiesVersionBox() chiamato');
  
  const utilitiesTab = document.getElementById('utilities-tab');
  if (!utilitiesTab) {
    console.warn('⚠️ Utilities tab non trovato');
    return;
  }

  console.log('✅ Utilities tab trovato');

  // Rimuovi vecchi box ovunque siano
  document.querySelectorAll('.version-box, #version-info, #version-info-box, .app-version').forEach((box, i) => {
    console.log(`🗑️ Rimosso vecchio box ${i}`);
    box.remove();
  });

  // Crea nuovo box LIGHT
  const versionBox = document.createElement('div');
  versionBox.className = 'utility-section';
  versionBox.id = 'version-info-box';
  
  versionBox.innerHTML = `
    <h3>ℹ️ Informazioni App</h3>
    
    <div class="version-card">
      <div class="version-header">
        <span class="version-label">Versione</span>
        <span class="version-number">${VERSION}</span>
      </div>
      
      <div class="version-details">
        <div class="version-detail-item">
          <span class="detail-icon">📅</span>
          <span class="detail-label">Build:</span>
          <span class="detail-value">${VERSION_INFO.date}</span>
        </div>
        
        <div class="version-detail-item">
          <span class="detail-icon">🚀</span>
          <span class="detail-label">Deployment:</span>
          <span class="detail-value">GitHub Pages</span>
        </div>
        
        <div class="version-detail-item">
          <span class="detail-icon">⚡</span>
          <span class="detail-label">PWA:</span>
          <span class="detail-value">Attivo</span>
        </div>
      </div>
      
      <button class="btn-changelog" onclick="toggleChangelog()">
        📋 Vedi Changelog
      </button>
      
      <div id="changelog-content" class="changelog-content" style="display: none;">
        ${generateChangelogHTML()}
      </div>

      <a href="/CRM/docs/manuale.html" target="_blank" class="doc-link">
        📖 Manuale Utente
      </a>

      <a href="/CRM/docs/architecture.html" target="_blank" class="doc-link">
        📚 Documentazione Architettura
      </a>
    </div>
  `;

  // ✅ FIX: Inserisci nel posto giusto
  const formContainer = utilitiesTab.querySelector('.form-container');
  if (formContainer) {
    const infoBox = formContainer.querySelector('#info-box');
    if (infoBox) {
      // Inserisci subito DOPO info-box
      infoBox.insertAdjacentElement('afterend', versionBox);
      console.log('✅ Box inserito dopo info-box');
    } else {
      const h1 = formContainer.querySelector('h1');
      if (h1) {
        h1.insertAdjacentElement('afterend', versionBox);
        console.log('✅ Box inserito dopo h1');
      } else {
        formContainer.prepend(versionBox);
        console.log('✅ Box inserito all\'inizio di form-container');
      }
    }
  } else {
    utilitiesTab.prepend(versionBox);
    console.log('✅ Box inserito all\'inizio di utilities-tab');
  }
  
  console.log(`✅ Version display inizializzato: ${VERSION}`);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Genera HTML changelog
 */
function generateChangelogHTML() {
  if (!CHANGELOG || CHANGELOG.length === 0) {
    return '<p class="changelog-empty">Nessun changelog disponibile</p>';
  }

  let html = '<div class="changelog-list">';
  
  CHANGELOG.forEach(entry => {
    const typeClass = entry.type || 'update';
    html += `
      <div class="changelog-entry">
        <div class="changelog-version">
          <span class="version-badge ${typeClass}">${entry.version}</span>
          <span class="version-date">${entry.date}</span>
        </div>
        <div class="changelog-changes">
          <ul>
            ${entry.changes.map(change => `<li>${escapeHtml(change)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

/**
 * Toggle changelog visibility
 */
window.toggleChangelog = function() {
  const content = document.getElementById('changelog-content');
  const btn = document.querySelector('.btn-changelog');
  
  if (!content || !btn) return;
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    btn.textContent = '📋 Nascondi Changelog';
  } else {
    content.style.display = 'none';
    btn.textContent = '📋 Vedi Changelog';
  }
};

/**
 * Aggiorna page title
 */
function updatePageTitle() {
  const currentTitle = document.title;
  if (!currentTitle.includes('v')) {
    document.title = `${currentTitle} - ${getVersionString()}`;
  }
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVersionDisplay);
} else {
  initVersionDisplay();
}
