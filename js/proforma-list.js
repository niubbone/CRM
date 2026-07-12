// =======================================================================
// === LISTA PROFORMA EMESSE (VERSIONE ROBUSTA) ===
// === VERSIONE: 3.4 FINALE ===
// === Data: 10 Febbraio 2026 - Ore 19:00 ===
// === FIX: Pulsante PDF + Campo Pagato salvato correttamente ===
// === Container: 'proforma-list-container' (NON 'proforma-lista-container') ===
// === 7 Protezioni Anti-Stuck + Retry + Safety Timeout ===
// =======================================================================

/**
 * Carica e mostra lista proforma con retry automatico
 * VERSIONE ROBUSTA con protezioni multiple
 */
async function loadProformaList(clientName = null, retryCount = 0) {
  console.log('🔄 loadProformaList() chiamata', { 
    clientName, 
    retryCount,
    timestamp: new Date().toISOString() 
  });
  
  // PROTEZIONE 1: Verifica container
  const container = document.getElementById('proforma-list-container');
  if (!container) {
    console.error('❌ CRITICO: Container proforma-list-container non trovato nel DOM');
    console.log('📋 Containers disponibili:', 
      Array.from(document.querySelectorAll('[id*="proforma"]')).map(el => el.id)
    );
    return;
  }
  
  container.innerHTML = '<div class="loading">⏳ Caricamento proforma...</div>';
  
  // PROTEZIONE 6: Safety timeout assoluto - dopo 20s mostra sempre qualcosa
  const safetyTimeoutId = setTimeout(() => {
    console.error('🚨 SAFETY TIMEOUT: loadProformaList non completata dopo 20 secondi');
    if (container.innerHTML.includes('loading')) {
      container.innerHTML = `
        <div class="error-state" style="padding: 20px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 12px;">⏱️</div>
          <div style="font-weight: bold; margin-bottom: 8px;">Timeout caricamento</div>
          <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Il caricamento sta impiegando troppo tempo</div>
          <div style="font-size: 12px; color: #999; margin-bottom: 16px;">
            Possibili cause: server lento, connessione instabile, backend sovraccarico
          </div>
          <button class="btn-primary btn-small" onclick="loadProformaList()" style="margin-top: 12px;">
            🔄 Riprova
          </button>
        </div>
      `;
    }
  }, 20000);
  
  try {
    // PROTEZIONE 2: Verifica CONFIG con fallback multipli
    let API_URL = null;
    
    // Tentativo 1: window.CONFIG
    if (window.CONFIG && window.CONFIG.APPS_SCRIPT_URL) {
      API_URL = window.CONFIG.APPS_SCRIPT_URL;
      console.log('✅ API URL da window.CONFIG');
    }
    // Tentativo 2: CONFIG globale
    else if (typeof CONFIG !== 'undefined' && CONFIG.APPS_SCRIPT_URL) {
      API_URL = CONFIG.APPS_SCRIPT_URL;
      console.log('✅ API URL da CONFIG globale');
    }
    // Tentativo 3: CONFIG non caricato
    else {
      clearTimeout(safetyTimeoutId);
      throw new Error('API URL non disponibile - CONFIG non caricato correttamente');
    }
    
    if (!API_URL || API_URL.trim() === '') {
      clearTimeout(safetyTimeoutId);
      throw new Error('API URL non disponibile - CONFIG non caricato');
    }
    
    // Costruisci URL completo
    const url = clientName 
      ? `${API_URL}?action=get_proforma_list&cliente=${encodeURIComponent(clientName)}`
      : `${API_URL}?action=get_proforma_list`;
    
    console.log('📡 Chiamata API:', url.substring(0, 100) + '...');
    console.log('🔗 Parametri:', { action: 'get_proforma_list', cliente: clientName || 'tutti' });
    
    // PROTEZIONE 3: Timeout di 15 secondi (aumentato da 10)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('⏱️ Timeout raggiunto dopo 15 secondi');
      controller.abort();
    }, 15000);
    
    const fetchStartTime = Date.now();
    const response = await fetch(url, { 
      signal: controller.signal,
      cache: 'no-cache' // Evita cache problematiche
    });
    clearTimeout(timeoutId);
    clearTimeout(safetyTimeoutId); // Cancella safety timeout se fetch completa
    
    const fetchDuration = Date.now() - fetchStartTime;
    console.log(`📥 Risposta ricevuta in ${fetchDuration}ms:`, response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Parse JSON
    const result = await response.json();
    console.log('📦 Dati JSON ricevuti:', {
      success: result.success,
      dataLength: result.data?.length,
      hasError: !!result.error
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Errore caricamento proforma (success=false)');
    }
    
    // SUCCESSO: Renderizza lista
    renderProformaList(result.data || []);
    console.log('✅ Lista proforma renderizzata con successo:', result.data?.length || 0, 'elementi');
    
  } catch (error) {
    clearTimeout(safetyTimeoutId); // Cancella safety timeout su errore
    console.error('❌ Errore loadProformaList:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 200)
    });
    
    // PROTEZIONE 4: Retry automatico (max 2 tentativi)
    // Ma NON su timeout (AbortError) per evitare loop
    if (retryCount < 2 && error.name !== 'AbortError') {
      const retryDelay = 2000 * (retryCount + 1); // Delay progressivo: 2s, 4s
      console.log(`🔁 Retry ${retryCount + 1}/2 tra ${retryDelay}ms...`);
      
      container.innerHTML = `
        <div class="loading">
          ⏳ Tentativo ${retryCount + 2}/3...
        </div>
      `;
      
      setTimeout(() => loadProformaList(clientName, retryCount + 1), retryDelay);
      return;
    }
    
    // PROTEZIONE 5: Mostra errore user-friendly con diagnostica
    let errorMessage = error.message;
    let suggestion = 'Verifica la connessione internet e riprova.';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Timeout - il server non risponde entro 15 secondi';
      suggestion = 'Il backend potrebbe essere lento o non disponibile. Riprova tra qualche minuto.';
    } else if (error.message.includes('CONFIG')) {
      errorMessage = 'Configurazione mancante';
      suggestion = 'Ricarica la pagina (CTRL+F5) per ricaricare la configurazione.';
    } else if (error.message.includes('HTTP')) {
      suggestion = 'Errore del server. Controlla i log di Google Apps Script.';
    }
    
    container.innerHTML = `
      <div class="error-state" style="padding: 20px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
        <div style="font-weight: bold; margin-bottom: 8px;">Errore caricamento proforma</div>
        <div style="font-size: 14px; color: #666; margin-bottom: 8px;">${errorMessage}</div>
        <div style="font-size: 12px; color: #999; margin-bottom: 16px;">${suggestion}</div>
        <button class="btn-primary btn-small" onclick="loadProformaList()" style="margin-top: 12px;">
          🔄 Riprova
        </button>
        <button class="btn-secondary btn-small" onclick="console.log('Debug info:', window.CONFIG)" style="margin-top: 12px; margin-left: 8px;">
          🐛 Debug Console
        </button>
      </div>
    `;
  }
}

/**
 * Renderizza lista proforma
 * VERSIONE ROBUSTA con protezioni contro errori di rendering
 * ✅ v3.2: Salva dati globali e popola filtro anno
 */
function renderProformaList(proformeList) {
  console.log('🎨 renderProformaList() chiamata', {
    isArray: Array.isArray(proformeList),
    length: proformeList?.length,
    firstItem: proformeList?.[0]
  });
  
  const container = document.getElementById('proforma-list-container');
  if (!container) {
    console.error('❌ CRITICO: Container proforma-list-container non trovato in renderProformaList');
    return;
  }
  
  // ✅ v3.2: Salva dati globali per filtri locali
  window.allProformeData = proformeList || [];
  
  // ✅ v3.2: Popola dropdown anni DOPO aver salvato i dati
  populateAnnoFilter();
  
  // Applica filtri locali (anno e stato)
  const filteredList = applyLocalFilters(window.allProformeData);
  
  // PROTEZIONE 1: Verifica array vuoto o null
  if (!filteredList || filteredList.length === 0) {
    console.log('ℹ️ Nessuna proforma da mostrare (dopo filtri)');
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
        <p style="font-weight: bold; margin-bottom: 8px;">Nessuna proforma trovata</p>
        <p style="color: #666;">Prova a modificare i filtri</p>
      </div>
    `;
    return;
  }
  
  try {
    // PROTEZIONE 2: Rendering con try-catch per ogni card
    const html = filteredList.map((proforma, index) => {
      try {
        const badgeClass = proforma.stato === 'Fatturata' ? 'badge-success' : 
                          proforma.stato === 'Pagata' ? 'badge-success' : 'badge-warning';
        
        const dataFormatted = formatDateItalian(proforma.data);
        const importoFormatted = formatCurrency(proforma.importo);
        const clienteEscaped = (proforma.cliente || '').replace(/'/g, "\\'");

        // ✅ v3.2: Layout compatto come Cattura2.png
        return `
          <div class="proforma-card">
            <div class="proforma-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e9ecef;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-weight: bold; font-size: 16px;">${proforma.nProforma || 'N/A'}</span>
                <span class="badge ${badgeClass}">${proforma.stato || 'Proforma'}</span>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 14px; color: #6c757d; margin-bottom: 4px;">${dataFormatted}</div>
                <div style="font-weight: bold; font-size: 18px; color: #28a745;">${importoFormatted}</div>
              </div>
            </div>
            
            <div class="proforma-body" style="padding: 12px 16px;">
              <div class="proforma-info" style="display: flex; align-items: center; margin-bottom: 8px;">
                <span class="info-icon" style="margin-right: 8px;">👤</span>
                <span style="font-weight: 500;">${proforma.cliente || 'Cliente non specificato'}</span>
              </div>
              
              ${proforma.stato === 'Fatturata' || proforma.stato === 'Pagata' ? `
                <div style="padding-top: 8px; border-top: 1px solid #e9ecef; margin-top: 8px; font-size: 13px; color: #6c757d;">
                  Fattura: ${proforma.numeroFattura || 'N/A'}
                  ${proforma.dataFattura ? ` (${formatDateItalian(proforma.dataFattura)})` : ''}
                </div>
              ` : ''}
            </div>
            
            ${proforma.stato !== 'Fatturata' && proforma.stato !== 'Pagata' ? `
              <div class="proforma-actions" style="padding: 12px 16px; border-top: 1px solid #e9ecef;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${proforma.pdfFileId ? `
                    <a href="https://drive.google.com/file/d/${proforma.pdfFileId}/view" target="_blank"
                       style="flex:0 0 auto;background:#28a745;color:white;border:none;padding:10px 16px;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
                      📄 PDF
                    </a>
                  ` : ''}
                  <button onclick="openAggiungiVociModal('${proforma.nProforma}','${clienteEscaped}','${(proforma.causale||'').replace(/'/g,"\\'")}')" style="flex:1;min-width:120px;background:#fd7e14;color:#fff;border:none;padding:10px 16px;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;">
                    ✏️ Modifica
                  </button>
                  <button class="btn-primary btn-small" onclick="openFatturaModal('${proforma.nProforma}')" style="flex: 2;">
                    📝 Emetti Fattura
                  </button>
                </div>
              </div>
            ` : proforma.pdfFileId ? `
              <div class="proforma-actions" style="padding: 12px 16px; border-top: 1px solid #e9ecef;">
                <a href="https://drive.google.com/file/d/${proforma.pdfFileId}/view" target="_blank" 
                   style="width: 100%; 
                          background: #28a745; 
                          color: white; 
                          border: none; 
                          padding: 10px 16px; 
                          border-radius: 6px; 
                          font-size: 14px; 
                          font-weight: 500;
                          cursor: pointer;
                          text-align: center; 
                          text-decoration: none; 
                          display: inline-flex;
                          align-items: center;
                          justify-content: center;
                          transition: background 0.2s ease;">
                  📄 Visualizza PDF
                </a>
              </div>
            ` : ''}
          </div>
        `;
      } catch (cardError) {
        console.error(`❌ Errore rendering card ${index}:`, cardError, proforma);
        return `
          <div class="proforma-card" style="border-left: 3px solid #dc3545;">
            <div class="proforma-body">
              <div style="color: #dc3545;">⚠️ Errore rendering proforma: ${proforma.nProforma || index}</div>
            </div>
          </div>
        `;
      }
    }).join('');
    
    container.innerHTML = html;
    console.log('✅ Rendering completato:', proformeList.length, 'proforma renderizzate');
    
  } catch (error) {
    console.error('❌ ERRORE CRITICO in renderProformaList:', error);
    container.innerHTML = `
      <div class="error-state" style="padding: 20px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
        <div style="font-weight: bold; margin-bottom: 8px;">Errore rendering lista proforma</div>
        <div style="font-size: 12px; color: #999; margin-bottom: 16px;">${error.message}</div>
        <button class="btn-primary btn-small" onclick="loadProformaList()">
          🔄 Ricarica
        </button>
      </div>
    `;
  }
}

/**
 * Apre modal per emissione fattura
 */
function openFatturaModal(nProforma) {
  console.log('📄 Apertura modal fattura per proforma:', nProforma);
  
  const modal = document.getElementById('fatturaModal');
  if (!modal) {
    console.error('❌ Modal fattura non trovato');
    alert('Errore: modal fattura non trovato nel DOM');
    return;
  }
  
  document.getElementById('fattura-proforma-number').textContent = nProforma;
  document.getElementById('fattura-n-proforma-hidden').value = nProforma;
  document.getElementById('fattura-numero-input').value = '';
  
  // ✅ v3.3: Inizializza data fattura con oggi
  const dataFatturaInput = document.getElementById('fattura-data-input');
  if (dataFatturaInput) {
    const oggi = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    dataFatturaInput.value = oggi;
  }
  
  // ✅ v3.3: Deseleziona checkbox pagato
  const pagatoCheckbox = document.getElementById('fattura-pagato-checkbox');
  if (pagatoCheckbox) {
    pagatoCheckbox.checked = false;
  }
  
  document.getElementById('fattura-numero-input').focus();
  modal.classList.add('active');
}

/**
 * Chiude modal fattura
 */
function closeFatturaModal() {
  const modal = document.getElementById('fatturaModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Salva numero fattura
 */
async function saveNumeroFattura(event) {
  event.preventDefault();
  
  const nProforma = document.getElementById('fattura-n-proforma-hidden').value;
  const numeroFattura = document.getElementById('fattura-numero-input').value.trim();
  
  if (!numeroFattura) {
    alert('⚠️ Inserisci il numero fattura');
    return;
  }
  
  // ✅ v3.3: Leggi checkbox pagato e data fattura
  const pagatoCheckbox = document.getElementById('fattura-pagato-checkbox');
  const dataFatturaInput = document.getElementById('fattura-data-input');
  
  const pagato = pagatoCheckbox ? pagatoCheckbox.checked : false;
  const dataFattura = dataFatturaInput ? dataFatturaInput.value : '';
  
  const submitBtn = document.getElementById('fattura-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Salvataggio...';
  
  try {
    const API_URL = window.CONFIG?.APPS_SCRIPT_URL || '';
    if (!API_URL) {
      throw new Error('API URL non configurato');
    }
    
    // ✅ v3.3: Aggiungi parametri pagato e data_fattura
    let url = `${API_URL}?action=update_numero_fattura&n_proforma=${encodeURIComponent(nProforma)}&numero_fattura=${encodeURIComponent(numeroFattura)}&pagato=${pagato}`;
    
    if (dataFattura && dataFattura.trim() !== '') {
      url += `&data_fattura=${encodeURIComponent(dataFattura)}`;
    }
    
    console.log('💾 Salvataggio fattura:', { nProforma, numeroFattura, pagato, dataFattura });
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Errore salvataggio fattura');
    }
    
    console.log('✅ Fattura salvata con successo');
    window.markTabDirty && window.markTabDirty('proforma');
    window.markTabDirty && window.markTabDirty('fatture');
    alert(`✅ Fattura ${numeroFattura} registrata per proforma ${nProforma}${pagato ? ' (Pagata)' : ''}`);
    closeFatturaModal();
    loadProformaList(); // Ricarica lista
    
  } catch (error) {
    console.error('❌ Errore saveNumeroFattura:', error);
    alert('❌ Errore: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

/**
 * Filtra proforma per cliente
 */
/**
 * ✅ v3.2: Popola dropdown anni con anni disponibili nelle proforma
 */
function populateAnnoFilter() {
  const annoFilter = document.getElementById('filter-anno-proforma');
  if (!annoFilter) {
    console.warn('⚠️ Dropdown filter-anno-proforma non trovato');
    return;
  }
  
  const proformeList = window.allProformeData || [];
  
  // Estrai anni unici dalle proforma (formato "N/YYYY")
  const anniSet = new Set();
  proformeList.forEach(p => {
    if (p.nProforma && p.nProforma.includes('/')) {
      const anno = p.nProforma.split('/')[1];
      if (anno && !isNaN(anno)) {
        anniSet.add(parseInt(anno));
      }
    }
  });
  
  // Ordina anni decrescente
  const anniOrdinati = Array.from(anniSet).sort((a, b) => b - a);
  
  console.log('📅 Anni disponibili:', anniOrdinati);
  
  // Popola dropdown
  const currentValue = annoFilter.value; // Salva selezione corrente
  
  annoFilter.innerHTML = '<option value="">Tutti gli anni</option>';
  anniOrdinati.forEach(anno => {
    const option = document.createElement('option');
    option.value = anno;
    option.textContent = anno;
    annoFilter.appendChild(option);
  });
  
  // Ripristina selezione se possibile
  if (currentValue && anniOrdinati.includes(parseInt(currentValue))) {
    annoFilter.value = currentValue;
  }
  
  console.log(`✅ Dropdown anni popolato: ${anniOrdinati.length} anni`);
}

/**
 * ✅ v3.2: Applica filtri locali (anno e stato) alla lista proforma
 */
function applyLocalFilters(proformeList) {
  if (!proformeList || proformeList.length === 0) return [];
  
  const annoFilter = document.getElementById('filter-anno-proforma');
  const statoFilter = document.getElementById('filter-stato-proforma');
  
  const annoSelezionato = annoFilter ? annoFilter.value : '';
  const statoSelezionato = statoFilter ? statoFilter.value : '';
  
  console.log('🔍 Filtri locali:', {
    anno: annoSelezionato || 'tutti',
    stato: statoSelezionato || 'tutti',
    totaleProforma: proformeList.length
  });
  
  let filtered = proformeList;
  
  // Filtra per anno
  if (annoSelezionato && annoSelezionato.trim() !== '') {
    filtered = filtered.filter(p => {
      if (!p.nProforma || !p.nProforma.includes('/')) return false;
      const anno = p.nProforma.split('/')[1];
      return anno === annoSelezionato;
    });
    console.log(`  → Dopo filtro anno ${annoSelezionato}: ${filtered.length} proforma`);
  }
  
  // Filtra per stato
  if (statoSelezionato && statoSelezionato.trim() !== '') {
    filtered = filtered.filter(p => p.stato === statoSelezionato);
    console.log(`  → Dopo filtro stato ${statoSelezionato}: ${filtered.length} proforma`);
  }
  
  return filtered;
}

/**
 * Filtra lista proforma per cliente (richiesta server)
 */
function filterProformaList() {
  const selectCliente = document.getElementById('filter-cliente-proforma');
  if (!selectCliente) return;

  const clienteSelezionato = selectCliente.value;
  console.log('🔍 Filtro proforma per cliente:', clienteSelezionato || 'TUTTI');

  // Ricarica da server con filtro cliente (questo popola window.allProformeData)
  loadProformaList(clienteSelezionato || null);
}

/**
 * Filtra lista proforma localmente (anno e stato) — senza nuova richiesta al server
 */
function filterProformaLocal() {
  if (window.allProformeData) {
    renderProformaList(window.allProformeData);
  }
}

/**
 * Formatta data in italiano in modo robusto
 * VERSIONE 3.1 - Gestione migliorata date verbose con timezone
 */
function formatDateItalian(dateStr) {
  if (!dateStr) return 'Data non disponibile';
  
  try {
    // CASO 1: Se già in formato dd/MM/yyyy, restituisci così com'è
    if (typeof dateStr === 'string' && dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return dateStr;
    }
    
    // CASO 2: Se in formato ISO yyyy-MM-dd, converti
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parts = dateStr.split('T')[0].split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    
    // CASO 3: Formato verbose con timezone (es: "Thu Jan 01 2026 00:00:00 GMT+0100 (Ora standard...)")
    // Questo è il problema principale - estraiamo PRIMA con regex
    if (typeof dateStr === 'string' && dateStr.includes('GMT')) {
      const match = dateStr.match(/(\w{3})\s+(\w{3})\s+(\d{1,2})\s+(\d{4})/);
      if (match) {
        const months = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        const day = match[3].padStart(2, '0'); // Assicura 2 cifre
        const month = months[match[2]];
        const year = match[4];
        return `${day}/${month}/${year}`;
      }
    }
    
    // CASO 4: Prova conversione generica a Date object
    const date = new Date(dateStr);
    
    // Verifica che sia una data valida
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Data non valida:', dateStr);
      return 'Data non valida';
    }
    
    // Formatta in italiano
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch(e) {
    console.error('❌ Errore formattazione data:', e, dateStr);
    return 'Errore data';
  }
}

/**
 * Formatta valuta
 */
function formatCurrency(value) {
  if (!value && value !== 0) return '€ 0,00';
  
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '€ 0,00';
  
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(num);
}

/**
 * Popola filtro clienti
 */
function populateProformaClientFilter() {
  const datalist = document.getElementById('filter-cliente-proforma-list');
  if (!datalist || !window.clients) return;

  datalist.innerHTML = '';
  window.clients.forEach(cliente => {
    const option = document.createElement('option');
    option.value = typeof cliente === 'string' ? cliente : cliente.name;
    datalist.appendChild(option);
  });
}

// =======================================================================
// === ESPOSIZIONE FUNZIONI SU WINDOW (ACCESSIBILI GLOBALMENTE) ===
// =======================================================================

window.loadProformaList = loadProformaList;
window.renderProformaList = renderProformaList;
window.openFatturaModal = openFatturaModal;
window.closeFatturaModal = closeFatturaModal;
window.saveNumeroFattura = saveNumeroFattura;
window.filterProformaList = filterProformaList;
window.filterProformaLocal = filterProformaLocal;
window.populateProformaClientFilter = populateProformaClientFilter;

/**
 * Resetta tutti i filtri proforma e ricarica lista completa
 */
function resetProformaFilters() {
  console.log('🔄 Reset filtri proforma');
  
  // Reset dropdown clienti
  const clienteFilter = document.getElementById('filter-cliente-proforma');
  if (clienteFilter) clienteFilter.value = '';
  
  // Reset dropdown anno
  const annoFilter = document.getElementById('filter-anno-proforma');
  if (annoFilter) annoFilter.value = '';
  
  // Reset dropdown stato
  const statoFilter = document.getElementById('filter-stato-proforma');
  if (statoFilter) statoFilter.value = '';
  
  // Ricarica lista completa
  filterProformaList();
}

// Espone resetProformaFilters globalmente
window.resetProformaFilters = resetProformaFilters;

console.log('✅ proforma-list.js caricato - funzioni esposte su window');

// =======================================================================
// === INIZIALIZZAZIONE AUTOMATICA ===
// =======================================================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOMContentLoaded - inizializzazione proforma-list');

  // Event listener per chiudere modal cliccando fuori
  const fatturaModal = document.getElementById('fatturaModal');
  if (fatturaModal) {
    fatturaModal.addEventListener('click', function(e) {
      if (e.target === fatturaModal) {
        closeFatturaModal();
      }
    });
    console.log('✅ Event listener modal fattura configurato');
  } else {
    console.warn('⚠️ Modal fattura non trovato in DOM');
  }

});

// =======================================================================
// === AGGIUNGI VOCI A PROFORMA ESISTENTE ===
// =======================================================================

let _aggiungiVociState = { nProforma: null, cliente: null, importoCorrente: 0 };

window.openAggiungiVociModal = async function(nProforma, cliente, causale, importoCorrente) {
  _aggiungiVociState = { nProforma, cliente, causale: causale || '', importoCorrente: parseFloat(importoCorrente) || 0 };

  document.getElementById('aggiorna-proforma-numero').textContent = nProforma;
  document.getElementById('aggiorna-proforma-info').innerHTML =
    `Cliente: <strong>${cliente}</strong>`;
  document.getElementById('aggiorna-causale').value = causale || '';
  document.getElementById('aggiorna-forfettario').checked = false;
  document.getElementById('aggiorna-proforma-info-box').style.display = 'none';
  document.getElementById('aggiorna-cliente-fallback').style.display = 'none';
  document.getElementById('aggiorna-cliente-override').value = '';
  document.getElementById('aggiorna-proforma-btn').disabled = false;
  document.getElementById('aggiorna-send-email').checked = false;

  // Popola datalist clienti per eventuale selezione override
  const dl = document.getElementById('aggiorna-cliente-override-list');
  dl.innerHTML = '';
  (window.clients || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = typeof c === 'string' ? c : (c.name || c.Nome_Cliente || c.nome || '');
    dl.appendChild(opt);
  });

  const listDiv = document.getElementById('aggiorna-voci-list');
  listDiv.innerHTML = '<p style="color:#6c757d;text-align:center;padding:20px;">⏳ Caricamento voci disponibili...</p>';
  document.getElementById('aggiungiVociModal').style.display = 'flex';

  try {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=get_timesheet_da_fatturare&cliente=${encodeURIComponent(cliente)}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Errore caricamento');

    const items = data.timesheet || [];
    if (items.length === 0) {
      listDiv.innerHTML = '<p style="color:#6c757d;text-align:center;padding:20px;">Nessun intervento "Da fatturare" disponibile per questo cliente.</p>';
      return;
    }

    listDiv.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="padding:8px;width:32px;"></th>
          <th style="padding:8px;text-align:left;">Data</th>
          <th style="padding:8px;text-align:left;">Descrizione</th>
          <th style="padding:8px;text-align:center;">Ore</th>
          <th style="padding:8px;text-align:right;">€</th>
        </tr></thead>
        <tbody>
          ${items.map(t => `
            <tr style="border-bottom:1px solid #f0f0f0;" class="aggiorna-voce-row">
              <td style="padding:8px;text-align:center;">
                <input type="checkbox" class="aggiorna-voce-cb" data-rowindex="${t.rowIndex}" data-costo="${t.costo||0}" onchange="aggiornaVociSelezione()">
              </td>
              <td style="padding:8px;white-space:nowrap;">${t.dataItaliana||t.data||'—'}</td>
              <td style="padding:8px;">${t.descrizione||'—'}</td>
              <td style="padding:8px;text-align:center;">${t.ore||0}h</td>
              <td style="padding:8px;text-align:right;">€ ${parseFloat(t.costo||0).toFixed(2)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch(err) {
    listDiv.innerHTML = `<p style="color:#dc3545;text-align:center;padding:20px;">❌ ${err.message}</p>`;
  }
};

window.aggiornaVociSelezione = function() {
  const checked = document.querySelectorAll('.aggiorna-voce-cb:checked');
  const infoBox = document.getElementById('aggiorna-proforma-info-box');

  if (checked.length > 0) {
    const addedCost = Array.from(checked).reduce((sum, cb) => sum + parseFloat(cb.dataset.costo||0), 0);
    infoBox.style.display = 'block';
    infoBox.innerHTML = `Voci selezionate: <strong>${checked.length}</strong> &nbsp;|&nbsp; Importo aggiunto: <strong>+ € ${addedCost.toFixed(2)}</strong>`;
  } else {
    infoBox.style.display = 'none';
  }
};

window.confermAAggiungiVoci = async function() {
  const checked      = Array.from(document.querySelectorAll('.aggiorna-voce-cb:checked'));
  const rowIndexes   = checked.map(cb => cb.dataset.rowindex).join(',');
  const sendEmail    = document.getElementById('aggiorna-send-email').checked;
  const forfettario  = document.getElementById('aggiorna-forfettario').checked;
  const causale      = document.getElementById('aggiorna-causale').value.trim();
  const clienteOverride = document.getElementById('aggiorna-cliente-override').value.trim();

  const btn = document.getElementById('aggiorna-proforma-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Salvataggio...';

  try {
    let url = `${CONFIG.APPS_SCRIPT_URL}?action=modifica_proforma`
      + `&n_proforma=${encodeURIComponent(_aggiungiVociState.nProforma)}`
      + `&forfettario=${forfettario}`
      + `&causale=${encodeURIComponent(causale)}`
      + `&send_email=${sendEmail}`;
    if (rowIndexes)      url += `&timesheet_ids=${rowIndexes}`;
    if (clienteOverride) url += `&cliente_override=${encodeURIComponent(clienteOverride)}`;

    const res  = await fetch(url);
    const data = await res.json();

    // Cliente non trovato: mostra sezione selezione nel modal
    if (!data.success && data.errorCode === 'CLIENT_NOT_FOUND') {
      document.getElementById('aggiorna-cliente-fallback').style.display = 'block';
      document.getElementById('aggiorna-cliente-fallback-msg').textContent =
        `Il cliente "${data.clientName}" non è stato trovato nel CRM (probabilmente rinominato). Seleziona il cliente corrispondente e clicca di nuovo "Salva modifiche".`;
      btn.disabled = false;
      btn.textContent = '✅ Salva modifiche';
      return;
    }

    if (!data.success) throw new Error(data.error);

    closeAggiungiVociModal();
    let msg = `✅ Proforma ${data.nProforma} aggiornata!\nNuovo totale: € ${data.nuovoTotale}`;
    if (data.forfettario) msg += '\nCliente forfettario: ritenuta = 0';
    if (data.vociAggiunte > 0) msg += `\nVoci aggiunte: ${data.vociAggiunte}`;
    alert(msg);
    if (window.allProformeData !== undefined) loadProformaList();
  } catch(err) {
    btn.disabled = false;
    btn.textContent = '✅ Salva modifiche';
    alert('❌ Errore: ' + err.message);
  }
};

window.closeAggiungiVociModal = function() {
  document.getElementById('aggiungiVociModal').style.display = 'none';
};
