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
  if (_tabLoaded[tabName]) return;
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
 * sul tab Clienti se ce ne sono.
 */
async function loadOreExtraBadge() {
  try {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_ore_extra_count`;
    const res  = await fetch(url);
    const data = await res.json();
    const badge = document.getElementById('clienti-extra-badge');
    if (!badge) return;
    if (data.success && data.count > 0) {
      badge.textContent = data.count;
      badge.style.display = 'inline-block';
      badge.title = `${data.count} riga/e con ore extra in sospeso`;
    } else {
      badge.style.display = 'none';
    }
  } catch(e) {
    console.warn('loadOreExtraBadge: errore silenzioso', e);
  }
}
