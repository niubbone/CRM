// =======================================================================
// === TIMESHEET LIST MODAL - Gestione Elenco Timesheet ===
// === VERSIONE CORRETTA - Usa codice funzionante da clienti.js ===
// =======================================================================

let allTimesheetData = [];
let filteredTimesheetData = [];

// =======================================================================
// === APERTURA/CHIUSURA MODAL ===
// =======================================================================

/**
 * Apre il modal e carica i timesheet
 */
async function openTimesheetListModal() {
    const modal = document.getElementById('timesheet-list-modal');
    modal.style.display = 'block';
    
    // Carica opzioni filtri (usa window.clients e window.config come nel form)
    loadFilterOptions();
    
    // Carica timesheet
    await loadAllTimesheet();
}

/**
 * Chiude il modal
 */
function closeTimesheetListModal() {
    const modal = document.getElementById('timesheet-list-modal');
    modal.style.display = 'none';
}

// Chiudi modal cliccando fuori
window.onclick = function(event) {
    const modal = document.getElementById('timesheet-list-modal');
    if (event.target === modal) {
        closeTimesheetListModal();
    }
}

// =======================================================================
// === CARICAMENTO DATI ===
// =======================================================================

/**
 * Carica le opzioni per i filtri - USA window.clients e window.config
 * IDENTICO al form timesheet che funziona
 */
function loadFilterOptions() {
    // Popola DATALIST CLIENTI (usa window.clients già caricato)
    const clientiDatalist = document.getElementById('filter-cliente-list');
    if (clientiDatalist) {
        clientiDatalist.innerHTML = '';
        
        if (window.clients && Array.isArray(window.clients)) {
            window.clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.name;
                clientiDatalist.appendChild(option);
            });
            console.log(`✅ Caricati ${window.clients.length} clienti nei filtri timesheet-list`);
        }
    }
    
    // Popola select TIPO INTERVENTO (usa window.config già caricato)
    const tipoSelect = document.getElementById('filter-tipo');
    tipoSelect.innerHTML = '<option value="">Tutti</option>';
    
    if (window.config && window.config.tipoIntervento && Array.isArray(window.config.tipoIntervento)) {
        window.config.tipoIntervento.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo;
            option.textContent = tipo;
            tipoSelect.appendChild(option);
        });
        console.log(`✅ Caricati ${window.config.tipoIntervento.length} tipi intervento nei filtri`);
    }
}

/**
 * Carica tutti i timesheet dal backend
 */
async function loadAllTimesheet(filters = {}) {
    const loading = document.getElementById('timesheet-list-loading');
    const tableContainer = document.getElementById('timesheet-list-table-container');
    const emptyMsg = document.getElementById('timesheet-list-empty');
    
    loading.style.display = 'block';
    tableContainer.style.display = 'none';
    emptyMsg.style.display = 'none';
    
    try {
        // Costruisci URL con filtri
        let url = `${CONFIG.APPS_SCRIPT_URL}?action=get_all_timesheet`;
        
        if (filters.cliente) {
            url += `&cliente=${encodeURIComponent(filters.cliente)}`;
        }
        if (filters.dataInizio) {
            url += `&data_inizio=${filters.dataInizio}`;
        }
        if (filters.dataFine) {
            url += `&data_fine=${filters.dataFine}`;
        }
        if (filters.tipoIntervento) {
            url += `&tipo_intervento=${encodeURIComponent(filters.tipoIntervento)}`;
        }
        if (filters.modAddebito) {
            url += `&mod_addebito=${encodeURIComponent(filters.modAddebito)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        loading.style.display = 'none';
        
        if (data.success && data.timesheet) {
            allTimesheetData = data.timesheet;
            filteredTimesheetData = data.timesheet;
            
            if (data.timesheet.length > 0) {
                renderTimesheetTable(data.timesheet);
                updateStats(data.timesheet);
                tableContainer.style.display = 'block';
            } else {
                emptyMsg.style.display = 'block';
            }
        } else {
            throw new Error(data.error || 'Errore caricamento timesheet');
        }
        
    } catch (error) {
        console.error('Errore caricamento timesheet:', error);
        loading.style.display = 'none';
        emptyMsg.style.display = 'block';
        alert('❌ Errore durante il caricamento dei timesheet');
    }
}

// =======================================================================
// === RENDERING TABELLA ===
// =======================================================================

/**
 * Renderizza la tabella timesheet
 * USA ts.data direttamente come in clienti.js (funziona!)
 */
function renderTimesheetTable(timesheetList) {
    const tbody = document.getElementById('timesheet-list-tbody');
    tbody.innerHTML = '';
    
    timesheetList.forEach(ts => {
        const row = document.createElement('tr');
        
        // Determina classe badge stato
        let badgeClass = 'badge-status';
        const modAddebito = ts.modAddebito || '';
        
        if (modAddebito === 'Da fatturare') {
            badgeClass += ' status-da-fatturare';
        } else if (modAddebito === 'Proformato') {
            badgeClass += ' status-proformato';
        } else if (modAddebito === 'Fatturato') {
            badgeClass += ' status-fatturato';
        } else if (modAddebito === 'Scalato') {
            badgeClass += ' status-scalato';
        }
        
        row.innerHTML = `
            <td>${ts.data || '-'}</td>
            <td>${ts.cliente || '-'}</td>
            <td>${ts.tipoIntervento || '-'}</td>
            <td>${ts.modEsecuzione || '-'}</td>
            <td style="text-align: center;">${ts.ore || '0'}</td>
            <td style="text-align: right;">€ ${parseFloat(ts.importo || 0).toFixed(2)}</td>
            <td><span class="${badgeClass}">${modAddebito || 'N/D'}</span></td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${ts.descrizione || '-'}</td>
            <td>
                <div class="timesheet-actions">
                    <button class="timesheet-action-btn" onclick="editTimesheet(${ts.rowIndex}, '${ts.idIntervento}')" title="Modifica">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="timesheet-action-btn" onclick="deleteTimesheetFromList('${ts.idIntervento}', ${ts.rowIndex})" title="Elimina" style="color: #dc3545;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

/**
 * Aggiorna statistiche
 */
function updateStats(timesheetList) {
    let totaleOre = 0;
    let totaleImporto = 0;
    
    timesheetList.forEach(ts => {
        totaleOre += parseFloat(ts.ore || 0);
        totaleImporto += parseFloat(ts.importo || 0);
    });
    
    document.getElementById('stat-totale-ore').textContent = totaleOre.toFixed(1);
    document.getElementById('stat-interventi').textContent = timesheetList.length;
    document.getElementById('stat-importo').textContent = `€ ${totaleImporto.toFixed(2)}`;
}

// =======================================================================
// === FILTRI ===
// =======================================================================

/**
 * Applica i filtri selezionati
 */
async function applyTimesheetFilters() {
    const filters = {
        cliente: document.getElementById('filter-cliente').value,
        dataInizio: document.getElementById('filter-data-inizio').value,
        dataFine: document.getElementById('filter-data-fine').value,
        tipoIntervento: document.getElementById('filter-tipo').value,
        modAddebito: document.getElementById('filter-mod-addebito').value
    };
    
    await loadAllTimesheet(filters);
}

/**
 * Reset filtri
 */
function resetTimesheetFilters() {
    document.getElementById('filter-cliente').value = '';
    document.getElementById('filter-data-inizio').value = '';
    document.getElementById('filter-data-fine').value = '';
    document.getElementById('filter-tipo').value = '';
    document.getElementById('filter-mod-addebito').value = '';
    
    loadAllTimesheet();
}

// =======================================================================
// === AZIONI TIMESHEET ===
// =======================================================================

/**
 * DEPRECATA - Ora usa editTimesheet() da clienti.js
 * Modifica timesheet - RICICLA logica da clienti.js
 */
/*
async function editTimesheetFromList(rowIndex) {
    try {
        // Carica i dati del timesheet da modificare
        const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=get_timesheet_row&row=${rowIndex}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Errore caricamento timesheet');
        }
        
        const ts = data.timesheet;
        
        // Chiudi modal elenco
        closeTimesheetListModal();
        
        // Vai alla tab Timesheet
        openTab('timesheet');
        
        // Popola il form con i dati esistenti
        document.getElementById('date').value = ts.data || '';
        document.getElementById('start_time').value = ts.startTime || '';
        document.getElementById('stop_time').value = ts.stopTime || '';
        document.getElementById('client_name').value = ts.cliente || '';
        document.getElementById('tipo_intervento').value = ts.tipoIntervento || '';
        document.getElementById('mod_esecuzione').value = ts.modEsecuzione || '';
        document.getElementById('chiamata').value = ts.chiamata || '';
        document.getElementById('mod_addebito').value = ts.modAddebito || '';
        document.getElementById('description').value = ts.descrizione || '';
        
        // Cambia testo del pulsante submit
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.value = 'Aggiorna Timesheet';
        submitBtn.dataset.editMode = 'true';
        submitBtn.dataset.editRow = rowIndex;
        
        // Scroll in cima
        window.scrollTo(0, 0);
        
        alert(`📝 Modifica il timesheet e clicca "Aggiorna Timesheet" per salvare le modifiche`);
        
    } catch (error) {
        console.error('Errore caricamento timesheet per modifica:', error);
        alert('❌ Errore durante il caricamento del timesheet da modificare');
    }
}
*/

/**
 * Elimina timesheet
 */
async function deleteTimesheetFromList(idIntervento, rowIndex) {
    const confirm = window.confirm(`⚠️ Sei sicuro di voler eliminare il timesheet ${idIntervento}?\n\nQuesta operazione è irreversibile.`);
    
    if (!confirm) return;
    
    try {
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=delete_timesheet&row=${rowIndex}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Timesheet eliminato con successo');
            // Ricarica l'elenco
            await loadAllTimesheet();
        } else {
            throw new Error(data.error || 'Errore eliminazione');
        }
    } catch (error) {
        console.error('Errore eliminazione:', error);
        alert('❌ Errore durante l\'eliminazione del timesheet');
    }
}

// =======================================================================
// === EXPORT CSV ===
// =======================================================================

/**
 * Esporta timesheet in CSV
 */
function exportTimesheetCSV() {
    if (!filteredTimesheetData || filteredTimesheetData.length === 0) {
        alert('⚠️ Nessun dato da esportare');
        return;
    }
    
    // Header CSV
    const headers = ['ID', 'Data', 'Cliente', 'Tipo', 'Modalità', 'Ore', 'Importo', 'Stato', 'Descrizione'];
    let csv = headers.join(';') + '\n';
    
    // Righe dati
    filteredTimesheetData.forEach(ts => {
        const row = [
            ts.idIntervento || '',
            ts.data || '',
            ts.cliente || '',
            ts.tipoIntervento || '',
            ts.modEsecuzione || '',
            ts.ore || '0',
            ts.importo || '0',
            ts.modAddebito || '',
            `"${(ts.descrizione || '').replace(/"/g, '""')}"` // Escape virgolette
        ];
        csv += row.join(';') + '\n';
    });
    
    // Download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `timesheet_export_${today}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('✅ Export CSV completato!');
}
