// =======================================================================
// === CLIENTI - GESTIONE COMPLETA ===
// === VERSIONE REFACTORED - ES6 Modules ===
// =======================================================================

// ✅ Import moduli ES6
import { CONFIG } from './config.js';
import { showNotification } from './utils.js';

let currentCliente = null;
let allClienti = [];
let currentClienteProdotti = []; // Per cache prodotti cliente

// =======================================================================
// === RICERCA CLIENTI ===
// =======================================================================

/**
 * Ricerca clienti per nome, P.IVA, CF, email
 */
async function searchCliente() {
    const searchTerm = document.getElementById('cliente-search').value.trim();
    
    if (!searchTerm) {
        alert('Inserisci un termine di ricerca');
        return;
    }
    
    try {
        showNotification('clienti-info', '⏳ Ricerca in corso...', 'info');
        
        // Importa CONFIG dalla window
        
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=search_clienti&search=${encodeURIComponent(searchTerm)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.clienti) {
            displaySearchResults(data.clienti);
            showNotification('clienti-info', `✅ Trovati ${data.clienti.length} clienti`, 'success');
        } else {
            throw new Error(data.error || 'Errore ricerca');
        }
        
    } catch (error) {
        console.error('Errore ricerca clienti:', error);
        showNotification('clienti-info', '❌ Errore durante la ricerca', 'error');
    }
}

/**
 * Mostra i risultati della ricerca
 */
function displaySearchResults(clienti) {
    const resultsDiv = document.getElementById('search-results');
    const resultsList = document.getElementById('search-results-list');
    
    if (clienti.length === 0) {
        resultsDiv.style.display = 'block';
        resultsList.innerHTML = '<p class="empty-state">Nessun cliente trovato</p>';
        return;
    }
    
    allClienti = clienti;
    
    let html = '';
    clienti.forEach(cliente => {
        const isAttivo = cliente.attivo === 'SI';
        const statusClass = isAttivo ? 'attivo' : 'non-attivo';
        const statusText = isAttivo ? '✅ Attivo' : '❌ Non Attivo';
        
        html += `
            <div class="cliente-card">
                <div class="cliente-card-header" onclick="loadClienteDetail('${cliente.id}')" style="cursor: pointer;">
                    <span class="cliente-card-name">${cliente.nome}</span>
                    <span class="cliente-card-status ${statusClass}">${statusText}</span>
                </div>
                <div class="cliente-card-body">
                    ${cliente.id ? `<div class="cliente-card-info">🆔 ${cliente.id}</div>` : ''}
                    ${cliente.email ? `<div class="cliente-card-info">📧 ${cliente.email}</div>` : ''}
                    ${cliente.piva ? `<div class="cliente-card-info">🏢 P.IVA: ${cliente.piva}</div>` : ''}
                    ${cliente.cf ? `<div class="cliente-card-info">📄 CF: ${cliente.cf}</div>` : ''}
                    ${cliente.citta ? `<div class="cliente-card-info">📍 ${cliente.citta}</div>` : ''}
                </div>
                <div class="cliente-card-actions" style="display: flex; gap: 8px; padding: 10px 15px; border-top: 1px solid #eee; justify-content: flex-end;">
                    <button class="btn-small btn-primary" onclick="event.stopPropagation(); loadClienteDetail('${cliente.id}')" title="Apri riepilogo cliente" style="font-size:12px;padding:4px 10px;">
                        🔍 Dettaglio
                    </button>
                    <button class="btn-small btn-secondary" onclick="event.stopPropagation(); quickViewCliente('${cliente.id}')" title="Visualizza dati anagrafici" style="font-size:12px;padding:4px 10px;">
                        👁️ Anagrafica
                    </button>
                    <button class="btn-small btn-secondary" onclick="event.stopPropagation(); quickEditCliente('${cliente.id}')" title="Modifica cliente" style="font-size:12px;padding:4px 10px;">
                        ✏️ Modifica
                    </button>
                </div>
            </div>
        `;
    });
    
    resultsList.innerHTML = html;
    resultsDiv.style.display = 'block';
}

// =======================================================================
// === DETTAGLIO CLIENTE ===
// =======================================================================

/**
 * Carica i dettagli di un cliente
 */
async function loadClienteDetail(clienteId) {
    try {
        showNotification('clienti-info', '⏳ Caricamento dettagli...', 'info');
        
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_cliente&id=${encodeURIComponent(clienteId)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.cliente) {
            currentCliente = data.cliente;
            // Mostra solo prodotti e timesheet, NON il form di modifica
            document.getElementById('cliente-detail-section').style.display = 'none';
            document.getElementById('cliente-prodotti-section').style.display = 'block';
            document.getElementById('cliente-timesheet-section').style.display = 'block';

            // Aggiungi bottone Modifica Cliente prima dei prodotti
            addModificaClienteButton();

            loadClienteProdotti(clienteId);
            loadClienteTimesheet(clienteId);
            loadClienteQODNETStorico(clienteId);
            loadClienteMovimenti(clienteId, currentCliente.nome);
            
            // Scroll alla sezione prodotti
            document.getElementById('cliente-prodotti-section').scrollIntoView({ behavior: 'smooth' });
            
            showNotification('clienti-info', '✅ Cliente caricato', 'success');
        } else {
            throw new Error(data.error || 'Errore caricamento');
        }
        
    } catch (error) {
        console.error('Errore caricamento cliente:', error);
        showNotification('clienti-info', '❌ Errore caricamento cliente', 'error');
    }
}

/**
 * Aggiunge i bottoni Modifica e Esporta vCard nella sezione prodotti
 */
function addModificaClienteButton() {
    const prodottiSection = document.getElementById('cliente-prodotti-section');
    
    // Rimuovi container bottoni se presente
    const existingContainer = prodottiSection.querySelector('.cliente-action-buttons');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Crea il container per i bottoni
    const container = document.createElement('div');
    container.className = 'cliente-action-buttons';
    container.style.display = 'flex';
    container.style.gap = '10px';
    container.style.marginBottom = '15px';
    
    // Crea il bottone Modifica
    const btnModifica = document.createElement('button');
    btnModifica.className = 'btn-modifica-cliente';
    btnModifica.onclick = openClienteEdit;
    btnModifica.innerHTML = '✏️ Modifica Dati Cliente';
    
    // Crea il bottone Esporta Dati Cliente
    const btnExport = document.createElement('button');
    btnExport.className = 'btn-modifica-cliente';
    btnExport.setAttribute('onclick', 'showExportDataModal()');
    btnExport.innerHTML = '📇 Esporta Dati Cliente';
    
    // Aggiungi i bottoni al container
    container.appendChild(btnModifica);
    container.appendChild(btnExport);
    
    // Inserisci il container come primo elemento dopo l'h3
    const h3 = prodottiSection.querySelector('h3');
    if (h3) {
        h3.insertAdjacentElement('afterend', container);
    } else {
        prodottiSection.insertBefore(container, prodottiSection.firstChild);
    }
}

/**
 * Mostra il form con i dettagli del cliente
 */
function showClienteDetail(cliente) {
    // Popola il form
    document.getElementById('edit-id-cliente').value = cliente.id || '';
    document.getElementById('edit-nome-cliente').value = cliente.nome || '';
    document.getElementById('edit-titolo').value = cliente.titolo || '';
    document.getElementById('edit-indirizzo').value = cliente.indirizzo || '';
    document.getElementById('edit-cap').value = cliente.cap || '';
    document.getElementById('edit-citta').value = cliente.citta || '';
    document.getElementById('edit-piva').value = cliente.piva || '';
    document.getElementById('edit-cf').value = cliente.cf || '';
    document.getElementById('edit-sdi').value = cliente.sdi || '';
    document.getElementById('edit-email').value = cliente.email || '';
    document.getElementById('edit-referente').value = cliente.referente || '';
    document.getElementById('edit-attivo').value = cliente.attivo || 'SI';
    
    // Mostra le sezioni
    document.getElementById('cliente-detail-section').style.display = 'block';
    document.getElementById('cliente-prodotti-section').style.display = 'block';
    document.getElementById('cliente-timesheet-section').style.display = 'block';

    // Scroll alla sezione dettaglio
    document.getElementById('cliente-detail-section').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Chiude il dettaglio cliente
 */
function closeClienteDetail() {
    currentCliente = null;
    document.getElementById('cliente-detail-section').style.display = 'none';
    document.getElementById('cliente-prodotti-section').style.display = 'none';
    document.getElementById('cliente-timesheet-section').style.display = 'none';
    document.getElementById('cliente-form').reset();
    loadClienteMovimenti(null);
}

/**
 * Apre il form di modifica del cliente corrente
 */
function openClienteEdit() {
    if (!currentCliente) {
        alert('Nessun cliente selezionato');
        return;
    }
    showClienteDetail(currentCliente);
}

// =======================================================================
// === SALVATAGGIO CLIENTE ===
// =======================================================================

/**
 * Gestisce il submit del form cliente
 */
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('cliente-form');
    if (form) {
        form.addEventListener('submit', saveClienteChanges);
    }
});

/**
 * Salva le modifiche al cliente o crea un nuovo cliente
 */
async function saveClienteChanges(event) {
    event.preventDefault();
    
    // Previeni doppio submit
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) {
        return; // Già in elaborazione
    }
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Salvataggio...';
    }
    
    const isNew = currentCliente && currentCliente.isNew;
    const actionType = isNew ? 'create_cliente' : 'update_cliente';
    
    const clienteData = {
        nome: document.getElementById('edit-nome-cliente').value,
        titolo: document.getElementById('edit-titolo').value,
        indirizzo: document.getElementById('edit-indirizzo').value,
        cap: document.getElementById('edit-cap').value,
        citta: document.getElementById('edit-citta').value,
        piva: document.getElementById('edit-piva').value,
        cf: document.getElementById('edit-cf').value,
        sdi: document.getElementById('edit-sdi').value,
        email: document.getElementById('edit-email').value,
        referente: document.getElementById('edit-referente').value,
        attivo: document.getElementById('edit-attivo').value
    };
    
    // Se non è nuovo, aggiungi l'ID
    if (!isNew) {
        clienteData.id = document.getElementById('edit-id-cliente').value;
    }
    
    if (!clienteData.nome) {
        alert('Il nome del cliente è obbligatorio');
        return;
    }
    
    try {
        const messagePrefix = isNew ? 'Creazione' : 'Salvataggio';
        showNotification('clienti-info', `⏳ ${messagePrefix} in corso...`, 'info');
        
        // Importa CONFIG dalla window se non è definito
        
        const url = `${CONFIG.APPS_SCRIPT_URL}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: actionType,
                ...clienteData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (isNew) {
                showNotification('clienti-info', `✅ Cliente creato con successo! ID: ${data.clienteId}`, 'success');
                
                // Carica il cliente appena creato
                setTimeout(() => {
                    loadClienteDetail(data.clienteId);
                }, 1000);
            } else {
                showNotification('clienti-info', '✅ Cliente aggiornato con successo', 'success');
                currentCliente = clienteData;
                
                // Ricarica la ricerca se c'è un termine
                const searchTerm = document.getElementById('cliente-search').value;
                if (searchTerm) {
                    searchCliente();
                }
            }
        } else {
            throw new Error(data.error || `Errore ${messagePrefix.toLowerCase()}`);
        }
        
    } catch (error) {
        console.error('Errore salvataggio cliente:', error);
        const messagePrefix = isNew ? 'creazione' : 'salvataggio';
        showNotification('clienti-info', `❌ Errore durante ${messagePrefix}`, 'error');
    } finally {
        // Riabilita il pulsante
        const submitBtn = document.querySelector('#cliente-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '💾 Salva Modifiche';
        }
    }
}

// =======================================================================
// === NUOVO CLIENTE ===
// =======================================================================

/**
 * Mostra il form per un nuovo cliente
 */
function openNewClienteForm() {
    currentCliente = { id: '', isNew: true };
    
    // Reset del form
    document.getElementById('cliente-form').reset();
    document.getElementById('edit-id-cliente').value = '(Verrà assegnato automaticamente)';
    document.getElementById('edit-attivo').value = 'SI';
    
    // Mostra solo la sezione dettaglio
    document.getElementById('cliente-detail-section').style.display = 'block';
    document.getElementById('cliente-prodotti-section').style.display = 'none';
    document.getElementById('cliente-timesheet-section').style.display = 'none';
    
    // Scroll alla sezione
    document.getElementById('cliente-detail-section').scrollIntoView({ behavior: 'smooth' });
    
    showNotification('clienti-info', 'ℹ️ Compilare i dati del nuovo cliente', 'info');
}


// =======================================================================
// === ASSEGNAZIONE ID MANCANTI ===
// =======================================================================

/**
 * Assegna ID a tutti i clienti che non ne hanno uno
 */
async function assignMissingClientIDs() {
    if (!confirm('Vuoi assegnare automaticamente gli ID ai clienti che non ne hanno uno?')) {
        return;
    }
    
    const resultBox = document.getElementById('assign-id-result');
    function showResult(msg, ok) {
        if (resultBox) {
            resultBox.style.display = 'block';
            resultBox.style.background = ok ? '#e8f5ee' : '#fdecea';
            resultBox.style.color = ok ? '#2e7d32' : '#c62828';
            resultBox.innerHTML = `<p style="margin:0;">${msg}</p>`;
        }
    }
    try {
        showResult('⏳ Assegnazione in corso...', true);
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=assign_missing_ids`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.success) {
            showResult(data.assigned > 0 ? `✅ Assegnati ${data.assigned} ID mancanti` : `✅ Nessun ID mancante — tutti i clienti hanno già un ID`, true);
        } else {
            throw new Error(data.error || 'Errore assegnazione');
        }
    } catch (error) {
        console.error('Errore assegnazione ID:', error);
        showResult('❌ Errore durante l\'assegnazione: ' + error.message, false);
    }
}

// =======================================================================
// === PRODOTTI CLIENTE ===
// =======================================================================

/**
 * Carica i prodotti attivi del cliente
 */
async function loadClienteProdotti(clienteId) {
    try {
        const contentDiv = document.getElementById('cliente-prodotti-content');
        contentDiv.innerHTML = '<p class="text-muted">⏳ Caricamento prodotti...</p>';
        
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_cliente_prodotti&id=${encodeURIComponent(clienteId)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            // ✅ Cache per renewProduct()
            currentClienteProdotti = data.prodotti;
            // Nome cliente disponibile in currentCliente (variabile locale)
            
            displayClienteProdotti(data.prodotti);
        } else {
            contentDiv.innerHTML = '<p class="empty-state">Errore caricamento prodotti</p>';
        }
        
    } catch (error) {
        console.error('Errore caricamento prodotti:', error);
        document.getElementById('cliente-prodotti-content').innerHTML = 
            '<p class="empty-state">Errore caricamento prodotti</p>';
    }
}

/**
 * Visualizza i prodotti del cliente
 */
function displayClienteProdotti(prodotti) {
    const contentDiv = document.getElementById('cliente-prodotti-content');
    
    if (!prodotti || prodotti.length === 0) {
        contentDiv.innerHTML = '<p class="empty-state">Nessun prodotto attivo per questo cliente</p>';
        return;
    }
    
    let html = '';
    
    prodotti.forEach(prodotto => {
        const tipoClass = prodotto.tipo.toLowerCase();
        const statusClass = prodotto.stato.toLowerCase().replace(' ', '-');
        
        html += `
            <div class="prodotto-item">
                <div class="prodotto-header">
                    <span class="prodotto-type ${tipoClass}">${getEmojiForType(prodotto.tipo)} ${prodotto.tipo}</span>
                    <span class="prodotto-status ${statusClass}">${prodotto.stato}</span>
                </div>
                <div class="prodotto-body">
                    ${prodotto.descrizione ? `
                    <div class="prodotto-info-item">
                        <span class="prodotto-info-label">Descrizione</span>
                        <span class="prodotto-info-value">${prodotto.descrizione}</span>
                    </div>` : ''}
                    ${prodotto.dataInizio ? `
                    <div class="prodotto-info-item">
                        <span class="prodotto-info-label">Data Inizio</span>
                        <span class="prodotto-info-value">${prodotto.dataInizio}</span>
                    </div>` : ''}
                    ${prodotto.tipo === 'Pacchetto' && prodotto.oreAcquistate !== undefined ? `
                    <div class="prodotto-info-item">
                        <span class="prodotto-info-label">Ore acquistate</span>
                        <span class="prodotto-info-value">${prodotto.oreAcquistate}h</span>
                    </div>
                    <div class="prodotto-info-item">
                        <span class="prodotto-info-label">Ore utilizzate</span>
                        <span class="prodotto-info-value">${prodotto.oreUtilizzate}h</span>
                    </div>
                    <div class="prodotto-info-item">
                        <span class="prodotto-info-label">Ore residue</span>
                        <span class="prodotto-info-value" style="font-weight:600;color:${prodotto.oreResidue <= 0 ? '#dc3545' : prodotto.oreResidue <= 5 ? '#fd7e14' : '#28a745'};">${prodotto.oreResidue}h</span>
                    </div>` : prodotto.oreResidue !== undefined ? `
                    <div class="prodotto-info-item">
                        <span class="prodotto-info-label">Ore Residue</span>
                        <span class="prodotto-info-value">${prodotto.oreResidue}h</span>
                    </div>` : ''}
                    ${prodotto.dataScadenza ? (() => {
                        const parts = prodotto.dataScadenza.split('/');
                        const scad = new Date(parts[2], parts[1]-1, parts[0]);
                        const giorni = Math.ceil((scad - new Date()) / 86400000);
                        const color = giorni < 0 ? '#dc3545' : giorni <= 30 ? '#fd7e14' : '#28a745';
                        const label = giorni < 0 ? `Scaduto da ${Math.abs(giorni)} giorni` : `${giorni} giorni alla scadenza`;
                        return `<div class="prodotto-info-item">
                        <span class="prodotto-info-label">Scadenza</span>
                        <span class="prodotto-info-value" style="color:${color};font-weight:600;">${prodotto.dataScadenza} — ${label}</span>
                    </div>`;
                    })() : ''}
                    ${prodotto.importo ? `
                    <div class="prodotto-info-item">
                        <span class="prodotto-info-label">Importo</span>
                        <span class="prodotto-info-value">€ ${prodotto.importo}</span>
                    </div>` : ''}
                </div>
                ${prodotto.tipo === 'Pacchetto' ? `
                <div class="prodotto-actions">
                    <button class="btn btn-sm btn-secondary" onclick="openPacchettoDettaglio('${prodotto.id}', '${(prodotto.descrizione||'Pacchetto').replace(/'/g,"\\'")}')">
                        📋 Dettaglio interventi
                    </button>
                </div>` : prodotto.canRenew ? `
                <div class="prodotto-actions">
                    <button class="btn btn-sm btn-primary" onclick="renewProduct('${prodotto.id}', '${prodotto.tipo}')">
                        🔄 Rinnova
                    </button>
                </div>` : ''}
            </div>
        `;
    });
    
    contentDiv.innerHTML = html;
}

/**
 * Restituisce l'emoji per il tipo di prodotto
 */
function getEmojiForType(tipo) {
    const emojis = {
        'Pacchetto': '📦',
        'Canone': '💰',
        'Firma': '✍️'
    };
    return emojis[tipo] || '📄';
}

// =======================================================================
// === TIMESHEET CLIENTE ===
// =======================================================================

/**
 * Carica i timesheet non fatturati del cliente
 */
async function loadClienteTimesheet(clienteId) {
    try {
        const contentDiv = document.getElementById('cliente-timesheet-content');
        contentDiv.innerHTML = '<p class="text-muted">⏳ Caricamento timesheet...</p>';
        
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_cliente_timesheet&id=${encodeURIComponent(clienteId)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            displayClienteTimesheet(data.timesheet);
        } else {
            contentDiv.innerHTML = '<p class="empty-state">Errore caricamento timesheet</p>';
        }
        
    } catch (error) {
        console.error('Errore caricamento timesheet:', error);
        document.getElementById('cliente-timesheet-content').innerHTML = 
            '<p class="empty-state">Errore caricamento timesheet</p>';
    }
}

/**
 * Visualizza i timesheet del cliente
 */
function displayClienteTimesheet(timesheet) {
    const contentDiv = document.getElementById('cliente-timesheet-content');
    
    if (!timesheet || timesheet.length === 0) {
        contentDiv.innerHTML = '<p class="empty-state">Nessun timesheet in sospeso per questo cliente</p>';
        return;
    }

    let totalOre = 0;
    let totalCosto = 0;
    let totalExtra = 0;

    let html = `
        <table class="timesheet-table">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Descrizione</th>
                    <th>Ore</th>
                    <th>Extra</th>
                    <th>Stato</th>
                    <th>Tipo</th>
                    <th>Costo €</th>
                    <th>Azioni</th>
                </tr>
            </thead>
            <tbody>
    `;

    timesheet.forEach(ts => {
        totalOre  += parseFloat(ts.ore)  || 0;
        totalCosto+= parseFloat(ts.costo)|| 0;

        const isErrore = ts.modAddebito === 'Errore Pacchetto';
        const hasExtra = ts.oreExtra > 0;
        totalExtra += hasExtra ? (parseFloat(ts.oreExtra) || 0) : isErrore ? (parseFloat(ts.ore) || 0) : 0;

        const rowStyle = isErrore ? 'background:#fff3cd;' : hasExtra ? 'background:#ffe5e5;' : '';

        const statoLabel = isErrore
            ? '<span style="color:#dc3545;font-weight:600;font-size:11px;">⚠️ Nessun pacchetto</span>'
            : hasExtra
                ? '<span style="color:#dc3545;font-weight:600;font-size:11px;">⚠️ Ore extra</span>'
                : '<span style="color:#28a745;font-size:11px;">Da fatturare</span>';

        const oreActionabili = hasExtra ? ts.oreExtra : isErrore ? ts.ore : 0;
        const extraCell = hasExtra
            ? `<td style="color:#dc3545;font-weight:600;white-space:nowrap;" title="${ts.ore}h totali, ${ts.ore - ts.oreExtra}h già scalate">+${ts.oreExtra}h</td>`
            : isErrore
                ? `<td style="color:#dc3545;font-weight:600;white-space:nowrap;">+${ts.ore}h</td>`
                : '<td style="color:#6c757d;">—</td>';

        html += `
            <tr style="${rowStyle}">
                <td>${ts.data}</td>
                <td>${ts.descrizione}</td>
                <td style="white-space:nowrap;">${hasExtra ? `<span title="${ts.ore}h totali">${ts.ore - ts.oreExtra}h+<span style="color:#dc3545;">${ts.oreExtra}h</span></span>` : `${ts.ore}h`}</td>
                ${extraCell}
                <td>${statoLabel}</td>
                <td>${ts.tipoIntervento}</td>
                <td style="text-align:right;">${parseFloat(ts.costo).toFixed(2)}</td>
                <td class="actions-column" style="white-space:nowrap;">
                    <button class="timesheet-edit-btn" onclick="editTimesheet(${ts.rowIndex}, '${ts.id}')">✏️</button>
                    ${(isErrore || hasExtra) ? `
                      <button class="timesheet-edit-btn" style="background:#28a745;color:#fff;margin-left:4px;"
                        onclick="${isErrore ? `convertiDaFatturare(${ts.rowIndex})` : `convertiExtraDaFatturare(${ts.rowIndex},${ts.oreExtra})`}"
                        title="Converti in Da fatturare">💶</button>
                      <button class="timesheet-edit-btn" style="background:#1976D2;color:#fff;margin-left:4px;"
                        onclick="apriScalaInPacchetto(${ts.rowIndex},${oreActionabili})"
                        title="Scala in un pacchetto esistente">📦</button>` : ''}
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
            <tfoot>
                <tr style="font-weight:bold;background:#f8f9fa;">
                    <td colspan="2" style="text-align:right;">TOTALE:</td>
                    <td style="white-space:nowrap;">${totalOre.toFixed(2)}h</td>
                    <td style="color:#dc3545;">${totalExtra > 0 ? '+' + totalExtra.toFixed(2) + 'h da gestire' : '—'}</td>
                    <td colspan="2"></td>
                    <td style="text-align:right;">€&nbsp;${totalCosto.toFixed(2)}</td>
                    <td></td>
                </tr>
            </tfoot>
        </table>
    `;
    
    contentDiv.innerHTML = html;
}

/**
 * Rinnova un prodotto
 */
function renewProduct(prodottoId, tipoProdotto) {
    console.log(`🔄 Rinnovo ${tipoProdotto}: ${prodottoId}`);
    
    // 🔍 DEBUG: Stato cache
    console.log('DEBUG renewProduct - Cache state:', {
        currentClienteProdotti: currentClienteProdotti,
        length: currentClienteProdotti?.length,
        allIds: currentClienteProdotti?.map(p => ({ id: p.id, tipo: p.tipo }))
    });
    
    // Verifica che vendite.js sia caricato
    if (typeof openRinnovoModal !== 'function') {
        alert('Errore: vendite.js non caricato. Verifica l\'ordine degli script.');
        return;
    }
    
    // 🔧 FIX: Recupera prodotto con confronto TYPE-SAFE (stringa vs numero)
    const prodotto = currentClienteProdotti?.find(p => 
        String(p.id).trim() === String(prodottoId).trim()
    );
    
    console.log('DEBUG renewProduct - Search result:', {
        searchingFor: prodottoId,
        searchingForType: typeof prodottoId,
        found: !!prodotto,
        foundId: prodotto?.id,
        foundType: prodotto ? typeof prodotto.id : 'N/A'
    });
    
    if (!prodotto) {
        console.error('⚠️ Prodotto non trovato:', {
            prodottoId,
            tipoProdotto,
            availableIds: currentClienteProdotti?.map(p => p.id),
            cacheLength: currentClienteProdotti?.length
        });
        
        // Alert più dettagliato per debug
        alert(`⚠️ Prodotto non trovato!\n\nCercato: ${prodottoId}\nDisponibili: ${currentClienteProdotti?.map(p => p.id).join(', ') || 'nessuno'}`);
        return;
    }
    
    // Prepara dati nel formato atteso da openRinnovoModal
    console.log('✅ Prodotto trovato:', {
        prodottoId: prodotto.id,
        tipoProdotto: tipoProdotto,
        currentClienteNome: currentCliente?.nome || '',
        prodottoData: prodotto
    });
    
    // Determina tipo API
    const tipoAPI = tipoProdotto.toLowerCase().includes('canone') ? 'CANONE' : 'FIRMA';
    
    // 🔧 FIX: Imposta dati globali per vendite.js (legacy)
    window.currentProdottoRinnovo = {
        idCanone: tipoAPI === 'CANONE' ? prodotto.id : undefined,
        idFirma: tipoAPI === 'FIRMA' ? prodotto.id : undefined,
        nomeCliente: currentCliente?.nome || '',
        descrizione: prodotto.descrizione || '',
        dataScadenza: prodotto.dataScadenza,
        importo: prodotto.importo || '',
        tipo: prodotto.tipo || 'Token'
    };
    
    // Chiama la funzione esistente
    openRinnovoModal(prodotto.id, tipoAPI);
}

// =======================================================================
// === ESPORTA DATI CLIENTE ===
// =======================================================================

/**
 * Formatta i dati del cliente per la visualizzazione
 */
function formatClientData(cliente) {
    let data = [];
    
    // Titolo e Nome
    if (cliente.titolo) data.push(cliente.titolo);
    if (cliente.nome) data.push(cliente.nome);
    
    // Indirizzo
    if (cliente.indirizzo) data.push(cliente.indirizzo);
    let citta = [];
    if (cliente.cap) citta.push(cliente.cap);
    if (cliente.citta) citta.push(cliente.citta);
    if (cliente.provincia) citta.push(`(${cliente.provincia})`);
    if (citta.length > 0) data.push(citta.join(' '));
    
    data.push(''); // Riga vuota
    
    // Dati fiscali
    if (cliente.piva) data.push(`P.IVA: ${cliente.piva}`);
    if (cliente.cf) data.push(`CF: ${cliente.cf}`);
    if (cliente.sdi) data.push(`SDI: ${cliente.sdi}`);
    
    data.push(''); // Riga vuota
    
    // Contatti
    if (cliente.email) data.push(`📧 ${cliente.email}`);
    if (cliente.cellulare) data.push(`📱 ${cliente.cellulare}`);
    if (cliente.telefono) data.push(`📞 ${cliente.telefono}`);
    if (cliente.pec) data.push(`PEC: ${cliente.pec}`);
    
    return data.join('\n');
}

/**
 * Mostra il modal con i dati del cliente
 */
function showExportDataModal() {
    if (!currentCliente) {
        alert('Nessun cliente selezionato');
        return;
    }
    
    const modal = document.getElementById('export-data-modal');
    const content = document.getElementById('export-data-content');
    
    // Formatta e inserisci i dati
    content.textContent = formatClientData(currentCliente);
    
    // Mostra il modal
    modal.style.display = 'flex';
}

/**
 * Chiude il modal
 */
function closeExportDataModal() {
    document.getElementById('export-data-modal').style.display = 'none';
}

/**
 * Copia i dati del cliente negli appunti
 */
async function copyClientData() {
    if (!currentCliente) {
        alert('Nessun cliente selezionato');
        return;
    }
    
    const dataText = formatClientData(currentCliente);
    const btn = event.target;
    const originalText = btn.innerHTML;
    
    // Prova prima con Clipboard API moderna
    try {
        await navigator.clipboard.writeText(dataText);
        showCopySuccess(btn, originalText);
        return;
    } catch (err) {
        // Ignora l'errore, prova con execCommand
    }
    
    // Fallback con execCommand (più compatibile con smartphone)
    const textArea = document.createElement('textarea');
    textArea.value = dataText;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            showCopySuccess(btn, originalText);
        }
        // Se fallisce, non mostra niente - la copia potrebbe comunque essere avvenuta
    } catch (err) {
        document.body.removeChild(textArea);
        // Ignora l'errore - se la copia è avvenuta, l'utente lo vedrà
    }
}

/**
 * Helper per mostrare feedback successo copia
 */
function showCopySuccess(btn, originalText) {
    showNotification('clienti-info', '✅ Dati copiati negli appunti', 'success');
    
    btn.innerHTML = '✅ Copiato!';
    btn.disabled = true;
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }, 2000);
}

// =======================================================================
// === ESPORTA VCARD ===
// =======================================================================

/**
 * Genera e scarica il file vCard per il cliente corrente
 */
function exportVCard() {
    if (!currentCliente) {
        alert('Nessun cliente selezionato');
        return;
    }
    
    // Genera il contenuto vCard versione 3.0
    let vcard = 'BEGIN:VCARD\n';
    vcard += 'VERSION:3.0\n';
    
    // Nome (obbligatorio in vCard)
    const nome = currentCliente.nome || 'Sconosciuto';
    vcard += `FN:${nome}\n`;
    vcard += `N:${nome};;;;\n`;
    
    // Titolo/Qualifica
    if (currentCliente.titolo) {
        vcard += `TITLE:${currentCliente.titolo}\n`;
    }
    
    // Organizzazione
    if (currentCliente.nome) {
        vcard += `ORG:${currentCliente.nome}\n`;
    }
    
    // Email
    if (currentCliente.email) {
        vcard += `EMAIL;TYPE=INTERNET:${currentCliente.email}\n`;
    }
    
    // Cellulare
    if (currentCliente.cellulare) {
        vcard += `TEL;TYPE=CELL:${currentCliente.cellulare}\n`;
    }
    
    // Telefono fisso
    if (currentCliente.telefono) {
        vcard += `TEL;TYPE=WORK,VOICE:${currentCliente.telefono}\n`;
    }
    
    // Indirizzo
    if (currentCliente.indirizzo || currentCliente.cap || currentCliente.citta || currentCliente.provincia) {
        const via = currentCliente.indirizzo || '';
        const cap = currentCliente.cap || '';
        const citta = currentCliente.citta || '';
        const provincia = currentCliente.provincia || '';
        
        // Formato ADR: casella postale; indirizzo esteso; via; città; regione; CAP; paese
        vcard += `ADR;TYPE=WORK:;;${via};${citta};${provincia};${cap};Italia\n`;
    }
    
    // Note aggiuntive con dati fiscali
    let note = [];
    if (currentCliente.piva) {
        note.push(`P.IVA: ${currentCliente.piva}`);
    }
    if (currentCliente.cf) {
        note.push(`CF: ${currentCliente.cf}`);
    }
    if (currentCliente.id) {
        note.push(`ID Cliente: ${currentCliente.id}`);
    }
    if (currentCliente.sdi) {
        note.push(`Codice SDI: ${currentCliente.sdi}`);
    }
    if (currentCliente.pec) {
        note.push(`PEC: ${currentCliente.pec}`);
    }
    
    if (note.length > 0) {
        vcard += `NOTE:${note.join(' - ')}\n`;
    }
    
    vcard += 'END:VCARD';
    
    // Crea il blob e scarica il file
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Nome file: usa ID cliente o nome sanitizzato
    const fileName = currentCliente.id || currentCliente.nome.replace(/[^a-z0-9]/gi, '_');
    link.href = url;
    link.download = `${fileName}.vcf`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    showNotification('clienti-info', '✅ vCard esportata con successo', 'success');
    closeExportDataModal(); // Chiudi il modal dopo l'esportazione
}

console.log('✅ Clienti module caricato');

// Esponi funzioni globalmente per onclick

// =======================================================================
// === MODAL MODIFICA TIMESHEET ===
// =======================================================================

let currentTimesheetData = null;

/**
 * Apre il modal per modificare un timesheet
 */
async function editTimesheet(rowIndex, idIntervento) {
    try {
        // Carica i dati completi del timesheet
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_timesheet_detail&row=${rowIndex}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            alert('Errore nel caricamento del timesheet');
            return;
        }
        
        currentTimesheetData = data.timesheet;

        const ts = currentTimesheetData;
        const isExtra  = ts.oreExtra > 0;
        const isErrore = ts.modAddebito === 'Errore Pacchetto';

        // Determina modalità e ore da mostrare
        let mode = '';
        let oreDisplay = ts.ore;
        let bannerMsg = '';

        if (isExtra) {
            mode = 'extra';
            oreDisplay = ts.oreExtra;
            const oreScalate = ts.ore - ts.oreExtra;
            bannerMsg = `⚠️ Stai gestendo <strong>${ts.oreExtra}h extra</strong> (le ${oreScalate}h scalate al pacchetto rimangono invariate). Salvando verrà creata una nuova riga "Da fatturare" per queste ore.`;
        } else if (isErrore) {
            mode = 'errore';
            bannerMsg = `⚠️ Intervento senza pacchetto valido. Salvando verrà convertito in <strong>"Da fatturare"</strong>.`;
        }

        // Popola il modal
        document.getElementById('ts-row-index').value = rowIndex;
        document.getElementById('ts-id-intervento').value = idIntervento;
        document.getElementById('ts-id-display').value = idIntervento;
        document.getElementById('ts-extra-mode').value = mode;
        document.getElementById('ts-ore-extra-orig').value = ts.oreExtra || 0;
        document.getElementById('ts-data').value = ts.data;
        document.getElementById('ts-ore').value = oreDisplay;
        document.getElementById('ts-descrizione').value = ts.descrizione;
        document.getElementById('ts-tipo').value = ts.tipoIntervento;
        document.getElementById('ts-modalita').value = ts.modEsecuzione;
        document.getElementById('ts-chiamata').value = ts.chiamata || '';
        document.getElementById('ts-costo').value = ts.costo;

        // Banner
        const banner = document.getElementById('ts-extra-banner');
        if (bannerMsg) {
            banner.innerHTML = bannerMsg;
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }

        // Titolo modale
        document.querySelector('#edit-timesheet-modal h2').textContent =
            mode === 'extra'  ? '💶 Gestisci ore extra' :
            mode === 'errore' ? '⚠️ Converti in Da fatturare' :
            '✏️ Modifica Timesheet';

        // Mostra il modal
        document.getElementById('edit-timesheet-modal').style.display = 'flex';
        
    } catch (error) {
        console.error('Errore apertura modal:', error);
        alert('Errore nel caricamento del timesheet');
    }
}

/**
 * Chiude il modal
 */
function closeEditTimesheetModal() {
    document.getElementById('edit-timesheet-modal').style.display = 'none';
    document.getElementById('ts-extra-mode').value = '';
    document.getElementById('ts-extra-banner').style.display = 'none';
    document.querySelector('#edit-timesheet-modal h2').textContent = '✏️ Modifica Timesheet';
    currentTimesheetData = null;
}

/**
 * Salva le modifiche al timesheet
 */
async function saveTimesheetChanges(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) return;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Salvataggio...';
    }
    
    try {
        const mode     = document.getElementById('ts-extra-mode').value;
        const rowIndex = document.getElementById('ts-row-index').value;
        const oreExtra = parseFloat(document.getElementById('ts-ore-extra-orig').value) || 0;

        const formData = {
            data:           document.getElementById('ts-data').value,
            ore:            document.getElementById('ts-ore').value,
            descrizione:    document.getElementById('ts-descrizione').value,
            tipoIntervento: document.getElementById('ts-tipo').value,
            modEsecuzione:  document.getElementById('ts-modalita').value,
            chiamata:       document.getElementById('ts-chiamata').value,
            costo:          document.getElementById('ts-costo').value
        };

        let body, successMsg;

        if (mode === 'extra') {
            // Crea nuova riga Da fatturare con le ore e i dati del form, azzera EXTRA sull'originale
            body = new URLSearchParams({
                action: 'crea_entry_da_fatturare',
                row_index: rowIndex,
                ore_extra: oreExtra,
                data_override: formData.data,
                descrizione_override: formData.descrizione,
                ore_override: formData.ore,
                tipo_override: formData.tipoIntervento,
                mod_esec_override: formData.modEsecuzione
            });
            successMsg = `✅ Creata riga "Da fatturare" per ${formData.ore}h`;
        } else if (mode === 'errore') {
            // Aggiorna la riga cambiando Mod_Addebito in Da fatturare
            body = new URLSearchParams({
                action: 'update_timesheet',
                rowIndex,
                modAddebito: 'Da fatturare',
                ...formData
            });
            successMsg = '✅ Convertito in "Da fatturare"';
        } else {
            // Modifica normale
            body = new URLSearchParams({
                action: 'update_timesheet',
                rowIndex,
                ...formData
            });
            successMsg = '✅ Timesheet aggiornato con successo';
        }

        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });

        const data = await response.json();

        if (data.success) {
            showNotification('clienti-info', successMsg, 'success');
            closeEditTimesheetModal();
            
            // Ricarica i timesheet del cliente
            if (currentCliente && currentCliente.id) {
                loadClienteTimesheet(currentCliente.id);
            }
        } else {
            throw new Error(data.error || 'Errore salvataggio');
        }
        
    } catch (error) {
        console.error('Errore salvataggio timesheet:', error);
        showNotification('clienti-info', '❌ Errore durante il salvataggio', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '💾 Salva Modifiche';
        }
    }
}

// Event listener per il form
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('edit-timesheet-form');
    if (form) {
        form.addEventListener('submit', saveTimesheetChanges);
    }
});

// =======================================================================
// === EXPORT MODULI ES6 ===
// =======================================================================

// =======================================================================
// === AZIONI RAPIDE DALLA CARD CLIENTE ===
// =======================================================================

/**
 * Visualizza rapidamente il dettaglio cliente in un alert
 */
function quickViewCliente(clienteId) {
    const cliente = allClienti.find(c => c.id === clienteId);
    if (!cliente) {
        alert('Cliente non trovato');
        return;
    }
    currentCliente = cliente;
    showExportDataModal();
}

/**
 * Apre form modifica cliente rapidamente
 */
function quickEditCliente(clienteId) {
    const cliente = allClienti.find(c => c.id === clienteId);
    if (!cliente) {
        alert('Cliente non trovato');
        return;
    }
    
    // Imposta currentCliente e apri modal modifica
    currentCliente = cliente;
    openClienteEdit();
}

/**
 * Copia dati cliente rapidamente
 */
function quickCopyCliente(cliente) {
    const datiCliente = `${cliente.nome || ''}
${cliente.indirizzo || ''}
${cliente.cap || ''} ${cliente.citta || ''}
P.IVA: ${cliente.piva || 'N/D'}
CF: ${cliente.cf || 'N/D'}
SDI: ${cliente.sdi || 'N/D'}
Email: ${cliente.email || 'N/D'}`;
    
    navigator.clipboard.writeText(datiCliente).then(() => {
        alert('✅ Dati cliente copiati negli appunti!');
    }).catch(err => {
        console.error('Errore copia:', err);
        alert('❌ Errore durante la copia');
    });
}

/**
 * Esporta vCard rapidamente
 */
function quickExportVCard(cliente) {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${cliente.nome || ''}
ORG:${cliente.nome || ''}
TEL;TYPE=CELL:${cliente.cellulare || ''}
TEL;TYPE=WORK:${cliente.telefono || ''}
EMAIL:${cliente.email || ''}
ADR;TYPE=WORK:;;${cliente.indirizzo || ''};${cliente.citta || ''};;${cliente.cap || ''};Italy
NOTE:P.IVA: ${cliente.piva || ''} - CF: ${cliente.cf || ''} - SDI: ${cliente.sdi || ''}
END:VCARD`;
    
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cliente.nome || 'cliente'}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Export per uso come modulo
export {
    searchCliente,
    loadClienteDetail,
    showClienteDetail,
    closeClienteDetail,
    openClienteEdit,
    openNewClienteForm,
    assignMissingClientIDs,
    showExportDataModal,
    closeExportDataModal
};

async function openPacchettoDettaglio(idPacchetto, descrizione, meta) {
    // meta opzionale: { nomeCliente, dataAcquisto, dataScadenza, oreAcquistate }
    const modal = document.getElementById('pacchetto-dettaglio-modal');
    const title = document.getElementById('pacchetto-dettaglio-title');
    const content = document.getElementById('pacchetto-dettaglio-content');
    if (!modal) return;

    title.textContent = '📋 ' + (descrizione || idPacchetto);
    content.innerHTML = '<p style="padding:20px;text-align:center;">⏳ Caricamento interventi...</p>';
    modal.style.display = 'flex';

    try {
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_pacchetto_timesheet&id_pacchetto=${encodeURIComponent(idPacchetto)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        const rows = data.interventi || [];
        if (rows.length === 0) {
            content.innerHTML = '<p style="padding:20px;text-align:center;color:#6c757d;">Nessun intervento registrato per questo pacchetto.</p>';
            return;
        }

        let html = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f8f9fa;">
                <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">Data</th>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">Descrizione</th>
                <th style="padding:8px;text-align:center;border-bottom:2px solid #dee2e6;">Ore</th>
                <th style="padding:8px;text-align:center;border-bottom:2px solid #dee2e6;">Extra</th>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">Tipo</th>
                <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Costo €</th>
            </tr></thead><tbody>`;

        rows.forEach(r => {
            const extraCell = r.oreExtra > 0 ? `<td style="padding:8px;text-align:center;color:#dc3545;font-weight:600;">+${r.oreExtra}h</td>` : '<td style="padding:8px;text-align:center;color:#adb5bd;">—</td>';
            html += `<tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:8px;white-space:nowrap;">${r.data}</td>
                <td style="padding:8px;">${r.descrizione}</td>
                <td style="padding:8px;text-align:center;">${r.ore}h</td>
                ${extraCell}
                <td style="padding:8px;">${r.tipoIntervento}</td>
                <td style="padding:8px;text-align:right;">${r.costo.toFixed(2)}</td>
            </tr>`;
        });

        html += `</tbody><tfoot><tr style="background:#f8f9fa;font-weight:700;">
            <td colspan="2" style="padding:8px;text-align:right;">TOTALE</td>
            <td style="padding:8px;text-align:center;">${data.totOre.toFixed(2)}h</td>
            <td style="padding:8px;text-align:center;color:#dc3545;">${data.totExtra > 0 ? '+'+data.totExtra.toFixed(2)+'h' : '—'}</td>
            <td></td>
            <td style="padding:8px;text-align:right;">€ ${data.totCosto.toFixed(2)}</td>
        </tr></tfoot></table>`;

        // Determina nomeCliente: da meta (storico) oppure dal cliente corrente
        const nomeCliente = (meta && meta.nomeCliente) || (typeof currentCliente !== 'undefined' && currentCliente?.nome) || '';
        const oreAcquistate = (meta && meta.oreAcquistate) || 0;
        const dataAcquisto  = (meta && meta.dataAcquisto)  || '';
        const dataScadenza  = (meta && meta.dataScadenza)  || '';

        modal.dataset.exportData = JSON.stringify({
            idPacchetto, descrizione, nomeCliente, oreAcquistate, dataAcquisto, dataScadenza,
            rows: data.interventi, totOre: data.totOre, totExtra: data.totExtra, totCosto: data.totCosto
        });
        content.innerHTML = html;
    } catch(err) {
        content.innerHTML = `<p style="padding:20px;text-align:center;color:#dc3545;">❌ Errore: ${err.message}</p>`;
    }
}

function stampaPacchettoDettaglio() {
    const modal = document.getElementById('pacchetto-dettaglio-modal');
    if (!modal || !modal.dataset.exportData) return;
    const d = JSON.parse(modal.dataset.exportData);
    if (typeof stampaPacchettoRiepilogo === 'function') {
        stampaPacchettoRiepilogo(d.idPacchetto, d.nomeCliente, d.descrizione, d.rows,
            d.totOre, d.totExtra, d.totCosto, d.dataAcquisto, d.dataScadenza, d.oreAcquistate);
    }
}

function closePacchettoDettaglioModal() {
    const modal = document.getElementById('pacchetto-dettaglio-modal');
    if (modal) modal.style.display = 'none';
}

function exportPacchettoDettaglio() {
    const modal = document.getElementById('pacchetto-dettaglio-modal');
    if (!modal || !modal.dataset.exportData) return;
    const { idPacchetto, descrizione, rows, totOre, totExtra } = JSON.parse(modal.dataset.exportData);

    let csv = `Pacchetto: ${idPacchetto} - ${descrizione}\n`;
    csv += `Data;Descrizione;Ore;Ore Extra;Tipo Intervento;Costo\n`;
    rows.forEach(r => {
        csv += `${r.data};"${r.descrizione}";${r.ore};${r.oreExtra||0};${r.tipoIntervento};${r.costo.toFixed(2)}\n`;
    });
    csv += `\nTOTALE;;${totOre.toFixed(2)};${totExtra.toFixed(2)};;\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pacchetto_${idPacchetto}_interventi.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function convertiDaFatturare(rowIndex) {
    if (!confirm('Convertire questa riga in "Da fatturare"? Sarà inclusa nella prossima proforma.')) return;
    try {
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=converti_da_fatturare&row_index=${rowIndex}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        showNotification('clienti-info', '✅ Convertita in Da fatturare', 'success');
        if (currentCliente) loadClienteTimesheet(currentCliente.id);
    } catch(err) {
        alert('❌ Errore: ' + err.message);
    }
}

async function convertiExtraDaFatturare(rowIndex, oreExtra) {
    if (!confirm(`Creare una nuova riga "Da fatturare" per ${oreExtra}h extra?`)) return;
    try {
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=crea_entry_da_fatturare&row_index=${rowIndex}&ore_extra=${oreExtra}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        showNotification('clienti-info', '✅ Creata nuova riga Da fatturare (' + oreExtra + 'h)', 'success');
        if (currentCliente) loadClienteTimesheet(currentCliente.id);
    } catch(err) {
        alert('❌ Errore: ' + err.message);
    }
}

function apriScalaInPacchetto(rowIndex, oreActionabili) {
    const modal = document.getElementById('scala-extra-modal');
    if (!modal) return;

    const pacchetti = (currentClienteProdotti || []).filter(p => p.tipo === 'Pacchetto' && p.stato === 'ATTIVO');
    const select = document.getElementById('scala-extra-select');
    select.innerHTML = '';

    if (pacchetti.length === 0) {
        select.innerHTML = '<option value="">Nessun pacchetto attivo disponibile</option>';
        document.getElementById('scala-extra-confirm').disabled = true;
    } else {
        document.getElementById('scala-extra-confirm').disabled = false;
        pacchetti.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.id}${p.descrizione ? ' — ' + p.descrizione : ''} (${p.oreResidue}h residue)`;
            select.appendChild(opt);
        });
    }

    modal.dataset.rowIndex    = rowIndex;
    modal.dataset.oreActionabili = oreActionabili;
    modal.style.display = 'flex';
}

async function eseguiScalaExtra() {
    const modal = document.getElementById('scala-extra-modal');
    const rowIndex      = parseInt(modal.dataset.rowIndex);
    const oreActionabili = parseFloat(modal.dataset.oreActionabili);
    const idPacchetto   = document.getElementById('scala-extra-select').value;
    if (!idPacchetto) { alert('Seleziona un pacchetto'); return; }

    const btn = document.getElementById('scala-extra-confirm');
    btn.disabled = true; btn.textContent = '⏳ ...';
    try {
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=scala_extra_in_pacchetto&row_index=${rowIndex}&id_pacchetto=${encodeURIComponent(idPacchetto)}&ore_extra=${oreActionabili}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        showNotification('clienti-info', `✅ ${oreActionabili}h scalate dal pacchetto ${idPacchetto}`, 'success');
        modal.style.display = 'none';
        if (currentCliente) {
            loadClienteTimesheet(currentCliente.id);
            loadClienteProdotti(currentCliente.id);
        }
    } catch(err) {
        alert('❌ Errore: ' + err.message);
    } finally {
        btn.disabled = false; btn.textContent = '📦 Scala';
    }
}

function chiudiScalaExtraModal() {
    const modal = document.getElementById('scala-extra-modal');
    if (modal) modal.style.display = 'none';
}

// Mantieni window.* solo per funzioni chiamate da HTML onclick
window.searchCliente = searchCliente;
window.loadClienteDetail = loadClienteDetail;
window.closeClienteDetail = closeClienteDetail;
window.openNewClienteForm = openNewClienteForm;
window.copyClientData = copyClientData;
window.exportVCard = exportVCard;
window.showExportDataModal = showExportDataModal;
window.closeExportDataModal = closeExportDataModal;
window.editTimesheet = editTimesheet;
window.renewProduct = renewProduct;
window.closeEditTimesheetModal = closeEditTimesheetModal;
window.saveTimesheetChanges = saveTimesheetChanges;
window.quickViewCliente = quickViewCliente;
window.quickEditCliente = quickEditCliente;
window.quickCopyCliente = quickCopyCliente;
window.quickExportVCard = quickExportVCard;
window.saveTimesheetChanges = saveTimesheetChanges;
window.assignMissingClientIDs      = assignMissingClientIDs;
window.openPacchettoDettaglio      = openPacchettoDettaglio;
window.closePacchettoDettaglioModal = closePacchettoDettaglioModal;
window.exportPacchettoDettaglio    = exportPacchettoDettaglio;
window.stampaPacchettoDettaglio    = stampaPacchettoDettaglio;
window.convertiDaFatturare       = convertiDaFatturare;
window.convertiExtraDaFatturare = convertiExtraDaFatturare;
window.apriScalaInPacchetto     = apriScalaInPacchetto;
window.eseguiScalaExtra         = eseguiScalaExtra;
window.chiudiScalaExtraModal    = chiudiScalaExtraModal;

// =======================================================================
// === STORICO ABBONAMENTI QODNET CLIENTE ===
// =======================================================================

async function loadClienteQODNETStorico(clienteId) {
    const section = document.getElementById('cliente-qodnet-section');
    const contentDiv = document.getElementById('cliente-qodnet-content');
    section.style.display = 'none';

    if (!clienteId) return;

    try {
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_cliente_qodnet_storico&id=${encodeURIComponent(clienteId)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success || !data.prodotti || data.prodotti.length === 0) return;

        section.style.display = 'block';
        contentDiv.innerHTML = data.prodotti.map(p => renderQODNETProdottoTimeline(p)).join('');

    } catch(err) {
        // Silenzioso: se non ci sono abbonamenti QODNET non mostrare errori
    }
}

function renderQODNETProdottoTimeline(prodotto) {
    const statoColori = {
        'Attivo':      { bg: '#d4edda', color: '#155724', badge: '#28a745' },
        'Scaduto':     { bg: '#f8d7da', color: '#721c24', badge: '#dc3545' },
        'Rinnovato':   { bg: '#e2e3e5', color: '#383d41', badge: '#6c757d' },
        'Incorporato': { bg: '#e2d9f3', color: '#4a235a', badge: '#6f42c1' }
    };

    const sc = statoColori[prodotto.statoCorrente] || statoColori['Scaduto'];

    const vociHtml = prodotto.voci.map((v, idx) => {
        const c = statoColori[v.stato] || statoColori['Scaduto'];
        const isLast = idx === prodotto.voci.length - 1;
        const isFirst = idx === 0;
        return `
        <div style="display:flex;gap:12px;position:relative;">
            <!-- linea verticale + dot -->
            <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                <div style="width:12px;height:12px;border-radius:50%;background:${c.badge};margin-top:3px;flex-shrink:0;"></div>
                ${!isLast ? `<div style="width:2px;flex:1;background:#dee2e6;margin-top:2px;"></div>` : ''}
            </div>
            <!-- contenuto voce -->
            <div style="flex:1;padding-bottom:${isLast ? '0' : '12px'};">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:12px;font-weight:600;color:#495057;">
                        ${v.dataInizio} → ${v.dataScadenza}
                    </span>
                    <span style="font-size:11px;padding:1px 7px;border-radius:10px;background:${c.badge};color:#fff;font-weight:600;">
                        ${v.stato}
                    </span>
                    ${isFirst ? '<span style="font-size:10px;color:#6c757d;font-style:italic;">prima sottoscrizione</span>' : ''}
                </div>
                <div style="margin-top:4px;display:flex;gap:16px;flex-wrap:wrap;">
                    <span style="font-size:13px;color:#212529;">€ ${v.imponibile.toFixed(2)}</span>
                    ${v.configurazione ? `<span style="font-size:12px;color:#6c757d;">${v.configurazione}</span>` : ''}
                    ${v.note ? `<span style="font-size:12px;color:#6c757d;font-style:italic;">${v.note}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    return `
    <div style="background:#fff;border:1px solid #dee2e6;border-radius:10px;padding:14px 16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
            <div>
                <span style="font-weight:700;font-size:15px;color:#212529;">${prodotto.prodotto}</span>
                <span style="margin-left:8px;font-size:12px;color:#6c757d;">${prodotto.tipo}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;color:#6c757d;">dal ${prodotto.primaData}</span>
                <span style="font-size:12px;padding:2px 10px;border-radius:12px;background:${sc.badge};color:#fff;font-weight:600;">
                    ${prodotto.statoCorrente}
                </span>
            </div>
        </div>
        <div>${vociHtml}</div>
    </div>`;
}

// =======================================================================
// === ULTIMI MOVIMENTI CLIENTE ===
// =======================================================================

async function loadClienteMovimenti(clienteId, nomeCliente) {
    const contentDiv = document.getElementById('cliente-movimenti-content');
    const titleEl = document.getElementById('cliente-movimenti-title');
    if (titleEl) {
        titleEl.textContent = clienteId
            ? `📋 Ultimi Movimenti — ${nomeCliente || clienteId}`
            : '📋 Ultimi Movimenti';
    }
    contentDiv.innerHTML = '<p style="padding:10px;color:#6c757d;">⏳ Caricamento...</p>';
    try {
        const idParam = clienteId ? `&id=${encodeURIComponent(clienteId)}` : '';
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_cliente_movimenti${idParam}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.success) {
            displayClienteMovimenti(data.movimenti);
        } else {
            contentDiv.innerHTML = `<p class="empty-state">Errore: ${data.error}</p>`;
        }
    } catch(err) {
        contentDiv.innerHTML = `<p class="empty-state">Errore di connessione</p>`;
    }
}

function displayClienteMovimenti(movimenti) {
    const contentDiv = document.getElementById('cliente-movimenti-content');
    if (!movimenti || movimenti.length === 0) {
        contentDiv.innerHTML = '<p class="empty-state">Nessun movimento trovato</p>';
        return;
    }

    const typeConfig = {
        'Timesheet': { color: '#0d6efd', bg: '#e7f1ff' },
        'Pacchetto':  { color: '#6f42c1', bg: '#f0ebff' },
        'Canone':     { color: '#198754', bg: '#e8f5ee' },
        'Firma':      { color: '#fd7e14', bg: '#fff3e7' },
        'Fattura':    { color: '#dc3545', bg: '#fdecea' },
        'Proforma':   { color: '#6c757d', bg: '#f0f0f0' },
    };

    let html = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">';
    movimenti.forEach(m => {
        const cfg = typeConfig[m.tipo] || { color: '#495057', bg: '#f8f9fa' };
        const nomeEsc = (m.nomeCliente || '').replace(/'/g, "\\'");
        const idEsc = (m.idCliente || '').replace(/'/g, "\\'");
        html += `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:#fff;border:1px solid #e9ecef;border-radius:6px;font-size:13px;">
            <span style="flex:0 0 76px;color:#6c757d;font-size:12px;">${m.data}</span>
            <span style="flex:0 0 76px;background:${cfg.bg};color:${cfg.color};border-radius:4px;padding:2px 7px;font-weight:600;font-size:11px;text-align:center;">${m.tipo}</span>
            <span style="flex:0 0 140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                <a href="#" onclick="event.preventDefault();loadClienteDetail('${idEsc}')" style="color:#1976D2;font-weight:600;text-decoration:none;font-size:12px;" title="Apri dettaglio ${nomeEsc}">${m.nomeCliente || ''}</a>
            </span>
            <span style="flex:1;color:#212529;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${m.descrizione}">${m.descrizione}</span>
            <span style="flex:0 0 auto;color:#495057;font-size:12px;white-space:nowrap;">${m.dettaglio}</span>
        </div>`;
    });
    html += '</div>';
    contentDiv.innerHTML = html;
}

window.loadClienteMovimenti = loadClienteMovimenti;

function initClienteTab() {
    loadClienteMovimenti(null);
}
window.initClienteTab = initClienteTab;

function showToast(message, type = 'info') {
    const colors = { info: '#1976D2', success: '#2e7d32', error: '#c62828' };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${colors[type]||colors.info};color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity 0.4s;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3000);
}
