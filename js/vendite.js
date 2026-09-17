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

// Cache persistente delle liste (js/cache-liste.js). Se questo file arriva più
// nuovo di index.html (cache HTTP nei minuti dopo un deploy) l'aiutante può non
// esserci: allora si carica come prima, direttamente dal server.
function _crmCacheListe() {
    return window.crmCache || {
        carica: async (o) => {
            o.caricamento();
            try { o.mostra(await o.scarica()); } catch (e) { o.errore(e); }
        }
    };
}

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
    const subtabs = ['nuovo', 'riepilogo', 'controlli', 'provvigioni', 'riscontro'];
    subtabs.forEach(st => {
        const content = document.getElementById(`vsub-${section}-${st}-content`);
        const btn     = document.getElementById(`vsub-${section}-${st}`);
        if (content) content.style.display = st === subtab ? '' : 'none';
        if (btn)     btn.classList.toggle('active', st === subtab);
    });

    // Carica dati la prima volta che si apre il riepilogo
    if (subtab === 'riepilogo' && !riepilogoLoaded[section]) {
        riepilogoLoaded[section] = true;
        if (section === 'pacchetti') loadStoricoPackages();
        if (section === 'canoni')    loadCanoniRiepilogo();
        if (section === 'firme')     loadFirmeRiepilogo();
        if (section === 'qodnet')    loadQodnetRiepilogo();
    }

    // QODNET: Servizi e Provvigioni leggono gli stessi dati
    if (subtab === 'provvigioni' && section === 'qodnet') {
        riepilogoLoaded.qodnet = true;
        if (qodnetDati) renderQodnetProvvigioni(); else loadQodnetRiepilogo();
    }

    // La vista controlli si ricarica sempre (lo stato cambia man mano che registri)
    if (subtab === 'controlli' && section === 'canoni') {
        loadControlliDaFare();
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

async function loadScadenze(opzioni) {
    const container = document.getElementById('scadenzeContainer');
    if (!container) return;

    return _crmCacheListe().carica({
        chiave: 'vendite_scadenze',
        contenitore: 'scadenzeContainer',
        forzato: !!(opzioni && opzioni.forzato),
        aggiorna: () => loadScadenze({ forzato: true }),

        caricamento: () => {
            container.innerHTML = '<div class="loading-scadenze">Caricamento scadenze...</div>';
        },

        scarica: async (opzioniFetch) => {
            // Le due chiamate sono lente (GAS): partono in parallelo per dimezzare l'attesa.
            const [result, controlli] = await Promise.all([
                fetch(`${getAPIUrl()}?action=get_scadenze&giorni=90`, opzioniFetch).then(r => r.json()),
                fetchControlliDaFare(opzioniFetch).catch(() => null)
            ]);
            if (!result.success) {
                throw new Error(result.error || 'Errore sconosciuto');
            }
            return { scadenze: result.data, controlli: controlli };
        },

        // Se i controlli non sono arrivati la risposta è incompleta: si mostra
        // ma non si salva, altrimenti per 5 minuti sembrerebbe «nessun controllo».
        salvabile: (dati) => dati.controlli !== null,

        mostra: (dati) => {
            scadenzeData = dati.scadenze;
            controlliDaFareData = dati.controlli || [];
            renderScadenze(scadenzeData);
        },

        errore: (error) => {
            container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div>Errore caricamento scadenze</div>
                <div style="font-size: 12px; margin-top: 8px; color: #999;">${error.message}</div>
            </div>
        `;
        }
    });
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

    // Sezione Controlli periodici da fare (in cima: azionabili subito)
    if (controlliDaFareData && controlliDaFareData.length > 0) {
        const sezControlli = document.createElement('div');
        sezControlli.style.marginBottom = '30px';

        const titleControlli = document.createElement('h3');
        titleControlli.innerHTML = '<i class="fas fa-clipboard-check" style="color:#fd7e14;margin-right:6px;"></i>Controlli da fare';
        titleControlli.style.color = '#fd7e14';
        titleControlli.style.marginBottom = '15px';
        sezControlli.appendChild(titleControlli);

        const bodyControlli = document.createElement('div');
        bodyControlli.innerHTML = controlliDaFareGroupedHtml(controlliDaFareData, 'sccdf', 'scadenze');
        sezControlli.appendChild(bodyControlli);

        container.appendChild(sezControlli);
    }

    // Sezione Canoni da Rinnovare (scaduti)
    if (canoniScaduti.length > 0) {
        const sezioneCanoni = document.createElement('div');
        sezioneCanoni.style.marginBottom = '30px';
        
        const titleCanoni = document.createElement('h3');
        titleCanoni.innerHTML = '<i class="fas fa-circle" style="color:#dc3545;font-size:0.65em;vertical-align:middle;margin-right:6px;"></i>Canoni da Rinnovare';
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
    
    const nessunControllo = !controlliDaFareData || controlliDaFareData.length === 0;
    if (canoniScaduti.length === 0 && altreScadenze.length === 0 && nessunControllo) {
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
                    <i class="fas fa-file"></i> Proforma
                </button>
            `;
        } else if (prodotto.fatturazione === CANONE_FATTURAZIONE.PROFORMATO) {
            actionButtons = `
                <button class="btn-small btn-fattura" onclick="openFatturaCanoneModal('${id}')">
                    <i class="fas fa-receipt"></i> Fattura
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
    const controlliGroup = document.getElementById('venditaControlliGroup');
    const controlliCheck = document.getElementById('venditaControlliCheck');
    const controlliDettagli = document.getElementById('venditaControlliDettagli');

    // Reset stato controlli periodici a ogni apertura
    if (controlliCheck) controlliCheck.checked = false;
    if (controlliDettagli) controlliDettagli.style.display = 'none';
    if (controlliGroup) controlliGroup.style.display = 'none';

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
        if (controlliGroup) controlliGroup.style.display = 'block';
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

            // Controlli periodici: canone di tipo CONTROLLI con N slot da tracciare
            const controlliCheck = document.getElementById('venditaControlliCheck');
            if (controlliCheck && controlliCheck.checked) {
                const nControlli = document.getElementById('venditaNControlli')?.value || 2;
                const etichette = document.getElementById('venditaEtichetteControlli')?.value || '';
                params += `&tipo=CONTROLLI&n_controlli=${encodeURIComponent(nControlli)}`;
                if (etichette.trim() !== '') {
                    params += `&etichette=${encodeURIComponent(etichette)}`;
                }
            }
        } else if (tipo === 'firma') {
            action = 'insert_firma';
            const tipoFirma = document.getElementById('venditaTipoFirma').value;
            const note = document.getElementById('venditaNote')?.value || '';
            params += `&tipo=${tipoFirma}&durata_anni=${durataAnni}&note=${encodeURIComponent(note)}`;
        }
        
        const response = await fetch(`${getAPIUrl()}?action=${action}&${params}`);
        const result = await response.json();
        
        if (result.success) {
            window.markTabDirty && window.markTabDirty('vendite');
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
                    <span><i class="fas fa-file"></i> Emetti Proforma Canone</span>
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
                        <button class="btn-primary" id="proforma-canone-submit" onclick="submitProformaCanone()"><i class="fas fa-file"></i> Genera Proforma</button>
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
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Elaborazione...';

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
        submitBtn.innerHTML = '<i class="fas fa-file"></i> Genera Proforma';
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
                    <span><i class="fas fa-receipt"></i> Registra Fattura Canone</span>
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
                        <button class="btn-primary" id="fattura-canone-submit" onclick="submitFatturaCanone()"><i class="fas fa-receipt"></i> Salva Fattura</button>
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
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';
    
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
        submitBtn.innerHTML = '<i class="fas fa-receipt"></i> Salva Fattura';
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

    // 1) Prova nei prodotti in scadenza (vista Scadenze)
    if (scadenzeData && scadenzeData.tutti) {
        prodotto = scadenzeData.tutti.find(p => {
            if (tipo === 'CANONE') return p.idCanone === id;
            else return p.idFirma === id;
        });
    }

    // 2) Fallback nei dati del Riepilogo: il pulsante Rinnova può essere premuto
    //    anche per canoni/firme NON in scadenza entro 90 giorni (assenti da scadenzeData)
    if (!prodotto && tipo === 'CANONE' && Array.isArray(canoniData)) {
        const c = canoniData.find(x => x.idCanone === id);
        if (c) prodotto = {
            idCanone: c.idCanone, nomeCliente: c.nomeCliente, descrizione: c.descrizione,
            importo: c.importo, dataScadenza: c.dataScadenza, tipoProdotto: 'CANONE'
        };
    }
    if (!prodotto && tipo !== 'CANONE' && Array.isArray(firmeData)) {
        const f = firmeData.find(x => x.idFirma === id);
        if (f) prodotto = {
            idFirma: f.idFirma, nomeCliente: f.nomeCliente, tipo: f.tipo,
            importo: f.importo, dataScadenza: f.dataScadenza
        };
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

    // dataScadenza può essere già "gg/mm/aaaa" (riepilogo) o Date/ISO (scadenze)
    let dataScadenza = '—';
    if (typeof prodotto.dataScadenza === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(prodotto.dataScadenza)) {
        dataScadenza = prodotto.dataScadenza;
    } else if (prodotto.dataScadenza) {
        const d = new Date(prodotto.dataScadenza);
        if (!isNaN(d.getTime())) dataScadenza = d.toLocaleDateString('it-IT');
    }
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
            window.markTabDirty && window.markTabDirty('vendite');
            alert('✅ Rinnovo completato con successo!');
            closeRinnovoModal();
            loadScadenze();
            // Aggiorna anche il riepilogo attualmente rilevante (altrimenti resta vecchio)
            if (tipo === 'CANONE') {
                if (typeof loadCanoniRiepilogo === 'function') loadCanoniRiepilogo();
            } else {
                if (typeof loadFirmeRiepilogo === 'function') loadFirmeRiepilogo();
            }
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
                    <h2><i class="fas fa-file"></i> Genera Proforma</h2>
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
                        <button class="btn-primary" onclick="generateProformaFromPacchetto('${pacchettoData.id_pacchetto}')"><i class="fas fa-file"></i> Genera Proforma</button>
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

// =======================================================================
// === VISTA CONTROLLI DA FARE (subtab Canoni + dashboard Scadenze) ===
// =======================================================================

let controlliDaFareData = [];

function _escControllo(str) {
    return (str == null ? '' : String(str))
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function fetchControlliDaFare(opzioniFetch) {
    const response = await fetch(`${getAPIUrl()}?action=get_controlli_da_fare`, opzioniFetch);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
    controlliDaFareData = result.controlli || [];
    return controlliDaFareData;
}

// Loader per il subtab dedicato (Vendite → Canoni → Controlli da fare).
// Registrare un controllo è una scrittura: la cache risulta vecchia e la
// lista si rilegge da sola.
async function loadControlliDaFare(opzioni) {
    const container = document.getElementById('controlliDaFareContainer');
    if (!container) return;

    return _crmCacheListe().carica({
        chiave: 'vendite_controlli',
        contenitore: 'controlliDaFareContainer',
        forzato: !!(opzioni && opzioni.forzato),
        aggiorna: () => loadControlliDaFare({ forzato: true }),

        caricamento: () => {
            container.innerHTML = '<div class="loading-scadenze">Caricamento controlli...</div>';
        },

        scarica: fetchControlliDaFare,

        mostra: (controlli) => {
            controlliDaFareData = controlli;
            container.innerHTML = controlli.length
                ? `<div style="font-size:13px;color:#666;margin-bottom:10px;">${controlli.length} controllo/i da eseguire</div>`
                  + controlliDaFareGroupedHtml(controlli, 'cdf', 'canoni')
                : `<div class="empty-state"><div class="empty-state-icon">✅</div><div>Nessun controllo da fare</div></div>`;
        },

        errore: (error) => {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${_escControllo(error.message)}</div></div>`;
        }
    });
}

// Raggruppa per cliente e restituisce l'HTML. prefix = namespace ID (evita
// collisioni fra subtab e dashboard); reloadKey = quale vista ricaricare dopo il salvataggio.
function controlliDaFareGroupedHtml(controlli, prefix, reloadKey) {
    const gruppi = {};
    controlli.forEach(c => {
        const k = c.nomeCliente || '—';
        if (!gruppi[k]) gruppi[k] = [];
        gruppi[k].push(c);
    });

    let html = '';
    Object.keys(gruppi).sort().forEach(cliente => {
        html += `<div style="margin-bottom:14px;">
            <div style="font-size:13px;font-weight:700;color:#0d6efd;margin-bottom:6px;padding:6px 10px;background:#e7f1ff;border-radius:6px;border-left:3px solid #0d6efd;">
                <i class="fas fa-user"></i> ${_escControllo(cliente)}
            </div>`;
        gruppi[cliente].forEach(c => { html += controlloDaFareCardHtml(c, prefix, reloadKey); });
        html += `</div>`;
    });
    return html;
}

function controlloDaFareCardHtml(c, prefix, reloadKey) {
    const oggiISO = new Date().toISOString().split('T')[0];
    const etichetta = c.etichetta || ('Controllo ' + c.nControllo);
    const scad = c.canoneScadenza ? `Canone in scadenza: ${c.canoneScadenza}` : '';
    return `
    <div class="controllo-slot" style="border:1px solid #e9ecef;border-radius:6px;padding:10px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
                <strong style="font-size:13px;">${_escControllo(etichetta)}</strong>
                <div style="font-size:12px;color:#fd7e14;font-weight:600;">◷ Da fare</div>
                ${scad ? `<div style="font-size:12px;color:#777;">${scad}</div>` : ''}
            </div>
            <button class="btn btn-sm btn-primary" onclick="toggleCdfForm('${prefix}','${c.idControllo}')">
                <i class="fas fa-check"></i> Registra
            </button>
        </div>
        <div id="${prefix}-form-${c.idControllo}" style="display:none;margin-top:8px;">
            <input type="date" id="${prefix}-data-${c.idControllo}" value="${oggiISO}" style="width:100%;margin-bottom:6px;">
            <textarea id="${prefix}-report-${c.idControllo}" rows="3" placeholder="Report / note del controllo..." style="width:100%;margin-bottom:6px;"></textarea>
            <div style="display:flex;gap:6px;">
                <button class="btn btn-sm btn-success" onclick="submitCdf('${prefix}','${c.idControllo}','${reloadKey}')"><i class="fas fa-save"></i> Salva</button>
                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('${prefix}-form-${c.idControllo}').style.display='none'">Annulla</button>
            </div>
        </div>
    </div>`;
}

function toggleCdfForm(prefix, id) {
    const form = document.getElementById(`${prefix}-form-${id}`);
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function submitCdf(prefix, id, reloadKey) {
    const data = document.getElementById(`${prefix}-data-${id}`)?.value || '';
    const report = document.getElementById(`${prefix}-report-${id}`)?.value || '';

    try {
        const params = new URLSearchParams({
            action: 'registra_controllo',
            id_controllo: id,
            data_eseguita: data,
            report: report
        });
        const res = await fetch(`${getAPIUrl()}?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore registrazione');

        window.markTabDirty && window.markTabDirty('vendite');
        if (reloadKey === 'scadenze') loadScadenze();
        else loadControlliDaFare();
    } catch (error) {
        console.error('Errore submitCdf:', error);
        alert('❌ Errore: ' + error.message);
    }
}

async function loadCanoniRiepilogo(opzioni) {
    const container = document.getElementById('canoniContainer');
    if (!container) return;

    const cliente = (document.getElementById('canoni-filter-cliente')?.value || '').trim();
    const stato   = document.getElementById('canoni-filter-stato')?.value || '';

    return _crmCacheListe().carica({
        // Con i filtri lato server attivi la risposta è parziale: niente cache.
        chiave: (cliente || stato) ? null : 'vendite_canoni',
        contenitore: 'canoniContainer',
        forzato: !!(opzioni && opzioni.forzato),
        aggiorna: () => loadCanoniRiepilogo({ forzato: true }),

        caricamento: () => {
            container.innerHTML = '<div class="loading-scadenze">Caricamento canoni...</div>';
        },

        scarica: async (opzioniFetch) => {
            let url = `${getAPIUrl()}?action=get_canoni_riepilogo`;
            if (cliente) url += `&cliente_nome=${encodeURIComponent(cliente)}`;
            if (stato)   url += `&stato=${encodeURIComponent(stato)}`;

            const response = await fetch(url, opzioniFetch);
            const result   = await response.json();
            if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
            return result.canoni || [];
        },

        mostra: (canoni) => {
            canoniData = canoni;
            populateCanoniClientFilter(canoniData);
            filterCanoni();   // applica il filtro di default (nasconde i rinnovati/storico)
        },

        errore: (error) => {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${error.message}</div></div>`;
        }
    });
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
    const filtroCliente = (document.getElementById('canoni-filter-cliente')?.value || '').trim().toLowerCase();
    const filtroStato   = (document.getElementById('canoni-filter-stato')?.value || '').toUpperCase();

    const filtered = (canoniData || []).filter(c => {
        const matchCliente = !filtroCliente || c.nomeCliente.toLowerCase().includes(filtroCliente);
        const stU = (c.stato || '').toUpperCase();

        let matchStato;
        if (filtroStato === '')          matchStato = stU !== 'RINNOVATO';  // default: nascondi lo storico
        else if (filtroStato === 'TUTTI') matchStato = true;
        else                              matchStato = stU === filtroStato;

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
            <div class="storico-gruppo-header"><i class="fas fa-user"></i> ${cliente}</div>`;

        gruppi[cliente].forEach(c => {
            const statoUp    = (c.stato || '').toUpperCase();
            const isAttivo   = statoUp === 'ATTIVO';
            const isRinnovato = statoUp === 'RINNOVATO' || c.rinnovato === true;
            const statoClass = isAttivo ? 'attivo' : 'scaduto';

            let scadenzaInfo = '';
            if (isRinnovato) {
                scadenzaInfo = `<span style="color:#6c757d;">Rinnovato — sostituito dal canone successivo</span>`;
            } else if (c.giorniAllaScadenza !== null) {
                if (c.giorniAllaScadenza < 0) {
                    scadenzaInfo = `<span style="color:#dc3545;">Scaduto da ${Math.abs(c.giorniAllaScadenza)} giorni</span>`;
                } else if (c.giorniAllaScadenza <= 60) {
                    scadenzaInfo = `<span style="color:#fd7e14;">Scade tra ${c.giorniAllaScadenza} giorni</span>`;
                } else {
                    scadenzaInfo = `<span style="color:#28a745;">Scade tra ${c.giorniAllaScadenza} giorni</span>`;
                }
            }

            const isControlli = (c.tipo || '').toUpperCase() === 'CONTROLLI';

            const fattBadge = c.fatturazione ? `<span class="storico-badge" style="background:#e8f4fd;color:#0c63e4;margin-left:6px;">${c.fatturazione}</span>` : '';
            const statoBadge = isRinnovato
                ? `<span class="storico-badge" style="background:#e2e3f3;color:#4b3fae;">Rinnovato</span>`
                : `<span class="storico-badge ${statoClass}">${c.stato}</span>`;
            // Distinzione grafica per i canoni-controlli: bordo sinistro arancio + chip
            const cardStyle = isControlli ? ' style="border-left:4px solid #fd7e14;"' : '';
            const controlliChip = isControlli
                ? `<span class="storico-badge" style="background:#fff3cd;color:#856404;margin-left:6px;"><i class="fas fa-clipboard-check"></i> Controlli</span>`
                : '';

            const mostraAzioni = isAttivo || c.idPrecedente || isControlli;

            html += `
            <div class="storico-card"${cardStyle}>
                <div class="storico-card-header">
                    <span class="storico-id">${c.idCanone}${controlliChip}${fattBadge}</span>
                    ${statoBadge}
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
                ${mostraAzioni ? `
                <div class="storico-actions">
                    ${isAttivo ? `<button class="btn-small btn-storico-detail"
                        onclick="openRinnovoModal('${c.idCanone}', 'CANONE')">
                        <i class="fas fa-arrows-rotate"></i> Rinnova
                    </button>` : ''}
                    ${isControlli ? `<button class="btn-small"
                        onclick="toggleControlliCanoneCard('${c.idCanone}')">
                        <i class="fas fa-clipboard-check"></i> Controlli (${c.nControlli || ''})
                    </button>` : ''}
                    ${c.idPrecedente ? `<button class="btn-small"
                        onclick="toggleStoricoCanone('${c.idCanone}')">
                        <i class="fas fa-clock-rotate-left"></i> Storico
                    </button>` : ''}
                </div>
                <div id="canone-controlli-${c.idCanone}" style="display:none;margin-top:8px;"></div>
                <div id="storico-canone-${c.idCanone}" style="display:none;margin-top:8px;"></div>` : ''}
            </div>`;
        });
        html += `</div>`;
    });

    container.innerHTML = html;
}

// --- Storico rinnovi di un canone (catena ID_Precedente) ---
async function toggleStoricoCanone(idCanone) {
    const box = document.getElementById(`storico-canone-${idCanone}`);
    if (!box) return;
    if (box.style.display === 'none' || box.style.display === '') {
        box.style.display = 'block';
        await loadStoricoCanone(idCanone);
    } else {
        box.style.display = 'none';
    }
}

async function loadStoricoCanone(idCanone) {
    const box = document.getElementById(`storico-canone-${idCanone}`);
    if (!box) return;
    box.innerHTML = '<div style="font-size:12px;color:#888;">⏳ Caricamento storico...</div>';
    try {
        const res = await fetch(`${getAPIUrl()}?action=get_storico_rinnovi&prodotto_id=${encodeURIComponent(idCanone)}&tipo=CANONE`);
        const result = await res.json();
        const catena = Array.isArray(result) ? result : (result.data || []);
        box.innerHTML = renderStoricoRinnovi(catena);
    } catch (e) {
        console.error('Errore storico canone:', e);
        box.innerHTML = `<div style="font-size:12px;color:#dc3545;">Errore caricamento storico</div>`;
    }
}

// --- Storico rinnovi di una firma (catena ID_Precedente) ---
async function toggleStoricoFirma(idFirma) {
    const box = document.getElementById(`storico-firma-${idFirma}`);
    if (!box) return;
    if (box.style.display === 'none' || box.style.display === '') {
        box.style.display = 'block';
        await loadStoricoFirma(idFirma);
    } else {
        box.style.display = 'none';
    }
}

async function loadStoricoFirma(idFirma) {
    const box = document.getElementById(`storico-firma-${idFirma}`);
    if (!box) return;
    box.innerHTML = '<div style="font-size:12px;color:#888;">⏳ Caricamento storico...</div>';
    try {
        const res = await fetch(`${getAPIUrl()}?action=get_storico_rinnovi&prodotto_id=${encodeURIComponent(idFirma)}&tipo=FIRMA`);
        const result = await res.json();
        const catena = Array.isArray(result) ? result : (result.data || []);
        box.innerHTML = renderStoricoRinnovi(catena);
    } catch (e) {
        console.error('Errore storico firma:', e);
        box.innerHTML = `<div style="font-size:12px;color:#dc3545;">Errore caricamento storico</div>`;
    }
}

// Reso generico: la catena può contenere canoni (idCanone) o firme (idFirma).
function renderStoricoRinnovi(catena) {
    if (!catena || !catena.length) return '<div style="font-size:12px;color:#888;">Nessuno storico disponibile.</div>';

    const fmt = d => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('it-IT'); };

    // La catena arriva dal più vecchio al più recente: mostro il più recente in cima.
    const rows = catena.slice().reverse().map(c => {
        const isAttuale = (c.stato || '').toUpperCase() === 'ATTIVO';
        const color = isAttuale ? '#28a745' : '#6c757d';
        const id = c.idCanone || c.idFirma || '';
        return `
        <div style="border-left:3px solid ${color};padding:4px 8px;margin-bottom:4px;background:#f8f9fa;border-radius:4px;">
            <div style="font-size:12px;font-weight:600;">${id} ${isAttuale ? '<span style="color:#28a745;">(attuale)</span>' : ''}</div>
            <div style="font-size:12px;color:#555;">${fmt(c.dataInizio)} → ${fmt(c.dataScadenza)} · € ${parseFloat(c.importo || 0).toFixed(2)} · ${c.stato || ''}</div>
        </div>`;
    }).join('');

    return `<div style="font-size:12px;color:#888;margin-bottom:4px;">Storico rinnovi (${catena.length})</div>${rows}`;
}

// --- Controlli periodici sulla card canone (storico completo: fatti + da fare) ---
async function toggleControlliCanoneCard(idCanone) {
    const box = document.getElementById(`canone-controlli-${idCanone}`);
    if (!box) return;
    if (box.style.display === 'none' || box.style.display === '') {
        box.style.display = 'block';
        await loadControlliCanoneCard(idCanone);
    } else {
        box.style.display = 'none';
    }
}

async function loadControlliCanoneCard(idCanone) {
    const box = document.getElementById(`canone-controlli-${idCanone}`);
    if (!box) return;
    box.innerHTML = '<div style="font-size:12px;color:#888;">⏳ Caricamento controlli...</div>';
    try {
        const res = await fetch(`${getAPIUrl()}?action=get_controlli&canone_id=${encodeURIComponent(idCanone)}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        box.innerHTML = renderControlliCanoneCard(idCanone, result.controlli || []);
    } catch (e) {
        box.innerHTML = `<div style="font-size:12px;color:#dc3545;">Errore controlli: ${_escControllo(e.message)}</div>`;
    }
}

function renderControlliCanoneCard(idCanone, controlli) {
    if (!controlli.length) return '<div style="font-size:12px;color:#888;">Nessun controllo generato.</div>';
    const rows = controlli.map(c => {
        const eseguito = c.stato === 'Eseguito';
        const badge = eseguito
            ? `<span style="color:#28a745;font-weight:600;">✓ Eseguito${c.dataEseguita ? ' il ' + c.dataEseguita : ''}</span>`
            : `<span style="color:#fd7e14;font-weight:600;">◷ Da fare</span>`;
        const reportHtml = c.report ? `<div style="font-size:12px;color:#555;margin-top:2px;white-space:pre-wrap;">${_escControllo(c.report)}</div>` : '';
        const etichetta = c.etichetta || ('Controllo ' + c.nControllo);
        const dataVal = (eseguito && c.dataEseguita) ? c.dataEseguita.split('/').reverse().join('-') : '';
        return `
        <div style="border:1px solid #e9ecef;border-radius:6px;padding:8px;margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div>
                    <strong style="font-size:13px;">${_escControllo(etichetta)}</strong>
                    <div style="font-size:12px;">${badge}</div>
                    ${reportHtml}
                </div>
                <button class="btn-small" onclick="toggleVccForm('${c.idControllo}')">
                    ${eseguito ? '<i class="fas fa-pen"></i> Modifica' : '<i class="fas fa-check"></i> Registra'}
                </button>
            </div>
            <div id="vcc-form-${c.idControllo}" style="display:none;margin-top:8px;">
                <input type="date" id="vcc-data-${c.idControllo}" value="${dataVal}" style="width:100%;margin-bottom:6px;">
                <textarea id="vcc-report-${c.idControllo}" rows="3" placeholder="Report / note del controllo..." style="width:100%;margin-bottom:6px;">${_escControllo(c.report || '')}</textarea>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn-small btn-storico-detail" onclick="submitControlloCard('${idCanone}','${c.idControllo}')"><i class="fas fa-save"></i> Salva</button>
                    <button class="btn-small" onclick="document.getElementById('vcc-form-${c.idControllo}').style.display='none'">Annulla</button>
                    ${eseguito ? `<button class="btn-small" style="color:#dc3545;" onclick="resetControlloCard('${idCanone}','${c.idControllo}')">Azzera</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
    return `<div style="font-size:12px;color:#888;margin-bottom:4px;">Controlli del ciclo (${controlli.length})</div>${rows}`;
}

function toggleVccForm(idControllo) {
    const f = document.getElementById(`vcc-form-${idControllo}`);
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function submitControlloCard(idCanone, idControllo) {
    const data = document.getElementById(`vcc-data-${idControllo}`)?.value || '';
    const report = document.getElementById(`vcc-report-${idControllo}`)?.value || '';
    try {
        const params = new URLSearchParams({ action: 'registra_controllo', id_controllo: idControllo, data_eseguita: data, report: report });
        const res = await fetch(`${getAPIUrl()}?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore registrazione');
        window.markTabDirty && window.markTabDirty('vendite');
        await loadControlliCanoneCard(idCanone);
    } catch (e) {
        console.error('Errore submitControlloCard:', e);
        alert('❌ Errore: ' + e.message);
    }
}

async function resetControlloCard(idCanone, idControllo) {
    if (!confirm('Azzerare questo controllo (rimuove data e report, torna "Da fare")?')) return;
    try {
        const params = new URLSearchParams({ action: 'update_controllo', id_controllo: idControllo, stato: 'Da fare' });
        const res = await fetch(`${getAPIUrl()}?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        await loadControlliCanoneCard(idCanone);
    } catch (e) {
        console.error('Errore resetControlloCard:', e);
        alert('❌ Errore: ' + e.message);
    }
}

// =======================================================================
// === RIEPILOGO FIRME DIGITALI ===
// =======================================================================

let firmeData = [];
let firmeFilterTimer = null;

async function loadFirmeRiepilogo(opzioni) {
    const container = document.getElementById('firmeContainer');
    if (!container) return;

    // Recupera SEMPRE tutte le firme: il filtro per stato è client-side
    // (filterFirme), così la rilevazione dei rinnovi lato server lavora
    // sempre sulla lista completa.
    const cliente = (document.getElementById('firme-filter-cliente')?.value || '').trim();

    return _crmCacheListe().carica({
        // Con il filtro cliente lato server attivo la risposta è parziale: niente cache.
        chiave: cliente ? null : 'vendite_firme',
        contenitore: 'firmeContainer',
        forzato: !!(opzioni && opzioni.forzato),
        aggiorna: () => loadFirmeRiepilogo({ forzato: true }),

        caricamento: () => {
            container.innerHTML = '<div class="loading-scadenze">Caricamento firme...</div>';
        },

        scarica: async (opzioniFetch) => {
            let url = `${getAPIUrl()}?action=get_firme_riepilogo`;
            if (cliente) url += `&cliente_nome=${encodeURIComponent(cliente)}`;

            const response = await fetch(url, opzioniFetch);
            const result   = await response.json();
            if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
            return result.firme || [];
        },

        mostra: (firme) => {
            firmeData = firme;
            populateFirmeClientFilter(firmeData);
            filterFirme();   // applica il filtro di default (nasconde le rinnovate/storico)
        },

        errore: (error) => {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${error.message}</div></div>`;
        }
    });
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
    const filtroCliente = (document.getElementById('firme-filter-cliente')?.value || '').trim().toLowerCase();
    const filtroStato   = (document.getElementById('firme-filter-stato')?.value || '').toLowerCase();

    const filtered = (firmeData || []).filter(f => {
        const matchCliente = !filtroCliente || f.nomeCliente.toLowerCase().includes(filtroCliente);
        const stL = (f.stato || '').toLowerCase();

        let matchStato;
        if (filtroStato === '')           matchStato = stL !== 'rinnovato';  // default: nascondi lo storico
        else if (filtroStato === 'tutti') matchStato = true;
        else                              matchStato = stL === filtroStato;

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
        const stL        = (f.stato || '').toLowerCase();
        const isAttivo   = stL === 'attivo';
        const isRinnovata = stL === 'rinnovato' || f.rinnovata === true;
        const statoClass = isAttivo ? 'attivo' : 'scaduto';

        let scadenzaInfo = '';
        if (isRinnovata) {
            scadenzaInfo = `<span style="color:#6c757d;">Rinnovata — sostituita dalla firma successiva</span>`;
        } else if (f.giorniAllaScadenza !== null) {
            if (f.giorniAllaScadenza < 0) {
                scadenzaInfo = `<span style="color:#dc3545;">Scaduta da ${Math.abs(f.giorniAllaScadenza)} giorni</span>`;
            } else if (f.giorniAllaScadenza <= 60) {
                scadenzaInfo = `<span style="color:#fd7e14;">Scade tra ${f.giorniAllaScadenza} giorni</span>`;
            } else {
                scadenzaInfo = `<span style="color:#28a745;">Scade tra ${f.giorniAllaScadenza} giorni</span>`;
            }
        }

        const statoBadge = isRinnovata
            ? `<span class="storico-badge" style="background:#e2e3f3;color:#4b3fae;">Rinnovato</span>`
            : `<span class="storico-badge ${statoClass}">${f.stato}</span>`;

        html += `
        <div class="storico-card">
            <div class="storico-card-header">
                <span class="storico-id">${f.idFirma} &nbsp;<span style="color:#888;font-weight:400;font-size:13px;">${f.tipo}</span></span>
                ${statoBadge}
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
                ? `<div class="storico-date"><i class="fas fa-receipt"></i> Fattura: <strong>${f.nFattura}</strong>${f.dataFattura ? ' — ' + f.dataFattura : ''}</div>`
                : (isAttivo ? `<div class="storico-actions"><button class="btn-small" style="background:#e8f4fd;color:#0c63e4;" onclick="openFirmaFatturaModal('${f.idFirma}', '${f.nomeCliente}', '${f.tipo}')"><i class="fas fa-clipboard"></i> Registra fattura</button></div>` : '')}
            ${(isAttivo || f.idPrecedente) ? `
            <div class="storico-actions">
                ${isAttivo ? `<button class="btn-small btn-storico-detail"
                    onclick="openRinnovoModal('${f.idFirma}', 'FIRMA')">
                    <i class="fas fa-arrows-rotate"></i> Rinnova
                </button>` : ''}
                ${f.idPrecedente ? `<button class="btn-small"
                    onclick="toggleStoricoFirma('${f.idFirma}')">
                    <i class="fas fa-clock-rotate-left"></i> Storico
                </button>` : ''}
            </div>
            <div id="storico-firma-${f.idFirma}" style="display:none;margin-top:8px;"></div>` : ''}
        </div>`;
    });

    container.innerHTML = html;
}

// =======================================================================
// === STORICO PACCHETTI ===
// =======================================================================

let storicoData = [];
let storicoFilterTimer = null;

async function loadStoricoPackages(opzioni) {
    const container = document.getElementById('storicoContainer');
    if (!container) return;

    const cliente = (document.getElementById('storico-filter-cliente')?.value || '').trim();
    const stato   = document.getElementById('storico-filter-stato')?.value || '';

    return _crmCacheListe().carica({
        // Con i filtri lato server attivi la risposta è parziale: niente cache.
        chiave: (cliente || stato) ? null : 'vendite_pacchetti',
        contenitore: 'storicoContainer',
        forzato: !!(opzioni && opzioni.forzato),
        aggiorna: () => loadStoricoPackages({ forzato: true }),

        caricamento: () => {
            container.innerHTML = '<div class="loading-scadenze">Caricamento storico...</div>';
        },

        scarica: async (opzioniFetch) => {
            let url = `${getAPIUrl()}?action=get_pacchetti_storico`;
            if (cliente) url += `&cliente_nome=${encodeURIComponent(cliente)}`;
            if (stato)   url += `&stato=${encodeURIComponent(stato)}`;

            const response = await fetch(url, opzioniFetch);
            const result   = await response.json();
            if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
            return result.pacchetti || [];
        },

        mostra: (pacchetti) => {
            storicoData = pacchetti;
            populateStoricoClientFilter(storicoData);
            renderStorico(storicoData);
        },

        errore: (error) => {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${error.message}</div></div>`;
        }
    });
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
            <div class="storico-gruppo-header"><i class="fas fa-user"></i> ${cliente}</div>`;
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
                        <i class="fas fa-list"></i> Dettaglio interventi
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

    const oreNormali   = rows.filter(r => r.modAddebito !== 'Omaggio').reduce((s,r) => s + (parseFloat(r.ore)||0), 0);
    const oreAbbuonate = rows.filter(r => r.modAddebito === 'Omaggio').reduce((s,r) => s + (parseFloat(r.ore)||0), 0);

    const orePerc = oreAcquistate > 0 ? Math.min(100, Math.round((oreNormali / oreAcquistate) * 100)) : 0;

    // Tutte le righe nella stessa tabella; le righe Omaggio in verde con costo "🎁 In omaggio"
    let righe = rows.map((r, i) => {
        const isOmaggio = r.modAddebito === 'Omaggio';
        const rowBg = isOmaggio ? (i % 2 === 0 ? '#e8f5e9' : '#f0faf2') : (i % 2 === 0 ? '#f9f9f9' : '#fff');
        const costoCell = isOmaggio
            ? `<td class="right" style="color:#34a853;font-weight:600;">🎁 In omaggio</td>`
            : `<td class="right">€ ${parseFloat(r.costo).toFixed(2)}</td>`;
        return `
        <tr style="background:${rowBg};">
            <td>${r.data || '—'}</td>
            <td class="desc">${r.descrizione || '—'}</td>
            <td class="center">${r.ore}h</td>
            <td class="center">${r.oreExtra > 0 ? '+' + r.oreExtra + 'h' : '—'}</td>
            <td>${r.tipoIntervento || '—'}</td>
            ${costoCell}
        </tr>`;
    }).join('');

    const righeOmaggioHtml = '';

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
    ${oreAbbuonate > 0 ? `
    <div class="meta-card" style="border-color:#34a853;">
      <div class="m-label" style="color:#34a853;">In omaggio</div>
      <div class="m-value" style="color:#34a853;">🎁 ${oreAbbuonate.toFixed(1)}h</div>
    </div>` : `
    <div class="meta-card">
      <div class="m-label">Totale €</div>
      <div class="m-value">€ ${totCosto.toFixed(2)}</div>
    </div>`}
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
        <td style="color:#34a853;font-weight:600;">${oreAbbuonate > 0 ? '🎁 ' + oreAbbuonate.toFixed(1) + 'h omaggio' : ''}</td>
        <td class="right">€ ${totCosto.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  ${righeOmaggioHtml}

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
        window.markTabDirty && window.markTabDirty('vendite');
        window.markTabDirty && window.markTabDirty('fatture');
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
// === QODNET — registro vendite e provvigioni ===
// =======================================================================
// I servizi si rinnovano da soli: le scadenze servono solo a controllare che
// ogni periodo sia coperto da una provvigione (vista Servizi). Le provvigioni
// si fatturano a QODNET quando si vuole (vista Provvigioni).

let qodnetDati = null;            // { righe, servizi, saldo, prodottiNoti }
let qodnetFilterTimer = null;
let qodnetSelezione = new Set();  // id righe scelte per la fatturazione
let qodnetRigaOriginale = null;   // valori del modal di modifica all'apertura
let qodnetContatoreRighe = 0;

// Regola provvigionale: 10% Hosting, Domini/DNS, MailFort/LibraESVA; 20% il resto.
// Stessa regola in Backend/QODNET.js (percentualeQODNET_).
function percentualeQodnet(prodotto) {
    return /hosting|dominio|domini|dns|mailfort|libraesva/i.test(prodotto || '') ? 10 : 20;
}

function escQodnet(s) {
    return (s === null || s === undefined ? '' : String(s))
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function euroQodnet(n) {
    if (n === '' || n === null || n === undefined || isNaN(n)) return '—';
    return '€ ' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isoQodnet(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fine periodo annuale: stesso giorno dell'anno dopo, meno un giorno (come nei report) */
function fineAnnoQodnet(isoInizio) {
    const p = isoInizio.split('-').map(Number);
    const d = new Date(p[0] + 1, p[1] - 1, p[2]);
    d.setDate(d.getDate() - 1);
    return isoQodnet(d);
}

async function chiamaQodnet(action, params) {
    const qs = Object.keys(params || {})
        .map(k => `${k}=${encodeURIComponent(params[k] === undefined || params[k] === null ? '' : params[k])}`)
        .join('&');
    const response = await fetch(`${getAPIUrl()}?action=${action}${qs ? '&' + qs : ''}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
    return result;
}

function dopoScritturaQodnet() {
    window.markTabDirty && window.markTabDirty('vendite');
    riepilogoLoaded.qodnet = true;
    return loadQodnetRiepilogo({ forzato: true });
}

// -----------------------------------------------------------------------
// Registra vendita / documento
// -----------------------------------------------------------------------

function openQodnetForm() {
    const modal = document.getElementById('qodnetModal');
    if (!modal) return;

    const datalist = document.getElementById('qodnet-client-list');
    if (datalist && datalist.options.length === 0) {
        fetch(`${getAPIUrl()}?action=get_data`)
            .then(r => r.json())
            .then(result => {
                if (result && result.clients) {
                    const nomi = result.clients
                        .map(c => typeof c === 'string' ? c : (c.name || ''))
                        .filter(Boolean).sort();
                    datalist.innerHTML = nomi.map(n => `<option value="${escQodnet(n)}">`).join('');
                }
            })
            .catch(() => {});
    }
    aggiornaProdottiNotiQodnet();

    document.getElementById('qodnetForm').reset();
    document.getElementById('qodnetDataDocumento').value = isoQodnet(new Date());
    document.getElementById('qodnetRighe').innerHTML = '';
    aggiornaStatoDocQodnet();
    aggiungiRigaQodnet();
    modal.classList.add('active');
}

function closeQodnetModal() {
    const modal = document.getElementById('qodnetModal');
    if (modal) modal.classList.remove('active');
}

function aggiornaProdottiNotiQodnet() {
    const list = document.getElementById('qodnet-prodotti-list');
    if (!list) return;
    const base = [
        'Microsoft 365 Business Basic', 'Microsoft 365 Business Standard', 'Microsoft 365 Apps for Business',
        'Microsoft Defender for Business', 'Exchange Online Plan 1', 'Exchange Online Plan 2',
        'MailFort / LibraESVA - Email Security Gateway', 'Web Hosting Essential', 'Web Hosting Professional',
        'Dominio e gestione DNS', 'Gestione completa WordPress'
    ];
    const noti = (qodnetDati && qodnetDati.prodottiNoti) || [];
    const tutti = [...new Set([...noti, ...base])].sort();
    list.innerHTML = tutti.map(p => `<option value="${escQodnet(p)}">`).join('');
}

function aggiornaStatoDocQodnet() {
    const doc = (document.getElementById('qodnetDocumento')?.value || '').trim();
    const sel = document.getElementById('qodnetStatoDocumento');
    if (sel) sel.disabled = !doc;
}

function aggiungiRigaQodnet() {
    const n = ++qodnetContatoreRighe;
    const oggi = isoQodnet(new Date());
    const div = document.createElement('div');
    div.className = 'qodnet-riga-form';
    div.dataset.riga = n;
    div.innerHTML = `
        <div class="qodnet-riga-top">
            <input type="text" class="qr-prodotto" list="qodnet-prodotti-list" placeholder="Prodotto / servizio *" autocomplete="off">
            <button type="button" class="qodnet-riga-x" title="Togli voce" onclick="togliRigaQodnet(${n})">&times;</button>
        </div>
        <div class="qodnet-riga-griglia">
            <input type="text" class="qr-dettaglio" placeholder="Dominio / dettaglio">
            <label class="qodnet-mini">Qtà <input type="number" class="qr-quantita" min="1" step="1" value="1"></label>
            <select class="qr-tipo" title="Tipo">
                <option value="">Tipo automatico</option>
                <option value="Nuovo">Nuovo</option>
                <option value="Rinnovo">Rinnovo</option>
                <option value="Integrazione">Integrazione / upselling</option>
            </select>
        </div>
        <div class="qodnet-riga-griglia">
            <label class="qodnet-check"><input type="checkbox" class="qr-unatantum"> Una tantum</label>
            <label class="qodnet-mini qr-periodo">Dal <input type="date" class="qr-inizio" value="${oggi}"></label>
            <label class="qodnet-mini qr-periodo">Al <input type="date" class="qr-fine" value="${fineAnnoQodnet(oggi)}"></label>
        </div>
        <div class="qodnet-riga-griglia">
            <label class="qodnet-mini">Imponibile € <input type="number" class="qr-imponibile" step="0.01" min="0" placeholder="facolt."></label>
            <label class="qodnet-mini">% <input type="number" class="qr-percentuale" step="0.1" min="0" max="100" value="20"></label>
            <label class="qodnet-mini">Provvigione € <input type="number" class="qr-provvigione" step="0.01" min="0"></label>
        </div>`;
    document.getElementById('qodnetRighe').appendChild(div);

    const q = sel => div.querySelector(sel);
    q('.qr-prodotto').addEventListener('input', () => {
        if (!q('.qr-percentuale').dataset.manuale) q('.qr-percentuale').value = percentualeQodnet(q('.qr-prodotto').value);
        ricalcolaRigaQodnet(div);
    });
    q('.qr-percentuale').addEventListener('input', () => { q('.qr-percentuale').dataset.manuale = '1'; ricalcolaRigaQodnet(div); });
    q('.qr-imponibile').addEventListener('input', () => ricalcolaRigaQodnet(div));
    q('.qr-provvigione').addEventListener('input', () => {
        q('.qr-provvigione').dataset.manuale = q('.qr-provvigione').value === '' ? '' : '1';
        aggiornaTotaleQodnet();
    });
    q('.qr-inizio').addEventListener('change', () => {
        if (q('.qr-inizio').value) q('.qr-fine').value = fineAnnoQodnet(q('.qr-inizio').value);
    });
    q('.qr-unatantum').addEventListener('change', () => {
        div.querySelectorAll('.qr-periodo').forEach(el => el.style.display = q('.qr-unatantum').checked ? 'none' : '');
    });

    q('.qr-prodotto').focus();
    aggiornaTotaleQodnet();
}

function togliRigaQodnet(n) {
    const righe = document.querySelectorAll('#qodnetRighe .qodnet-riga-form');
    if (righe.length <= 1) return;
    const div = document.querySelector(`#qodnetRighe .qodnet-riga-form[data-riga="${n}"]`);
    if (div) div.remove();
    aggiornaTotaleQodnet();
}

function ricalcolaRigaQodnet(div) {
    const imp = parseFloat(div.querySelector('.qr-imponibile').value);
    const perc = parseFloat(div.querySelector('.qr-percentuale').value);
    const provv = div.querySelector('.qr-provvigione');
    if (!provv.dataset.manuale) {
        provv.value = !isNaN(imp) && !isNaN(perc) ? (Math.round(imp * perc) / 100).toFixed(2) : '';
    }
    aggiornaTotaleQodnet();
}

function aggiornaTotaleQodnet() {
    let tot = 0;
    document.querySelectorAll('#qodnetRighe .qr-provvigione').forEach(el => tot += parseFloat(el.value) || 0);
    const box = document.getElementById('qodnetTotale');
    if (box) box.textContent = `Provvigione totale: ${euroQodnet(tot)}`;
}

async function submitQodnet(e, consentiEsistente) {
    if (e) e.preventDefault();

    const cliente   = (document.getElementById('qodnetCliente')?.value || '').trim();
    const documento = (document.getElementById('qodnetDocumento')?.value || '').trim();
    const dataDoc   = document.getElementById('qodnetDataDocumento')?.value || '';
    const statoDoc  = document.getElementById('qodnetStatoDocumento')?.value || '';
    const note      = (document.getElementById('qodnetNote')?.value || '').trim();

    if (!cliente) { alert('⚠️ Seleziona un cliente'); return; }

    const righe = [];
    let errore = '';
    document.querySelectorAll('#qodnetRighe .qodnet-riga-form').forEach((div, i) => {
        const v = sel => (div.querySelector(sel).value || '').trim();
        const prodotto = v('.qr-prodotto');
        const vuota = !prodotto && !v('.qr-imponibile') && !v('.qr-provvigione');
        if (vuota) return;
        const unaTantum = div.querySelector('.qr-unatantum').checked;
        if (!prodotto) errore = errore || `Voce ${i + 1}: manca il prodotto`;
        if (v('.qr-provvigione') === '') errore = errore || `Voce ${i + 1}: serve l'imponibile o la provvigione`;
        if (!unaTantum && (!v('.qr-inizio') || !v('.qr-fine'))) errore = errore || `Voce ${i + 1}: indica il periodo o spunta «Una tantum»`;
        righe.push({
            prodotto,
            dettaglio: v('.qr-dettaglio'),
            quantita: v('.qr-quantita') || 1,
            periodo_inizio: unaTantum ? '' : v('.qr-inizio'),
            periodo_fine: unaTantum ? '' : v('.qr-fine'),
            imponibile: v('.qr-imponibile'),
            percentuale: v('.qr-percentuale'),
            provvigione: v('.qr-provvigione'),
            tipo: unaTantum ? 'Una tantum' : v('.qr-tipo')
        });
    });
    if (errore) { alert('⚠️ ' + errore); return; }
    if (!righe.length) { alert('⚠️ Inserisci almeno una voce'); return; }

    const btn = document.getElementById('qodnetSubmitBtn');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Salvataggio...';

    try {
        const params = {
            cliente_nome: cliente,
            documento,
            data_documento: dataDoc,
            stato_documento: documento ? statoDoc : '',
            note,
            righe: JSON.stringify(righe)
        };
        if (consentiEsistente) params.consenti_documento_esistente = 'true';
        const result = await chiamaQodnet('insert_documento_qodnet', params);

        closeQodnetModal();
        alert(`✅ Registrate ${result.righe} voci — provvigione ${euroQodnet(result.provvigione)}` +
              (documento ? '' : '\nSenza numero documento: restano «da confermare» finché non compaiono in un report.'));
        dopoScritturaQodnet();
        switchVenditeSubtab('qodnet', 'provvigioni');
    } catch (error) {
        console.error('Errore registrazione QODNET:', error);
        if (!consentiEsistente && /già registrato/.test(error.message)) {
            if (confirm(`${error.message}\n\nAggiungere comunque queste voci allo stesso documento?`)) {
                btn.disabled = false; btn.textContent = origText;
                return submitQodnet(null, true);
            }
        } else {
            alert('❌ Errore: ' + error.message);
        }
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}

// -----------------------------------------------------------------------
// Caricamento dati (una chiamata per Servizi e Provvigioni)
// -----------------------------------------------------------------------

async function loadQodnetRiepilogo(opzioni) {
    const vistaProvvigioni = document.getElementById('vsub-qodnet-provvigioni-content')?.style.display !== 'none';
    const contenitore = vistaProvvigioni ? 'qodnetProvvigioniContainer' : 'qodnetContainer';
    const container = document.getElementById(contenitore);
    if (!container) return;

    return _crmCacheListe().carica({
        chiave: 'vendite_qodnet_registro',
        contenitore,
        forzato: !!(opzioni && opzioni.forzato),
        aggiorna: () => loadQodnetRiepilogo({ forzato: true }),

        caricamento: () => {
            container.innerHTML = '<div class="loading-scadenze">Caricamento QODNET...</div>';
        },

        scarica: async (opzioniFetch) => {
            const response = await fetch(`${getAPIUrl()}?action=get_qodnet_riepilogo`, opzioniFetch);
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
            return { righe: result.righe || [], servizi: result.servizi || [], saldo: result.saldo || {}, prodottiNoti: result.prodottiNoti || [] };
        },

        mostra: (dati) => {
            qodnetDati = dati;
            const esistenti = new Set(dati.righe.filter(r => r.statoProvvigione !== 'Fatturata' && r.documento).map(r => r.id));
            qodnetSelezione = new Set([...qodnetSelezione].filter(id => esistenti.has(id)));
            filterQodnet();
            renderQodnetProvvigioni();
        },

        errore: (error) => {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${escQodnet(error.message)}</div></div>`;
        }
    });
}

// -----------------------------------------------------------------------
// Vista Servizi (copertura)
// -----------------------------------------------------------------------

function filterQodnetDebounced() {
    clearTimeout(qodnetFilterTimer);
    qodnetFilterTimer = setTimeout(filterQodnet, 250);
}

function filterQodnet() {
    if (!qodnetDati) { loadQodnetRiepilogo(); return; }
    const testo = (document.getElementById('qodnet-filter-cliente')?.value || '').trim().toLowerCase();
    const stato = document.getElementById('qodnet-filter-stato')?.value || '';
    const chiuso = s => s.stato === 'Annullato' || s.stato === 'Sostituito';

    const lista = qodnetDati.servizi.filter(s => {
        if (testo && !`${s.nomeCliente} ${s.prodotto} ${s.dettaglio}`.toLowerCase().includes(testo)) return false;
        if (stato === 'tutti') return true;
        if (stato === 'chiusi') return chiuso(s);
        if (stato) return s.stato === stato;
        return !chiuso(s);
    });
    renderQodnetServizi(lista);
}

function badgeServizioQodnet(stato) {
    const classi = { 'Coperto': 'coperto', 'In scadenza': 'inscadenza', 'Scoperto': 'scoperto', 'Annullato': 'chiuso', 'Sostituito': 'chiuso' };
    return `<span class="qodnet-badge ${classi[stato] || ''}">${escQodnet(stato)}</span>`;
}

function renderQodnetServizi(lista) {
    const container = document.getElementById('qodnetContainer');
    if (!container) return;

    const tutti = qodnetDati.servizi;
    const conta = st => tutti.filter(s => s.stato === st).length;
    const riepilogo = `
        <div class="qodnet-contatori">
            <span class="qodnet-badge scoperto">${conta('Scoperto')} scoperti</span>
            <span class="qodnet-badge inscadenza">${conta('In scadenza')} in scadenza</span>
            <span class="qodnet-badge coperto">${conta('Coperto')} coperti</span>
        </div>`;

    if (!lista.length) {
        container.innerHTML = riepilogo + `<div class="empty-state"><div class="empty-state-icon">🌐</div><div>${tutti.length ? 'Nessun servizio con questi filtri' : 'Nessun servizio registrato: inizia da «Nuova vendita»'}</div></div>`;
        return;
    }

    const gruppi = {};
    lista.forEach(s => { (gruppi[s.nomeCliente] = gruppi[s.nomeCliente] || []).push(s); });

    let html = riepilogo;
    Object.keys(gruppi).sort().forEach(cliente => {
        html += `<div class="storico-gruppo"><div class="storico-gruppo-header"><i class="fas fa-user"></i> ${escQodnet(cliente)}</div>`;
        gruppi[cliente].forEach(s => {
            let quando;
            if (s.stato === 'Scoperto') quando = `<span class="qodnet-rosso">Copertura finita il ${s.coperturaFino} — scoperto da ${Math.abs(s.giorni)} giorni</span>`;
            else if (s.stato === 'In scadenza') quando = `<span class="qodnet-arancio">Coperto fino al ${s.coperturaFino} (tra ${s.giorni} giorni)</span>`;
            else quando = `Coperto fino al ${s.coperturaFino}`;

            const chiuso = s.stato === 'Annullato' || s.stato === 'Sostituito';
            const azioni = chiuso
                ? `<button class="btn-small" onclick="statoServizioQodnet('${s.idUltimaRiga}','')"><i class="fas fa-rotate-left"></i> Segui di nuovo</button>`
                : `<button class="btn-small" onclick="statoServizioQodnet('${s.idUltimaRiga}','Annullato')"><i class="fas fa-ban"></i> Annullato</button>
                   <button class="btn-small" onclick="statoServizioQodnet('${s.idUltimaRiga}','Sostituito')"><i class="fas fa-right-left"></i> Sostituito</button>`;

            const periodi = s.periodi.slice().reverse().map(p => `
                <div class="qodnet-periodo">
                    <span>${p.inizio} → ${p.fine}</span>
                    <span>${escQodnet(p.documento || 'da confermare')}</span>
                    <span>${p.quantita > 1 ? p.quantita + ' x · ' : ''}${escQodnet(p.tipo)}</span>
                    <span>${euroQodnet(p.provvigione)}</span>
                </div>`).join('');

            html += `
            <div class="storico-card qodnet-card">
                <div class="storico-card-header">
                    <span class="storico-id">${s.quantita > 1 ? s.quantita + ' x ' : ''}${escQodnet(s.prodotto)}</span>
                    ${badgeServizioQodnet(s.stato)}
                </div>
                ${s.dettaglio ? `<div class="storico-descrizione">${escQodnet(s.dettaglio)}</div>` : ''}
                <div class="storico-date">${quando} · seguito dal ${s.dal}</div>
                <details class="qodnet-dettagli">
                    <summary>${s.periodi.length} ${s.periodi.length === 1 ? 'periodo registrato' : 'periodi registrati'}</summary>
                    ${periodi}
                </details>
                <div class="storico-actions">${azioni}</div>
            </div>`;
        });
        html += `</div>`;
    });
    container.innerHTML = html;
}

async function statoServizioQodnet(idRiga, stato) {
    const msg = stato
        ? `Segnare il servizio come «${stato}»? Non verrà più controllata la copertura.`
        : 'Tornare a controllare la copertura di questo servizio?';
    if (!confirm(msg)) return;
    try {
        await chiamaQodnet('aggiorna_righe_qodnet', { ids: idRiga, stato_servizio: stato });
        dopoScritturaQodnet();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    }
}

// -----------------------------------------------------------------------
// Vista Provvigioni (saldo e fatturazione)
// -----------------------------------------------------------------------

function righeQodnetPerDocumento(righe) {
    const docs = {};
    righe.forEach(r => {
        const k = `${r.documento}|${r.idCliente}`;
        if (!docs[k]) docs[k] = { documento: r.documento, nomeCliente: r.nomeCliente, data: r.dataDocumento, dataIso: r.dataDocumentoIso, stato: r.statoDocumento, righe: [] };
        docs[k].righe.push(r);
    });
    return Object.values(docs).sort((a, b) => (b.dataIso || '').localeCompare(a.dataIso || ''));
}

function rigaVoceQodnet(r, conCheckbox) {
    const periodo = r.unaTantum ? 'Una tantum' : `${r.inizio} → ${r.fine}`;
    const perc = r.percentuale !== '' ? `${r.percentuale}%` : '';
    const check = conCheckbox
        ? `<input type="checkbox" class="qodnet-sel" ${qodnetSelezione.has(r.id) ? 'checked' : ''} onchange="selezionaVoceQodnet('${r.id}', this.checked)">`
        : '';
    return `
        <div class="qodnet-voce">
            ${check}
            <div class="qodnet-voce-desc">
                <div>${r.quantita > 1 ? r.quantita + ' x ' : ''}${escQodnet(r.prodotto)}${r.dettaglio ? ` <small>— ${escQodnet(r.dettaglio)}</small>` : ''}</div>
                <small>${periodo}${r.unaTantum ? "" : " · " + escQodnet(r.tipo)} · imp. ${euroQodnet(r.imponibile)} ${perc}${r.note ? ' · ' + escQodnet(r.note) : ''}</small>
            </div>
            <div class="qodnet-voce-importo">${euroQodnet(r.provvigione)}</div>
            <button class="qodnet-icona" title="Modifica voce" onclick="openQodnetRigaModal('${r.id}')"><i class="fas fa-pen"></i></button>
        </div>`;
}

function renderQodnetProvvigioni() {
    const container = document.getElementById('qodnetProvvigioniContainer');
    if (!container || !qodnetDati) return;
    const { righe, saldo } = qodnetDati;

    const maturate = righe.filter(r => r.statoProvvigione !== 'Fatturata' && r.documento);
    const daConfermare = righe.filter(r => r.statoProvvigione !== 'Fatturata' && !r.documento);
    const fatturate = righe.filter(r => r.statoProvvigione === 'Fatturata');

    let html = `
        <div class="qodnet-saldo">
            <div class="qodnet-saldo-box principale">
                <div class="qodnet-saldo-label">Da fatturare a QODNET</div>
                <div class="qodnet-saldo-valore">${euroQodnet(saldo.maturate)}</div>
                <div class="qodnet-saldo-sub">clienti che hanno pagato ${euroQodnet(saldo.maturatePagate)} · non ancora pagato ${euroQodnet(saldo.maturateNonPagate)}</div>
            </div>
            <div class="qodnet-saldo-box">
                <div class="qodnet-saldo-label">Da confermare</div>
                <div class="qodnet-saldo-valore">${euroQodnet(saldo.daConfermare)}</div>
                <div class="qodnet-saldo-sub">${saldo.nDaConfermare || 0} voci non ancora in un report</div>
            </div>
            <div class="qodnet-saldo-box">
                <div class="qodnet-saldo-label">Già fatturate</div>
                <div class="qodnet-saldo-valore">${euroQodnet(saldo.fatturate)}</div>
                <div class="qodnet-saldo-sub">${saldo.nFatturate || 0} voci</div>
            </div>
        </div>`;

    // --- Da fatturare ---
    html += `<h3 class="qodnet-titolo">Da fatturare</h3>`;
    if (!maturate.length) {
        html += `<div class="empty-state" style="padding:16px;">Nessuna provvigione da fatturare</div>`;
    } else {
        html += `
        <div class="qodnet-barra-fattura">
            <span id="qodnetSelTesto"></span>
            <button class="btn-small" onclick="selezionaTutteQodnet('pagate')">Scegli le pagate</button>
            <button class="btn-small" onclick="selezionaTutteQodnet('tutte')">Tutte</button>
            <button class="btn-small" onclick="selezionaTutteQodnet('nessuna')">Nessuna</button>
            <button class="btn-small qodnet-btn-fattura" id="qodnetBtnFattura" onclick="fatturaQodnetSelezionate()">
                <i class="fas fa-file-invoice"></i> Fattura a QODNET…
            </button>
        </div>`;
        righeQodnetPerDocumento(maturate).forEach(d => {
            const tot = d.righe.reduce((s, r) => s + (r.provvigione || 0), 0);
            const ids = d.righe.map(r => r.id);
            const tutteSel = ids.every(id => qodnetSelezione.has(id));
            const pagato = d.stato === 'Pagato';
            html += `
            <div class="storico-card qodnet-doc">
                <div class="qodnet-doc-header">
                    <input type="checkbox" ${tutteSel ? 'checked' : ''} onchange="selezionaDocumentoQodnet('${ids.join(',')}', this.checked)">
                    <div class="qodnet-doc-titolo">
                        <strong>${escQodnet(d.documento)}</strong> · ${escQodnet(d.nomeCliente)}
                        <small>${d.data || ''}</small>
                    </div>
                    <span class="qodnet-badge ${pagato ? 'coperto' : 'inscadenza'}">${pagato ? 'Pagato' : 'Non pagato'}</span>
                    <button class="qodnet-icona" title="Modifica documento (numero, data, pagamento)" onclick="openQodnetDocumentoModal('${ids.join(',')}')"><i class="fas fa-pen"></i></button>
                </div>
                ${d.righe.map(r => rigaVoceQodnet(r, true)).join('')}
                <div class="qodnet-doc-totale">Totale ${euroQodnet(tot)}</div>
            </div>`;
        });
    }

    // --- Da confermare ---
    if (daConfermare.length) {
        html += `<h3 class="qodnet-titolo">Da confermare <small>vendite registrate che non hanno ancora un documento QODNET</small></h3>`;
        const perCliente = {};
        daConfermare.forEach(r => { (perCliente[r.nomeCliente] = perCliente[r.nomeCliente] || []).push(r); });
        Object.keys(perCliente).sort().forEach(c => {
            const ids = perCliente[c].map(r => r.id);
            html += `
            <div class="storico-card qodnet-doc">
                <div class="qodnet-doc-header">
                    <div class="qodnet-doc-titolo"><strong>${escQodnet(c)}</strong></div>
                    <button class="btn-small" onclick="openQodnetDocumentoModal('${ids.join(',')}')"><i class="fas fa-check"></i> Conferma con documento</button>
                </div>
                ${perCliente[c].map(r => rigaVoceQodnet(r, false)).join('')}
            </div>`;
        });
    }

    // --- Fatturate ---
    if (fatturate.length) {
        html += `<details class="qodnet-dettagli qodnet-fatturate"><summary>Già fatturate (${fatturate.length} voci)</summary>`;
        const perRif = {};
        fatturate.forEach(r => { (perRif[r.rifFatturazione] = perRif[r.rifFatturazione] || []).push(r); });
        Object.keys(perRif).sort().reverse().forEach(rif => {
            const rr = perRif[rif];
            const tot = rr.reduce((s, r) => s + (r.provvigione || 0), 0);
            const docs = [...new Set(rr.map(r => r.documento))].join(', ');
            html += `
            <div class="storico-card qodnet-doc">
                <div class="qodnet-doc-header">
                    <div class="qodnet-doc-titolo">
                        Fattura <strong>${escQodnet(rif)}</strong> · ${euroQodnet(tot)} · ${rr.length} voci
                        <small>${rr[0].dataFatturazione} — ${escQodnet(docs)}</small>
                    </div>
                    <button class="btn-small" onclick="annullaFatturazioneQodnet('${escQodnet(rif)}')"><i class="fas fa-rotate-left"></i> Annulla</button>
                </div>
            </div>`;
        });
        html += `</details>`;
    }

    container.innerHTML = html;
    aggiornaSelezioneQodnet();
}

function selezionaVoceQodnet(id, on) {
    if (on) qodnetSelezione.add(id); else qodnetSelezione.delete(id);
    aggiornaSelezioneQodnet();
}

function selezionaDocumentoQodnet(ids, on) {
    ids.split(',').forEach(id => { if (on) qodnetSelezione.add(id); else qodnetSelezione.delete(id); });
    renderQodnetProvvigioni();
}

function selezionaTutteQodnet(quali) {
    const maturate = qodnetDati.righe.filter(r => r.statoProvvigione !== 'Fatturata' && r.documento);
    qodnetSelezione = new Set(
        quali === 'nessuna' ? [] :
        maturate.filter(r => quali === 'tutte' || r.statoDocumento === 'Pagato').map(r => r.id)
    );
    renderQodnetProvvigioni();
}

function aggiornaSelezioneQodnet() {
    const testo = document.getElementById('qodnetSelTesto');
    const btn = document.getElementById('qodnetBtnFattura');
    if (!testo || !qodnetDati) return;
    const scelte = qodnetDati.righe.filter(r => qodnetSelezione.has(r.id));
    const tot = scelte.reduce((s, r) => s + (r.provvigione || 0), 0);
    testo.innerHTML = scelte.length ? `Scelte <strong>${scelte.length}</strong> voci · <strong>${euroQodnet(tot)}</strong>` : 'Scegli le voci da fatturare';
    if (btn) btn.disabled = !scelte.length;
}

/** Apre la finestra per numero e data della fattura diretta a QODNET */
function fatturaQodnetSelezionate() {
    const scelte = qodnetDati.righe.filter(r => qodnetSelezione.has(r.id));
    if (!scelte.length) return;
    const tot = Math.round(scelte.reduce((s, r) => s + (r.provvigione || 0), 0) * 100) / 100;
    const iva = Math.round(tot * 22) / 100;
    const nonPagate = scelte.filter(r => r.statoDocumento !== 'Pagato').length;
    const docs = [...new Set(scelte.map(r => r.documento))];

    document.getElementById('qodnetFatturaRiepilogo').innerHTML =
        `<strong>${scelte.length} voci</strong> di ${docs.length} documenti<br>` +
        `Imponibile <strong>${euroQodnet(tot)}</strong> + IVA 22% ${euroQodnet(iva)} = <strong>${euroQodnet(Math.round((tot + iva) * 100) / 100)}</strong>` +
        (nonPagate ? `<br><span class="qodnet-arancio">${nonPagate} voci sono di documenti che il cliente non ha ancora pagato</span>` : '');
    document.getElementById('qodnetFatturaData').value = isoQodnet(new Date());
    const numero = document.getElementById('qodnetFatturaNumero');
    numero.value = '';
    proponiNumeroFatturaQodnet(numero);
    document.getElementById('qodnetFatturaModal').classList.add('active');
    numero.focus();
}

/** Propone il numero successivo nel formato NN/A-AAAA leggendo le fatture dell'anno */
async function proponiNumeroFatturaQodnet(input) {
    try {
        const anno = new Date().getFullYear();
        const response = await fetch(`${getAPIUrl()}?action=get_fatture_list`);
        const result = await response.json();
        const lista = result.fatture || result.data || [];
        let max = 0;
        lista.forEach(f => {
            const m = /^(\d+)\/A-(\d{4})$/.exec(String(f.nFattura || '').trim());
            if (m && parseInt(m[2]) === anno) max = Math.max(max, parseInt(m[1]));
        });
        if (max && !input.value) input.placeholder = `${max + 1}/A-${anno} (proposto)`, input.value = `${max + 1}/A-${anno}`;
    } catch (e) { /* il numero si scrive a mano */ }
}

function closeQodnetFatturaModal() {
    document.getElementById('qodnetFatturaModal')?.classList.remove('active');
}

async function submitQodnetFattura(e) {
    e.preventDefault();
    const scelte = qodnetDati.righe.filter(r => qodnetSelezione.has(r.id));
    const nFattura = document.getElementById('qodnetFatturaNumero').value.trim();
    const data = document.getElementById('qodnetFatturaData').value;
    if (!scelte.length || !nFattura || !data) return;

    const btn = document.getElementById('qodnetFatturaSubmitBtn');
    btn.disabled = true; btn.textContent = 'Registrazione...';
    try {
        const result = await chiamaQodnet('fattura_provvigioni_qodnet', {
            ids: scelte.map(r => r.id).join(','), n_fattura: nFattura, data_fattura: data
        });
        qodnetSelezione.clear();
        closeQodnetFatturaModal();
        window.markTabDirty && window.markTabDirty('fatture');
        alert(result.fatturaEsistente
            ? `✅ ${result.voci} voci collegate alla fattura ${nFattura} già presente nel tab Fatture.` + (result.avviso ? `\n\n⚠️ ${result.avviso}` : '')
            : `✅ Fattura ${nFattura} registrata: imponibile ${euroQodnet(result.totale)} a QODNET SRL.`);
        dopoScritturaQodnet();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    } finally {
        btn.disabled = false; btn.textContent = 'Registra fattura';
    }
}

async function annullaFatturazioneQodnet(rif) {
    if (!confirm(`Annullare la fatturazione ${rif}?\n\nLe voci tornano da fatturare. La fattura nel tab Fatture viene eliminata se l'hai creata da qui e non è incassata; se l'avevi inserita a mano resta e si scollegano solo le voci.`)) return;
    try {
        const result = await chiamaQodnet('annulla_fatturazione_qodnet', { rif });
        window.markTabDirty && window.markTabDirty('fatture');
        alert(`✅ ${result.righe} voci tornate da fatturare.` + (result.fatturaEliminata ? `\nFattura ${rif} eliminata dal tab Fatture.` : `\nLa fattura ${rif} è rimasta nel tab Fatture.`));
        dopoScritturaQodnet();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    }
}

// -----------------------------------------------------------------------
// Modifica voce / documento
// -----------------------------------------------------------------------

function valoriFormRigaQodnet() {
    const v = id => (document.getElementById(id)?.value || '').trim();
    return {
        documento: v('qodnetRigaDocumento'),
        data_documento: v('qodnetRigaDataDocumento'),
        stato_documento: v('qodnetRigaStatoDocumento'),
        prodotto: v('qodnetRigaProdotto'),
        dettaglio: v('qodnetRigaDettaglio'),
        quantita: v('qodnetRigaQuantita'),
        tipo: v('qodnetRigaTipo'),
        periodo_inizio: v('qodnetRigaInizio'),
        periodo_fine: v('qodnetRigaFine'),
        imponibile: v('qodnetRigaImponibile'),
        percentuale: v('qodnetRigaPercentuale'),
        provvigione: v('qodnetRigaProvvigione'),
        note: v('qodnetRigaNote')
    };
}

function apriModalRigaQodnet(ids, titolo, r, soloDocumento) {
    aggiornaProdottiNotiQodnet();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val === undefined || val === null ? '' : val; };
    set('qodnetRigaIds', ids.join(','));
    set('qodnetRigaDocumento', r.documento);
    set('qodnetRigaDataDocumento', r.dataDocumentoIso || isoQodnet(new Date()));
    set('qodnetRigaStatoDocumento', r.statoDocumento || (soloDocumento && !r.documento ? 'Non pagato' : ''));
    set('qodnetRigaProdotto', r.prodotto);
    set('qodnetRigaDettaglio', r.dettaglio);
    set('qodnetRigaQuantita', r.quantita);
    set('qodnetRigaTipo', r.tipo || 'Nuovo');
    set('qodnetRigaInizio', r.inizioIso);
    set('qodnetRigaFine', r.fineIso);
    set('qodnetRigaImponibile', r.imponibile);
    set('qodnetRigaPercentuale', r.percentuale);
    set('qodnetRigaProvvigione', r.provvigione);
    set('qodnetRigaNote', r.note);

    document.getElementById('qodnetRigaTitolo').textContent = titolo;
    document.getElementById('qodnetRigaCampiVoce').style.display = soloDocumento ? 'none' : '';
    document.getElementById('qodnetRigaNote').closest('.form-group').style.display = soloDocumento ? 'none' : '';
    document.getElementById('qodnetRigaEliminaBtn').style.display = soloDocumento || r.statoProvvigione === 'Fatturata' ? 'none' : '';

    const avviso = document.getElementById('qodnetRigaAvviso');
    const fatturata = r.statoProvvigione === 'Fatturata';
    avviso.style.display = fatturata || soloDocumento ? '' : 'none';
    avviso.textContent = fatturata
        ? `Voce già fatturata (${r.rifFatturazione}): puoi cambiare solo pagamento e note. Per il resto annulla prima la fatturazione.`
        : `Le modifiche valgono per ${ids.length} ${ids.length === 1 ? 'voce' : 'voci'}.`;

    qodnetRigaOriginale = { ids, soloDocumento, fatturata, valori: valoriFormRigaQodnet() };
    document.getElementById('qodnetRigaModal').classList.add('active');
}

function openQodnetRigaModal(id) {
    const r = qodnetDati && qodnetDati.righe.find(x => x.id === id);
    if (!r) { alert('Voce non trovata: ricarica la pagina'); return; }
    apriModalRigaQodnet([id], `Modifica voce ${id}`, r, false);
}

function openQodnetDocumentoModal(idsCsv) {
    const ids = idsCsv.split(',');
    const r = qodnetDati && qodnetDati.righe.find(x => x.id === ids[0]);
    if (!r) { alert('Documento non trovato: ricarica la pagina'); return; }
    apriModalRigaQodnet(ids, r.documento ? `Documento ${r.documento}` : `Conferma vendite ${r.nomeCliente}`, r, true);
}

function closeQodnetRigaModal() {
    document.getElementById('qodnetRigaModal')?.classList.remove('active');
}

function calcQodnetRiga() {
    const imp = parseFloat(document.getElementById('qodnetRigaImponibile').value);
    const perc = parseFloat(document.getElementById('qodnetRigaPercentuale').value);
    if (!isNaN(imp) && !isNaN(perc)) {
        document.getElementById('qodnetRigaProvvigione').value = (Math.round(imp * perc) / 100).toFixed(2);
    }
}

async function submitQodnetRiga(e) {
    e.preventDefault();
    if (!qodnetRigaOriginale) return;
    const { ids, soloDocumento, fatturata, valori: prima } = qodnetRigaOriginale;
    const dopo = valoriFormRigaQodnet();

    const ammessi = fatturata
        ? ['stato_documento', 'note']
        : soloDocumento ? ['documento', 'data_documento', 'stato_documento'] : Object.keys(dopo);
    const params = { ids: ids.join(',') };
    ammessi.forEach(k => { if (dopo[k] !== prima[k]) params[k] = dopo[k]; });
    if (soloDocumento && dopo.documento) params.stato_documento = dopo.stato_documento || 'Non pagato';

    if (Object.keys(params).length === 1) { closeQodnetRigaModal(); return; }
    if (!soloDocumento && !fatturata && (!!dopo.periodo_inizio !== !!dopo.periodo_fine)) {
        alert('⚠️ Indica sia inizio sia fine del periodo, oppure svuotali entrambi (una tantum)'); return;
    }

    const btn = document.getElementById('qodnetRigaSubmitBtn');
    const origText = btn.textContent;
    btn.disabled = true; btn.textContent = 'Salvataggio...';
    try {
        await chiamaQodnet('aggiorna_righe_qodnet', params);
        closeQodnetRigaModal();
        dopoScritturaQodnet();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    } finally {
        btn.disabled = false; btn.textContent = origText;
    }
}

async function eliminaRigaQodnet() {
    if (!qodnetRigaOriginale || qodnetRigaOriginale.ids.length !== 1) return;
    const id = qodnetRigaOriginale.ids[0];
    if (!confirm(`Eliminare definitivamente la voce ${id}?`)) return;
    try {
        await chiamaQodnet('elimina_riga_qodnet', { id });
        qodnetSelezione.delete(id);
        closeQodnetRigaModal();
        dopoScritturaQodnet();
    } catch (error) {
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
    window.toggleStoricoCanone = toggleStoricoCanone;
    window.toggleStoricoFirma = toggleStoricoFirma;
    window.toggleControlliCanoneCard = toggleControlliCanoneCard;
    window.toggleVccForm = toggleVccForm;
    window.submitControlloCard = submitControlloCard;
    window.resetControlloCard = resetControlloCard;
    window.switchVenditeSection = switchVenditeSection;
    window.switchVenditeSubtab = switchVenditeSubtab;
    window.loadControlliDaFare = loadControlliDaFare;
    window.toggleCdfForm = toggleCdfForm;
    window.submitCdf = submitCdf;
    window.openQodnetForm = openQodnetForm;
    window.closeQodnetModal = closeQodnetModal;
    window.submitQodnet = submitQodnet;
    window.aggiungiRigaQodnet = aggiungiRigaQodnet;
    window.togliRigaQodnet = togliRigaQodnet;
    window.aggiornaStatoDocQodnet = aggiornaStatoDocQodnet;
    window.loadQodnetRiepilogo = loadQodnetRiepilogo;
    window.filterQodnet = filterQodnet;
    window.filterQodnetDebounced = filterQodnetDebounced;
    window.statoServizioQodnet = statoServizioQodnet;
    window.selezionaVoceQodnet = selezionaVoceQodnet;
    window.selezionaDocumentoQodnet = selezionaDocumentoQodnet;
    window.selezionaTutteQodnet = selezionaTutteQodnet;
    window.fatturaQodnetSelezionate = fatturaQodnetSelezionate;
    window.closeQodnetFatturaModal = closeQodnetFatturaModal;
    window.submitQodnetFattura = submitQodnetFattura;
    window.annullaFatturazioneQodnet = annullaFatturazioneQodnet;
    window.openQodnetRigaModal = openQodnetRigaModal;
    window.openQodnetDocumentoModal = openQodnetDocumentoModal;
    window.closeQodnetRigaModal = closeQodnetRigaModal;
    window.calcQodnetRiga = calcQodnetRiga;
    window.submitQodnetRiga = submitQodnetRiga;
    window.eliminaRigaQodnet = eliminaRigaQodnet;
}
