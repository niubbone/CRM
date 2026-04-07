// ========================================
// VENDITE TAB - JavaScript  
// Versione: 2.0 - Aggiunto supporto Fatturazione Canoni
// ========================================

// getAPIUrl() è lazy: viene chiamata al momento di ogni fetch, non all'avvio.
// I moduli ES6 (config.js via main.js) sono defer e girano DOPO i regular
// script, quindi "const API_URL = getAPIUrl()" all'avvio leggerebbe CONFIG
// non ancora impostato e userebbe sempre la URL di fallback.
const getAPIUrl = () => {
    if (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.APPS_SCRIPT_URL) {
        return window.CONFIG.APPS_SCRIPT_URL;
    }
    if (typeof CONFIG !== 'undefined' && CONFIG.APPS_SCRIPT_URL) {
        return CONFIG.APPS_SCRIPT_URL;
    }
    return 'https://script.google.com/macros/s/AKfycbxodRCMoPa9VW2nphsazv8Ux72mebjCSKd48c0HKoCOsrG5Z-ZJFyzCWHt6qhCgPxkU/exec';
};
let scadenzeData = null;

// Costanti fatturazione (sincronizzate con backend)
const CANONE_FATTURAZIONE = {
    DA_FATTURARE: 'Da fatturare',
    PROFORMATO: 'Proformato',
    FATTURATO: 'Fatturato'
};

function initVenditeTab() {
    loadVenditaClienti();
    setVenditaDefaultDate();
    switchVenditeSection('scadenze');
}

// =======================================================================
// === NAVIGAZIONE VENDITE ===
// =======================================================================

let currentVenditeSection = 'pacchetti';
// Traccia se il riepilogo di ogni sezione è già stato caricato
const riepilogoLoaded = { pacchetti: false, canoni: false, firme: false, qodnet: false };

function switchVenditeSection(section) {
    // Aggiorna nav cards
    ['pacchetti','canoni','firme','scadenze','qodnet'].forEach(s => {
        const card = document.getElementById(`vnav-${s}`);
        if (card) card.classList.toggle('active', s === section);
    });

    // Mostra/nascondi pannelli
    ['pacchetti','canoni','firme','scadenze','qodnet'].forEach(s => {
        const panel = document.getElementById(`vendite-section-${s}`);
        if (panel) panel.style.display = s === section ? '' : 'none';
    });

    currentVenditeSection = section;

    // Carica dati necessari
    if (section === 'scadenze') {
        loadScadenze();
    } else if (section !== 'scadenze') {
        // Auto-carica il riepilogo se non ancora fatto
        if (!riepilogoLoaded[section]) {
            switchVenditeSubtab(section, 'riepilogo');
        }
    }
}

function switchVenditeSubtab(section, subtab) {
    const nuovoContent    = document.getElementById(`vsub-${section}-nuovo-content`);
    const riepilogoContent = document.getElementById(`vsub-${section}-riepilogo-content`);
    const btnNuovo        = document.getElementById(`vsub-${section}-nuovo`);
    const btnRiepilogo    = document.getElementById(`vsub-${section}-riepilogo`);

    if (nuovoContent)    nuovoContent.style.display    = subtab === 'nuovo'    ? '' : 'none';
    if (riepilogoContent) riepilogoContent.style.display = subtab === 'riepilogo' ? '' : 'none';
    if (btnNuovo)    btnNuovo.classList.toggle('active',    subtab === 'nuovo');
    if (btnRiepilogo) btnRiepilogo.classList.toggle('active', subtab === 'riepilogo');

    // Carica dati la prima volta che si apre il riepilogo
    if (subtab === 'riepilogo' && !riepilogoLoaded[section]) {
        riepilogoLoaded[section] = true;
        if (section === 'pacchetti') loadStoricoPackages();
        if (section === 'canoni')    loadCanoniRiepilogo();
        if (section === 'firme')     loadFirmeRiepilogo();
        if (section === 'qodnet')    loadQodnetRiepilogo();
    }
}

function setVenditaDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('venditaDataInizio');
    if (dateInput) {
        dateInput.value = today;
    }
}

async function loadVenditaClienti() {
    try {
        const input = document.getElementById('venditaCliente');
        const datalist = document.getElementById('vendita_client_list');
        
        if (!input || !datalist) return;
        
        input.value = '';
        input.placeholder = 'Caricamento...';
        datalist.innerHTML = '';
        
        const response = await fetch(`${getAPIUrl()}?action=get_data`);
        const result = await response.json();
        
        if (!result || !result.clients) {
            throw new Error('Nessun dato clienti disponibile');
        }
        
        const clientsList = result.clients;
        
        if (clientsList.length > 0) {
            clientsList.sort((a, b) => {
                const nameA = (typeof a === 'string' ? a : (a.name || '')).toLowerCase();
                const nameB = (typeof b === 'string' ? b : (b.name || '')).toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            datalist.innerHTML = '';
            
            clientsList.forEach(cliente => {
                const option = document.createElement('option');
                const clienteName = typeof cliente === 'string' ? cliente : (cliente.name || '');
                option.value = clienteName;
                datalist.appendChild(option);
            });
            
            input.placeholder = 'Cerca o seleziona cliente...';
        } else {
            input.placeholder = 'Nessun cliente disponibile';
        }
    } catch (error) {
        console.error('Errore caricamento clienti vendite:', error);
        const input = document.getElementById('venditaCliente');
        if (input) {
            input.placeholder = 'Errore caricamento';
        }
    }
}

async function loadScadenze() {
    const container = document.getElementById('scadenzeContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-scadenze">Caricamento scadenze...</div>';
    
    try {
        const response = await fetch(`${getAPIUrl()}?action=get_scadenze&giorni=90`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Errore sconosciuto');
        }
        
        scadenzeData = result.data;
        renderScadenze(scadenzeData);
        
    } catch (error) {
        console.error('Errore caricamento scadenze:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div>Errore caricamento scadenze</div>
                <div style="font-size: 12px; margin-top: 8px; color: #999;">${error.message}</div>
            </div>
        `;
    }
}

function renderScadenze(data) {
    const container = document.getElementById('scadenzeContainer');
    if (!container) return;
    
    const canoniScaduti = data.tutti.filter(p => 
        p.tipoProdotto === 'CANONE' && 
        p.giorniMancanti < 0 && 
        (p.stato === 'ATTIVO' || p.stato === 'Attivo')
    );
    
    const altreScadenze = data.tutti.filter(p => 
        !(p.tipoProdotto === 'CANONE' && p.giorniMancanti < 0)
    );
    
    container.innerHTML = '';
    container.className = 'scadenze-list';
    
    // Sezione Canoni da Rinnovare (scaduti)
    if (canoniScaduti.length > 0) {
        const sezioneCanoni = document.createElement('div');
        sezioneCanoni.style.marginBottom = '30px';
        
        const titleCanoni = document.createElement('h3');
        titleCanoni.textContent = '🔴 Canoni da Rinnovare';
        titleCanoni.style.color = '#dc3545';
        titleCanoni.style.marginBottom = '15px';
        sezioneCanoni.appendChild(titleCanoni);
        
        canoniScaduti.forEach(canone => {
            const card = createScadenzaCard(canone, true);
            sezioneCanoni.appendChild(card);
        });
        
        container.appendChild(sezioneCanoni);
    }
    
    // Sezione Prossime Scadenze
    if (altreScadenze.length > 0) {
        const sezioneScadenze = document.createElement('div');
        
        const titleScadenze = document.createElement('h3');
        titleScadenze.textContent = '📅 Prossime Scadenze (90 giorni)';
        titleScadenze.style.color = '#007bff';
        titleScadenze.style.marginBottom = '15px';
        sezioneScadenze.appendChild(titleScadenze);
        
        altreScadenze.forEach(prodotto => {
            const card = createScadenzaCard(prodotto, false);
            sezioneScadenze.appendChild(card);
        });
        
        container.appendChild(sezioneScadenze);
    }
    
    if (canoniScaduti.length === 0 && altreScadenze.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <div>Nessun prodotto in scadenza</div>
                <div style="font-size: 12px; margin-top: 8px; color: #999;">Prossimi 90 giorni</div>
            </div>
        `;
    }
}

function createScadenzaCard(prodotto, isCanoneScaduto = false) {
    const card = document.createElement('div');
    
    let urgenzaClass = 'bassa';
    if (isCanoneScaduto) {
        urgenzaClass = 'scaduto';
    } else {
        urgenzaClass = prodotto.urgenza === 'ALTA' ? 'urgente' : 
                       prodotto.urgenza === 'MEDIA' ? 'media' : 'bassa';
    }
    
    card.className = `scadenza-card ${urgenzaClass}`;
    
    const id = prodotto.tipoProdotto === 'CANONE' ? prodotto.idCanone : prodotto.idFirma;
    const tipo = prodotto.tipoProdotto === 'CANONE' ? 'Canone' : 'Firma';
    const dataScadenza = new Date(prodotto.dataScadenza).toLocaleDateString('it-IT');
    
    let dettagli = '';
    if (prodotto.tipoProdotto === 'CANONE' && prodotto.descrizione) {
        dettagli = ` • ${prodotto.descrizione}`;
    } else if (prodotto.tipoProdotto === 'FIRMA') {
        dettagli = ` • ${prodotto.tipo}`;
    }
    
    let giorniText = '';
    if (isCanoneScaduto) {
        const giorniPassati = Math.abs(prodotto.giorniMancanti);
        giorniText = `Scaduto da ${giorniPassati} giorni`;
    } else {
        giorniText = `${prodotto.giorniMancanti} giorni`;
    }
    
    // 🆕 Badge fatturazione per canoni
    let fatturazioneBadge = '';
    if (prodotto.tipoProdotto === 'CANONE' && prodotto.fatturazione) {
        const badgeClass = prodotto.fatturazione === CANONE_FATTURAZIONE.FATTURATO ? 'badge-success' :
                          prodotto.fatturazione === CANONE_FATTURAZIONE.PROFORMATO ? 'badge-info' :
                          'badge-warning';
        fatturazioneBadge = `<span class="badge ${badgeClass}">${prodotto.fatturazione}</span>`;
    }
    
    // 🆕 Pulsanti azione fatturazione
    let actionButtons = '';
    if (prodotto.tipoProdotto === 'CANONE') {
        if (prodotto.fatturazione === CANONE_FATTURAZIONE.DA_FATTURARE) {
            actionButtons = `
                <button class="btn-small btn-proforma" onclick="openProformaCanoneModal('${id}')">
                    📄 Proforma
                </button>
            `;
        } else if (prodotto.fatturazione === CANONE_FATTURAZIONE.PROFORMATO) {
            actionButtons = `
                <button class="btn-small btn-fattura" onclick="openFatturaCanoneModal('${id}')">
                    🧾 Fattura
                </button>
            `;
        }
    }
    
    card.innerHTML = `
        <div class="scadenza-info">
            <div class="scadenza-id">
                ${tipo}: ${id}
                <span class="scadenza-urgenza urgenza-${isCanoneScaduto ? 'scaduto' : prodotto.urgenza.toLowerCase()}">
                    ${giorniText}
                </span>
                ${fatturazioneBadge}
            </div>
            <div class="scadenza-cliente">${prodotto.nomeCliente}</div>
            <div class="scadenza-data">Scadenza: ${dataScadenza}${dettagli}</div>
        </div>
        <div class="scadenza-actions">
            ${actionButtons}
            <button class="btn-rinnova" onclick="openRinnovoModal('${id}', '${prodotto.tipoProdotto}')">
                Rinnova
            </button>
        </div>
    `;
    
    return card;
}

// =======================================================================
// === MODAL VENDITA ===
// =======================================================================

function openVenditaModal(tipo) {
    const modal = document.getElementById('venditaModal');
    const form = document.getElementById('venditaForm');
    
    if (!modal || !form) return;
    
    form.reset();
    setVenditaDefaultDate();
    
    const tipoInput = document.getElementById('tipoVendita');
    if (tipoInput) tipoInput.value = tipo;
    
    const modalTitle = document.getElementById('modalVenditaTitle');
    const tipoFirmaGroup = document.getElementById('venditaTipoFirmaGroup');
    const oreGroup = document.getElementById('venditaOreGroup');
    const oreInput = document.getElementById('venditaOreTotali');
    const durataGroup = document.getElementById('venditaDurataGroup');
    const durataLabel = document.getElementById('venditaDurataLabel');
    const durataInput = document.getElementById('venditaDurataAnni');
    const descrizioneGroup = document.getElementById('venditaDescrizioneGroup');
    const descrizioneLabel = document.getElementById('venditaDescrizioneLabel');
    const noteGroup = document.getElementById('venditaNoteGroup');
    
    if (tipo === 'pacchetto') {
        if (modalTitle) modalTitle.textContent = '📦 Nuovo Pacchetto Ore';
        if (tipoFirmaGroup) tipoFirmaGroup.style.display = 'none';
        if (oreGroup) oreGroup.style.display = 'block';
        if (oreInput) { oreInput.required = true; oreInput.value = ''; }
        if (durataGroup) durataGroup.style.display = 'none';
        if (descrizioneGroup) descrizioneGroup.style.display = 'block';
        if (descrizioneLabel) descrizioneLabel.textContent = 'Descrizione';
        if (noteGroup) noteGroup.style.display = 'none';
    } else if (tipo === 'canone') {
        if (modalTitle) modalTitle.textContent = '📅 Nuovo Canone';
        if (tipoFirmaGroup) tipoFirmaGroup.style.display = 'none';
        if (oreGroup) oreGroup.style.display = 'none';
        if (oreInput) oreInput.required = false;
        if (durataGroup) durataGroup.style.display = 'block';
        if (durataLabel) durataLabel.textContent = 'Durata (anni)';
        if (durataInput) durataInput.value = 1;
        if (descrizioneGroup) descrizioneGroup.style.display = 'block';
        if (descrizioneLabel) descrizioneLabel.textContent = 'Descrizione';
        if (noteGroup) noteGroup.style.display = 'none';
    } else if (tipo === 'firma') {
        if (modalTitle) modalTitle.textContent = '✍️ Nuova Firma Digitale';
        if (tipoFirmaGroup) tipoFirmaGroup.style.display = 'block';
        if (oreGroup) oreGroup.style.display = 'none';
        if (oreInput) oreInput.required = false;
        if (durataGroup) durataGroup.style.display = 'block';
        if (durataLabel) durataLabel.textContent = 'Durata (anni)';
        if (durataInput) durataInput.value = 3;
        if (descrizioneGroup) descrizioneGroup.style.display = 'none';
        if (noteGroup) noteGroup.style.display = 'block';
    }
    
    modal.classList.add('active');
}

function closeVenditaModal() {
    const modal = document.getElementById('venditaModal');
    if (modal) modal.classList.remove('active');
}

async function submitVendita(e) {
    e.preventDefault();
    
    const tipo = document.getElementById('tipoVendita').value;
    const cliente = document.getElementById('venditaCliente').value;
    const descrizione = document.getElementById('venditaDescrizione').value;
    const importo = document.getElementById('venditaImporto').value;
    const dataInizio = document.getElementById('venditaDataInizio').value;
    const durataAnni = document.getElementById('venditaDurataAnni').value;
    const oreTotali = document.getElementById('venditaOreTotali')?.value;
    
    if (!cliente || cliente.trim() === '' || cliente === 'Seleziona cliente...') {
        alert('⚠️ Seleziona un cliente');
        return;
    }
    
    if (!importo || importo <= 0) {
        alert('⚠️ Inserisci un importo valido');
        return;
    }
    
    if (tipo === 'pacchetto' && (!oreTotali || oreTotali <= 0)) {
        alert('⚠️ Inserisci il numero di ore del pacchetto');
        return;
    }
    
    const submitBtn = document.getElementById('venditaSubmitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creazione in corso...';
    
    try {
        let action = '';
        const nomeCliente = cliente.trim();
        let params = `cliente=${encodeURIComponent(nomeCliente)}&cliente_nome=${encodeURIComponent(nomeCliente)}&importo=${importo}&data_inizio=${dataInizio}`;
        
        if (tipo === 'pacchetto') {
            action = 'insert_pacchetto';
            params += `&ore_totali=${oreTotali}&descrizione=${encodeURIComponent(descrizione)}`;
        } else if (tipo === 'canone') {
            action = 'insert_canone';
            params += `&descrizione=${encodeURIComponent(descrizione)}&durata_anni=${durataAnni}`;
        } else if (tipo === 'firma') {
            action = 'insert_firma';
            const tipoFirma = document.getElementById('venditaTipoFirma').value;
            const note = document.getElementById('venditaNote')?.value || '';
            params += `&tipo=${tipoFirma}&durata_anni=${durataAnni}&note=${encodeURIComponent(note)}`;
        }
        
        const response = await fetch(`${getAPIUrl()}?action=${action}&${params}`);
        const result = await response.json();
        
        if (result.success) {
            if (tipo === 'pacchetto') {
                closeVenditaModal();
                document.getElementById('venditaForm').reset();
                showProformaFromPacchettoModal(result);
                loadScadenze();
            } else {
                alert('✅ Vendita creata con successo!');
                closeVenditaModal();
                document.getElementById('venditaForm').reset();
                loadScadenze();
            }
        } else {
            throw new Error(result.error || 'Errore sconosciuto');
        }
        
    } catch (error) {
        console.error('Errore submit vendita:', error);
        alert('❌ Errore: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// =======================================================================
// === 🆕 MODAL PROFORMA CANONE ===
// =======================================================================

function openProformaCanoneModal(canoneId) {
    const canone = scadenzeData?.tutti?.find(p => p.idCanone === canoneId);
    
    if (!canone) {
        alert('⚠️ Canone non trovato');
        return;
    }
    
    const modalHTML = `
        <div id="proformaCanoneModal" class="modal-vendite active">
            <div class="modal-content-vendite" style="max-width: 500px;">
                <div class="modal-header-vendite">
                    <span>📄 Emetti Proforma Canone</span>
                    <button class="modal-close-vendite" onclick="closeProformaCanoneModal()">✕</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="proforma-canone-id" value="${canoneId}">
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div><strong>ID:</strong> ${canoneId}</div>
                        <div><strong>Cliente:</strong> ${canone.nomeCliente}</div>
                        <div><strong>Importo:</strong> € ${parseFloat(canone.importo).toFixed(2)}</div>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        Cliccando "Genera Proforma" il canone verrà marcato come <strong>Proformato</strong>.
                    </p>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                        <button class="btn-secondary" onclick="closeProformaCanoneModal()">Annulla</button>
                        <button class="btn-primary" id="proforma-canone-submit" onclick="submitProformaCanone()">📄 Genera Proforma</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('proformaCanoneModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeProformaCanoneModal() {
    const modal = document.getElementById('proformaCanoneModal');
    if (modal) modal.remove();
}

async function submitProformaCanone() {
    const canoneId = document.getElementById('proforma-canone-id').value;
    const submitBtn = document.getElementById('proforma-canone-submit');
    
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Elaborazione...';
    
    try {
        const url = `${getAPIUrl()}?action=update_fatturazione_canone&canone_id=${encodeURIComponent(canoneId)}&fatturazione=${encodeURIComponent(CANONE_FATTURAZIONE.PROFORMATO)}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Errore aggiornamento');
        }
        
        alert(`✅ Canone ${canoneId} marcato come Proformato`);
        closeProformaCanoneModal();
        loadScadenze();
        
    } catch (error) {
        console.error('Errore submitProformaCanone:', error);
        alert('❌ Errore: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '📄 Genera Proforma';
    }
}

// =======================================================================
// === 🆕 MODAL FATTURA CANONE ===
// =======================================================================

function openFatturaCanoneModal(canoneId) {
    const canone = scadenzeData?.tutti?.find(p => p.idCanone === canoneId);
    
    if (!canone) {
        alert('⚠️ Canone non trovato');
        return;
    }
    
    const oggi = new Date().toISOString().split('T')[0];
    
    const modalHTML = `
        <div id="fatturaCanoneModal" class="modal-vendite active">
            <div class="modal-content-vendite" style="max-width: 450px;">
                <div class="modal-header-vendite">
                    <span>🧾 Registra Fattura Canone</span>
                    <button class="modal-close-vendite" onclick="closeFatturaCanoneModal()">✕</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="fattura-canone-id" value="${canoneId}">
                    
                    <div style="background: #e8f5e9; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
                        <strong>${canoneId}</strong> - ${canone.nomeCliente}
                    </div>
                    
                    <div class="form-group">
                        <label>Numero Fattura *</label>
                        <input type="text" id="fattura-canone-numero" placeholder="Es. N.23/A" 
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                        <small style="color: #888;">Inserisci il numero fattura (es. N.23/A, 2026/001)</small>
                    </div>
                    
                    <div class="form-group" style="margin-top: 15px;">
                        <label>Data Fattura</label>
                        <input type="date" id="fattura-canone-data" value="${oggi}"
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                        <button class="btn-secondary" onclick="closeFatturaCanoneModal()">Annulla</button>
                        <button class="btn-primary" id="fattura-canone-submit" onclick="submitFatturaCanone()">🧾 Salva Fattura</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('fatturaCanoneModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeFatturaCanoneModal() {
    const modal = document.getElementById('fatturaCanoneModal');
    if (modal) modal.remove();
}

async function submitFatturaCanone() {
    const canoneId = document.getElementById('fattura-canone-id').value;
    const numeroFattura = document.getElementById('fattura-canone-numero').value.trim();
    const dataFattura = document.getElementById('fattura-canone-data').value;
    
    if (!numeroFattura) {
        alert('⚠️ Inserisci il numero fattura');
        return;
    }
    
    const submitBtn = document.getElementById('fattura-canone-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Salvataggio...';
    
    try {
        // Formatta: "N.23/A del 15/01/2026"
        const dataFormatted = new Date(dataFattura).toLocaleDateString('it-IT');
        const nFatturaCompleto = `${numeroFattura} del ${dataFormatted}`;
        
        const url = `${getAPIUrl()}?action=set_canone_fatturato&canone_id=${encodeURIComponent(canoneId)}&n_fattura=${encodeURIComponent(nFatturaCompleto)}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Errore salvataggio');
        }
        
        alert(`✅ Fattura "${nFatturaCompleto}" registrata per canone ${canoneId}`);
        closeFatturaCanoneModal();
        loadScadenze();
        
    } catch (error) {
        console.error('Errore submitFatturaCanone:', error);
        alert('❌ Errore: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🧾 Salva Fattura';
    }
}

// =======================================================================
// === MODAL RINNOVO ===
// =======================================================================

function openRinnovoModal(id, tipo) {
    const modal = document.getElementById('rinnovoModal');
    if (!modal) return;
    
    const rinnovoIdInput = document.getElementById('rinnovoId');
    const rinnovoTipoInput = document.getElementById('rinnovoTipo');
    if (rinnovoIdInput) rinnovoIdInput.value = id;
    if (rinnovoTipoInput) rinnovoTipoInput.value = tipo;
    
    let prodotto = null;
    
    if (scadenzeData && scadenzeData.tutti) {
        prodotto = scadenzeData.tutti.find(p => {
            if (tipo === 'CANONE') return p.idCanone === id;
            else return p.idFirma === id;
        });
    }
    
    if (!prodotto && window.currentProdottoRinnovo) {
        prodotto = window.currentProdottoRinnovo;
    }
    
    if (!prodotto) {
        alert('⚠️ Prodotto non trovato');
        return;
    }
    
    const clienteNome = document.getElementById('rinnovoClienteNome');
    const dettagli = document.getElementById('rinnovoDettagli');
    const tipoFirmaGroup = document.getElementById('rinnovoTipoFirmaGroup');
    const descrizione = document.getElementById('rinnovoDescrizione');
    const tipoFirma = document.getElementById('rinnovoTipoFirma');
    const importo = document.getElementById('rinnovoImporto');
    const noteGroup = document.getElementById('rinnovoNoteGroup');
    
    if (clienteNome) clienteNome.textContent = prodotto.nomeCliente;
    
    const dataScadenza = new Date(prodotto.dataScadenza).toLocaleDateString('it-IT');
    let dettagliText = `${tipo === 'CANONE' ? 'Canone' : 'Firma'} • Scadenza: ${dataScadenza}`;
    
    if (tipo === 'CANONE') {
        if (descrizione) descrizione.value = prodotto.descrizione || '';
        if (tipoFirmaGroup) tipoFirmaGroup.style.display = 'none';
        if (noteGroup) noteGroup.style.display = 'none';
        if (prodotto.descrizione) dettagliText += ` • ${prodotto.descrizione}`;
    } else {
        if (tipoFirma) tipoFirma.value = prodotto.tipo || 'Token';
        if (tipoFirmaGroup) tipoFirmaGroup.style.display = 'block';
        if (noteGroup) noteGroup.style.display = 'block';
        dettagliText += ` • ${prodotto.tipo}`;
    }
    
    if (dettagli) dettagli.textContent = dettagliText;
    if (importo) importo.value = prodotto.importo || '';
    
    modal.classList.add('active');
}

function closeRinnovoModal() {
    const modal = document.getElementById('rinnovoModal');
    if (modal) modal.classList.remove('active');
}

async function submitRinnovo(e) {
    e.preventDefault();
    
    const id = document.getElementById('rinnovoId').value;
    const tipo = document.getElementById('rinnovoTipo').value;
    const importo = document.getElementById('rinnovoImporto').value;
    
    const submitBtn = document.getElementById('rinnovoSubmitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Rinnovo in corso...';
    
    try {
        let action = '';
        let params = '';
        
        if (tipo === 'CANONE') {
            action = 'rinnova_canone';
            const descrizione = document.getElementById('rinnovoDescrizione').value;
            params = `canone_id=${encodeURIComponent(id)}`;
            if (descrizione) params += `&descrizione=${encodeURIComponent(descrizione)}`;
            if (importo) params += `&importo=${importo}`;
        } else {
            action = 'rinnova_firma';
            const tipoFirma = document.getElementById('rinnovoTipoFirma').value;
            const note = document.getElementById('rinnovoNote')?.value || '';
            params = `firma_id=${encodeURIComponent(id)}&tipo=${tipoFirma}`;
            if (importo) params += `&importo=${importo}`;
            if (note) params += `&note=${encodeURIComponent(note)}`;
        }
        
        const response = await fetch(`${getAPIUrl()}?action=${action}&${params}`);
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Rinnovo completato con successo!');
            closeRinnovoModal();
            loadScadenze();
        } else {
            throw new Error(result.error || 'Errore sconosciuto');
        }
        
    } catch (error) {
        console.error('Errore submit rinnovo:', error);
        alert('❌ Errore: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// =======================================================================
// === PROFORMA DA PACCHETTO ===
// =======================================================================

function showProformaFromPacchettoModal(pacchettoData) {
    const modalHTML = `
        <div id="proformaFromPacchettoModal" class="modal active">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>📄 Genera Proforma</h2>
                    <button class="close-btn" onclick="closeProformaFromPacchettoModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="info-banner" style="margin-bottom: 20px;">
                        ✅ Pacchetto <strong>${pacchettoData.id_pacchetto}</strong> creato con successo!
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div><strong>Cliente:</strong> ${pacchettoData.cliente}</div>
                        <div><strong>Ore:</strong> ${pacchettoData.ore_totali}h</div>
                        <div><strong>Importo:</strong> € ${pacchettoData.importo}</div>
                        <div><strong>Descrizione:</strong> ${pacchettoData.descrizione || '-'}</div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="applicaQuotaPacchetto" style="margin-right: 10px;">
                            <span>Applica quota integrativa 4%</span>
                        </label>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn-secondary" onclick="closeProformaFromPacchettoModal()">Salta</button>
                        <button class="btn-primary" onclick="generateProformaFromPacchetto('${pacchettoData.id_pacchetto}')">📄 Genera Proforma</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('proformaFromPacchettoModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeProformaFromPacchettoModal() {
    const modal = document.getElementById('proformaFromPacchettoModal');
    if (modal) modal.remove();
}

async function generateProformaFromPacchetto(idPacchetto) {
    const applicaQuota = document.getElementById('applicaQuotaPacchetto')?.checked || false;
    
    try {
        const response = await fetch(`${getAPIUrl()}?action=generate_proforma_pacchetto&id_pacchetto=${encodeURIComponent(idPacchetto)}&applica_quota=${applicaQuota}`);
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Proforma ${result.n_proforma} generata con successo!`);
            closeProformaFromPacchettoModal();
        } else {
            throw new Error(result.error || 'Errore generazione proforma');
        }
    } catch (error) {
        console.error('Errore generazione proforma pacchetto:', error);
        alert('❌ Errore: ' + error.message);
    }
}

// =======================================================================
// === RIEPILOGO CANONI ===
// =======================================================================

let canoniData = [];
let canoniFilterTimer = null;

async function loadCanoniRiepilogo() {
    const container = document.getElementById('canoniContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading-scadenze">Caricamento canoni...</div>';

    try {
        const cliente = (document.getElementById('canoni-filter-cliente')?.value || '').trim();
        const stato   = document.getElementById('canoni-filter-stato')?.value || '';

        let url = `${getAPIUrl()}?action=get_canoni_riepilogo`;
        if (cliente) url += `&cliente_nome=${encodeURIComponent(cliente)}`;
        if (stato)   url += `&stato=${encodeURIComponent(stato)}`;

        const response = await fetch(url);
        const result   = await response.json();

        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');

        canoniData = result.canoni || [];
        populateCanoniClientFilter(canoniData);
        renderCanoni(canoniData);

    } catch (error) {
        console.error('Errore caricamento canoni:', error);
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${error.message}</div></div>`;
    }
}

function populateCanoniClientFilter(canoni) {
    const datalist = document.getElementById('canoni-client-list');
    if (!datalist) return;
    const nomi = [...new Set(canoni.map(c => c.nomeCliente).filter(Boolean))].sort();
    datalist.innerHTML = nomi.map(n => `<option value="${n}">`).join('');
}

function filterCanoniDebounced() {
    clearTimeout(canoniFilterTimer);
    canoniFilterTimer = setTimeout(filterCanoni, 300);
}

function filterCanoni() {
    if (!canoniData.length) return;
    const filtroCliente = (document.getElementById('canoni-filter-cliente')?.value || '').trim().toLowerCase();
    const filtroStato   = (document.getElementById('canoni-filter-stato')?.value || '').toUpperCase();

    const filtered = canoniData.filter(c => {
        const matchCliente = !filtroCliente || c.nomeCliente.toLowerCase().includes(filtroCliente);
        const matchStato   = !filtroStato   || (c.stato || '').toUpperCase() === filtroStato;
        return matchCliente && matchStato;
    });
    renderCanoni(filtered);
}

function renderCanoni(canoni) {
    const container = document.getElementById('canoniContainer');
    if (!container) return;

    if (!canoni.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div>Nessun canone trovato</div></div>`;
        return;
    }

    const gruppi = {};
    canoni.forEach(c => {
        const k = c.nomeCliente || '—';
        if (!gruppi[k]) gruppi[k] = [];
        gruppi[k].push(c);
    });

    let html = '';
    Object.keys(gruppi).sort().forEach(cliente => {
        html += `<div class="storico-gruppo">
            <div class="storico-gruppo-header">👤 ${cliente}</div>`;

        gruppi[cliente].forEach(c => {
            const isAttivo   = (c.stato || '').toUpperCase() === 'ATTIVO';
            const statoClass = isAttivo ? 'attivo' : 'scaduto';

            let scadenzaInfo = '';
            if (c.giorniAllaScadenza !== null) {
                if (c.giorniAllaScadenza < 0) {
                    scadenzaInfo = `<span style="color:#dc3545;">Scaduto da ${Math.abs(c.giorniAllaScadenza)} giorni</span>`;
                } else if (c.giorniAllaScadenza <= 60) {
                    scadenzaInfo = `<span style="color:#fd7e14;">Scade tra ${c.giorniAllaScadenza} giorni</span>`;
                } else {
                    scadenzaInfo = `<span style="color:#28a745;">Scade tra ${c.giorniAllaScadenza} giorni</span>`;
                }
            }

            const fattBadge = c.fatturazione ? `<span class="storico-badge" style="background:#e8f4fd;color:#0c63e4;margin-left:6px;">${c.fatturazione}</span>` : '';

            html += `
            <div class="storico-card">
                <div class="storico-card-header">
                    <span class="storico-id">${c.idCanone}${fattBadge}</span>
                    <span class="storico-badge ${statoClass}">${c.stato}</span>
                </div>
                ${c.descrizione ? `<div class="storico-descrizione">${c.descrizione}</div>` : ''}
                <div class="firma-card-body">
                    <div class="firma-stat">
                        <span class="storico-stat-label">Inizio</span>
                        <span class="storico-stat-value">${c.dataInizio || '—'}</span>
                    </div>
                    <div class="firma-stat">
                        <span class="storico-stat-label">Scadenza</span>
                        <span class="storico-stat-value">${c.dataScadenza || '—'}</span>
                    </div>
                    <div class="firma-stat">
                        <span class="storico-stat-label">Importo</span>
                        <span class="storico-stat-value">€ ${parseFloat(c.importo).toFixed(2)}</span>
                    </div>
                </div>
                ${scadenzaInfo ? `<div class="storico-date" style="margin-top:4px;">${scadenzaInfo}</div>` : ''}
                ${c.idPrecedente ? `<div class="storico-date" style="color:#bbb;">Rinnovo di: ${c.idPrecedente}</div>` : ''}
                ${isAttivo ? `
                <div class="storico-actions">
                    <button class="btn-small btn-storico-detail"
                        onclick="openRinnovoModal('${c.idCanone}', 'CANONE')">
                        🔄 Rinnova
                    </button>
                </div>` : ''}
            </div>`;
        });
        html += `</div>`;
    });

    container.innerHTML = html;
}

// =======================================================================
// === RIEPILOGO FIRME DIGITALI ===
// =======================================================================

let firmeData = [];
let firmeFilterTimer = null;

async function loadFirmeRiepilogo() {
    const container = document.getElementById('firmeContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading-scadenze">Caricamento firme...</div>';

    try {
        const cliente = (document.getElementById('firme-filter-cliente')?.value || '').trim();
        const stato   = document.getElementById('firme-filter-stato')?.value || '';

        let url = `${getAPIUrl()}?action=get_firme_riepilogo`;
        if (cliente) url += `&cliente_nome=${encodeURIComponent(cliente)}`;
        if (stato)   url += `&stato=${encodeURIComponent(stato)}`;

        const response = await fetch(url);
        const result   = await response.json();

        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');

        firmeData = result.firme || [];
        populateFirmeClientFilter(firmeData);
        renderFirme(firmeData);

    } catch (error) {
        console.error('Errore caricamento firme:', error);
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${error.message}</div></div>`;
    }
}

function populateFirmeClientFilter(firme) {
    const datalist = document.getElementById('firme-client-list');
    if (!datalist) return;
    const nomi = [...new Set(firme.map(f => f.nomeCliente).filter(Boolean))].sort();
    datalist.innerHTML = nomi.map(n => `<option value="${n}">`).join('');
}

function filterFirmeDebounced() {
    clearTimeout(firmeFilterTimer);
    firmeFilterTimer = setTimeout(filterFirme, 300);
}

function filterFirme() {
    if (!firmeData.length) return;
    const filtroCliente = (document.getElementById('firme-filter-cliente')?.value || '').trim().toLowerCase();
    const filtroStato   = (document.getElementById('firme-filter-stato')?.value || '').toLowerCase();

    const filtered = firmeData.filter(f => {
        const matchCliente = !filtroCliente || f.nomeCliente.toLowerCase().includes(filtroCliente);
        const matchStato   = !filtroStato   || f.stato.toLowerCase() === filtroStato;
        return matchCliente && matchStato;
    });
    renderFirme(filtered);
}

function renderFirme(firme) {
    const container = document.getElementById('firmeContainer');
    if (!container) return;

    if (!firme.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div>Nessuna firma trovata</div></div>`;
        return;
    }

    // Ordina per data inizio discendente (più recenti prima)
    const parseDate = s => { if (!s) return 0; const p = s.split('/'); return new Date(p[2], p[1]-1, p[0]).getTime(); };
    const sorted = [...firme].sort((a, b) => parseDate(b.dataInizio) - parseDate(a.dataInizio));

    let html = '';
    sorted.forEach(f => {
        const isAttivo  = f.stato.toLowerCase() === 'attivo';
        const statoClass = isAttivo ? 'attivo' : 'scaduto';

        let scadenzaInfo = '';
        if (f.giorniAllaScadenza !== null) {
            if (f.giorniAllaScadenza < 0) {
                scadenzaInfo = `<span style="color:#dc3545;">Scaduta da ${Math.abs(f.giorniAllaScadenza)} giorni</span>`;
            } else if (f.giorniAllaScadenza <= 60) {
                scadenzaInfo = `<span style="color:#fd7e14;">Scade tra ${f.giorniAllaScadenza} giorni</span>`;
            } else {
                scadenzaInfo = `<span style="color:#28a745;">Scade tra ${f.giorniAllaScadenza} giorni</span>`;
            }
        }

        html += `
        <div class="storico-card">
            <div class="storico-card-header">
                <span class="storico-id">${f.idFirma} &nbsp;<span style="color:#888;font-weight:400;font-size:13px;">${f.tipo}</span></span>
                <span class="storico-badge ${statoClass}">${f.stato}</span>
            </div>
            <div class="storico-descrizione" style="color:#555;">${f.nomeCliente}</div>
            <div class="firma-card-body">
                <div class="firma-stat">
                    <span class="storico-stat-label">Inizio</span>
                    <span class="storico-stat-value">${f.dataInizio || '—'}</span>
                </div>
                <div class="firma-stat">
                    <span class="storico-stat-label">Scadenza</span>
                    <span class="storico-stat-value">${f.dataScadenza || '—'}</span>
                </div>
                <div class="firma-stat">
                    <span class="storico-stat-label">Importo</span>
                    <span class="storico-stat-value">€ ${parseFloat(f.importo).toFixed(2)}</span>
                </div>
            </div>
            ${scadenzaInfo ? `<div class="storico-date" style="margin-top:4px;">${scadenzaInfo}</div>` : ''}
            ${f.note ? `<div class="storico-date">${f.note}</div>` : ''}
            ${f.idPrecedente ? `<div class="storico-date" style="color:#bbb;">Rinnovo di: ${f.idPrecedente}</div>` : ''}
            ${f.nFattura
                ? `<div class="storico-date">🧾 Fattura: <strong>${f.nFattura}</strong>${f.dataFattura ? ' — ' + f.dataFattura : ''}</div>`
                : (isAttivo ? `<div class="storico-actions"><button class="btn-small" style="background:#e8f4fd;color:#0c63e4;" onclick="openFirmaFatturaModal('${f.idFirma}', '${f.nomeCliente}', '${f.tipo}')">📋 Registra fattura</button></div>` : '')}
            ${isAttivo ? `
            <div class="storico-actions">
                <button class="btn-small btn-storico-detail"
                    onclick="openRinnovoModal('${f.idFirma}', 'FIRMA')">
                    🔄 Rinnova
                </button>
            </div>` : ''}
        </div>`;
    });

    container.innerHTML = html;
}

// =======================================================================
// === STORICO PACCHETTI ===
// =======================================================================

let storicoData = [];
let storicoFilterTimer = null;

async function loadStoricoPackages() {
    const container = document.getElementById('storicoContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading-scadenze">Caricamento storico...</div>';

    try {
        const cliente = (document.getElementById('storico-filter-cliente')?.value || '').trim();
        const stato   = document.getElementById('storico-filter-stato')?.value || '';

        let url = `${getAPIUrl()}?action=get_pacchetti_storico`;
        if (cliente) url += `&cliente_nome=${encodeURIComponent(cliente)}`;
        if (stato)   url += `&stato=${encodeURIComponent(stato)}`;

        const response = await fetch(url);
        const result   = await response.json();

        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');

        storicoData = result.pacchetti || [];
        populateStoricoClientFilter(storicoData);
        renderStorico(storicoData);

    } catch (error) {
        console.error('Errore caricamento storico:', error);
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${error.message}</div></div>`;
    }
}

function populateStoricoClientFilter(pacchetti) {
    const datalist = document.getElementById('storico-client-list');
    if (!datalist) return;
    const nomi = [...new Set(pacchetti.map(p => p.nomeCliente).filter(Boolean))].sort();
    datalist.innerHTML = nomi.map(n => `<option value="${n}">`).join('');
}

function filterStoricoDebounced() {
    clearTimeout(storicoFilterTimer);
    storicoFilterTimer = setTimeout(filterStorico, 300);
}

function filterStorico() {
    if (!storicoData.length) return;
    const filtroCliente = (document.getElementById('storico-filter-cliente')?.value || '').trim().toLowerCase();
    const filtroStato   = (document.getElementById('storico-filter-stato')?.value || '').toUpperCase();

    const filtered = storicoData.filter(p => {
        const matchCliente = !filtroCliente || p.nomeCliente.toLowerCase().includes(filtroCliente);
        const matchStato   = !filtroStato   || p.stato.toUpperCase() === filtroStato;
        return matchCliente && matchStato;
    });
    renderStorico(filtered);
}

function renderStorico(pacchetti) {
    const container = document.getElementById('storicoContainer');
    if (!container) return;

    if (!pacchetti.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div>Nessun pacchetto trovato</div></div>`;
        return;
    }

    // Raggruppa per cliente
    const gruppi = {};
    pacchetti.forEach(p => {
        const k = p.nomeCliente || '—';
        if (!gruppi[k]) gruppi[k] = [];
        gruppi[k].push(p);
    });

    let html = '';
    Object.keys(gruppi).sort().forEach(cliente => {
        html += `<div class="storico-gruppo">
            <div class="storico-gruppo-header">👤 ${cliente}</div>`;
        gruppi[cliente].forEach(p => {
            const statoClass = p.stato.toUpperCase() === 'ATTIVO'    ? 'attivo'
                             : p.stato.toUpperCase() === 'TERMINATO' ? 'terminato'
                             : p.stato.toUpperCase() === 'OVER'      ? 'over'
                             :                                          'scaduto';
            const percUsata = p.oreAcquistate > 0
                ? Math.min(100, Math.round((p.oreUtilizzate / p.oreAcquistate) * 100))
                : 0;
            html += `
            <div class="storico-card">
                <div class="storico-card-header">
                    <span class="storico-id">${p.idPacchetto}</span>
                    <span class="storico-badge ${statoClass}">${p.stato}</span>
                </div>
                ${p.descrizione ? `<div class="storico-descrizione">${p.descrizione}</div>` : ''}
                <div class="storico-card-body">
                    <div class="storico-stat">
                        <span class="storico-stat-label">Acquistate</span>
                        <span class="storico-stat-value">${p.oreAcquistate}h</span>
                    </div>
                    <div class="storico-stat">
                        <span class="storico-stat-label">Utilizzate</span>
                        <span class="storico-stat-value">${p.oreUtilizzate}h</span>
                    </div>
                    <div class="storico-stat">
                        <span class="storico-stat-label">Residue</span>
                        <span class="storico-stat-value" style="color:${p.oreResidue < 0 ? '#dc3545' : '#6c757d'};">${p.oreResidue}h</span>
                    </div>
                    <div class="storico-stat">
                        <span class="storico-stat-label">Importo</span>
                        <span class="storico-stat-value">€ ${parseFloat(p.importo).toFixed(2)}</span>
                    </div>
                </div>
                <div class="storico-progress-bar">
                    <div class="storico-progress-fill ${statoClass}" style="width:${percUsata}%"></div>
                </div>
                <div class="storico-date">
                    ${p.dataAcquisto ? `Acquisto: ${p.dataAcquisto}` : ''}
                    ${p.dataAcquisto && p.dataScadenza ? ' &nbsp;•&nbsp; ' : ''}
                    ${p.dataScadenza ? `Scadenza: ${p.dataScadenza}` : ''}
                </div>
                <div class="storico-actions">
                    <button class="btn-small btn-storico-detail"
                        onclick="openPacchettoDettaglio('${p.idPacchetto}', '${(p.descrizione || p.idPacchetto).replace(/'/g,"\\'")}', {nomeCliente:'${p.nomeCliente.replace(/'/g,"\\'")}',oreAcquistate:${p.oreAcquistate},dataAcquisto:'${p.dataAcquisto}',dataScadenza:'${p.dataScadenza}'})">
                        📋 Dettaglio interventi
                    </button>
                </div>
            </div>`;
        });
        html += `</div>`;
    });

    container.innerHTML = html;
}

// =======================================================================
// === STAMPA RIEPILOGO PACCHETTO ===
// =======================================================================

function stampaPacchettoRiepilogo(idPacchetto, nomeCliente, descrizione, rows, totOre, totExtra, totCosto, dataAcquisto, dataScadenza, oreAcquistate) {
    const oggi = new Date().toLocaleDateString('it-IT');
    const orePerc = oreAcquistate > 0 ? Math.min(100, Math.round((totOre / oreAcquistate) * 100)) : 0;

    let righe = rows.map((r, i) => `
        <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
            <td>${r.data || '—'}</td>
            <td class="desc">${r.descrizione || '—'}</td>
            <td class="center">${r.ore}h</td>
            <td class="center">${r.oreExtra > 0 ? '+' + r.oreExtra + 'h' : '—'}</td>
            <td>${r.tipoIntervento || '—'}</td>
            <td class="right">€ ${parseFloat(r.costo).toFixed(2)}</td>
        </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Riepilogo ${idPacchetto}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; font-size: 13px; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 30px; }

  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; padding-bottom:20px; border-bottom:3px solid #1a73e8; }
  .studio-name { font-size:22px; font-weight:700; color:#1a73e8; }
  .doc-info { text-align:right; color:#666; font-size:12px; }
  .doc-info .doc-title { font-size:16px; font-weight:600; color:#333; margin-bottom:4px; }

  .client-box { background:#f8f9ff; border:1px solid #d0d9f0; border-radius:8px; padding:16px 20px; margin-bottom:24px; }
  .client-box .label { font-size:11px; text-transform:uppercase; color:#888; letter-spacing:.5px; margin-bottom:4px; }
  .client-box .value { font-size:16px; font-weight:600; color:#1a73e8; }

  .meta-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:28px; }
  .meta-card { background:#fff; border:1px solid #e0e0e0; border-radius:6px; padding:12px; text-align:center; }
  .meta-card .m-label { font-size:10px; text-transform:uppercase; color:#999; letter-spacing:.5px; }
  .meta-card .m-value { font-size:18px; font-weight:700; color:#333; margin-top:4px; }
  .meta-card.highlight .m-value { color:#1a73e8; }

  .progress-wrap { margin-bottom:28px; }
  .progress-label { display:flex; justify-content:space-between; font-size:12px; color:#666; margin-bottom:6px; }
  .progress-bar { height:10px; background:#e9ecef; border-radius:5px; overflow:hidden; }
  .progress-fill { height:100%; background:linear-gradient(90deg,#1a73e8,#34a853); border-radius:5px; width:${orePerc}%; }

  table { width:100%; border-collapse:collapse; margin-bottom:28px; }
  thead tr { background:#1a73e8; color:#fff; }
  thead th { padding:10px 12px; text-align:left; font-size:12px; font-weight:600; }
  thead th.center { text-align:center; }
  thead th.right { text-align:right; }
  tbody tr.even { background:#f9f9f9; }
  tbody tr.odd  { background:#fff; }
  tbody td { padding:9px 12px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
  tbody td.center { text-align:center; }
  tbody td.right  { text-align:right; }
  tbody td.desc   { max-width:300px; }
  tfoot tr { background:#1a73e8; color:#fff; }
  tfoot td { padding:10px 12px; font-weight:700; }
  tfoot td.center { text-align:center; }
  tfoot td.right  { text-align:right; }

  .footer { text-align:center; font-size:11px; color:#aaa; margin-top:30px; padding-top:15px; border-top:1px solid #e0e0e0; }

  @media print {
    body { font-size:12px; }
    .page { padding:20px; }
    .no-print { display:none !important; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="studio-name">Studio Smart</div>
      <div style="color:#666;font-size:13px;margin-top:4px;">Riepilogo Interventi Pacchetto Ore</div>
    </div>
    <div class="doc-info">
      <div class="doc-title">${idPacchetto}</div>
      <div>Generato il ${oggi}</div>
      ${dataAcquisto ? `<div>Acquisto: ${dataAcquisto}</div>` : ''}
      ${dataScadenza ? `<div>Scadenza: ${dataScadenza}</div>` : ''}
    </div>
  </div>

  <div class="client-box">
    <div class="label">Cliente</div>
    <div class="value">${nomeCliente}</div>
    ${descrizione ? `<div style="color:#666;font-size:13px;margin-top:4px;">${descrizione}</div>` : ''}
  </div>

  <div class="meta-grid">
    <div class="meta-card highlight">
      <div class="m-label">Ore acquistate</div>
      <div class="m-value">${oreAcquistate}h</div>
    </div>
    <div class="meta-card">
      <div class="m-label">Ore utilizzate</div>
      <div class="m-value">${totOre.toFixed(1)}h</div>
    </div>
    <div class="meta-card">
      <div class="m-label">Ore extra</div>
      <div class="m-value" style="color:${totExtra > 0 ? '#dc3545' : '#aaa'};">${totExtra > 0 ? '+' + totExtra.toFixed(1) + 'h' : '—'}</div>
    </div>
    <div class="meta-card">
      <div class="m-label">Totale €</div>
      <div class="m-value">€ ${totCosto.toFixed(2)}</div>
    </div>
  </div>

  <div class="progress-wrap">
    <div class="progress-label">
      <span>Utilizzo ore</span>
      <span>${orePerc}%</span>
    </div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Descrizione</th>
        <th class="center">Ore</th>
        <th class="center">Extra</th>
        <th>Tipo</th>
        <th class="right">Costo €</th>
      </tr>
    </thead>
    <tbody>${righe}</tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right;">TOTALE</td>
        <td class="center">${totOre.toFixed(2)}h</td>
        <td class="center">${totExtra > 0 ? '+' + totExtra.toFixed(2) + 'h' : '—'}</td>
        <td></td>
        <td class="right">€ ${totCosto.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">Studio Smart &mdash; Riepilogo generato automaticamente il ${oggi}</div>
</div>
<script>window.onload = () => window.print();<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
}

// =======================================================================
// === FATTURA FIRMA DIGITALE ===
// =======================================================================

function openFirmaFatturaModal(idFirma, nomeCliente, tipo) {
    document.getElementById('firmaFatturaId').value = idFirma;
    document.getElementById('firmaFatturaInfo').textContent = `${idFirma} — ${nomeCliente} (${tipo})`;
    const oggi = new Date().toISOString().split('T')[0];
    document.getElementById('firmaFatturaData').value = oggi;
    document.getElementById('firmaFatturaN').value = '';
    const modal = document.getElementById('firmaFatturaModal');
    if (modal) modal.classList.add('active');
}

function closeFirmaFatturaModal() {
    const modal = document.getElementById('firmaFatturaModal');
    if (modal) modal.classList.remove('active');
}

async function submitFirmaFattura(e) {
    e.preventDefault();
    const idFirma    = document.getElementById('firmaFatturaId').value;
    const nFattura   = document.getElementById('firmaFatturaN').value.trim();
    const dataFattura = document.getElementById('firmaFatturaData').value;

    const btn = document.getElementById('firmaFatturaSubmitBtn');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Salvataggio...';

    try {
        const params = `firma_id=${encodeURIComponent(idFirma)}&n_fattura=${encodeURIComponent(nFattura)}&data_fattura=${dataFattura}`;
        const response = await fetch(`${getAPIUrl()}?action=update_fattura_firma&${params}`);
        const result   = await response.json();
        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
        closeFirmaFatturaModal();
        riepilogoLoaded.firme = false;
        loadFirmeRiepilogo();
    } catch (error) {
        console.error('Errore registrazione fattura firma:', error);
        alert('❌ Errore: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}

// =======================================================================
// === QODNET ===
// =======================================================================

let qodnetData = [];
let qodnetFilterTimer = null;

function openQodnetForm() {
    const modal = document.getElementById('qodnetModal');
    if (!modal) return;

    // Popola datalist clienti
    const datalist = document.getElementById('qodnet-client-list');
    if (datalist && datalist.options.length === 0) {
        fetch(`${getAPIUrl()}?action=get_data`)
            .then(r => r.json())
            .then(result => {
                if (result && result.clients) {
                    const nomi = result.clients
                        .map(c => typeof c === 'string' ? c : (c.name || ''))
                        .filter(Boolean).sort();
                    datalist.innerHTML = nomi.map(n => `<option value="${n}">`).join('');
                }
            })
            .catch(() => {});
    }

    // Date di default: oggi → +1 anno
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const nextYearStr = nextYear.toISOString().split('T')[0];

    const inizio = document.getElementById('qodnetDataInizio');
    const scad   = document.getElementById('qodnetDataScadenza');
    if (inizio && !inizio.value) inizio.value = today;
    if (scad  && !scad.value)   scad.value   = nextYearStr;

    // Reset provvigione calcolata
    calcQodnetProvvigione();

    modal.classList.add('active');
}

function closeQodnetModal() {
    const modal = document.getElementById('qodnetModal');
    if (modal) modal.classList.remove('active');
}

function calcQodnetProvvigione() {
    const imp  = parseFloat(document.getElementById('qodnetImponibile')?.value) || 0;
    const perc = parseFloat(document.getElementById('qodnetPercentuale')?.value) || 0;
    const field = document.getElementById('qodnetProvvigione');
    if (field) field.value = (imp * perc / 100).toFixed(2);
}

async function submitQodnet(e) {
    e.preventDefault();

    const cliente      = (document.getElementById('qodnetCliente')?.value || '').trim();
    const tipo         = document.getElementById('qodnetTipo')?.value || '';
    const prodotto     = (document.getElementById('qodnetProdotto')?.value || '').trim();
    const config       = (document.getElementById('qodnetConfigurazione')?.value || '').trim();
    const dataInizio   = document.getElementById('qodnetDataInizio')?.value || '';
    const dataScadenza = document.getElementById('qodnetDataScadenza')?.value || '';
    const imponibile   = document.getElementById('qodnetImponibile')?.value || '';
    const percentuale  = document.getElementById('qodnetPercentuale')?.value || '20';
    const provvigione  = document.getElementById('qodnetProvvigione')?.value || '';
    const note         = (document.getElementById('qodnetNote')?.value || '').trim();

    if (!cliente) { alert('⚠️ Seleziona un cliente'); return; }
    if (!prodotto) { alert('⚠️ Inserisci il prodotto'); return; }
    if (!imponibile || parseFloat(imponibile) <= 0) { alert('⚠️ Inserisci un imponibile valido'); return; }

    const btn = document.getElementById('qodnetSubmitBtn');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Salvataggio...';

    try {
        const params = [
            `cliente_nome=${encodeURIComponent(cliente)}`,
            `tipo=${encodeURIComponent(tipo)}`,
            `prodotto=${encodeURIComponent(prodotto)}`,
            `configurazione=${encodeURIComponent(config)}`,
            `data_inizio=${dataInizio}`,
            `data_scadenza=${dataScadenza}`,
            `imponibile=${imponibile}`,
            `percentuale=${percentuale}`,
            `provvigione=${provvigione}`,
            `note=${encodeURIComponent(note)}`
        ].join('&');

        const response = await fetch(`${getAPIUrl()}?action=insert_qodnet&${params}`);
        const result   = await response.json();

        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');

        alert(`✅ Abbonamento creato: ${result.id}`);
        closeQodnetModal();
        document.getElementById('qodnetForm').reset();
        // Forza ricaricamento riepilogo
        qodnetData = [];
        riepilogoLoaded.qodnet = false;
        switchVenditeSubtab('qodnet', 'riepilogo');

    } catch (error) {
        console.error('Errore insert QODNET:', error);
        alert('❌ Errore: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}

async function loadQodnetRiepilogo() {
    const container = document.getElementById('qodnetContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading-scadenze">Caricamento abbonamenti QODNET...</div>';

    try {
        const cliente = (document.getElementById('qodnet-filter-cliente')?.value || '').trim();
        const stato   = document.getElementById('qodnet-filter-stato')?.value || '';

        let url = `${getAPIUrl()}?action=get_qodnet_riepilogo`;
        if (cliente) url += `&cliente_nome=${encodeURIComponent(cliente)}`;
        if (stato)   url += `&stato=${encodeURIComponent(stato)}`;

        const response = await fetch(url);
        const result   = await response.json();

        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');

        qodnetData = result.abbonamenti || [];
        renderQodnet(qodnetData);

    } catch (error) {
        console.error('Errore caricamento QODNET:', error);
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${error.message}</div></div>`;
    }
}

function filterQodnetDebounced() {
    clearTimeout(qodnetFilterTimer);
    qodnetFilterTimer = setTimeout(filterQodnet, 300);
}

function filterQodnet() {
    if (!qodnetData.length) { loadQodnetRiepilogo(); return; }
    const filtroCliente = (document.getElementById('qodnet-filter-cliente')?.value || '').trim().toLowerCase();
    const filtroStato   = (document.getElementById('qodnet-filter-stato')?.value || '').toLowerCase();

    const filtered = qodnetData.filter(q => {
        const matchCliente = !filtroCliente || (q.nomeCliente || '').toLowerCase().includes(filtroCliente);
        const matchStato   = !filtroStato   || (q.stato || '').toLowerCase() === filtroStato;
        return matchCliente && matchStato;
    });
    renderQodnet(filtered);
}

function renderQodnet(lista) {
    const container = document.getElementById('qodnetContainer');
    if (!container) return;

    if (!lista.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌐</div><div>Nessun abbonamento trovato</div></div>`;
        return;
    }

    // Raggruppa per cliente
    const gruppi = {};
    lista.forEach(q => {
        const k = q.nomeCliente || '—';
        if (!gruppi[k]) gruppi[k] = [];
        gruppi[k].push(q);
    });

    let html = '';
    Object.keys(gruppi).sort().forEach(cliente => {
        html += `<div class="storico-gruppo">
            <div class="storico-gruppo-header">👤 ${cliente}</div>`;

        gruppi[cliente].forEach(q => {
            const stato = (q.stato || '').toLowerCase();
            const isAttivo = stato === 'attivo';
            const statoClass = isAttivo ? 'attivo' : stato === 'rinnovato' ? 'rinnovato' : 'scaduto';

            let scadenzaInfo = '';
            if (q.giorniAllaScadenza != null) {
                if (q.giorniAllaScadenza < 0) {
                    scadenzaInfo = `<span style="color:#dc3545;">Scaduto da ${Math.abs(q.giorniAllaScadenza)} giorni</span>`;
                } else if (q.giorniAllaScadenza <= 30) {
                    scadenzaInfo = `<span style="color:#dc3545;">⚠️ Scade tra ${q.giorniAllaScadenza} giorni</span>`;
                } else if (q.giorniAllaScadenza <= 60) {
                    scadenzaInfo = `<span style="color:#fd7e14;">Scade tra ${q.giorniAllaScadenza} giorni</span>`;
                } else {
                    scadenzaInfo = `<span style="color:#28a745;">Scade tra ${q.giorniAllaScadenza} giorni</span>`;
                }
            }

            const configHtml = q.configurazione
                ? `<div class="storico-date" style="color:#555;white-space:pre-wrap;">${q.configurazione}</div>`
                : '';

            const actionsHtml = isAttivo ? `
            <div class="storico-actions">
                <button class="btn-small btn-storico-detail" onclick="openQodnetRinnovoModal('${q.id}')">
                    🔄 Rinnova
                </button>
                <button class="btn-small" style="background:#f0f0f0;color:#555;"
                    onclick="updateStatoQodnet('${q.id}','Incorporato')">
                    📥 Incorporato
                </button>
            </div>` : '';

            html += `
            <div class="storico-card">
                <div class="storico-card-header">
                    <span class="storico-id">${q.id} &nbsp;<span style="color:#888;font-weight:400;font-size:13px;">${q.tipo || ''}</span></span>
                    <span class="storico-badge ${statoClass}">${q.stato}</span>
                </div>
                <div class="storico-descrizione">${q.prodotto || '—'}</div>
                <div class="firma-card-body">
                    <div class="firma-stat">
                        <span class="storico-stat-label">Inizio</span>
                        <span class="storico-stat-value">${q.dataInizio || '—'}</span>
                    </div>
                    <div class="firma-stat">
                        <span class="storico-stat-label">Scadenza</span>
                        <span class="storico-stat-value">${q.dataScadenza || '—'}</span>
                    </div>
                    <div class="firma-stat">
                        <span class="storico-stat-label">Imponibile</span>
                        <span class="storico-stat-value">€ ${parseFloat(q.imponibile || 0).toFixed(2)}</span>
                    </div>
                    <div class="firma-stat">
                        <span class="storico-stat-label">Provvigione</span>
                        <span class="storico-stat-value">€ ${parseFloat(q.provvigione || 0).toFixed(2)} <small style="color:#888;">(${q.percentuale || 20}%)</small></span>
                    </div>
                </div>
                ${configHtml}
                ${scadenzaInfo ? `<div class="storico-date" style="margin-top:4px;">${scadenzaInfo}</div>` : ''}
                ${q.note ? `<div class="storico-date">${q.note}</div>` : ''}
                ${actionsHtml}
            </div>`;
        });
        html += `</div>`;
    });

    container.innerHTML = html;
}

function openQodnetRinnovoModal(id) {
    const record = qodnetData.find(q => q.id === id);
    if (!record) { alert('Record non trovato'); return; }

    document.getElementById('qodnetRinnovoId').value = id;
    document.getElementById('qodnetRinnovoCliente').textContent = record.nomeCliente || '';
    document.getElementById('qodnetRinnovoDettagli').textContent =
        `${record.tipo || ''} — ${record.prodotto || ''} | Scadenza attuale: ${record.dataScadenza || '—'}`;

    // Data scadenza default: +1 anno dall'attuale
    const rinnovoScad = document.getElementById('qodnetRinnovoDataScadenza');
    if (rinnovoScad) {
        const base = record.dataScadenza ? new Date(record.dataScadenza) : new Date();
        base.setFullYear(base.getFullYear() + 1);
        rinnovoScad.value = base.toISOString().split('T')[0];
    }

    // Pre-popola configurazione e valori economici
    const configEl = document.getElementById('qodnetRinnovoConfigurazione');
    if (configEl) configEl.value = record.configurazione || '';

    const impEl  = document.getElementById('qodnetRinnovoImponibile');
    const percEl = document.getElementById('qodnetRinnovoPercentuale');
    if (impEl)  impEl.value  = record.imponibile  || '';
    if (percEl) percEl.value = record.percentuale || '20';
    calcQodnetRinnovoProvvigione();

    const modal = document.getElementById('qodnetRinnovoModal');
    if (modal) modal.classList.add('active');
}

function closeQodnetRinnovoModal() {
    const modal = document.getElementById('qodnetRinnovoModal');
    if (modal) modal.classList.remove('active');
}

function calcQodnetRinnovoProvvigione() {
    const imp  = parseFloat(document.getElementById('qodnetRinnovoImponibile')?.value) || 0;
    const perc = parseFloat(document.getElementById('qodnetRinnovoPercentuale')?.value) || 0;
    const field = document.getElementById('qodnetRinnovoProvvigione');
    if (field) field.value = (imp * perc / 100).toFixed(2);
}

async function submitQodnetRinnovo(e) {
    e.preventDefault();

    const id           = document.getElementById('qodnetRinnovoId')?.value || '';
    const dataScadenza = document.getElementById('qodnetRinnovoDataScadenza')?.value || '';
    const config       = (document.getElementById('qodnetRinnovoConfigurazione')?.value || '').trim();
    const imponibile   = document.getElementById('qodnetRinnovoImponibile')?.value || '';
    const percentuale  = document.getElementById('qodnetRinnovoPercentuale')?.value || '20';
    const provvigione  = document.getElementById('qodnetRinnovoProvvigione')?.value || '';
    const note         = (document.getElementById('qodnetRinnovoNote')?.value || '').trim();

    if (!id || !dataScadenza) { alert('⚠️ Dati mancanti'); return; }

    const btn = e.submitter || document.querySelector('#qodnetRinnovoForm button[type="submit"]');
    const origText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Rinnovando...'; }

    try {
        const params = [
            `id=${encodeURIComponent(id)}`,
            `data_scadenza=${dataScadenza}`,
            `configurazione=${encodeURIComponent(config)}`,
            `imponibile=${imponibile}`,
            `percentuale=${percentuale}`,
            `provvigione=${provvigione}`,
            `note=${encodeURIComponent(note)}`
        ].join('&');

        const response = await fetch(`${getAPIUrl()}?action=rinnova_qodnet&${params}`);
        const result   = await response.json();

        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');

        alert(`✅ Rinnovo completato: ${result.nuovoId}`);
        closeQodnetRinnovoModal();
        document.getElementById('qodnetRinnovoForm').reset();
        qodnetData = [];
        riepilogoLoaded.qodnet = false;
        switchVenditeSubtab('qodnet', 'riepilogo');

    } catch (error) {
        console.error('Errore rinnovo QODNET:', error);
        alert('❌ Errore: ' + error.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
}

async function updateStatoQodnet(id, stato) {
    if (!confirm(`Segnare questo abbonamento come "${stato}"?`)) return;

    try {
        const params = `id=${encodeURIComponent(id)}&stato=${encodeURIComponent(stato)}`;
        const response = await fetch(`${getAPIUrl()}?action=update_stato_qodnet&${params}`);
        const result   = await response.json();

        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');

        qodnetData = [];
        riepilogoLoaded.qodnet = false;
        loadQodnetRiepilogo();

    } catch (error) {
        console.error('Errore update stato QODNET:', error);
        alert('❌ Errore: ' + error.message);
    }
}

// Esporta funzioni per uso globale
if (typeof window !== 'undefined') {
    window.initVenditeTab = initVenditeTab;
    window.openVenditaModal = openVenditaModal;
    window.closeVenditaModal = closeVenditaModal;
    window.submitVendita = submitVendita;
    window.openRinnovoModal = openRinnovoModal;
    window.closeRinnovoModal = closeRinnovoModal;
    window.submitRinnovo = submitRinnovo;
    window.loadScadenze = loadScadenze;
    window.openProformaCanoneModal = openProformaCanoneModal;
    window.closeProformaCanoneModal = closeProformaCanoneModal;
    window.submitProformaCanone = submitProformaCanone;
    window.openFatturaCanoneModal = openFatturaCanoneModal;
    window.closeFatturaCanoneModal = closeFatturaCanoneModal;
    window.submitFatturaCanone = submitFatturaCanone;
    window.closeProformaFromPacchettoModal = closeProformaFromPacchettoModal;
    window.generateProformaFromPacchetto = generateProformaFromPacchetto;
    window.loadStoricoPackages = loadStoricoPackages;
    window.filterStorico = filterStorico;
    window.filterStoricoDebounced = filterStoricoDebounced;
    window.stampaPacchettoRiepilogo = stampaPacchettoRiepilogo;
    window.loadFirmeRiepilogo = loadFirmeRiepilogo;
    window.filterFirme = filterFirme;
    window.filterFirmeDebounced = filterFirmeDebounced;
    window.openFirmaFatturaModal = openFirmaFatturaModal;
    window.closeFirmaFatturaModal = closeFirmaFatturaModal;
    window.submitFirmaFattura = submitFirmaFattura;
    window.loadCanoniRiepilogo = loadCanoniRiepilogo;
    window.filterCanoni = filterCanoni;
    window.filterCanoniDebounced = filterCanoniDebounced;
    window.switchVenditeSection = switchVenditeSection;
    window.switchVenditeSubtab = switchVenditeSubtab;
    window.openQodnetForm = openQodnetForm;
    window.closeQodnetModal = closeQodnetModal;
    window.calcQodnetProvvigione = calcQodnetProvvigione;
    window.submitQodnet = submitQodnet;
    window.loadQodnetRiepilogo = loadQodnetRiepilogo;
    window.filterQodnet = filterQodnet;
    window.filterQodnetDebounced = filterQodnetDebounced;
    window.openQodnetRinnovoModal = openQodnetRinnovoModal;
    window.closeQodnetRinnovoModal = closeQodnetRinnovoModal;
    window.calcQodnetRinnovoProvvigione = calcQodnetRinnovoProvvigione;
    window.submitQodnetRinnovo = submitQodnetRinnovo;
    window.updateStatoQodnet = updateStatoQodnet;
}
