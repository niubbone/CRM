// =======================================================================
// === VENDITE > CONTRATTI (servizi Kleos) ===
// =======================================================================
// Contratto composto con le voci del listino: il PDF contiene solo ciò che è
// stato acquistato. Ciclo BOZZA → INVIATO → FIRMATO (pacchetti ore + proforma)
// oppure ANNULLATO. Backend: Backend/Contratti.js (il listino arriva da lì).
// Riusa gli aiutanti QODNET di vendite.js (escQodnet, euroQodnet, isoQodnet, chiamaQodnet).

let contrattiDati = null;      // { contratti, listino }
let contrattoCliente = null;   // anagrafica del cliente scelto nel modulo

function dopoScritturaContratti() {
    window.markTabDirty && window.markTabDirty('vendite');
    riepilogoLoaded.contratti = true;
    return loadContrattiRiepilogo({ forzato: true });
}

async function loadContrattiRiepilogo(opzioni) {
    const container = document.getElementById('contrattiContainer');
    if (!container) return;

    return _crmCacheListe().carica({
        chiave: 'vendite_contratti',
        contenitore: 'contrattiContainer',
        forzato: !!(opzioni && opzioni.forzato),
        aggiorna: () => loadContrattiRiepilogo({ forzato: true }),
        caricamento: () => {
            container.innerHTML = '<div class="loading-scadenze">Caricamento contratti...</div>';
        },
        scarica: async (opzioniFetch) => {
            const response = await fetch(`${getAPIUrl()}?action=get_contratti`, opzioniFetch);
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
            return { contratti: result.contratti || [], listino: result.listino || null };
        },
        mostra: (dati) => {
            contrattiDati = dati;
            renderContratti();
        },
        errore: (error) => {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Errore: ${escQodnet(error.message)}</div></div>`;
        }
    });
}

const STATI_CONTRATTO = {
    BOZZA: { testo: 'Da inviare', classe: 'bozza' },
    INVIATO: { testo: 'Inviato, da firmare', classe: 'inviato' },
    FIRMATO: { testo: 'Firmato', classe: 'firmato' },
    ANNULLATO: { testo: 'Annullato', classe: 'annullato' }
};

function pagamentoContratto(c) {
    if (c.pagamento === 'R12' || c.pagamento === 'R36') {
        return `monte ore in ${c.pagamento === 'R12' ? 12 : 36} rate da ${euroQodnet(c.rata)}`;
    }
    return 'unica soluzione';
}

function cardContratto(c) {
    const s = STATI_CONTRATTO[c.stato] || { testo: c.stato, classe: '' };
    const aperto = c.stato === 'BOZZA' || c.stato === 'INVIATO';
    const voci = (c.voci || []).map(v => `
        <div class="contratto-voce"><span>${escQodnet(v.descrizione)}</span><span>${euroQodnet(v.importo)}</span></div>`).join('');
    const info = [
        `del ${c.data}`,
        `attivazione ${c.dataAttivazione}`,
        pagamentoContratto(c),
        c.dataInvio ? `inviato ${c.dataInvio}` : '',
        c.dataFirma ? `firmato ${c.dataFirma}` : '',
        c.pacchetti ? `pacchetti ${escQodnet(c.pacchetti)}` : '',
        c.proforma ? `proforma ${escQodnet(c.proforma)}` : ''
    ].filter(Boolean).join(' · ');
    const pulsanti = [
        c.pdfUrl ? `<a class="btn-small" href="${c.pdfUrl}" target="_blank" rel="noopener"><i class="fas fa-file-pdf"></i> Contratto</a>` : '',
        c.firmatoUrl ? `<a class="btn-small" href="${c.firmatoUrl}" target="_blank" rel="noopener"><i class="fas fa-file-signature"></i> Firmato</a>` : '',
        aperto ? `<button class="btn-small" onclick="inviaContratto('${c.id}')"><i class="fas fa-envelope"></i> ${c.stato === 'INVIATO' ? 'Reinvia' : 'Invia al cliente'}</button>` : '',
        aperto ? `<button class="btn-small contratto-btn-firma" onclick="openFirmaContratto('${c.id}')"><i class="fas fa-signature"></i> Segna firmato…</button>` : '',
        aperto ? `<button class="btn-small qodnet-btn-elimina" onclick="annullaContratto('${c.id}')"><i class="fas fa-ban"></i> Annulla</button>` : '',
        c.stato === 'ANNULLATO' ? `<button class="btn-small qodnet-btn-elimina" onclick="eliminaContratto('${c.id}')"><i class="fas fa-trash"></i> Elimina</button>` : ''
    ].filter(Boolean).join('');
    return `
        <div class="storico-card contratto-card">
            <div class="contratto-testa">
                <div>
                    <strong>${escQodnet(c.id)}</strong> · ${escQodnet(c.nomeCliente)}
                    <span class="contratto-stato ${s.classe}">${s.testo}</span>
                </div>
                <div class="contratto-totale">${euroQodnet(c.totale)}</div>
            </div>
            <div class="contratto-voci">${voci}</div>
            <small class="contratto-info">${info}</small>
            ${c.note ? `<small class="contratto-info qodnet-arancio">${escQodnet(c.note)}</small>` : ''}
            <div class="contratto-azioni">${pulsanti}</div>
        </div>`;
}

function renderContratti() {
    const container = document.getElementById('contrattiContainer');
    if (!container || !contrattiDati) return;
    const tutti = contrattiDati.contratti;
    const aperti = tutti.filter(c => c.stato === 'BOZZA' || c.stato === 'INVIATO');
    const firmati = tutti.filter(c => c.stato === 'FIRMATO');
    const annullati = tutti.filter(c => c.stato === 'ANNULLATO');

    let html = `<h3 class="qodnet-titolo">Da firmare</h3>`;
    html += aperti.length ? aperti.map(cardContratto).join('')
        : `<div class="empty-state" style="padding:16px;">Nessun contratto in attesa di firma</div>`;
    if (firmati.length) {
        html += `<h3 class="qodnet-titolo">Firmati</h3>` + firmati.map(cardContratto).join('');
    }
    if (annullati.length) {
        html += `<details class="qodnet-dettagli"><summary>Annullati (${annullati.length})</summary>${annullati.map(cardContratto).join('')}</details>`;
    }
    container.innerHTML = html;
}

// -----------------------------------------------------------------------
// Nuovo contratto
// -----------------------------------------------------------------------

async function openContrattoForm(nomeCliente) {
    const modal = document.getElementById('contrattoModal');
    if (!modal) return;
    if (!contrattiDati || !contrattiDati.listino) {
        try {
            await loadContrattiRiepilogo();
        } catch (e) { /* il messaggio d'errore è già nel contenitore */ }
        if (!contrattiDati || !contrattiDati.listino) { alert('❌ Listino non disponibile: riprova tra poco'); return; }
    }

    const datalist = document.getElementById('contratto-client-list');
    if (datalist && datalist.options.length === 0) {
        fetch(`${getAPIUrl()}?action=get_data`)
            .then(r => r.json())
            .then(result => {
                if (result && result.clients) {
                    const nomi = result.clients.map(c => typeof c === 'string' ? c : (c.name || '')).filter(Boolean).sort();
                    datalist.innerHTML = nomi.map(n => `<option value="${escQodnet(n)}">`).join('');
                }
            })
            .catch(() => {});
    }

    const L = contrattiDati.listino;
    document.getElementById('contrattoForm').reset();
    contrattoCliente = null;
    document.getElementById('contrattoAnagrafica').innerHTML = '';
    document.getElementById('contrattoAvvisoAvviamento').textContent = '';
    document.getElementById('contrattoAvviamento').innerHTML = '<option value="">— nessuno —</option>' +
        L.avviamento.map(a => `<option value="${a.codice}">${escQodnet(a.nome)} · ${a.aProgetto ? `${a.utentiDa}+ utenti, a progetto` : `${a.utentiDa}–${a.utentiA} utenti, ${a.ore} h, ${euroQodnet(a.importo)}`}</option>`).join('');
    document.getElementById('contrattoMonteOre').innerHTML = '<option value="">— nessuno —</option>' +
        L.monteOre.map(m => `<option value="${m.ore}">${m.ore} ore · ${euroQodnet(m.tariffa)}/h · ${euroQodnet(m.importo)}</option>`).join('');
    document.getElementById('contrattoAnalisi').innerHTML = '<option value="">— nessuna —</option>' +
        L.analisi.map(a => `<option value="${a.codice}">${escQodnet(a.nome.replace('Analisi e riprogettazione dei processi — ', ''))}${a.aProgetto ? ' · a progetto' : ' · ' + euroQodnet(a.importo)}</option>`).join('');
    document.getElementById('contrattoAttivazione').value = isoQodnet(new Date());
    document.getElementById('contrattoCliente').value = nomeCliente || '';
    aggiornaContrattoForm();
    modal.classList.add('active');
    if (nomeCliente) caricaClienteContratto(); else document.getElementById('contrattoCliente').focus();
}

function closeContrattoModal() {
    document.getElementById('contrattoModal')?.classList.remove('active');
}

const CAMPI_ANAGRAFICA_CONTRATTO = [
    ['indirizzo', 'Indirizzo'], ['cap', 'CAP'], ['citta', 'Città'], ['piva', 'P.IVA'],
    ['cf', 'Codice fiscale'], ['sdi', 'Codice SDI o PEC'], ['email', 'Email'], ['referente', 'Referente']
];

async function caricaClienteContratto() {
    const nome = document.getElementById('contrattoCliente').value.trim();
    const box = document.getElementById('contrattoAnagrafica');
    const avviso = document.getElementById('contrattoAvvisoAvviamento');
    contrattoCliente = null;
    avviso.textContent = '';
    if (!nome) { box.innerHTML = ''; return; }
    box.innerHTML = '<small>Lettura anagrafica...</small>';
    try {
        const r = await chiamaQodnet('get_contratto_cliente', { cliente_nome: nome });
        contrattoCliente = r.cliente;
        const mancanti = CAMPI_ANAGRAFICA_CONTRATTO.filter(([k]) => !String(r.cliente[k] || '').trim());
        box.innerHTML = `
            <div class="contratto-anagrafica">
                ${CAMPI_ANAGRAFICA_CONTRATTO.map(([k, etichetta]) => {
                    const v = String(r.cliente[k] || '').trim();
                    if (v) return `<div><small>${etichetta}</small><div>${escQodnet(v)}</div></div>`;
                    // il referente è facoltativo: niente evidenza arancione
                    return k === 'referente'
                        ? `<div><small>${etichetta} (facoltativo)</small><input type="text" data-campo="${k}" autocomplete="off" style="width:100%;"></div>`
                        : `<div class="contratto-mancante"><small>${etichetta} — da completare</small><input type="text" data-campo="${k}" autocomplete="off"></div>`;
                }).join('')}
            </div>
            <small>${mancanti.length ? 'I campi compilati qui si salvano nella scheda del cliente.' : 'Anagrafica completa.'}</small>`;
        if (r.avviamentoGia) avviso.textContent = `Il cliente ha già un avviamento nel contratto ${r.avviamentoGia}: l'avviamento si acquista una sola volta.`;
    } catch (error) {
        box.innerHTML = `<small class="qodnet-arancio">${escQodnet(error.message)}</small>`;
    }
}

/**
 * Numero di utenti: NON sceglie l'avviamento (si può fare un contratto con il solo
 * monte ore). La fascia giusta compare solo come suggerimento sotto la tendina.
 */
function proponiAvviamentoContratto() {
    aggiornaContrattoForm();
}

/** Scelte del modulo (stesso formato che legge il backend) */
function scelteContratto() {
    const v = id => document.getElementById(id).value;
    return {
        avviamento: v('contrattoAvviamento'),
        ent_ore: v('contrattoEntOre'), ent_importo: v('contrattoEntImporto'),
        postazioni_win: v('contrattoPostWin'), postazioni_mac: v('contrattoPostMac'),
        monte_ore: v('contrattoMonteOre'),
        pagamento: v('contrattoPagamento') || 'UNICA',
        analisi: v('contrattoAnalisi'), analisi_importo: v('contrattoAnalisiImporto')
    };
}

/** Anteprima: stesse regole del backend (che comunque ricalcola tutto) */
function aggiornaContrattoForm() {
    if (!contrattiDati) return;
    const L = contrattiDati.listino;
    const s = scelteContratto();

    document.getElementById('contrattoEntBox').style.display = s.avviamento === 'ENT' ? '' : 'none';
    document.getElementById('contrattoAnalisiImportoBox').style.display = s.analisi === 'AOLTRE' ? '' : 'none';

    // Pagamento: opzioni ammesse per il monte ore scelto
    const monte = L.monteOre.find(m => String(m.ore) === String(s.monte_ore));
    const selPag = document.getElementById('contrattoPagamento');
    const opzioni = [['UNICA', 'Unica soluzione alla sottoscrizione']];
    if (monte) {
        [12, 36].forEach(n => {
            const rata = Math.round(monte.importo / n * 100) / 100;
            if (n === 36 && monte.ore <= 40) return;
            if (rata < L.rataMinima) return;
            opzioni.push([`R${n}`, `${n} rate mensili da ${euroQodnet(rata)}`]);
        });
    }
    const prima = selPag.value;
    selPag.innerHTML = opzioni.map(([val, t]) => `<option value="${val}">${t}</option>`).join('');
    selPag.value = opzioni.some(o => o[0] === prima) ? prima : 'UNICA';
    const nota = document.getElementById('contrattoPagamentoNota');
    nota.textContent = !monte ? 'Le rate valgono solo per il monte ore.'
        : opzioni.length === 1 ? `Niente rate: sotto ${euroQodnet(L.rataMinima)} al mese.` : '';

    // Voci e totale
    const voci = [];
    const a = L.avviamento.find(x => x.codice === s.avviamento);
    if (a) voci.push([a.aProgetto ? `${a.nome} (${s.ent_ore || '?'} h)` : `${a.nome} — ${a.ore} h`, a.aProgetto ? parseFloat(s.ent_importo) || 0 : a.importo]);
    const pw = parseInt(s.postazioni_win, 10) || 0, pm = parseInt(s.postazioni_mac, 10) || 0;
    if (pw) voci.push([`${pw} postazioni Windows in più`, pw * L.postazione.windows]);
    if (pm) voci.push([`${pm} postazioni macOS in più`, pm * L.postazione.mac]);
    if (monte) voci.push([`Monte ore ${monte.ore} h`, monte.importo]);
    const an = L.analisi.find(x => x.codice === s.analisi);
    if (an) voci.push([an.nome.replace('Analisi e riprogettazione dei processi', 'Analisi'), an.aProgetto ? parseFloat(s.analisi_importo) || 0 : an.importo]);

    const totale = voci.reduce((t, x) => t + x[1], 0);
    const rate = selPag.value !== 'UNICA' && monte;
    const subito = totale - (rate ? monte.importo : 0);
    const utenti = parseInt(document.getElementById('contrattoUtenti').value, 10);
    const fascia = utenti && L.avviamento.find(x => utenti >= x.utentiDa && utenti <= x.utentiA);
    const fuoriFascia = a && fascia && fascia.codice !== a.codice;

    document.getElementById('contrattoRiepilogo').innerHTML = voci.length ? `
        ${voci.map(([d, i]) => `<div class="contratto-voce"><span>${escQodnet(d)}</span><span>${euroQodnet(i)}</span></div>`).join('')}
        <div class="contratto-voce contratto-voce-totale"><span>Totale imponibile</span><span>${euroQodnet(totale)}</span></div>
        <small>${rate
            ? `Monte ore in ${selPag.value === 'R12' ? 12 : 36} rate${subito > 0 ? `; alla firma proforma di ${euroQodnet(subito)}` : ''}.`
            : `Alla firma proforma di ${euroQodnet(totale)}.`}</small>
        ${fuoriFascia ? `<small class="qodnet-arancio">Con ${utenti} utenti la fascia di avviamento è ${escQodnet(fascia.nome)}.</small>` : ''}
        ${!a && fascia ? `<small>Senza avviamento. Se servisse, per ${utenti} utenti sarebbe ${escQodnet(fascia.nome)}.</small>` : ''}`
        : '<small>Scegli almeno una voce.</small>';
    document.getElementById('contrattoSubmitBtn').disabled = !voci.length;
}

async function submitContratto(e) {
    e.preventDefault();
    const nome = document.getElementById('contrattoCliente').value.trim();
    if (!nome) return;
    const params = {
        cliente_nome: nome,
        scelte: JSON.stringify(scelteContratto()),
        utenti: document.getElementById('contrattoUtenti').value,
        data_attivazione: document.getElementById('contrattoAttivazione').value,
        condizioni: document.getElementById('contrattoCondizioni').value.trim()
    };
    document.querySelectorAll('#contrattoAnagrafica input[data-campo]').forEach(inp => {
        if (inp.value.trim()) params[inp.dataset.campo] = inp.value.trim();
    });
    if (!params.referente && contrattoCliente) params.referente = contrattoCliente.referente || '';

    const btn = document.getElementById('contrattoSubmitBtn');
    btn.disabled = true; btn.textContent = 'Creazione del PDF...';
    try {
        const r = await chiamaQodnet('crea_contratto', params);
        closeContrattoModal();
        dopoScritturaContratti();
        const extra = r.anagraficaCompletata && r.anagraficaCompletata.length
            ? `\nScheda cliente completata: ${r.anagraficaCompletata.join(', ')}.` : '';
        if (confirm(`✅ Contratto ${r.id} creato per ${r.cliente} (${euroQodnet(r.totale)}).${extra}\n\nAprire il PDF per controllarlo?`)) {
            window.open(r.pdfUrl, '_blank');
        }
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    } finally {
        btn.disabled = false; btn.textContent = 'Crea contratto';
    }
}

// -----------------------------------------------------------------------
// Invio, firma, annullamento
// -----------------------------------------------------------------------

function contrattoPerId(id) {
    return contrattiDati && contrattiDati.contratti.find(c => c.id === id);
}

async function inviaContratto(id) {
    const c = contrattoPerId(id);
    if (!c || !confirm(`Inviare il contratto ${id} a ${c.nomeCliente}?\n\nParte un'email all'indirizzo della scheda cliente, con il contratto e il listino allegati.`)) return;
    try {
        const r = await chiamaQodnet('send_contratto', { id });
        alert(`✅ Contratto ${id} inviato a ${r.destinatario}.` + (r.avvisi && r.avvisi.length ? '\n\n⚠️ ' + r.avvisi.join('\n⚠️ ') : ''));
        dopoScritturaContratti();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    }
}

async function annullaContratto(id) {
    if (!confirm(`Annullare il contratto ${id}? Resta in archivio come annullato.`)) return;
    try {
        await chiamaQodnet('annulla_contratto', { id });
        dopoScritturaContratti();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    }
}

async function eliminaContratto(id) {
    if (!confirm(`Eliminare del tutto il contratto ${id}?\n\nSparisce dall'archivio e il PDF va nel cestino di Drive.`)) return;
    try {
        await chiamaQodnet('elimina_contratto', { id, conferma: 'SI' });
        dopoScritturaContratti();
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    }
}

function openFirmaContratto(id) {
    const c = contrattoPerId(id);
    if (!c) return;
    const rate = c.pagamento === 'R12' || c.pagamento === 'R36';
    const pacchetti = (c.voci || []).filter(v => v.tipo === 'AVVIAMENTO' || v.tipo === 'MONTE_ORE');
    const subito = (c.voci || []).filter(v => !(rate && v.tipo === 'MONTE_ORE')).reduce((t, v) => t + v.importo, 0);
    document.getElementById('contrattoFirmaId').value = id;
    document.getElementById('contrattoFirmaTitolo').textContent = `Contratto ${id} firmato — ${c.nomeCliente}`;
    document.getElementById('contrattoFirmaFile').value = '';
    document.getElementById('contrattoFirmaEffetti').innerHTML = `
        <strong>Alla registrazione il CRM:</strong>
        <ul>
            <li>archivia il file firmato nella cartella dei contratti su Drive;</li>
            ${pacchetti.map(v => `<li>crea il pacchetto ${v.tipo === 'AVVIAMENTO' ? 'avviamento' : 'monte ore'} da ${v.ore} h (${euroQodnet(v.importo)});</li>`).join('')}
            ${subito > 0 ? `<li>emette e invia la proforma di ${euroQodnet(subito)};</li>` : ''}
            ${rate ? `<li>ti ricorda di creare l'abbonamento Stripe da ${euroQodnet(c.rata)} al mese.</li>` : ''}
        </ul>`;
    document.getElementById('contrattoFirmaModal').classList.add('active');
}

function closeFirmaContratto() {
    document.getElementById('contrattoFirmaModal')?.classList.remove('active');
}

function leggiFileBase64(file) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
        fr.onerror = () => reject(new Error('File non leggibile'));
        fr.readAsDataURL(file);
    });
}

async function submitFirmaContratto(e) {
    e.preventDefault();
    const id = document.getElementById('contrattoFirmaId').value;
    const file = document.getElementById('contrattoFirmaFile').files[0];
    if (!file && !confirm('Nessun file firmato scelto. Registrare la firma lo stesso?')) return;
    if (file && file.size > 20 * 1024 * 1024) { alert('❌ File troppo grande (massimo 20 MB)'); return; }

    const btn = document.getElementById('contrattoFirmaSubmitBtn');
    btn.disabled = true; btn.textContent = 'Registrazione...';
    try {
        const params = { action: 'registra_firma_contratto', id };
        if (file) {
            params.file_base64 = await leggiFileBase64(file);
            params.file_nome = file.name;
            params.file_tipo = file.type || 'application/octet-stream';
        }
        const response = await fetch(getAPIUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params)
        });
        const r = await response.json();
        if (!r.success) throw new Error(r.error || 'Errore sconosciuto');

        closeFirmaContratto();
        window.markTabDirty && window.markTabDirty('proforma');
        let msg = `✅ Contratto ${id} firmato.`;
        if (r.pacchetti && r.pacchetti.length) msg += `\nPacchetti creati: ${r.pacchetti.join(', ')}.`;
        if (r.proforma) msg += `\nProforma ${r.proforma} emessa e inviata.`;
        if (r.rate) msg += `\n${r.rate} rate create in Vendite → Incassi (e nel calendario «Incassi»).`;
        if (r.promemoria) msg += `\n\n👉 ${r.promemoria}`;
        if (r.avvisi && r.avvisi.length) msg += '\n\n⚠️ ' + r.avvisi.join('\n⚠️ ');
        alert(msg);
        dopoScritturaContratti();
        if (r.pacchetti && r.pacchetti.length && r.timesheet_in_attesa && r.timesheet_in_attesa.length && window.proponiTimesheetInAttesa) {
            window.proponiTimesheetInAttesa({ id_pacchetto: r.pacchetti[0], timesheet_in_attesa: r.timesheet_in_attesa });
        }
    } catch (error) {
        alert('❌ Errore: ' + error.message);
    } finally {
        btn.disabled = false; btn.textContent = 'Registra firma';
    }
}

/** Dalla scheda cliente: apre Vendite > Contratti con il modulo già sul cliente */
function nuovoContrattoCliente(nomeCliente) {
    if (window.switchTab) window.switchTab('vendite');
    switchVenditeSection('contratti');
    openContrattoForm(nomeCliente);
}

window.loadContrattiRiepilogo = loadContrattiRiepilogo;
window.openContrattoForm = openContrattoForm;
window.closeContrattoModal = closeContrattoModal;
window.caricaClienteContratto = caricaClienteContratto;
window.proponiAvviamentoContratto = proponiAvviamentoContratto;
window.aggiornaContrattoForm = aggiornaContrattoForm;
window.submitContratto = submitContratto;
window.inviaContratto = inviaContratto;
window.annullaContratto = annullaContratto;
window.eliminaContratto = eliminaContratto;
window.openFirmaContratto = openFirmaContratto;
window.closeFirmaContratto = closeFirmaContratto;
window.submitFirmaContratto = submitFirmaContratto;
window.nuovoContrattoCliente = nuovoContrattoCliente;
