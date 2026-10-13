// =======================================================================
// === VENDITE > FERRARI COMPUTERS ===
// =======================================================================
// Vendite hardware Ferrari ai miei clienti: si registrano al volo (cliente,
// data, cosa) e si chiudono quando fatturo le provvigioni a Ferrari.
// Importo e provvigione sono facoltativi: la provvigione si può scrivere anche
// nella finestra della fattura. Backend: Backend/Ferrari.js.
// Riusa gli aiutanti e gli stili QODNET di vendite.js (escQodnet, euroQodnet,
// isoQodnet, chiamaQodnet, proponiNumeroFatturaQodnet, classi .qodnet-*).

let ferrariDati = null;              // { righe, saldo }
let ferrariSelezione = new Set();    // id vendite scelte per la fattura

function dopoScritturaFerrari() {
    window.markTabDirty && window.markTabDirty('vendite');
    riepilogoLoaded.ferrari = true;
    return loadFerrariRiepilogo({ forzato: true });
}

async function loadFerrariRiepilogo(opzioni) {
    const container = document.getElementById('ferrariContainer');
    if (!container) return;

    return _crmCacheListe().carica({
        chiave: 'vendite_ferrari',
        contenitore: 'ferrariContainer',
        forzato: !!(opzioni && opzioni.forzato),
        aggiorna: () => loadFerrariRiepilogo({ forzato: true }),
        caricamento: () => {
            container.innerHTML = '<div class="loading-scadenze">Caricamento vendite Ferrari...</div>';
        },
        scarica: async (opzioniFetch) => {
            const response = await fetch(`${getAPIUrl()}?action=get_ferrari_riepilogo`, opzioniFetch);
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
            return { righe: result.righe || [], saldo: result.saldo || {} };
        },
        mostra: (dati) => {
            ferrariDati = dati;
            const aperte = new Set(dati.righe.filter(r => r.stato !== 'Fatturata').map(r => r.id));
            ferrariSelezione = new Set([...ferrariSelezione].filter(id => aperte.has(id)));
            renderFerrari();
        },
        errore: (error) => {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${escQodnet(error.message)}</div></div>`;
        }
    });
}

function rigaVenditaFerrari(r, conCheckbox) {
    const check = conCheckbox
        ? `<input type="checkbox" class="qodnet-sel" ${ferrariSelezione.has(r.id) ? 'checked' : ''} onchange="selezionaVenditaFerrari('${r.id}', this.checked)">`
        : '';
    const provv = r.provvigione === ''
        ? '<span class="qodnet-arancio" title="Provvigione da scrivere">—</span>'
        : euroQodnet(r.provvigione);
    const dettagli = [r.data, r.importo !== '' ? 'venduto ' + euroQodnet(r.importo) : '', r.note ? escQodnet(r.note) : '']
        .filter(Boolean).join(' · ');
    return `
        <div class="qodnet-voce">
            ${check}
            <div class="qodnet-voce-desc">
                <div><strong>${escQodnet(r.nomeCliente)}</strong> — ${escQodnet(r.descrizione)}</div>
                <small>${dettagli}</small>
            </div>
            <div class="qodnet-voce-importo">${provv}</div>
            ${conCheckbox ? `<button class="qodnet-icona" title="Modifica" onclick="openFerrariForm('${r.id}')"><i class="fas fa-pen"></i></button>` : ''}
        </div>`;
}

function renderFerrari() {
    const container = document.getElementById('ferrariContainer');
    if (!container || !ferrariDati) return;
    const { righe, saldo } = ferrariDati;
    const aperte = righe.filter(r => r.stato !== 'Fatturata');
    const fatturate = righe.filter(r => r.stato === 'Fatturata');

    let html = `
        <div class="qodnet-saldo ferrari-saldo">
            <div class="qodnet-saldo-box principale">
                <div class="qodnet-saldo-label">Da fatturare a Ferrari</div>
                <div class="qodnet-saldo-valore">${saldo.nDaFatturare || 0} vendit${saldo.nDaFatturare === 1 ? 'a' : 'e'}</div>
                <div class="qodnet-saldo-sub">provvigioni note ${euroQodnet(saldo.daFatturare || 0)}${saldo.nSenzaProvvigione ? ` · ${saldo.nSenzaProvvigione} senza provvigione` : ''}</div>
            </div>
            <div class="qodnet-saldo-box">
                <div class="qodnet-saldo-label">Già fatturate</div>
                <div class="qodnet-saldo-valore">${euroQodnet(saldo.fatturate || 0)}</div>
                <div class="qodnet-saldo-sub">${saldo.nFatturate || 0} vendite</div>
            </div>
        </div>`;

    html += `<h3 class="qodnet-titolo">Da fatturare</h3>`;
    if (!aperte.length) {
        html += `<div class="empty-state" style="padding:16px;">Nessuna vendita da fatturare</div>`;
    } else {
        html += `
        <div class="qodnet-barra-fattura">
            <span id="ferrariSelTesto"></span>
            <button class="btn-small" onclick="selezionaTutteFerrari(true)">Tutte</button>
            <button class="btn-small" onclick="selezionaTutteFerrari(false)">Nessuna</button>
            <button class="btn-small qodnet-btn-fattura" id="ferrariBtnFattura" onclick="fatturaFerrariSelezionate()">
                <i class="fas fa-file-invoice"></i> Fattura a Ferrari…
            </button>
        </div>
        <div class="storico-card qodnet-doc">${aperte.map(r => rigaVenditaFerrari(r, true)).join('')}</div>`;
    }

    if (fatturate.length) {
        html += `<details class="qodnet-dettagli qodnet-fatturate"><summary>Già fatturate (${fatturate.length} vendite)</summary>`;
        const perRif = {};
        fatturate.forEach(r => { (perRif[r.rifFattura] = perRif[r.rifFattura] || []).push(r); });
        Object.keys(perRif).sort((a, b) => (perRif[b][0].dataFattura.split('/').reverse().join('')).localeCompare(perRif[a][0].dataFattura.split('/').reverse().join(''))).forEach(rif => {
            const rr = perRif[rif];
            const tot = rr.reduce((s, r) => s + (r.provvigione || 0), 0);
            html += `
            <div class="storico-card qodnet-doc">
                <div class="qodnet-doc-header">
                    <div class="qodnet-doc-titolo">
                        Fattura <strong>${escQodnet(rif)}</strong> · ${euroQodnet(tot)} · ${rr.length} vendit${rr.length === 1 ? 'a' : 'e'}
                        <small>${rr[0].dataFattura}</small>
                    </div>
                    <button class="btn-small" onclick="annullaFatturazioneFerrari('${escQodnet(rif)}')"><i class="fas fa-rotate-left"></i> Annulla</button>
                </div>
                ${rr.map(r => rigaVenditaFerrari(r, false)).join('')}
            </div>`;
        });
        html += `</details>`;
    }

    container.innerHTML = html;
    aggiornaSelezioneFerrari();
}

function selezionaVenditaFerrari(id, on) {
    if (on) ferrariSelezione.add(id); else ferrariSelezione.delete(id);
    aggiornaSelezioneFerrari();
}

function selezionaTutteFerrari(tutte) {
    ferrariSelezione = new Set(tutte ? ferrariDati.righe.filter(r => r.stato !== 'Fatturata').map(r => r.id) : []);
    renderFerrari();
}

function aggiornaSelezioneFerrari() {
    const testo = document.getElementById('ferrariSelTesto');
    const btn = document.getElementById('ferrariBtnFattura');
    if (!testo || !ferrariDati) return;
    const scelte = ferrariDati.righe.filter(r => ferrariSelezione.has(r.id));
    const tot = scelte.reduce((s, r) => s + (r.provvigione || 0), 0);
    testo.innerHTML = scelte.length ? `Scelte <strong>${scelte.length}</strong> · <strong>${euroQodnet(tot)}</strong>` : 'Scegli le vendite da fatturare';
    if (btn) btn.disabled = !scelte.length;
}

// -----------------------------------------------------------------------
// Registra / modifica vendita
// -----------------------------------------------------------------------

function openFerrariForm(id) {
    const modal = document.getElementById('ferrariModal');
    if (!modal) return;

    const datalist = document.getElementById('ferrari-client-list');
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

    const form = document.getElementById('ferrariForm');
    form.reset();
    const r = id && ferrariDati ? ferrariDati.righe.find(x => x.id === id) : null;
    document.getElementById('ferrariId').value = r ? r.id : '';
    document.getElementById('ferrariTitolo').textContent = r ? 'Modifica vendita Ferrari' : 'Registra vendita Ferrari';
    document.getElementById('ferrariCliente').value = r ? r.nomeCliente : '';
    document.getElementById('ferrariData').value = r ? r.dataIso : isoQodnet(new Date());
    document.getElementById('ferrariDescrizione').value = r ? r.descrizione : '';
    document.getElementById('ferrariImporto').value = r && r.importo !== '' ? r.importo : '';
    document.getElementById('ferrariProvvigione').value = r && r.provvigione !== '' ? r.provvigione : '';
    document.getElementById('ferrariNote').value = r ? r.note : '';
    document.getElementById('ferrariBtnElimina').style.display = r ? '' : 'none';
    modal.classList.add('active');
    document.getElementById(r ? 'ferrariDescrizione' : 'ferrariCliente').focus();
}

function closeFerrariModal() {
    document.getElementById('ferrariModal')?.classList.remove('active');
}

async function submitFerrari(e) {
    e.preventDefault();
    const id = document.getElementById('ferrariId').value;
    const params = {
        cliente_nome: document.getElementById('ferrariCliente').value.trim(),
        data_vendita: document.getElementById('ferrariData').value,
        descrizione: document.getElementById('ferrariDescrizione').value.trim(),
        importo: document.getElementById('ferrariImporto').value,
        provvigione: document.getElementById('ferrariProvvigione').value,
        note: document.getElementById('ferrariNote').value.trim()
    };
    if (id) params.id = id;

    const btn = document.getElementById('ferrariSubmitBtn');
    btn.disabled = true; btn.textContent = 'Salvataggio...';
    try {
        await chiamaQodnet(id ? 'aggiorna_vendita_ferrari' : 'insert_vendita_ferrari', params);
        closeFerrariModal();
        dopoScritturaFerrari();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    } finally {
        btn.disabled = false; btn.textContent = 'Salva';
    }
}

async function eliminaVenditaFerrari() {
    const id = document.getElementById('ferrariId').value;
    if (!id || !confirm('Eliminare questa vendita?')) return;
    try {
        await chiamaQodnet('elimina_vendita_ferrari', { id });
        closeFerrariModal();
        dopoScritturaFerrari();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    }
}

// -----------------------------------------------------------------------
// Fattura provvigioni a Ferrari
// -----------------------------------------------------------------------

function fatturaFerrariSelezionate() {
    const scelte = ferrariDati.righe.filter(r => ferrariSelezione.has(r.id));
    if (!scelte.length) return;

    document.getElementById('ferrariFatturaVoci').innerHTML = scelte.map(r => `
        <label class="qodnet-fattura-voce">
            <input type="checkbox" class="ferrari-fattura-cb" value="${r.id}" checked onchange="aggiornaTotaliFatturaFerrari(false)">
            <span>${escQodnet(r.nomeCliente)} — ${escQodnet(r.descrizione)} <small>${r.data}${r.importo !== '' ? ' · venduto ' + euroQodnet(r.importo) : ''}</small></span>
            <input type="number" class="ferrari-fattura-provv" data-id="${r.id}" step="0.01" min="0" placeholder="provv. €"
                   value="${r.provvigione !== '' ? r.provvigione : ''}" oninput="aggiornaTotaliFatturaFerrari(false)" style="width:100px;">
        </label>`).join('');

    const imp = document.getElementById('ferrariFatturaImponibile');
    delete imp.dataset.manuale;
    aggiornaTotaliFatturaFerrari(false);
    document.getElementById('ferrariFatturaData').value = isoQodnet(new Date());
    const numero = document.getElementById('ferrariFatturaNumero');
    numero.value = '';
    proponiNumeroFatturaQodnet(numero);
    document.getElementById('ferrariFatturaModal').classList.add('active');
    const primaVuota = document.querySelector('.ferrari-fattura-provv[value=""]');
    (primaVuota || numero).focus();
}

/** Vendite spuntate con la provvigione scritta nella finestra */
function voceFatturaFerrari() {
    return [...document.querySelectorAll('.ferrari-fattura-cb:checked')].map(cb => {
        const input = document.querySelector(`.ferrari-fattura-provv[data-id="${cb.value}"]`);
        return { id: cb.value, provvigione: input ? input.value : '' };
    });
}

function aggiornaTotaliFatturaFerrari(daImponibile) {
    const imp = document.getElementById('ferrariFatturaImponibile');
    const voci = voceFatturaFerrari();
    const mancanti = voci.filter(v => !(parseFloat(v.provvigione) > 0)).length;
    const somma = Math.round(voci.reduce((s, v) => s + (parseFloat(v.provvigione) || 0), 0) * 100) / 100;
    if (daImponibile) imp.dataset.manuale = imp.value === '' ? '' : '1';
    if (!imp.dataset.manuale) imp.value = somma ? somma.toFixed(2) : '';

    const fatturato = parseFloat(imp.value) || 0;
    const iva = Math.round(fatturato * 22) / 100;
    const ritenuta = Math.round(fatturato * 20) / 100;
    const netto = Math.round((fatturato + iva - ritenuta) * 100) / 100;
    const diff = Math.round((fatturato - somma) * 100) / 100;
    document.getElementById('ferrariFatturaRiepilogo').innerHTML =
        `<strong>${voci.length} vendite</strong> per ${euroQodnet(somma)} di provvigioni` +
        (mancanti ? ` <span class="qodnet-arancio">(${mancanti} senza provvigione)</span>` : '') + '<br>' +
        `Imponibile <strong>${euroQodnet(fatturato)}</strong> + IVA 22% ${euroQodnet(iva)} − ritenuta 20% ${euroQodnet(ritenuta)} = <strong>${euroQodnet(netto)}</strong> netto a pagare` +
        (Math.abs(diff) >= 0.01 ? `<br><span class="qodnet-arancio">Differenza rispetto alle provvigioni: ${diff > 0 ? '+' : ''}${euroQodnet(diff)}</span>` : '');
    document.getElementById('ferrariFatturaSubmitBtn').disabled = !voci.length || mancanti > 0 || fatturato <= 0;
}

function closeFerrariFatturaModal() {
    document.getElementById('ferrariFatturaModal')?.classList.remove('active');
}

async function submitFerrariFattura(e) {
    e.preventDefault();
    const voci = voceFatturaFerrari();
    const nFattura = document.getElementById('ferrariFatturaNumero').value.trim();
    const data = document.getElementById('ferrariFatturaData').value;
    const imponibile = document.getElementById('ferrariFatturaImponibile').value;
    if (!voci.length || !nFattura || !data || !(parseFloat(imponibile) > 0)) return;

    const provvigioni = {};
    voci.forEach(v => provvigioni[v.id] = v.provvigione);
    const btn = document.getElementById('ferrariFatturaSubmitBtn');
    btn.disabled = true; btn.textContent = 'Registrazione...';
    try {
        const result = await chiamaQodnet('fattura_provvigioni_ferrari', {
            ids: voci.map(v => v.id).join(','), provvigioni: JSON.stringify(provvigioni),
            n_fattura: nFattura, data_fattura: data, imponibile
        });
        ferrariSelezione.clear();
        closeFerrariFatturaModal();
        window.markTabDirty && window.markTabDirty('fatture');
        alert(result.fatturaEsistente
            ? `✅ ${result.vendite} vendite collegate alla fattura ${nFattura} già presente nel tab Fatture.` + (result.avviso ? `\n\n⚠️ ${result.avviso}` : '')
            : `✅ Fattura ${nFattura} registrata: imponibile ${euroQodnet(result.imponibile)} a ${result.intestatario} (${result.vendite} vendite).`);
        dopoScritturaFerrari();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    } finally {
        btn.disabled = false; btn.textContent = 'Registra fattura';
    }
}

async function annullaFatturazioneFerrari(rif) {
    if (!confirm(`Annullare la fatturazione ${rif}?\n\nLe vendite tornano da fatturare. La fattura nel tab Fatture viene eliminata se l'hai creata da qui e non è incassata; se l'avevi inserita a mano resta.`)) return;
    try {
        const result = await chiamaQodnet('annulla_fatturazione_ferrari', { rif });
        window.markTabDirty && window.markTabDirty('fatture');
        alert(`✅ ${result.vendite} vendite tornate da fatturare.` + (result.fatturaEliminata ? `\nFattura ${rif} eliminata dal tab Fatture.` : `\nLa fattura ${rif} è rimasta nel tab Fatture.`));
        dopoScritturaFerrari();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    }
}
