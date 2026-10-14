// =======================================================================
// === PROFORMA - GESTIONE TAB PROFORMA ===
// === VERSIONE: 3.0 FINALE ===
// === Data: 10 Febbraio 2026 - Ore 15:30 ===
// === FIX: Delega loadProformaList a proforma-list.js ===
// =======================================================================

import { getTimesheetDaFatturare, generateProforma } from './api.js';
import { formatDate, formatCurrency } from './utils.js';

const API_URL = window.CONFIG?.APPS_SCRIPT_URL || '';

/**
 * Popola il dropdown clienti nel tab proforma
 */
function populateClientDropdown() {
  const clients = window.clients;
  if (!clients || clients.length === 0) return;

  const datalist = document.getElementById('proforma-client-list');
  if (!datalist) return;

  datalist.innerHTML = '';
  clients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.name || client.Nome_Cliente || client.nome || '';
    datalist.appendChild(option);
  });

  // Se c'è un cliente pending (es. "Crea Proforma" dal pannello cliente), selezionalo
  if (window._pendingProformaCliente) {
    const input = document.getElementById('proforma_client_select');
    if (input) input.value = window._pendingProformaCliente;
    window._pendingProformaCliente = null;
    loadTimesheetForClient();
  }
}

// Espone la funzione globalmente
window.populateClientDropdown = populateClientDropdown;

/**
 * Inizializza il tab proforma
 */
export function initProforma() {
  setupProformaListeners();
}

/**
 * Setup event listeners per proforma
 */
function setupProformaListeners() {
  const applicaQuotaCheckbox = document.getElementById('applica_quota');
  if (applicaQuotaCheckbox) {
    applicaQuotaCheckbox.addEventListener('change', updateProformaTotals);
  }
}

/**
 * Mostra uno specifico step della proforma
 */
export function showProformaStep(stepNumber) {
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('active');
  });
  const stepElement = document.getElementById('step-' + stepNumber);
  if (stepElement) {
    stepElement.classList.add('active');
  }
}

/**
 * Carica i timesheet da fatturare per un cliente
 */
export async function loadTimesheetForClient() {
  const clientName = document.getElementById('proforma_client_select').value;
  
  if (!clientName) {
    alert('Seleziona un cliente');
    return;
  }
  
  const loadingBox = document.getElementById('loading-timesheet');
  loadingBox.style.display = 'block';
  
  try {
    // ✅ Backend restituisce { timesheet: [], canoni: [] }
    const data = await getTimesheetDaFatturare(clientName);
    
    // ✅ Salva separatamente timesheet e canoni
    window.currentTimesheetData = data.timesheet || [];
    window.currentCanoniData = data.canoni || [];
    
    // ✅ Unisci timesheet + canoni per visualizzazione
    const allItems = [...window.currentTimesheetData, ...window.currentCanoniData];
    
    displayTimesheetTable(allItems);
    showProformaStep(2);
  } catch (error) {
    console.error('Errore:', error);
    alert('Errore: ' + error.message);
  } finally {
    loadingBox.style.display = 'none';
  }
}

/**
 * Mostra la tabella dei timesheet
 */
function displayTimesheetTable(items) {
  const tbody = document.getElementById('timesheet-tbody');
  tbody.innerHTML = '';
  window.selectedTimesheet = [];
  window.selectedCanoni = []; // 🆕 Reset anche selectedCanoni
  
  if (items.length === 0) {
    document.getElementById('timesheet-table-container').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔭</div>
        <p><strong>Nessun timesheet o canone da fatturare</strong></p>
        <p>Non ci sono elementi con modalità addebito "Da fatturare" per questo cliente</p>
      </div>
    `;
    const selectionInfo = document.getElementById('selection-info');
    if (selectionInfo) {
      selectionInfo.style.display = 'none';
    }
    return;
  }
  
  const timesheetContainer = document.getElementById('timesheet-table-container');
  const selectionInfo = document.getElementById('selection-info');
  
  if (timesheetContainer) {
    timesheetContainer.style.display = 'block';
  }
  if (selectionInfo) {
    selectionInfo.style.display = 'block';
  }
  
  items.forEach((row, index) => {
    // ✅ Gestione diversa per CANONE vs TIMESHEET
    const isCanone = row.tipo === 'CANONE';
    
    let dataFormatted, tipo, modalita, ore, chiamata, costo;
    
    if (isCanone) {
      // CANONE: usa campi specifici
      dataFormatted = formatDate(row.dataScadenza || row.data);
      tipo = '📅 CANONE';
      modalita = row.descrizione || 'Canone';
      ore = '-';
      chiamata = 0;
      costo = row.importo || 0;
    } else {
      // TIMESHEET: usa campi standard
      dataFormatted = formatDate(row.dataItaliana || row.data);
      tipo = row.tipo || '';
      modalita = row.modalita || '';
      ore = row.ore || 0;
      chiamata = row.chiamata || 0;
      costo = row.costo || 0;
    }
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="timesheet-checkbox" data-index="${index}" data-row="${row.rowIndex}" data-date="${row.data || row.dataScadenza}" onchange="window.updateSelection()"></td>
      <td>${dataFormatted}</td>
      <td>${tipo}</td>
      <td>${modalita}</td>
      <td>${ore}</td>
      <td>${formatCurrency(chiamata)}</td>
      <td><strong>${formatCurrency(costo)}</strong></td>
    `;
    tbody.appendChild(tr);
  });
  
  updateSelection();
}

/**
 * Seleziona tutti i timesheet
 */
export function selectAllTimesheet() {
  document.querySelectorAll('.timesheet-checkbox').forEach(checkbox => {
    checkbox.checked = true;
  });
  updateSelection();
}

/**
 * Deseleziona tutti i timesheet
 */
export function deselectAllTimesheet() {
  document.querySelectorAll('.timesheet-checkbox').forEach(checkbox => {
    checkbox.checked = false;
  });
  updateSelection();
}

/**
 * Aggiorna la selezione dei timesheet
 */
export function updateSelection() {
  window.selectedTimesheet = [];
  window.selectedCanoni = []; // 🆕 Array separato per canoni
  let subtotale = 0;
  
  // ✅ Unisci timesheet + canoni per accesso univoco
  const allItems = [...window.currentTimesheetData, ...window.currentCanoniData];
  
  document.querySelectorAll('.timesheet-checkbox:checked').forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index);
    const rowIndex = parseInt(checkbox.dataset.row);
    
    const item = allItems[index];
    if (item) {
      // 🆕 Distingui tra timesheet e canone
      if (item.tipo === 'CANONE' || item.idCanone) {
        window.selectedCanoni.push(rowIndex);
      } else {
        window.selectedTimesheet.push(rowIndex);
      }
      
      const costo = parseFloat(item.costo || item.importo || 0);
      subtotale += costo;
    }
  });
  
  const totalSelected = window.selectedTimesheet.length + window.selectedCanoni.length;
  document.getElementById('selected-count').textContent = totalSelected;
  document.getElementById('subtotale-preview').textContent = formatCurrency(subtotale);
  
  document.getElementById('proceed-to-step3-btn').disabled = totalSelected === 0;
}

/**
 * Procede allo step 3 (configurazione proforma)
 */
export function proceedToStep3() {
  // 🆕 Controlla sia timesheet che canoni
  const totalSelected = (window.selectedTimesheet?.length || 0) + (window.selectedCanoni?.length || 0);
  if (totalSelected === 0) {
    alert('Seleziona almeno un timesheet o canone');
    return;
  }
  
  let lastDate = new Date(0);
  document.querySelectorAll('.timesheet-checkbox:checked').forEach(checkbox => {
    const dateStr = checkbox.dataset.date;
    if (dateStr) {
      const dateObj = new Date(dateStr);
      if (!isNaN(dateObj.getTime()) && dateObj > lastDate) {
        lastDate = dateObj;
      }
    }
  });
  
  let dateFormatted = 'data non disponibile';
  if (lastDate.getTime() > 0) {
    dateFormatted = lastDate.toLocaleDateString('it-IT');
  }
  
  document.getElementById('proforma_causale').value = `Per interventi, consulenze e formazione al ${dateFormatted}`;
  
  updateProformaTotals();
  showProformaStep(3);
}

/**
 * Aggiorna i totali della proforma
 */
export function updateProformaTotals() {
  let subtotale = 0;
  
  // ✅ Calcola da timesheet selezionati
  window.currentTimesheetData.forEach((row) => {
    if (window.selectedTimesheet?.includes(row.rowIndex)) {
      const costo = parseFloat(row.costo || 0);
      subtotale += costo;
    }
  });
  
  // ✅ Calcola da canoni selezionati
  window.currentCanoniData.forEach((row) => {
    if (window.selectedCanoni?.includes(row.rowIndex)) {
      const importo = parseFloat(row.importo || row.costo || 0);
      subtotale += importo;
    }
  });
  
  const applicaQuota = document.getElementById('applica_quota').checked;
  // calcolo unico (js/fiscale.js), uguale al backend
  const f = window.calcolaFiscale(subtotale, { quota: applicaQuota });
  const quotaIntegrativa = f.quota;
  const { imponibile, ritenuta, iva, lordo, netto } = f;
  
  document.getElementById('totale-subtotale').textContent = formatCurrency(subtotale);
  document.getElementById('totale-quota-row').style.display = applicaQuota ? 'flex' : 'none';
  document.getElementById('totale-quota').textContent = formatCurrency(quotaIntegrativa);
  document.getElementById('totale-imponibile').textContent = formatCurrency(imponibile);
  document.getElementById('totale-ritenuta').textContent = formatCurrency(ritenuta);
  document.getElementById('totale-iva').textContent = formatCurrency(iva);
  document.getElementById('totale-lordo').textContent = formatCurrency(lordo);
  document.getElementById('totale-netto').textContent = formatCurrency(netto);
}

/**
 * Genera e invia la proforma finale
 */
export async function generateProformaFinal() {
  const clientName = document.getElementById('proforma_client_select').value;
  const causale = document.getElementById('proforma_causale').value;
  const applicaQuota = document.getElementById('applica_quota').checked;
  
  if (!causale || causale.trim() === '') {
    alert('Inserisci una causale');
    return;
  }
  
  const totalSelected = (window.selectedTimesheet?.length || 0) + (window.selectedCanoni?.length || 0);
  if (totalSelected === 0) {
    alert('Nessun timesheet o canone selezionato');
    return;
  }
  
  const generateBtn = document.getElementById('generate-proforma-final-btn');
  const proformaInfoBox = document.getElementById('proforma-info-box');
  
  generateBtn.textContent = 'Generazione in corso...';
  generateBtn.disabled = true;
  proformaInfoBox.innerHTML = '<p>⏳ Generazione proforma in corso...</p>';
  
  try {
    // Al backend vanno gli ID (stabili), non i numeri di riga
    const rif = (voci, righe) => (righe || []).map(r => {
      const v = voci.find(x => x.rowIndex === r);
      return (v && (v.idIntervento || v.idCanone)) || r;
    });
    const data = await generateProforma(
      clientName, 
      rif(window.currentTimesheetData || [], window.selectedTimesheet), 
      causale, 
      applicaQuota,
      rif(window.currentCanoniData || [], window.selectedCanoni)
    );
    
    proformaInfoBox.innerHTML = `
      <p style="color: #155724; background: #d4edda; padding: 15px !important; border-radius: 4px;">
        ✅ Proforma <strong>${data.proforma_number}</strong> generata e inviata!<br>
        Elementi inclusi: ${data.timesheet_count || totalSelected}<br>
        Totale: € ${data.totale}
      </p>
    `;
    
    setTimeout(function() {
      showProformaStep(1);
      document.getElementById('proforma_client_select').value = '';
      proformaInfoBox.innerHTML = '<p>📄 Seleziona un cliente per iniziare</p>';
    }, 5000);
  } catch (error) {
    console.error('Errore:', error);
    proformaInfoBox.innerHTML = `<p style="color: #d32f2f;">❌ Errore: ${error.message}</p>`;
  } finally {
    generateBtn.textContent = 'Genera e Invia Proforma';
    generateBtn.disabled = false;
  }
}
// =======================================================================
// === 🆕 FUNZIONI FATTURA DIRETTA - DA AGGIUNGERE ALLA FINE DI proforma.js ===
// =======================================================================

/**
 * Switch tra viste in step 4
 */
function switchProformaView(view) {
  // Aggiorna tab buttons
  document.querySelectorAll('.proforma-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Mostra vista corretta
  document.getElementById('proforma-lista-view').style.display   = view === 'lista'            ? 'block' : 'none';
  document.getElementById('proforma-diretta-view').style.display = view === 'proforma-diretta' ? 'block' : 'none';

  if (view === 'proforma-diretta') {
    initProformaDiretta();
  }
  
  if (view === 'lista') {
    // Usa funzioni da proforma-list.js
    if (typeof window.populateProformaClientFilter === 'function') {
      window.populateProformaClientFilter();
    }
    if (typeof window.loadProformaList === 'function') {
      window.loadProformaList();
    }
  }
}


// =======================================================================
// === PROFORMA DIRETTA ===
// =======================================================================

function initProformaDiretta() {
  // Data default = oggi
  const dataEl = document.getElementById('pd-data');
  if (dataEl && !dataEl.value) {
    dataEl.value = new Date().toISOString().split('T')[0];
  }
  // Popola datalist clienti
  const dl = document.getElementById('pd-cliente-list');
  if (dl && window.clients && dl.children.length === 0) {
    window.clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = typeof c === 'string' ? c : c.name;
      dl.appendChild(opt);
    });
  }
}

function aggiornaTotaleProformaDiretta() {
  const importo = parseFloat(document.getElementById('pd-importo').value) || 0;
  const quota   = document.getElementById('pd-quota').checked;
  if (importo <= 0) {
    document.getElementById('pd-riepilogo').style.display = 'none';
    return;
  }
  const f = window.calcolaFiscale(importo, { quota });
  const quotaAmt = f.quota;
  const { iva, ritenuta, netto } = f;

  const fmt = v => '€ ' + v.toFixed(2).replace('.', ',');
  document.getElementById('pd-tot-imponibile').textContent = fmt(importo);
  document.getElementById('pd-tot-quota').textContent      = fmt(quotaAmt);
  document.getElementById('pd-tot-iva').textContent        = fmt(iva);
  document.getElementById('pd-tot-ritenuta').textContent   = fmt(ritenuta);
  document.getElementById('pd-tot-netto').textContent      = fmt(netto);
  document.getElementById('pd-riepilogo').style.display    = 'block';
}

function toggleOrePacchetto() {
  const checked = document.getElementById('pd-pacchetto').checked;
  document.getElementById('pd-ore-row').style.display = checked ? 'block' : 'none';
  if (!checked) document.getElementById('pd-ore').value = '';
}

async function submitProformaDiretta(event) {
  event.preventDefault();
  const btn = document.getElementById('pd-submit-btn');
  const infoEl = document.getElementById('pd-info');
  btn.disabled = true;
  btn.textContent = '⏳ Generazione...';
  infoEl.innerHTML = '';

  try {
    const cliente      = document.getElementById('pd-cliente').value.trim();
    const causale      = document.getElementById('pd-causale').value.trim();
    const importo      = parseFloat(document.getElementById('pd-importo').value) || 0;
    const applicaQuota = document.getElementById('pd-quota').checked;
    const isPacchetto  = document.getElementById('pd-pacchetto').checked;
    const ore          = isPacchetto ? (parseFloat(document.getElementById('pd-ore').value) || 0) : 0;

    if (isPacchetto && ore <= 0) {
      throw new Error('Inserisci le ore acquistate del pacchetto');
    }

    const url = `${window.CONFIG.APPS_SCRIPT_URL}?action=genera_proforma_diretta` +
      `&cliente_nome=${encodeURIComponent(cliente)}` +
      `&causale=${encodeURIComponent(causale)}` +
      `&importo_subtotale=${importo}` +
      `&applica_quota=${applicaQuota}` +
      `&ore_pacchetto=${ore}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Errore generazione proforma');

    infoEl.innerHTML = `<div style="background:#d4edda;border:1px solid #c3e6cb;border-radius:6px;padding:12px;color:#155724;">
      ✅ <strong>Proforma ${data.proforma_number}</strong> generata e inviata per email.<br>
      Totale netto: <strong>€ ${parseFloat(data.totale).toFixed(2).replace('.',',')}</strong>
      ${ore > 0 ? `<br>📦 Il pacchetto (${ore}h) verrà creato automaticamente alla conferma del pagamento.` : ''}
    </div>`;

    // Reset form
    document.getElementById('proforma-diretta-form').reset();
    document.getElementById('pd-riepilogo').style.display = 'none';
    document.getElementById('pd-ore-row').style.display = 'none';
    document.getElementById('pd-data').value = new Date().toISOString().split('T')[0];

  } catch(err) {
    infoEl.innerHTML = `<div style="background:#f8d7da;border:1px solid #f5c6cb;border-radius:6px;padding:12px;color:#721c24;">❌ ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file"></i> Genera Proforma';
  }
}

function resetProformaDiretta() {
  document.getElementById('proforma-diretta-form').reset();
  document.getElementById('pd-riepilogo').style.display = 'none';
  document.getElementById('pd-ore-row').style.display = 'none';
  document.getElementById('pd-info').innerHTML = '';
  document.getElementById('pd-data').value = new Date().toISOString().split('T')[0];
}

// Esponi funzioni globalmente per onclick HTML
window.switchProformaView = switchProformaView;
window.submitProformaDiretta = submitProformaDiretta;
window.resetProformaDiretta = resetProformaDiretta;
window.aggiornaTotaleProformaDiretta = aggiornaTotaleProformaDiretta;
window.toggleOrePacchetto = toggleOrePacchetto;
