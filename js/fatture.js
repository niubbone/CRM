// =======================================================================
// === Studio Smart CRM - Gestione Fatture ===
// === Frontend Module v1.1 ===
// =======================================================================

let allFattureData = [];
let _nfVociData = { timesheet: [], canoni: [] };

async function loadFattureList(retryCount = 0) {
  const container = document.getElementById('fatture-list-container');
  if (!container) return;
  container.innerHTML = '<div style="padding:30px;text-align:center;">⏳ Caricamento fatture...</div>';
  const safetyId = setTimeout(() => {
    if (container.innerHTML.includes('Caricamento')) {
      container.innerHTML = buildFattureErrorHTML('Timeout', 'Server non risponde.', 'loadFattureList()');
    }
  }, 20000);
  try {
    const API_URL = window.CONFIG?.APPS_SCRIPT_URL;
    if (!API_URL) throw new Error('CONFIG non disponibile');
    const filtri = getFiltriAttivi();
    const params = new URLSearchParams({ action: 'get_fatture_list', ...filtri });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(`${API_URL}?${params.toString()}`, { signal: controller.signal, cache: 'no-cache' });
    clearTimeout(timeoutId);
    clearTimeout(safetyId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Errore caricamento');
    allFattureData = result.data || [];
    renderFattureList(allFattureData);
    renderFattureTotali(result.totali || {});
    populateFattureAnnoFilter();
    console.log('✅ Fatture caricate:', allFattureData.length);
  } catch (error) {
    clearTimeout(safetyId);
    if (retryCount < 2 && error.name !== 'AbortError') {
      container.innerHTML = '<div style="padding:30px;text-align:center;">⏳ Tentativo ' + (retryCount + 2) + '/3...</div>';
      setTimeout(() => loadFattureList(retryCount + 1), 2000 * (retryCount + 1));
      return;
    }
    container.innerHTML = buildFattureErrorHTML('Errore caricamento', error.message, 'loadFattureList()');
  }
}

function getFiltriAttivi() {
  const f = {};
  const cliente = document.getElementById('fatture-filter-cliente')?.value?.trim();
  const anno    = document.getElementById('fatture-filter-anno')?.value?.trim();
  const pagato  = document.getElementById('fatture-filter-pagato')?.value?.trim();
  if (cliente) f.cliente = cliente;
  if (anno)    f.anno    = anno;
  if (pagato)  f.pagato  = pagato;
  return f;
}

function renderFattureList(fatture) {
  const container = document.getElementById('fatture-list-container');
  if (!container) return;
  if (!fatture || fatture.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#6c757d;"><div style="font-size:48px;margin-bottom:12px;"><i class="fas fa-receipt" style="color:#dee2e6;"></i></div><p style="font-weight:bold;">Nessuna fattura trovata</p><p style="font-size:14px;">Prova a modificare i filtri o aggiungi una nuova fattura</p></div>';
    return;
  }
  container.innerHTML = fatture.map(f => buildFatturaCard(f)).join('');
}

function buildFatturaCard(f) {
  const isPagata  = f.pagato === 'SI';
  const isDiretta = !f.nProforma;
  const tipoText  = isDiretta ? '<i class="fas fa-clipboard"></i> Diretta' : '<i class="fas fa-file"></i> Da proforma ' + f.nProforma;
  const tipoColor = isDiretta ? '#6c757d' : '#1976D2';
  const isNC      = parseFloat(f.totale) < 0;

  const badgeStyle = isPagata
    ? 'background:#28a745;color:#fff;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:none;'
    : 'background:#fd7e14;color:#fff;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:none;';
  const badgeText   = isPagata ? '✓ Pagata' : '⏳ Da pagare';
  const badgeAction = isPagata
    ? `annullaPagamento('${f.nFattura.replace(/'/g, "\\'")}')`
    : `openPagamentoModal('${f.nFattura.replace(/'/g, "\\'")}')`;

  return `
    <div style="background:#fff;border-radius:8px;border:1px solid #e9ecef;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #f0f0f0;">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
          <span style="font-weight:700;font-size:16px;">${f.nFattura}</span>
          <button onclick="${badgeAction}" style="${badgeStyle}">${badgeText}</button>
          <span style="color:${tipoColor};font-size:12px;">${tipoText}</span>
          ${isNC ? `<span style="color:#dc3545;font-size:12px;font-weight:600;"><i class="fas fa-file-pen"></i> Nota di credito</span>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:12px;color:#6c757d;">${f.dataFattura || '—'}</div>
          <div style="font-weight:700;font-size:18px;color:${isNC ? '#dc3545' : '#212529'};">€ ${formatFattureNum(f.totale)}</div>
          ${f.ritenuta ? `<div style="font-size:11px;color:#6c757d;">di cui rit. acconto -€ ${formatFattureNum(f.ritenuta)}</div>` : ''}
        </div>
      </div>
      <div style="padding:10px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
        <div><i class="fas fa-user" style="font-size:13px;color:#6c757d;margin-right:4px;"></i><span style="font-weight:500;">${f.nomeCliente || '—'}</span></div>
        ${isPagata && f.dataPagamento ? `<div style="font-size:12px;color:#28a745;margin-left:8px;">Pagata il ${f.dataPagamento}</div>` : ''}
      </div>
    </div>`;
}

function renderFattureTotali(totali) {
  const el = document.getElementById('fatture-totali');
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:0 0 14px 0;">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <div style="background:#f8f9fa;border-radius:8px;padding:10px 18px;text-align:center;min-width:90px;">
          <div style="font-size:22px;font-weight:700;">${totali.count || 0}</div>
          <div style="font-size:12px;color:#6c757d;">Fatture</div>
        </div>
        <div style="background:#e8f5e9;border-radius:8px;padding:10px 18px;text-align:center;min-width:120px;">
          <div style="font-size:16px;font-weight:700;color:#28a745;">€ ${formatFattureNum(totali.totale || 0)}</div>
          <div style="font-size:12px;color:#6c757d;">Totale fatturato</div>
        </div>
        <div style="background:#fff3cd;border-radius:8px;padding:10px 18px;text-align:center;min-width:120px;">
          <div style="font-size:16px;font-weight:700;color:#fd7e14;">€ ${formatFattureNum(totali.daPagare || 0)}</div>
          <div style="font-size:12px;color:#6c757d;">Da incassare</div>
        </div>
        ${totali.ritenuta ? `
        <div style="background:#ede7f6;border-radius:8px;padding:10px 18px;text-align:center;min-width:120px;">
          <div style="font-size:16px;font-weight:700;color:#6f42c1;">€ ${formatFattureNum(totali.ritenuta)}</div>
          <div style="font-size:12px;color:#6c757d;">Ritenute d'acconto</div>
        </div>` : ''}
      </div>
      <button onclick="openNuovaFatturaModal()" style="background:#1976D2;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-plus"></i> Nuova Fattura Diretta</button>
    </div>`;
}

function populateFattureAnnoFilter() {
  const select = document.getElementById('fatture-filter-anno');
  if (!select || !allFattureData.length) return;
  const anniSet = new Set();
  allFattureData.forEach(f => {
    if (f.dataFattura && f.dataFattura.includes('/')) {
      const anno = f.dataFattura.split('/')[2];
      if (anno) anniSet.add(anno);
    }
  });
  const current = select.value;
  select.innerHTML = '<option value="">Tutti gli anni</option>';
  Array.from(anniSet).sort((a, b) => b - a).forEach(anno => {
    const opt = document.createElement('option');
    opt.value = anno; opt.textContent = anno;
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

function populateFattureClientFilter() {
  const datalist = document.getElementById('fatture-filter-cliente-list');
  if (!datalist || !window.clients) return;
  datalist.innerHTML = '';
  window.clients.forEach(c => {
    const name = typeof c === 'string' ? c : c.name;
    const opt = document.createElement('option');
    opt.value = name;
    datalist.appendChild(opt);
  });
}

function applyFattureFilters() { loadFattureList(); }

function resetFattureFilters() {
  ['fatture-filter-cliente','fatture-filter-anno','fatture-filter-pagato'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  loadFattureList();
}

function openNuovaFatturaModal() {
  const modal = document.getElementById('nuova-fattura-modal');
  if (!modal) return;
  document.getElementById('nf-numero').value = '';
  document.getElementById('nf-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('nf-imponibile').value = '';
  document.getElementById('nf-iva-display').textContent = '€ 0,00';
  document.getElementById('nf-totale-display').textContent = '€ 0,00';
  document.getElementById('nf-descrizione').value = '';
  document.getElementById('nf-note').value = '';
  const ritenuta = document.getElementById('nf-ritenuta');
  if (ritenuta) ritenuta.checked = false;
  const ritRow = document.getElementById('nf-ritenuta-row');
  if (ritRow) ritRow.style.display = 'none';
  // Reset sezione voci
  _nfVociData = { timesheet: [], canoni: [] };
  const caricaBtn = document.getElementById('nf-carica-btn');
  if (caricaBtn) { caricaBtn.style.display = 'block'; caricaBtn.disabled = false; caricaBtn.innerHTML = '<i class="fas fa-plus"></i> Collega timesheet / canoni (opzionale)'; }
  const vociContainer = document.getElementById('nf-voci-container');
  if (vociContainer) vociContainer.style.display = 'none';
  const vociFooter = document.getElementById('nf-voci-footer');
  if (vociFooter) vociFooter.style.display = 'none';

  const clientInput = document.getElementById('nf-cliente');
  const clientDatalist = document.getElementById('nf-cliente-list');
  if (clientInput && clientDatalist) {
    clientInput.value = '';
    clientDatalist.innerHTML = '';
    const clientList = window.clients || [];
    const sorted = [...clientList].sort((a, b) => {
      const na = typeof a === 'string' ? a : (a.name || '');
      const nb = typeof b === 'string' ? b : (b.name || '');
      return na.localeCompare(nb, 'it');
    });
    sorted.forEach(c => {
      const name = typeof c === 'string' ? c : (c.name || '');
      if (!name) return;
      const opt = document.createElement('option');
      opt.value = name;
      clientDatalist.appendChild(opt);
    });
  }

  modal.style.display = 'flex';
  document.getElementById('nf-numero').focus();
}

function closeNuovaFatturaModal() {
  const modal = document.getElementById('nuova-fattura-modal');
  if (modal) modal.style.display = 'none';
}

function aggiornaCalcoloIVA() {
  const imp    = parseFloat(document.getElementById('nf-imponibile')?.value) || 0;
  const iva    = Math.round(imp * 0.22 * 100) / 100;
  const tot    = Math.round((imp + iva) * 100) / 100;
  const hasRA  = document.getElementById('nf-ritenuta')?.checked;
  const ra     = hasRA ? Math.round(imp * 0.20 * 100) / 100 : 0;
  const netto  = Math.round((tot - ra) * 100) / 100;

  if (document.getElementById('nf-iva-display'))
    document.getElementById('nf-iva-display').textContent = '€ ' + formatFattureNum(iva);
  if (document.getElementById('nf-totale-display'))
    document.getElementById('nf-totale-display').textContent = '€ ' + formatFattureNum(tot);

  const ritRow = document.getElementById('nf-ritenuta-row');
  if (ritRow) ritRow.style.display = hasRA ? 'flex' : 'none';
  if (document.getElementById('nf-ra-display'))
    document.getElementById('nf-ra-display').textContent = '- € ' + formatFattureNum(ra);
  if (document.getElementById('nf-netto-display'))
    document.getElementById('nf-netto-display').textContent = '€ ' + formatFattureNum(netto);
}

async function saveNuovaFattura(event) {
  event.preventDefault();
  const nFattura      = document.getElementById('nf-numero')?.value?.trim();
  const dataFattura   = document.getElementById('nf-data')?.value?.trim();
  const cliente       = document.getElementById('nf-cliente')?.value?.trim();
  const imponibile    = document.getElementById('nf-imponibile')?.value?.trim();
  const descrizione   = document.getElementById('nf-descrizione')?.value?.trim();
  const note          = document.getElementById('nf-note')?.value?.trim();
  const applicaRit    = document.getElementById('nf-ritenuta')?.checked || false;
  if (!nFattura || !cliente || !imponibile) {
    alert('⚠️ Compila i campi obbligatori: Numero fattura, Cliente, Imponibile');
    return;
  }
  // Raccogli voci selezionate
  const allItems = [..._nfVociData.timesheet, ..._nfVociData.canoni];
  const tsIds = [], canIds = [];
  document.querySelectorAll('.nf-voce-cb:checked').forEach(cb => {
    const item = allItems[parseInt(cb.dataset.index)];
    if (!item) return;
    if (item.tipo === 'CANONE' || item.idCanone) canIds.push(item.rowIndex);
    else tsIds.push(item.rowIndex);
  });
  const btn = document.getElementById('nf-submit-btn');
  btn.disabled = true; btn.textContent = '⏳ Salvataggio...';
  try {
    const API_URL = window.CONFIG?.APPS_SCRIPT_URL;
    const params = new URLSearchParams({
      action: 'insert_fattura_diretta',
      n_fattura: nFattura,
      data_fattura: dataFattura || '',
      cliente,
      imponibile,
      descrizione: descrizione || '',
      note: note || '',
      applica_ritenuta: applicaRit ? 'true' : 'false'
    });
    if (tsIds.length)  params.append('timesheet_ids', tsIds.join(','));
    if (canIds.length) params.append('canoni_ids', canIds.join(','));
    const response = await fetch(`${API_URL}?${params.toString()}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Errore salvataggio');
    window.markTabDirty && window.markTabDirty('fatture');
    let msg = '✅ Fattura ' + nFattura + ' inserita con successo!';
    if (result.timesheetMarcati) msg += '\n' + result.timesheetMarcati + ' timesheet marcati.';
    if (result.canoniMarcati) msg += '\n' + result.canoniMarcati + ' canoni marcati.';
    alert(msg);
    closeNuovaFatturaModal();
    loadFattureList();
  } catch(error) {
    alert('❌ Errore: ' + error.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Salva Fattura';
  }
}

function openPagamentoModal(nFattura) {
  const modal = document.getElementById('pagamento-modal');
  if (!modal) return;
  document.getElementById('pag-n-fattura').textContent = nFattura;
  document.getElementById('pag-n-fattura-hidden').value = nFattura;
  document.getElementById('pag-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('pag-note').value = '';
  modal.style.display = 'flex';
}

function closePagamentoModal() {
  const modal = document.getElementById('pagamento-modal');
  if (modal) modal.style.display = 'none';
}

async function savePagamento(event) {
  event.preventDefault();
  const nFattura = document.getElementById('pag-n-fattura-hidden')?.value;
  const data     = document.getElementById('pag-data')?.value;
  const note     = document.getElementById('pag-note')?.value?.trim();
  if (!nFattura) return;
  const btn = document.getElementById('pag-submit-btn');
  btn.disabled = true; btn.textContent = '⏳ Salvataggio...';
  try {
    const API_URL = window.CONFIG?.APPS_SCRIPT_URL;
    const params = new URLSearchParams({
      action: 'update_pagamento_fattura',
      n_fattura: nFattura,
      pagato: 'true',
      data_pagamento: data || '',
      note: note || ''
    });
    const response = await fetch(`${API_URL}?${params.toString()}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Errore');
    window.markTabDirty && window.markTabDirty('fatture');
    alert('✅ Fattura ' + nFattura + ' segnata come pagata!');
    closePagamentoModal();
    loadFattureList();
  } catch(error) {
    alert('❌ Errore: ' + error.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-credit-card"></i> Conferma Pagamento';
  }
}

async function annullaPagamento(nFattura) {
  if (!confirm('Annullare il pagamento della fattura ' + nFattura + '?')) return;
  try {
    const API_URL = window.CONFIG?.APPS_SCRIPT_URL;
    const params = new URLSearchParams({
      action: 'update_pagamento_fattura',
      n_fattura: nFattura,
      pagato: 'false'
    });
    const response = await fetch(`${API_URL}?${params.toString()}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    loadFattureList();
  } catch(error) {
    alert('❌ Errore: ' + error.message);
  }
}

function formatFattureNum(val) {
  const n = parseFloat(val) || 0;
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildFattureErrorHTML(title, msg, retryFn) {
  return `<div style="padding:30px;text-align:center;"><div style="font-size:40px;margin-bottom:8px;"><i class="fas fa-triangle-exclamation" style="color:#fd7e14;"></i></div><div style="font-weight:bold;margin-bottom:6px;">${title}</div><div style="font-size:13px;color:#6c757d;margin-bottom:12px;">${msg}</div><button onclick="${retryFn}" style="background:#1976D2;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-arrows-rotate"></i> Riprova</button></div>`;
}

function initFattureTab() {
  console.log('🧾 Inizializzazione tab Fatture');
  populateFattureClientFilter();
  // Default: anno corrente
  const annoSelect = document.getElementById('fatture-filter-anno');
  if (annoSelect && !annoSelect.value) {
    const opt = document.createElement('option');
    const currentYear = new Date().getFullYear().toString();
    opt.value = currentYear;
    opt.textContent = currentYear;
    annoSelect.appendChild(opt);
    annoSelect.value = currentYear;
  }
  loadFattureList();
}

document.addEventListener('DOMContentLoaded', () => {
  ['nuova-fattura-modal','pagamento-modal'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  });
});

window.loadFattureList         = loadFattureList;
window.initFattureTab          = initFattureTab;
window.applyFattureFilters     = applyFattureFilters;
window.resetFattureFilters     = resetFattureFilters;
window.openNuovaFatturaModal   = openNuovaFatturaModal;
window.closeNuovaFatturaModal  = closeNuovaFatturaModal;
window.aggiornaCalcoloIVA      = aggiornaCalcoloIVA;
window.saveNuovaFattura        = saveNuovaFattura;
window.openPagamentoModal      = openPagamentoModal;
window.closePagamentoModal     = closePagamentoModal;
window.savePagamento           = savePagamento;
window.annullaPagamento        = annullaPagamento;
window.caricaVociFatturaDiretta = caricaVociFatturaDiretta;
window.aggiornaSelezioneVoci   = aggiornaSelezioneVoci;

async function caricaVociFatturaDiretta() {
  const cliente = document.getElementById('nf-cliente')?.value?.trim();
  if (!cliente) { alert('⚠️ Inserisci prima il cliente'); return; }
  const btn = document.getElementById('nf-carica-btn');
  const container = document.getElementById('nf-voci-container');
  btn.textContent = '⏳ Caricamento...';
  btn.disabled = true;
  _nfVociData = { timesheet: [], canoni: [] };
  try {
    const API_URL = window.CONFIG?.APPS_SCRIPT_URL;
    if (!API_URL) throw new Error('CONFIG non disponibile');
    const res  = await fetch(`${API_URL}?action=get_timesheet_da_fatturare&cliente=${encodeURIComponent(cliente)}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Errore caricamento');
    _nfVociData.timesheet = data.timesheet || [];
    _nfVociData.canoni    = data.canoni    || [];
    const allItems = [..._nfVociData.timesheet, ..._nfVociData.canoni];
    const listEl = document.getElementById('nf-voci-list');
    if (allItems.length === 0) {
      listEl.innerHTML = '<div style="padding:12px;color:#6c757d;text-align:center;">Nessuna voce da fatturare per questo cliente</div>';
    } else {
      listEl.innerHTML = allItems.map((item, i) => {
        const isCanone = item.tipo === 'CANONE' || !!item.idCanone;
        const dataStr  = isCanone ? (item.dataScadenza || item.data) : (item.dataItaliana || item.data || '—');
        const desc     = isCanone ? (item.descrizione || 'Canone') : (item.descrizione || item.modalita || '');
        const costo    = parseFloat(isCanone ? (item.importo || item.costo) : item.costo) || 0;
        const icon     = isCanone ? '<i class="fas fa-calendar"></i>' : '<i class="fas fa-clock"></i>';
        return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #f0f0f0;cursor:pointer;">
          <input type="checkbox" class="nf-voce-cb" data-index="${i}" data-costo="${costo}" onchange="aggiornaSelezioneVoci()">
          <span style="flex:1;font-size:12px;">${icon} <strong>${dataStr}</strong> — ${desc}</span>
          <span style="font-weight:600;white-space:nowrap;font-size:12px;">€ ${costo.toFixed(2).replace('.',',')}</span>
        </label>`;
      }).join('');
    }
    container.style.display = 'block';
    btn.style.display = 'none';
  } catch(err) {
    btn.textContent = '❌ ' + err.message;
    btn.disabled = false;
  }
}

function aggiornaSelezioneVoci() {
  const checked = Array.from(document.querySelectorAll('.nf-voce-cb:checked'));
  const footer  = document.getElementById('nf-voci-footer');
  if (checked.length === 0) {
    footer.style.display = 'none';
    return;
  }
  const total = checked.reduce((sum, cb) => sum + parseFloat(cb.dataset.costo || 0), 0);
  footer.style.display = 'block';
  footer.textContent = `${checked.length} voce${checked.length > 1 ? 'i' : ''} selezionate — Subtotale: € ${total.toFixed(2).replace('.',',')}`;
  document.getElementById('nf-imponibile').value = total.toFixed(2);
  aggiornaCalcoloIVA();
}

console.log('✅ fatture.js v1.2 caricato');
