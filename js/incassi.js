// =======================================================================
// === VENDITE > INCASSI (scadenzario delle rate) ===
// =======================================================================
// Una riga per rata: PREVISTA → INCASSATA → FATTURATA (o ANNULLATA).
// Le rate dei contratti Kleos a rate nascono alla firma; le altre si creano da qui
// («Nuove rate»: es. il contratto passato da un'azienda che paga a bonifico).
// Backend: Backend/Incassi.js. Ogni rata ha un evento nel calendario «Incassi».

let incassiDati = null;
let incassiFiltro = 'aperte';   // aperte | tutte

async function loadIncassi() {
    const container = document.getElementById('incassiContainer');
    if (!container) return;
    container.innerHTML = '<div class="loading-scadenze">Caricamento incassi...</div>';
    try {
        const response = await fetch(`${getAPIUrl()}?action=get_incassi&_t=${Date.now()}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
        incassiDati = result;
        renderIncassi();
    } catch (error) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${escQodnet(error.message)}</div></div>`;
    }
}

function dopoScritturaIncassi() {
    window.markTabDirty && window.markTabDirty('vendite');
    window.markTabDirty && window.markTabDirty('home');
    return loadIncassi();
}

const STATI_RATA = {
    PREVISTA: { testo: 'Prevista', colore: '#6c757d', sfondo: '#f1f3f5' },
    INCASSATA: { testo: 'Incassata · da fatturare', colore: '#155724', sfondo: '#d4edda' },
    FATTURATA: { testo: 'Fatturata', colore: '#0c5460', sfondo: '#d1ecf1' },
    ANNULLATA: { testo: 'Annullata', colore: '#721c24', sfondo: '#f8d7da' }
};

function rigaRata(r) {
    const s = STATI_RATA[r.stato] || STATI_RATA.PREVISTA;
    const ritardo = r.giorniRitardo > 0 ? ` <span style="color:#dc3545;font-weight:bold;">· in ritardo di ${r.giorniRitardo} gg</span>` : '';
    const azioni = [];
    if (r.stato === 'PREVISTA') {
        azioni.push(`<button class="btn-small" style="background:#28a745;color:#fff;border-color:#28a745;" onclick="registraIncassoRata('${r.idRata}')"><i class="fas fa-check"></i> Incassata</button>`);
    }
    if (r.stato === 'INCASSATA' || r.stato === 'PREVISTA') {
        azioni.push(`<button class="btn-small" onclick="fatturaRata('${r.idRata}')"><i class="fas fa-file-invoice"></i> Fattura</button>`);
    }
    return `
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eee;">
        <div style="flex:1;min-width:200px;">
            <strong>${r.nRata}/${r.di}</strong> · ${r.dataPrevista || '—'} · ${euroQodnet(r.importo)} + IVA
            <span style="color:#6c757d;">(${euroQodnet(r.lordo)})</span>${ritardo}
            <div style="font-size:0.85em;color:#6c757d;">
                ${r.dataIncasso ? 'Incassata il ' + r.dataIncasso + (r.canale ? ' (' + escQodnet(r.canale) + ')' : '') : ''}
                ${r.nFattura ? ' · fattura ' + escQodnet(r.nFattura) : ''}
            </div>
        </div>
        <span style="font-size:0.8em;padding:2px 8px;border-radius:10px;background:${s.sfondo};color:${s.colore};">${s.testo}</span>
        <div style="display:flex;gap:6px;">${azioni.join('')}</div>
    </div>`;
}

function renderIncassi() {
    const container = document.getElementById('incassiContainer');
    if (!container || !incassiDati) return;
    const rate = incassiDati.rate || [];
    const rp = incassiDati.riepilogo || {};

    if (!rate.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-coins"></i></div>
            <div>Nessuna rata. Nascono alla firma dei contratti Kleos a rate, oppure con «Nuove rate».</div></div>`;
        return;
    }

    // serie (contratto o S-AAAA-NNN) in ordine di prossima rata aperta
    const serie = {};
    rate.forEach(r => { (serie[r.serie] = serie[r.serie] || []).push(r); });
    const chiavi = Object.keys(serie).filter(k => incassiFiltro === 'tutte' ||
        serie[k].some(r => r.stato === 'PREVISTA' || r.stato === 'INCASSATA'));
    const prossima = k => {
        const a = serie[k].find(r => r.stato === 'INCASSATA') || serie[k].find(r => r.stato === 'PREVISTA');
        if (!a || !a.dataPrevista) return 9e15;
        const p = a.dataPrevista.split('/'); return new Date(p[2], p[1] - 1, p[0]).getTime();
    };
    chiavi.sort((a, b) => prossima(a) - prossima(b));

    let html = `
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0;">
        <div class="info-banner" style="flex:1;min-width:160px;margin:0;"><strong>${rp.daFatturare || 0}</strong> incassate da fatturare${rp.importoDaFatturare ? ' · ' + euroQodnet(rp.importoDaFatturare) + ' + IVA' : ''}</div>
        <div class="info-banner" style="flex:1;min-width:160px;margin:0;${rp.inRitardo ? 'background:#f8d7da;color:#721c24;' : ''}"><strong>${rp.inRitardo || 0}</strong> in ritardo</div>
        <div class="info-banner" style="flex:1;min-width:160px;margin:0;"><strong>${rp.inArrivo || 0}</strong> previste nei prossimi 7 giorni</div>
    </div>
    <div style="margin-bottom:10px;">
        <label style="font-size:0.9em;"><input type="checkbox" ${incassiFiltro === 'tutte' ? 'checked' : ''}
            onchange="incassiFiltro = this.checked ? 'tutte' : 'aperte'; renderIncassi();"> Mostra anche le serie chiuse</label>
    </div>`;

    chiavi.forEach(k => {
        const L = serie[k].sort((a, b) => a.nRata - b.nRata);
        const p = L[0];
        const incassate = L.filter(r => r.stato === 'INCASSATA' || r.stato === 'FATTURATA').length;
        const aperte = L.filter(r => r.stato === 'PREVISTA').length;
        // si mostrano le rate da fatturare, quelle in ritardo e la prossima prevista; il resto a richiesta
        const prossimaPrevista = L.find(r => r.stato === 'PREVISTA');
        const visibili = L.filter(r => r.stato === 'INCASSATA' || r.giorniRitardo > 0 || r === prossimaPrevista);
        html += `
        <div class="storico-card" style="margin-bottom:12px;">
            <div class="storico-card-header">
                <span class="storico-id">${escQodnet(p.nomeCliente)}</span>
                <span style="font-size:0.85em;color:#6c757d;">${escQodnet(k)} · ${incassate}/${L.length} incassate</span>
            </div>
            ${p.descrizione ? `<div class="storico-descrizione">${escQodnet(p.descrizione)}</div>` : ''}
            <div>${visibili.map(rigaRata).join('') || '<div style="color:#6c757d;padding:6px 0;">Nessuna rata aperta</div>'}</div>
            <div class="storico-actions">
                <button class="btn-small" onclick="toggleRateSerie('${escQodnet(k)}')"><i class="fas fa-list"></i> Tutte le rate (${L.length})</button>
                ${aperte ? `<button class="btn-small" onclick="annullaSerieRate('${prossimaPrevista ? prossimaPrevista.idRata : ''}', ${aperte})"><i class="fas fa-ban"></i> Annulla rate aperte</button>` : ''}
            </div>
            <div id="rate-serie-${escQodnet(k)}" style="display:none;margin-top:8px;">${L.map(rigaRata).join('')}</div>
        </div>`;
    });
    container.innerHTML = html;
}

function toggleRateSerie(k) {
    const box = document.getElementById(`rate-serie-${k}`);
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function rataPerId(id) {
    return ((incassiDati && incassiDati.rate) || []).find(r => r.idRata === id);
}

async function chiamaIncassi(parametri) {
    const response = await fetch(`${getAPIUrl()}?${new URLSearchParams(parametri).toString()}`);
    const r = await response.json();
    if (!r.success) throw new Error(r.error || 'Errore sconosciuto');
    return r;
}

async function registraIncassoRata(id) {
    const r = rataPerId(id);
    if (!r) return;
    const oggi = new Date().toLocaleDateString('it-IT');
    const data = prompt(`Rata ${r.nRata}/${r.di} di ${r.nomeCliente} (${euroQodnet(r.lordo)} IVA inclusa).\n\nData dell'incasso (gg/mm/aaaa):`, oggi);
    if (data === null) return;
    const m = data.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) { alert('⚠️ Data non valida'); return; }
    const canale = prompt('Come è arrivato? (Stripe, Bonifico, …)', r.canale || 'Bonifico');
    if (canale === null) return;
    try {
        await chiamaIncassi({ action: 'registra_incasso', id_rata: id,
            data: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, canale: canale.trim() });
        await dopoScritturaIncassi();
        if (confirm('✅ Incasso registrato. Registri subito la fattura?')) fatturaRata(id);
    } catch (e) {
        alert('❌ Errore: ' + e.message);
    }
}

/** Apre la «Nuova fattura» del tab Fatture già compilata; salvandola la rata diventa FATTURATA */
function fatturaRata(id) {
    const r = rataPerId(id);
    if (!r) return;
    if (r.stato === 'PREVISTA' && !confirm('La rata non risulta ancora incassata. Registrare lo stesso la fattura?')) return;
    if (typeof window.switchTab === 'function') window.switchTab('fatture');
    setTimeout(() => {
        if (typeof window.openNuovaFatturaModal !== 'function') { alert('⚠️ Modulo fattura non disponibile'); return; }
        window.openNuovaFatturaModal({
            cliente: r.nomeCliente, imponibile: r.importo, rataId: r.idRata,
            note: `Rata ${r.nRata}/${r.di}${r.idContratto ? ' contratto ' + r.idContratto : ''}${r.descrizione ? ' — ' + r.descrizione : ''}`
        });
    }, 150);
}

async function annullaSerieRate(id, quante) {
    if (!id || !confirm(`Annullare le ${quante} rate ancora previste di questa serie? Le rate già incassate restano.`)) return;
    try {
        await chiamaIncassi({ action: 'annulla_rata', id_rata: id, serie: 'SI' });
        await dopoScritturaIncassi();
    } catch (e) {
        alert('❌ Errore: ' + e.message);
    }
}

// --- Nuove rate (senza contratto, o di un contratto firmato prima dello scadenzario) ---
function openNuoveRate() {
    const modal = document.getElementById('nuoveRateModal');
    if (!modal) return;
    const lista = document.getElementById('nuoveRateClienti');
    if (lista) {
        lista.innerHTML = (window.clients || []).map(c => typeof c === 'string' ? c : (c.name || ''))
            .filter(Boolean).sort((a, b) => a.localeCompare(b, 'it'))
            .map(n => `<option value="${escQodnet(n)}"></option>`).join('');
    }
    document.getElementById('nuoveRateForm').reset();
    document.getElementById('nuoveRatePrima').value = new Date().toISOString().split('T')[0];
    modal.classList.add('active');
}

function closeNuoveRate() {
    const modal = document.getElementById('nuoveRateModal');
    if (modal) modal.classList.remove('active');
}

async function submitNuoveRate(e) {
    e.preventDefault();
    const v = id => document.getElementById(id).value.trim();
    const parametri = { action: 'crea_rate', prima_data: v('nuoveRatePrima'), canale: v('nuoveRateCanale') };
    if (v('nuoveRateContratto')) {
        parametri.id_contratto = v('nuoveRateContratto');
    } else {
        parametri.cliente = v('nuoveRateCliente');
        parametri.n_rate = v('nuoveRateNumero');
        parametri.totale = v('nuoveRateTotale').replace(',', '.');
        parametri.descrizione = v('nuoveRateDescrizione');
        if (!parametri.cliente || !parametri.n_rate || !(parseFloat(parametri.totale) > 0)) {
            alert('⚠️ Indica cliente, numero di rate e totale (oppure un contratto)'); return;
        }
    }
    const btn = document.getElementById('nuoveRateSubmit');
    btn.disabled = true; btn.textContent = 'Creazione...';
    try {
        const r = await chiamaIncassi(parametri);
        closeNuoveRate();
        alert(`✅ ${r.rate} rate da ${euroQodnet(r.rata)} create (${r.serie}).${r.avviso ? '\n⚠️ ' + r.avviso : ''}`);
        await dopoScritturaIncassi();
    } catch (err) {
        alert('❌ Errore: ' + err.message);
    } finally {
        btn.disabled = false; btn.textContent = 'Crea rate';
    }
}

window.loadIncassi = loadIncassi;
window.renderIncassi = renderIncassi;
window.toggleRateSerie = toggleRateSerie;
window.registraIncassoRata = registraIncassoRata;
window.fatturaRata = fatturaRata;
window.annullaSerieRate = annullaSerieRate;
window.openNuoveRate = openNuoveRate;
window.closeNuoveRate = closeNuoveRate;
window.submitNuoveRate = submitNuoveRate;
