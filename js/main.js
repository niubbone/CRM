// =======================================================================
// === MAIN - INIZIALIZZAZIONE APPLICAZIONE ===
// =======================================================================
import { initGlobalState } from './config.js';
import { initTimesheet, openAddClientModal, closeAddClientModal, saveNewClient } from './timesheet.js';
import { 
  initProforma, 
  showProformaStep, 
  loadTimesheetForClient, 
  selectAllTimesheet, 
  deselectAllTimesheet,
  updateSelection,
  proceedToStep3,
  generateProformaFinal
} from './proforma.js';
import { initUtilities } from './utilities.js';

/**
 * Cambia tab attivo - ESPOSTA GLOBALMENTE SUBITO
 * VERSIONE CORRETTA con protezione undefined e controlli null
 */
// Traccia quali tab sono già state inizializzate nella sessione corrente
const _tabLoaded = {};

// Esponi funzione per invalidare cache di una tab (chiamarla dopo inserimenti)
window.markTabDirty = function(tabName) {
  _tabLoaded[tabName] = false;
};

window.switchTab = function(tabName) {
  if (!tabName || tabName === 'undefined') {
    console.warn('⚠️ switchTab chiamata senza parametro valido - operazione ignorata');
    return;
  }

  document.querySelectorAll('.tab-content').forEach(tab => {
    if (tab && tab.classList) tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-button').forEach(btn => {
    if (btn && btn.classList) btn.classList.remove('active');
  });

  const targetTab = document.getElementById(tabName + '-tab');
  if (targetTab && targetTab.classList) {
    targetTab.classList.add('active');
  } else {
    console.error('❌ Tab non trovata:', tabName + '-tab');
    return;
  }

  const activeBtn = Array.from(document.querySelectorAll('.tab-button'))
    .find(btn => btn && btn.textContent && btn.textContent.toLowerCase().includes(tabName));
  if (activeBtn && activeBtn.classList) activeBtn.classList.add('active');

  // Inizializza solo se non già caricata in questa sessione
  if (_tabLoaded[tabName]) {
    // Eccezione: se la proforma list è bloccata in stato loading, ricarica
    if (tabName === 'proforma') {
      const proformaContainer = document.getElementById('proforma-list-container');
      if (proformaContainer && proformaContainer.innerHTML.includes('loading')) {
        if (typeof loadProformaList === 'function') loadProformaList();
      }
    }
    return;
  }
  _tabLoaded[tabName] = true;

  switch(tabName) {
    case 'proforma':
      if (typeof showProformaStep === 'function') showProformaStep(1);
      if (typeof loadProformaList === 'function') loadProformaList();
      if (typeof populateClientDropdown === 'function') populateClientDropdown();
      break;
    case 'utilities':
      if (typeof initUtilities === 'function') initUtilities();
      break;
    case 'vendite':
      if (typeof initVenditeTab === 'function') initVenditeTab();
      break;
    case 'fatture':
      if (typeof initFattureTab === 'function') initFattureTab();
      break;
    case 'clienti':
      if (typeof initClienteTab === 'function') initClienteTab();
      break;
  }
};

/**
 * Inizializzazione applicazione
 */
window.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Inizializzazione Studio Smart Timesheet...');
  
  // Inizializza stato globale
  initGlobalState();
  
  // Setup tab switching
  setupTabs();
  
  // Inizializza moduli essenziali
  await initTimesheet();
  initProforma();

  // Esponi funzioni globali per onclick HTML
  exposeGlobalFunctions();

  // Carica badge ore extra in sospeso
  loadOreExtraBadge();

  console.log('✅ Applicazione inizializzata con successo!');
});

/**
 * Setup navigazione tab
 * VERSIONE CORRETTA con caso Clienti aggiunto
 */
function setupTabs() {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      let tabName;
      
      if (btn.textContent.includes('Timesheet')) {
        tabName = 'timesheet';
      } else if (btn.textContent.includes('Proforma')) {
        tabName = 'proforma';
      } else if (btn.textContent.includes('Vendite')) {
        tabName = 'vendite';
      } else if (btn.textContent.includes('Fatture')) {
        tabName = 'fatture';
      } else if (btn.textContent.includes('Clienti')) {  // ✅ FIX: AGGIUNTO CASO CLIENTI
        tabName = 'clienti';
      } else if (btn.textContent.includes('Utilities')) {
        tabName = 'utilities';
      }
      
      // ✅ FIX: Chiama switchTab solo se tabName è definito
      if (tabName) {
        window.switchTab(tabName);
      } else {
        console.warn('⚠️ Pulsante tab non riconosciuto:', btn.textContent);
      }
    });
  });
}

/**
 * Espone funzioni globali per onclick HTML
 */
function exposeGlobalFunctions() {
  // Timesheet
  window.openAddClientModal = openAddClientModal;
  window.closeAddClientModal = closeAddClientModal;
  window.saveNewClient = saveNewClient;
  
  // Proforma
  window.showProformaStep = showProformaStep;
  window.loadTimesheetForClient = loadTimesheetForClient;
  window.selectAllTimesheet = selectAllTimesheet;
  window.deselectAllTimesheet = deselectAllTimesheet;
  window.updateSelection = updateSelection;
  window.proceedToStep3 = proceedToStep3;
  window.generateProformaFinal = generateProformaFinal;
  
  // switchTab è già esposta all'inizio del file come window.switchTab
  // downloadFrontendBackup viene esposta in utilities.js (caricato subito ora)
}

/**
 * Carica il conteggio delle ore extra in sospeso e mostra il badge
 * sul tab Clienti se ce ne sono. Il badge è cliccabile e mostra
 * un popover rapido con la lista dei clienti e le ore.
 */
async function loadOreExtraBadge() {
  try {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_ore_extra_count`;
    const res  = await fetch(url, { noSpinner: true });
    const data = await res.json();
    const badge = document.getElementById('clienti-extra-badge');
    if (!badge) return;

    if (data.success && data.count > 0) {
      badge.textContent = data.count;
      badge.style.display = 'inline-block';
      badge.style.cursor = 'pointer';
      badge.title = 'Clicca per vedere i clienti con ore extra';

      // Popover già iniettato? Rimuovi e ricrea
      const existing = document.getElementById('ore-extra-popover');
      if (existing) existing.remove();

      const popover = document.createElement('div');
      popover.id = 'ore-extra-popover';
      popover.style.cssText = `
        display:none; position:fixed; z-index:9999;
        background:#fff; border:1px solid #dee2e6; border-radius:8px;
        box-shadow:0 4px 20px rgba(0,0,0,.15); padding:0; min-width:260px; max-width:340px;
      `;

      let rows = '';
      (data.perCliente || []).forEach(c => {
        const totH = c.righe.reduce((s, r) => s + (parseFloat(r.oreExtra) || 0), 0);
        rows += `<tr>
          <td style="padding:7px 12px;font-weight:600;">${c.cliente}</td>
          <td style="padding:7px 12px;text-align:center;color:#dc3545;font-weight:700;">${totH}h</td>
          <td style="padding:7px 12px;text-align:center;color:#888;font-size:12px;">${c.righe.length} riga${c.righe.length > 1 ? 'e' : ''}</td>
        </tr>`;
      });

      popover.innerHTML = `
        <div style="background:#dc3545;color:#fff;padding:10px 14px;border-radius:7px 7px 0 0;font-weight:600;font-size:13px;">
          ⏰ Ore extra in sospeso (${data.count})
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f8f9fa;font-size:11px;text-transform:uppercase;color:#888;">
            <th style="padding:6px 12px;text-align:left;">Cliente</th>
            <th style="padding:6px 12px;text-align:center;">Ore</th>
            <th style="padding:6px 12px;text-align:center;">Righe</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="padding:8px 12px;font-size:11px;color:#888;border-top:1px solid #f0f0f0;">
          Apri la scheda del cliente per gestire le ore.
        </div>`;

      document.body.appendChild(popover);

      // Mostra/nascondi al click sul badge
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popover.style.display === 'none') {
          const rect = badge.getBoundingClientRect();
          popover.style.top  = (rect.bottom + 6) + 'px';
          popover.style.left = Math.max(4, rect.left - 180) + 'px';
          popover.style.display = 'block';
        } else {
          popover.style.display = 'none';
        }
      });

      // Chiudi cliccando fuori
      document.addEventListener('click', () => { popover.style.display = 'none'; }, { capture: false });

    } else {
      badge.style.display = 'none';
    }
  } catch(e) {
    console.warn('loadOreExtraBadge: errore silenzioso', e);
  }
}
