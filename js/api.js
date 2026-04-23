// =======================================================================
// === API - CHIAMATE AL BACKEND ===
// =======================================================================
import { CONFIG } from './config.js';

/**
 * Carica clienti e configurazioni dal backend
 */
export async function getClientsAndConfig() {
  const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_data`;
  
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Errore HTTP: Status ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.detail || data.error);
  }
  
  return {
    clients: data.clients || [],
    config: data.config || {}
  };
}

/**
 * Aggiunge un nuovo cliente
 */
export async function addClient(clientName, clientEmail = '') {
  const url = `${CONFIG.APPS_SCRIPT_URL}?action=add_client&client_name=${encodeURIComponent(clientName)}&client_email=${encodeURIComponent(clientEmail)}`;
  
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Impossibile aggiungere il cliente');
  }
  
  return data;
}

/**
 * Carica timesheet E canoni da fatturare per un cliente
 * @returns {object} - { timesheet: [], canoni: [] }
 */
export async function getTimesheetDaFatturare(clientName) {
  const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_timesheet_da_fatturare&client_name=${encodeURIComponent(clientName)}`;
  
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Impossibile caricare i timesheet');
  }
  
  // ✅ AGGIORNATO: Backend restituisce { timesheet: [], canoni: [] }
  return {
    timesheet: data.timesheet || data.data || [],
    canoni: data.canoni || []
  };
}

/**
 * Genera e invia proforma
 * @param {string} clientName - Nome cliente
 * @param {array} timesheetIds - Array rowIndex timesheet
 * @param {string} causale - Causale proforma
 * @param {boolean} applicaQuota - Applica quota integrativa 4%
 * @param {array} canoniIds - Array rowIndex canoni (opzionale)
 */
export async function generateProforma(clientName, timesheetIds, causale, applicaQuota, canoniIds = []) {
  const timesheetIdsStr = timesheetIds.join(',');
  const canoniIdsStr = canoniIds.join(',');
  
  // ✅ Backend usa 'cliente' non 'client_name'
  let url = `${CONFIG.APPS_SCRIPT_URL}?action=generate_proforma&cliente=${encodeURIComponent(clientName)}&timesheet_ids=${timesheetIdsStr}&causale=${encodeURIComponent(causale)}&applica_quota=${applicaQuota}`;
  
  // 🆕 Aggiungi canoni_ids se presenti
  if (canoniIds.length > 0) {
    url += `&canoni_ids=${canoniIdsStr}`;
  }
  
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Errore durante la generazione della proforma');
  }
  
  return data;
}

/**
 * Recupera l'ultimo warning generato dal backend
 */
export async function getLastWarning(bustCache = false) {
  // bustCache=true aggiunge un timestamp per aggirare la cache del service worker
  // (usare sempre dopo un form submit, così il warning è sempre fresco)
  const cacheBuster = bustCache ? `&_t=${Date.now()}` : '';
  const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_last_warning${cacheBuster}`;

  try {
    const response = await fetch(url, { method: 'GET' });
    const data = await response.json();

    if (data.success && data.warning) {
      return data.warning;
    }
    return null;
  } catch (error) {
    console.error('Errore recupero warning:', error);
    return null;
  }
}

/**
 * Invia timesheet al backend (usato dal form submit via iframe)
 * Questa funzione non usa fetch perché il form usa action POST con target iframe
 */
export function setupTimesheetFormSubmit() {
  // Il form usa già il metodo POST con iframe hidden
  // Non serve modificare, manteniamo la logica esistente
  return true;
}

// =======================================================================
// === CANONI - COSTANTI E FUNZIONI ===
// =======================================================================

/**
 * Stati lifecycle canone
 */
export const CANONE_STATI = {
  ATTIVO: 'ATTIVO',
  SCADUTO: 'SCADUTO',
  RINNOVATO: 'RINNOVATO',
  DISDETTO: 'DISDETTO'
};

/**
 * Stati fatturazione canone
 */
export const CANONE_FATTURAZIONE = {
  DA_FATTURARE: 'Da fatturare',
  PROFORMATO: 'Proformato',
  FATTURATO: 'Fatturato'
};

/**
 * Recupera lista canoni con filtri opzionali
 * @param {object} filtri - { stato, fatturazione, cliente }
 */
export async function getCanoni(filtri = {}) {
  const params = new URLSearchParams({ action: 'get_canoni' });
  
  if (filtri.stato) params.append('stato', filtri.stato);
  if (filtri.fatturazione) params.append('fatturazione', filtri.fatturazione);
  if (filtri.cliente) params.append('cliente', filtri.cliente);
  
  const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Errore caricamento canoni');
  }
  
  return data.data || [];
}

/**
 * Recupera solo canoni ATTIVI e Da fatturare
 */
export async function getCanoniDaFatturare() {
  const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=get_canoni_da_fatturare`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Errore caricamento canoni da fatturare');
  }
  
  return data.data || [];
}

/**
 * Aggiorna stato fatturazione canone
 * @param {string} canoneId - ID canone
 * @param {string} fatturazione - Da fatturare|Proformato|Fatturato
 * @param {string} nFattura - Numero fattura (opzionale)
 */
export async function updateFatturazioneCanone(canoneId, fatturazione, nFattura = '') {
  const params = new URLSearchParams({
    action: 'update_fatturazione_canone',
    canone_id: canoneId,
    fatturazione: fatturazione
  });
  
  if (nFattura) {
    params.append('n_fattura', nFattura);
  }
  
  const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Errore aggiornamento fatturazione');
  }
  
  return data;
}

/**
 * Segna canone come fatturato
 * @param {string} canoneId - ID canone
 * @param {string} nFattura - Numero fattura completo (es. "N.23/A del 15/01/2026")
 */
export async function setCanoneFatturato(canoneId, nFattura) {
  const params = new URLSearchParams({
    action: 'set_canone_fatturato',
    canone_id: canoneId,
    n_fattura: nFattura
  });
  
  const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Errore registrazione fattura');
  }
  
  return data;
}

/**
 * Disdici un canone
 * @param {string} canoneId - ID canone
 * @param {string} motivazione - Motivazione (opzionale)
 */
export async function disdiciCanone(canoneId, motivazione = '') {
  const params = new URLSearchParams({
    action: 'disdici_canone',
    canone_id: canoneId
  });
  
  if (motivazione) {
    params.append('motivazione', motivazione);
  }
  
  const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Errore disdetta canone');
  }
  
  return data;
}

/**
 * Statistiche canoni per dashboard
 */
export async function getCanoniStats() {
  const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=get_canoni_stats`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Errore caricamento statistiche');
  }
  
  return data.data || {};
}
