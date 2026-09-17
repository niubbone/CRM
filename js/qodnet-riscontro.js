// =======================================================================
// === QODNET — Riscontro con il report provvigioni e con il pannello ===
// =======================================================================
// Tutto il confronto avviene qui nel browser sui dati già letti da
// get_qodnet_riepilogo (vendite.js → qodnetDati). Il server serve solo per
// salvare le correzioni scelte e gli abbinamenti clienti (get/salva_qodnet_config).
//
// Report: si carica il PDF (letto con pdf.js, scaricato solo quando serve)
// oppure se ne incolla il testo.
// Pannello: si copia la tabella Area Rivenditori → Ordini → Prodotti/Servizi.

const QodnetRiscontro = (() => {

    const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    let config = null;          // { clientiReport, clientiPannello, ignorati }
    let clientiCRM = [];        // nomi anagrafica
    let ultimoReport = null;    // documenti letti dal report
    let ultimoPannello = null;  // servizi letti dal pannello
    const clientiScelti = {};   // documento del report → cliente CRM scritto a mano

    // -------------------------------------------------------------------
    // Utilità
    // -------------------------------------------------------------------

    const esc = s => (s === null || s === undefined ? '' : String(s))
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const euro = n => (n === '' || n === null || n === undefined || isNaN(n)) ? '—'
        : '€ ' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const numeroIt = s => {
        if (s === undefined || s === null) return '';
        const t = String(s).replace(/[€\s]/g, '');
        if (!t || t === '-') return '';
        // «1.404,00» (italiano) oppure «1404.00» (pannello)
        const n = t.includes(',') ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t.replace(/,/g, ''));
        return isNaN(n) ? '' : n;
    };

    const dmyToIso = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
    const isoToDmy = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
    const norm = s => (s || '').toString().toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();

    /** Chiave voce: prodotto e dettaglio insieme, così «Sito web caldart-arrigo.it» = «Sito web» + «caldart-arrigo.it» */
    const chiaveVoce = (prodotto, dettaglio) => norm(`${prodotto} ${dettaglio || ''}`.replace(/ - /g, ' '));

    /** Famiglia di prodotto: i nomi del pannello e del report non coincidono sempre */
    function famiglia(prodotto) {
        const p = norm(prodotto);
        if (/mailfort|libraesva/.test(p)) return 'mailfort';
        if (/defender/.test(p)) return 'defender';
        if (/exchange online plan 1/.test(p)) return 'exchange1';
        if (/exchange online plan 2/.test(p)) return 'exchange2';
        if (/business basic/.test(p)) return 'm365basic';
        if (/business standard/.test(p)) return 'm365standard';
        if (/business premium/.test(p)) return 'm365premium';
        if (/apps for business/.test(p)) return 'm365apps';
        if (/gestione completa wordpress/.test(p)) return 'wpgestione';
        if (/hosting|wordpress professional|wordpress essential/.test(p)) return 'hosting';
        if (/dominio|dns/.test(p)) return 'dominio';
        return p;
    }

    /** Separa «Web Hosting Essential - caldart-arrigo.it» in prodotto e dominio */
    function separaDettaglio(testo) {
        const m = /^(.*\S) - ([a-z0-9][a-z0-9.-]*\.[a-z]{2,})$/i.exec(testo.trim());
        return m ? { prodotto: m[1], dettaglio: m[2] } : { prodotto: testo.trim(), dettaglio: '' };
    }

    /** Il nome più simile tra quelli dell'anagrafica (parole in comune), o '' */
    function suggerisciCliente(nome) {
        const parole = s => norm(s).replace(/[^a-z0-9àèéìòù ]/g, ' ').split(' ')
            .filter(w => w.length > 2 && !['avv', 'studio', 'legale', 'associato', 'associati', 'dott', 'srl', 'snc', 'sas', 'spa', 'societa', 'società', 'cooperativa'].includes(w));
        const cercate = parole(nome);
        let migliore = '', punti = 0;
        clientiCRM.forEach(c => {
            const pc = parole(c);
            const comuni = cercate.filter(w => pc.includes(w)).length;
            const score = comuni / Math.max(pc.length, 1);
            if (comuni > 0 && score > punti) { punti = score; migliore = c; }
        });
        return migliore;
    }

    async function chiama(action, params) {
        const qs = Object.keys(params || {}).map(k => `${k}=${encodeURIComponent(params[k] ?? '')}`).join('&');
        const response = await fetch(`${getAPIUrl()}?action=${action}${qs ? '&' + qs : ''}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');
        return result;
    }

    async function assicuraConfig() {
        if (!config) config = (await chiama('get_qodnet_config')).config;
        if (!clientiCRM.length) {
            const r = await (await fetch(`${getAPIUrl()}?action=get_data`)).json();
            clientiCRM = ((r && r.clients) || []).map(c => typeof c === 'string' ? c : (c.name || '')).filter(Boolean).sort();
        }
    }

    async function salvaConfig(parziale) {
        const r = await chiama('salva_qodnet_config', { config: JSON.stringify(parziale) });
        config = r.config;
    }

    function datalistClienti() {
        let dl = document.getElementById('qodnet-riscontro-clienti');
        if (!dl) {
            dl = document.createElement('datalist');
            dl.id = 'qodnet-riscontro-clienti';
            document.body.appendChild(dl);
        }
        dl.innerHTML = clientiCRM.map(n => `<option value="${esc(n)}">`).join('');
    }

    // -------------------------------------------------------------------
    // Lettura del report
    // -------------------------------------------------------------------

    /**
     * Testo del report (estratto dal PDF o incollato) → documenti con voci.
     * @returns {{ documenti: Array, totaleDichiarato: number|'' }}
     */
    function leggiReport(testo) {
        let t = ' ' + (testo || '').replace(/ /g, ' ').replace(/\s+/g, ' ') + ' ';
        const totaleDichiarato = numeroIt((/TOTALE COMPLESSIVO DA RICONOSCERE\s*(€\s*[\d.,]+)/i.exec(t) || [])[1]);
        t = t.replace(/Prospetto provvigioni - .*? Pagina \d+/gi, ' ')
             .replace(/Servizio Periodo Imponibile % Provvigione/gi, ' ')
             .replace(/Subtotale € [\d.,]+/gi, ' ');

        const reDoc = /(\S+) - ([^€%]+?) - Data: (\d{2}\/\d{2}\/\d{4}) - Stato: (NON PAGATA|PAGATA)/gi;
        const intestazioni = [];
        let m;
        while ((m = reDoc.exec(t))) {
            intestazioni.push({ inizio: m.index, fine: reDoc.lastIndex, documento: m[1], cliente: m[2].trim(), data: m[3], pagato: m[4].toUpperCase() === 'PAGATA' });
        }

        const reVoce = /(?:^|\s)(?:(\d+) x )?(\S.*?) (\d{2}\/\d{2}\/\d{4} - \d{2}\/\d{2}\/\d{4}|Una tantum) (€ [\d.,]+|-) (\d+(?:[.,]\d+)?)% € ([\d.,]+)/gi;
        const documenti = intestazioni.map((h, i) => {
            const pezzo = t.slice(h.fine, i + 1 < intestazioni.length ? intestazioni[i + 1].inizio : t.length);
            const voci = [];
            let v;
            reVoce.lastIndex = 0;
            while ((v = reVoce.exec(pezzo))) {
                const { prodotto, dettaglio } = separaDettaglio(v[2]);
                const periodo = /una tantum/i.test(v[3]) ? null : v[3].split(' - ');
                voci.push({
                    quantita: v[1] ? parseInt(v[1]) : 1,
                    prodotto, dettaglio,
                    inizio: periodo ? dmyToIso(periodo[0]) : '',
                    fine: periodo ? dmyToIso(periodo[1]) : '',
                    imponibile: numeroIt(v[4]),
                    percentuale: numeroIt(v[5]),
                    provvigione: numeroIt(v[6])
                });
            }
            return {
                documento: h.documento, cliente: h.cliente, data: dmyToIso(h.data), pagato: h.pagato, voci,
                totale: Math.round(voci.reduce((s, x) => s + x.provvigione, 0) * 100) / 100
            };
        });
        return { documenti, totaleDichiarato };
    }

    async function testoDaPdf(file) {
        if (!window.pdfjsLib) {
            await new Promise((ok, ko) => {
                const s = document.createElement('script');
                s.src = PDFJS_URL; s.onload = ok;
                s.onerror = () => ko(new Error('Non riesco a scaricare il lettore PDF: serve la connessione'));
                document.head.appendChild(s);
            });
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        }
        const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        let testo = '';
        for (let p = 1; p <= pdf.numPages; p++) {
            const c = await (await pdf.getPage(p)).getTextContent();
            testo += c.items.map(i => i.str).join(' ') + ' ';
        }
        return testo;
    }

    // -------------------------------------------------------------------
    // Lettura della tabella del pannello
    // -------------------------------------------------------------------

    /**
     * Tabella Prodotti/Servizi copiata dal pannello → servizi.
     * Righe separate da tabulazioni (copia della tabella) oppure testo libero.
     */
    function leggiPannello(testo) {
        const servizi = [];
        const aggiungi = (id, prodotto, dominio, idCliente, nome, prezzo, ciclo, stato, scadenza) => servizi.push({
            id: String(id).trim(), prodotto: prodotto.trim(), dominio: (dominio || '').trim(),
            idCliente: String(idCliente).trim(), nomeCliente: nome.trim(),
            prezzo: numeroIt(prezzo), ciclo: (ciclo || '').trim(), stato: (stato || '').trim(), scadenza: scadenza
        });

        const righe = (testo || '').split(/\r?\n/);
        if (righe.some(r => r.split('\t').length >= 8)) {
            righe.forEach(r => {
                const c = r.split('\t').map(x => x.trim());
                if (c.length < 8 || !/^\d+$/.test(c[0])) return;
                const cli = /^#?(\d+)\s+(.*)$/.exec(c[3]);
                const scad = /(\d{4}-\d{2}-\d{2})/.exec(c[7]);
                if (!cli || !scad) return;
                aggiungi(c[0], c[1], c[2], cli[1], cli[2], c[4], c[5], c[6], scad[1]);
            });
            return servizi;
        }

        const t = ' ' + (testo || '').replace(/\s+/g, ' ') + ' ';
        const re = / (\d+) (.+?) (?:([a-z0-9][a-z0-9.-]*\.[a-z]{2,}) )?#(\d+) (.+?) €\s?([\d.,]+)(?: EUR)? (\S+) (\S+(?: \S+)?) (\d{4}-\d{2}-\d{2})/gi;
        let m;
        while ((m = re.exec(t))) aggiungi(m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9]);
        return servizi;
    }

    // -------------------------------------------------------------------
    // Confronto report ↔ CRM
    // -------------------------------------------------------------------

    function confrontaReport(report, dati) {
        const righe = dati.righe || [];
        const perDoc = {};
        righe.forEach(r => { if (r.documento) (perDoc[norm(r.documento)] = perDoc[norm(r.documento)] || []).push(r); });
        const docReport = new Set(report.documenti.map(d => norm(d.documento)));

        const esiti = report.documenti.map(d => {
            const crm = perDoc[norm(d.documento)] || [];
            if (!crm.length) {
                const cliente = clientiScelti[d.documento] || config.clientiReport[d.cliente] || suggerisciCliente(d.cliente);
                return { tipo: 'nuovo', doc: d, clienteProposto: cliente, abbinamentoSalvato: !!config.clientiReport[d.cliente] };
            }

            const liberi = crm.slice();
            // 1) stessa voce e stesso periodo  2) stessa voce  3) stesso prodotto
            //    con il dominio indicato solo da una delle due parti
            const stessaVoce = (r, v, livello) => livello < 3
                ? chiaveVoce(r.prodotto, r.dettaglio) === chiaveVoce(v.prodotto, v.dettaglio)
                : (!r.dettaglio || !v.dettaglio) && [r.prodotto, chiaveVoce(r.prodotto, r.dettaglio)].map(norm)
                    .some(a => [v.prodotto, chiaveVoce(v.prodotto, v.dettaglio)].map(norm).includes(a));
            const prendi = (voce, livello) => {
                const i = liberi.findIndex(r => stessaVoce(r, voce, livello)
                    && (livello !== 1 || (r.inizioIso || '') === voce.inizio));
                return i === -1 ? null : liberi.splice(i, 1)[0];
            };
            const voci = d.voci.map(v => ({ v, r: prendi(v, 1) }));
            [2, 3].forEach(livello => voci.forEach(x => { if (!x.r) x.r = prendi(x.v, livello); }));

            const differenze = [];
            voci.forEach(({ v, r }) => {
                if (!r) { differenze.push({ tipo: 'manca', v }); return; }
                const diverse = [];
                if (Math.abs((r.provvigione || 0) - v.provvigione) > 0.005) diverse.push(`provvigione ${euro(r.provvigione)} → ${euro(v.provvigione)}`);
                if ((r.inizioIso || '') !== v.inizio || (r.fineIso || '') !== v.fine) diverse.push(`periodo ${r.unaTantum ? 'una tantum' : r.inizio + ' → ' + r.fine} → ${v.inizio ? isoToDmy(v.inizio) + ' → ' + isoToDmy(v.fine) : 'una tantum'}`);
                if (v.imponibile !== '' && (r.imponibile === '' || Math.abs(r.imponibile - v.imponibile) > 0.005)) diverse.push(`imponibile ${euro(r.imponibile)} → ${euro(v.imponibile)}`);
                if ((r.quantita || 1) !== v.quantita) diverse.push(`quantità ${r.quantita || 1} → ${v.quantita}`);
                if (diverse.length) differenze.push({ tipo: 'diversa', v, r, diverse });
            });
            liberi.forEach(r => differenze.push({ tipo: 'solo-crm', r }));

            const statoCrm = crm[0].statoDocumento === 'Pagato';
            if (d.pagato && !statoCrm) differenze.unshift({ tipo: 'pagato', ids: crm.map(r => r.id) });
            const giaFatturate = crm.filter(r => r.statoProvvigione === 'Fatturata').length;

            return { tipo: differenze.length ? 'differenze' : 'ok', doc: d, crm, differenze, giaFatturate };
        });

        // Voci da fatturare nel CRM il cui documento non è in questo report
        const assenti = righe.filter(r => r.documento && r.statoProvvigione !== 'Fatturata' && !docReport.has(norm(r.documento)));
        return { esiti, assenti };
    }

    // -------------------------------------------------------------------
    // Confronto pannello ↔ CRM
    // -------------------------------------------------------------------

    function confrontaPannello(servizi, dati) {
        const serviziCRM = (dati.servizi || []).filter(s => s.stato !== 'Annullato' && s.stato !== 'Sostituito');
        const nomePerId = {};
        (dati.righe || []).forEach(r => { nomePerId[r.idCliente] = r.nomeCliente; });

        const clientiPannello = {};
        servizi.forEach(s => {
            if (!clientiPannello[s.idCliente]) {
                const salvato = config.clientiPannello[s.idCliente];
                clientiPannello[s.idCliente] = { id: s.idCliente, nome: s.nomeCliente, crm: salvato || suggerisciCliente(s.nomeCliente), salvato: !!salvato };
            }
        });

        const usati = new Set();
        const esiti = servizi.map(s => {
            if (config.ignorati[s.id]) return { tipo: 'ignorato', s, motivo: config.ignorati[s.id] };
            const crmNome = clientiPannello[s.idCliente].crm;
            const candidati = serviziCRM.filter(c => !usati.has(c.chiave) && norm(c.nomeCliente) === norm(crmNome) && famiglia(c.prodotto) === famiglia(s.prodotto));
            let c = candidati.find(x => s.dominio && norm(x.dettaglio) === norm(s.dominio))
                 || candidati.find(x => !s.dominio || !x.dettaglio)
                 || (['hosting', 'dominio'].includes(famiglia(s.prodotto)) ? null : candidati[0]);
            if (!c) return { tipo: 'senza-provvigione', s };
            usati.add(c.chiave);

            // Prossima scadenza nel pannello = giorno dopo la fine del periodo in corso
            const d = new Date(s.scadenza + 'T00:00:00'); d.setDate(d.getDate() - 1);
            const fineAttesa = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const fineCrm = dmyToIso(c.coperturaFino);
            const scarto = Math.round((new Date(fineAttesa) - new Date(fineCrm)) / 86400000);
            if (scarto > 7) return { tipo: 'rinnovato-scoperto', s, c, fineAttesa };
            return { tipo: 'ok', s, c, scarto };
        });

        // Servizi seguiti nel CRM, di clienti presenti nel pannello, che il pannello non ha più
        const clientiAbbinati = new Set(Object.values(clientiPannello).map(x => norm(x.crm)).filter(Boolean));
        const soloCrm = serviziCRM.filter(c => !usati.has(c.chiave) && clientiAbbinati.has(norm(c.nomeCliente)));

        return { esiti, soloCrm, clientiPannello: Object.values(clientiPannello) };
    }

    // -------------------------------------------------------------------
    // Interfaccia
    // -------------------------------------------------------------------

    function contenitore() { return document.getElementById('qodnetRiscontroRisultato'); }

    function messaggio(html, tipo) {
        const box = contenitore();
        if (box) box.innerHTML = `<div class="qodnet-riscontro-msg ${tipo || ''}">${html}</div>`;
    }

    async function datiCRM(forzato) {
        if (!qodnetDati || forzato) await loadQodnetRiepilogo({ forzato: !!forzato });
        if (!qodnetDati) throw new Error('Registro QODNET non disponibile');
        return qodnetDati;
    }

    async function caricaPdf(input) {
        const file = input.files && input.files[0];
        input.value = '';
        if (!file) return;
        messaggio('Lettura del PDF...');
        try {
            analizzaReport(await testoDaPdf(file));
        } catch (e) {
            messaggio('❌ ' + esc(e.message), 'errore');
        }
    }

    async function analizza() {
        const testo = (document.getElementById('qodnetRiscontroTesto')?.value || '').trim();
        if (!testo) { messaggio('Carica il PDF del report oppure incolla il testo del report o della tabella del pannello.'); return; }
        if (/Stato: (NON )?PAGATA/i.test(testo)) return analizzaReport(testo);
        return analizzaPannello(testo);
    }

    async function analizzaReport(testo) {
        messaggio('Confronto con il registro...');
        try {
            await assicuraConfig();
            datalistClienti();
            const report = leggiReport(testo);
            if (!report.documenti.length) { messaggio('Non trovo documenti nel testo: è il «Prospetto unico provvigioni» di QODNET?', 'errore'); return; }
            ultimoReport = report;
            ultimoPannello = null;
            renderReport(confrontaReport(report, await datiCRM()), report);
        } catch (e) {
            messaggio('❌ ' + esc(e.message), 'errore');
        }
    }

    async function analizzaPannello(testo) {
        messaggio('Confronto con il registro...');
        try {
            await assicuraConfig();
            datalistClienti();
            const servizi = leggiPannello(testo);
            if (!servizi.length) { messaggio('Non trovo servizi: copia la tabella Area Rivenditori → Ordini → Prodotti/Servizi (con 100 elementi per pagina).', 'errore'); return; }
            ultimoPannello = servizi;
            ultimoReport = null;
            renderPannello(confrontaPannello(servizi, await datiCRM()));
        } catch (e) {
            messaggio('❌ ' + esc(e.message), 'errore');
        }
    }

    async function rianalizza() {
        await datiCRM(true);
        if (ultimoReport) renderReport(confrontaReport(ultimoReport, qodnetDati), ultimoReport);
        else if (ultimoPannello) renderPannello(confrontaPannello(ultimoPannello, qodnetDati));
    }

    const rigaVoce = v => `${v.quantita > 1 ? v.quantita + ' x ' : ''}${esc(v.prodotto)}${v.dettaglio ? ` <small>— ${esc(v.dettaglio)}</small>` : ''}
        <small>${v.inizio ? isoToDmy(v.inizio) + ' → ' + isoToDmy(v.fine) : 'Una tantum'} · imp. ${euro(v.imponibile)} · ${v.percentuale}%</small>`;

    function renderReport({ esiti, assenti }, report) {
        const box = contenitore();
        const nuovi = esiti.filter(e => e.tipo === 'nuovo');
        const diff = esiti.filter(e => e.tipo === 'differenze');
        const ok = esiti.filter(e => e.tipo === 'ok');
        const somma = Math.round(report.documenti.reduce((s, d) => s + d.totale, 0) * 100) / 100;
        const quadra = report.totaleDichiarato === '' || Math.abs(somma - report.totaleDichiarato) < 0.01;

        let html = `
        <div class="qodnet-riscontro-sintesi">
            <strong>Report:</strong> ${report.documenti.length} documenti, ${report.documenti.reduce((s, d) => s + d.voci.length, 0)} voci, ${euro(somma)}
            ${quadra ? '✅ quadra con il totale del report' : `<span class="qodnet-rosso">⚠️ il totale del report è ${euro(report.totaleDichiarato)}: alcune voci non sono state lette, controlla a mano</span>`}
            <div class="qodnet-contatori">
                <span class="qodnet-badge scoperto">${nuovi.length} documenti nuovi</span>
                <span class="qodnet-badge inscadenza">${diff.length} con differenze</span>
                <span class="qodnet-badge coperto">${ok.length} uguali</span>
                <span class="qodnet-badge chiuso">${assenti.length} voci del CRM assenti dal report</span>
            </div>
        </div>`;

        nuovi.forEach((e, i) => {
            const idx = esiti.indexOf(e);
            const clienteCrm = e.clienteProposto;
            const conferme = proponiConferme(e.doc, clienteCrm);
            html += `
            <div class="storico-card qodnet-doc">
                <div class="qodnet-doc-header">
                    <div class="qodnet-doc-titolo"><strong>${esc(e.doc.documento)}</strong> · ${esc(e.doc.cliente)} <small>${isoToDmy(e.doc.data)} · ${e.doc.pagato ? 'Pagato' : 'Non pagato'}</small></div>
                    <span class="qodnet-badge scoperto">Nuovo</span>
                </div>
                ${e.doc.voci.map((v, j) => `<div class="qodnet-voce"><div class="qodnet-voce-desc">${rigaVoce(v)}
                    ${conferme[j] ? `<small class="qodnet-arancio">conferma la vendita registrata ${esc(conferme[j].id)}</small>` : ''}</div>
                    <div class="qodnet-voce-importo">${euro(v.provvigione)}</div></div>`).join('')}
                <div class="qodnet-riscontro-azione">
                    <label>Cliente nel CRM
                        <input type="text" list="qodnet-riscontro-clienti" id="qodnetRiscCliente${idx}" value="${esc(clienteCrm)}" placeholder="Scegli il cliente"
                               onchange="QodnetRiscontro.aggiornaConferme(${idx})">
                    </label>
                    <button class="btn-small qodnet-btn-fattura" onclick="QodnetRiscontro.importaDocumento(${idx}, this)"><i class="fas fa-download"></i> Registra ${euro(e.doc.totale)}</button>
                </div>
            </div>`;
        });

        diff.forEach(e => {
            const idx = esiti.indexOf(e);
            html += `
            <div class="storico-card qodnet-doc">
                <div class="qodnet-doc-header">
                    <div class="qodnet-doc-titolo"><strong>${esc(e.doc.documento)}</strong> · ${esc(e.crm[0].nomeCliente)} <small>${isoToDmy(e.doc.data)}${e.giaFatturate ? ` · ${e.giaFatturate} voci già fatturate da te` : ''}</small></div>
                    <span class="qodnet-badge inscadenza">Differenze</span>
                </div>
                ${e.differenze.map((x, j) => {
                    if (x.tipo === 'pagato') return `<div class="qodnet-voce"><div class="qodnet-voce-desc">Il report lo dà <strong>pagato</strong>, nel CRM è non pagato</div>
                        <button class="btn-small" onclick="QodnetRiscontro.segnaPagato(${idx}, this)">Segna pagato</button></div>`;
                    if (x.tipo === 'manca') return `<div class="qodnet-voce"><div class="qodnet-voce-desc"><span class="qodnet-rosso">Nel report, non nel CRM:</span> ${rigaVoce(x.v)}</div>
                        <div class="qodnet-voce-importo">${euro(x.v.provvigione)}</div>
                        <button class="btn-small" onclick="QodnetRiscontro.aggiungiVoce(${idx}, ${j}, this)">Aggiungi</button></div>`;
                    if (x.tipo === 'diversa') return `<div class="qodnet-voce"><div class="qodnet-voce-desc">${rigaVoce(x.v)}<small class="qodnet-arancio">${esc(x.diverse.join(' · '))}</small></div>
                        ${x.r.statoProvvigione === 'Fatturata' ? '<small>già fatturata</small>' : `<button class="btn-small" onclick="QodnetRiscontro.allinea(${idx}, ${j}, this)">Usa il report</button>`}</div>`;
                    return `<div class="qodnet-voce"><div class="qodnet-voce-desc"><span class="qodnet-rosso">Nel CRM, non nel report:</span> ${esc(x.r.prodotto)}${x.r.dettaglio ? ' — ' + esc(x.r.dettaglio) : ''}
                        <small>${x.r.unaTantum ? 'Una tantum' : x.r.inizio + ' → ' + x.r.fine}</small></div>
                        <div class="qodnet-voce-importo">${euro(x.r.provvigione)}</div>
                        <button class="qodnet-icona" title="Modifica o elimina" onclick="openQodnetRigaModal('${esc(x.r.id)}')"><i class="fas fa-pen"></i></button></div>`;
                }).join('')}
            </div>`;
        });

        if (assenti.length) {
            const perDoc = {};
            assenti.forEach(r => { (perDoc[r.documento] = perDoc[r.documento] || []).push(r); });
            html += `<h3 class="qodnet-titolo">Da fatturare nel CRM ma assenti da questo report <small>da chiedere a QODNET, oppure il report era parziale</small></h3>`;
            Object.keys(perDoc).forEach(doc => {
                const rr = perDoc[doc];
                html += `<div class="storico-card qodnet-doc"><div class="qodnet-doc-titolo"><strong>${esc(doc)}</strong> · ${esc(rr[0].nomeCliente)}
                    <small>${rr.length} voci · ${euro(rr.reduce((s, r) => s + r.provvigione, 0))}</small></div></div>`;
            });
        }

        if (ok.length) {
            html += `<details class="qodnet-dettagli"><summary>${ok.length} documenti uguali al CRM</summary>
                ${ok.map(e => `<div class="qodnet-periodo"><span>${esc(e.doc.documento)}</span><span>${esc(e.crm[0].nomeCliente)}</span><span>${e.doc.voci.length} voci</span><span>${euro(e.doc.totale)}</span></div>`).join('')}
            </details>`;
        }

        box.innerHTML = html;
        box._esiti = esiti;
    }

    /** Vendite da confermare del cliente che corrispondono alle voci del documento */
    function proponiConferme(doc, clienteCrm) {
        const libere = (qodnetDati.righe || []).filter(r => !r.documento && r.statoProvvigione !== 'Fatturata' && norm(r.nomeCliente) === norm(clienteCrm));
        return doc.voci.map(v => {
            const i = libere.findIndex(r => famiglia(r.prodotto) === famiglia(v.prodotto)
                && (!r.dettaglio || !v.dettaglio || norm(r.dettaglio) === norm(v.dettaglio)));
            return i === -1 ? null : libere.splice(i, 1)[0];
        });
    }

    function aggiornaConferme(idx) {
        const e = contenitore()._esiti[idx];
        const inp = document.getElementById('qodnetRiscCliente' + idx);
        if (e && inp) clientiScelti[e.doc.documento] = inp.value.trim();
        if (ultimoReport) renderReport(confrontaReport(ultimoReport, qodnetDati), ultimoReport);
    }

    function inAttesa(btn, testo) {
        if (!btn) return () => {};
        const orig = btn.innerHTML;
        btn.disabled = true; btn.textContent = testo || '...';
        return () => { btn.disabled = false; btn.innerHTML = orig; };
    }

    const vocePerInsert = v => ({
        prodotto: v.prodotto, dettaglio: v.dettaglio, quantita: v.quantita,
        periodo_inizio: v.inizio, periodo_fine: v.fine,
        imponibile: v.imponibile, percentuale: v.percentuale, provvigione: v.provvigione
    });

    async function importaDocumento(idx, btn) {
        const e = contenitore()._esiti[idx];
        const cliente = (document.getElementById('qodnetRiscCliente' + idx)?.value || '').trim();
        if (!cliente || !clientiCRM.includes(cliente)) { alert('⚠️ Scegli il cliente dall\'anagrafica'); return; }
        const conferme = proponiConferme(e.doc, cliente);
        const fine = inAttesa(btn, 'Registrazione...');
        try {
            const r = await chiama('insert_documento_qodnet', {
                cliente_nome: cliente, documento: e.doc.documento, data_documento: e.doc.data,
                stato_documento: e.doc.pagato ? 'Pagato' : 'Non pagato',
                righe: JSON.stringify(e.doc.voci.map((v, j) => Object.assign(vocePerInsert(v), conferme[j] ? { id_da_confermare: conferme[j].id } : {})))
            });
            if (config.clientiReport[e.doc.cliente] !== cliente) {
                await salvaConfig({ clientiReport: { [e.doc.cliente]: cliente } }).catch(() => {});
            }
            window.markTabDirty && window.markTabDirty('vendite');
            await rianalizza();
            if (r.confermate) alert(`✅ ${e.doc.documento}: ${r.righe} voci, di cui ${r.confermate} vendite già registrate ora confermate`);
        } catch (err) {
            fine();
            alert('❌ ' + err.message);
        }
    }

    async function segnaPagato(idx, btn) {
        const e = contenitore()._esiti[idx];
        const x = e.differenze.find(d => d.tipo === 'pagato');
        const fine = inAttesa(btn);
        try {
            await chiama('aggiorna_righe_qodnet', { ids: x.ids.join(','), stato_documento: 'Pagato' });
            window.markTabDirty && window.markTabDirty('vendite');
            await rianalizza();
        } catch (err) { fine(); alert('❌ ' + err.message); }
    }

    async function aggiungiVoce(idx, j, btn) {
        const e = contenitore()._esiti[idx];
        const x = e.differenze[j];
        const fine = inAttesa(btn);
        try {
            await chiama('insert_documento_qodnet', {
                cliente_nome: e.crm[0].nomeCliente, documento: e.doc.documento, data_documento: e.doc.data,
                stato_documento: e.doc.pagato ? 'Pagato' : (e.crm[0].statoDocumento || 'Non pagato'),
                consenti_documento_esistente: 'true',
                righe: JSON.stringify([vocePerInsert(x.v)])
            });
            window.markTabDirty && window.markTabDirty('vendite');
            await rianalizza();
        } catch (err) { fine(); alert('❌ ' + err.message); }
    }

    async function allinea(idx, j, btn) {
        const e = contenitore()._esiti[idx];
        const { v, r } = e.differenze[j];
        const fine = inAttesa(btn);
        try {
            await chiama('aggiorna_righe_qodnet', {
                ids: r.id, quantita: v.quantita, periodo_inizio: v.inizio, periodo_fine: v.fine,
                imponibile: v.imponibile, percentuale: v.percentuale, provvigione: v.provvigione
            });
            window.markTabDirty && window.markTabDirty('vendite');
            await rianalizza();
        } catch (err) { fine(); alert('❌ ' + err.message); }
    }

    function renderPannello({ esiti, soloCrm, clientiPannello }) {
        const box = contenitore();
        const conta = t => esiti.filter(e => e.tipo === t).length;
        const nonAbbinati = clientiPannello.filter(c => !c.crm || !clientiCRM.includes(c.crm) || !c.salvato);

        let html = `
        <div class="qodnet-riscontro-sintesi">
            <strong>Pannello:</strong> ${esiti.length} servizi di ${clientiPannello.length} clienti
            <div class="qodnet-contatori">
                <span class="qodnet-badge scoperto">${conta('senza-provvigione')} senza provvigione nel CRM</span>
                <span class="qodnet-badge inscadenza">${conta('rinnovato-scoperto')} rinnovati ma non coperti</span>
                <span class="qodnet-badge chiuso">${soloCrm.length} nel CRM ma non nel pannello</span>
                <span class="qodnet-badge coperto">${conta('ok')} in ordine</span>
            </div>
        </div>`;

        if (nonAbbinati.length) {
            html += `<h3 class="qodnet-titolo">Clienti del pannello <small>controlla l'abbinamento e salvalo: la prossima volta non te lo chiedo</small></h3>
            <div class="storico-card qodnet-doc">
                ${nonAbbinati.map(c => `<div class="qodnet-riscontro-azione">
                    <span class="qodnet-riscontro-nome">#${esc(c.id)} ${esc(c.nome)}</span>
                    <input type="text" list="qodnet-riscontro-clienti" id="qodnetRiscPann${esc(c.id)}" value="${esc(c.crm)}" placeholder="Cliente nel CRM">
                </div>`).join('')}
                <button class="btn-small qodnet-btn-fattura" onclick="QodnetRiscontro.salvaAbbinamentiPannello(this)"><i class="fas fa-link"></i> Salva abbinamenti e ricontrolla</button>
            </div>`;
        }

        const sezione = (titolo, sottotitolo, lista, riga) => lista.length
            ? `<h3 class="qodnet-titolo">${titolo} <small>${sottotitolo}</small></h3><div class="storico-card qodnet-doc">${lista.map(riga).join('')}</div>` : '';
        const nomeCrm = s => (clientiPannello.find(c => c.id === s.idCliente) || {}).crm || s.nomeCliente;

        html += sezione('Senza provvigione nel CRM', 'servizi attivi nel pannello che nessun report ha coperto', esiti.filter(e => e.tipo === 'senza-provvigione'), e => `
            <div class="qodnet-voce"><div class="qodnet-voce-desc">${esc(e.s.prodotto)}${e.s.dominio ? ` <small>— ${esc(e.s.dominio)}</small>` : ''}
                <small>${esc(nomeCrm(e.s))} · ID ${esc(e.s.id)} · listino ${euro(e.s.prezzo)} · prossima scadenza ${isoToDmy(e.s.scadenza)}</small></div>
                <button class="btn-small" onclick="QodnetRiscontro.ignora('${esc(e.s.id)}', this)">Ignora</button></div>`);

        html += sezione('Rinnovati ma non coperti', 'il pannello è già al periodo successivo, il CRM no: serve il report', esiti.filter(e => e.tipo === 'rinnovato-scoperto'), e => `
            <div class="qodnet-voce"><div class="qodnet-voce-desc">${esc(e.c.prodotto)}${e.c.dettaglio ? ` <small>— ${esc(e.c.dettaglio)}</small>` : ''}
                <small>${esc(e.c.nomeCliente)} · coperto fino al ${e.c.coperturaFino}, nel pannello fino al ${isoToDmy(e.fineAttesa)}</small></div></div>`);

        html += sezione('Nel CRM ma non nel pannello', 'forse disdetti o sostituiti', soloCrm, c => `
            <div class="qodnet-voce"><div class="qodnet-voce-desc">${c.quantita > 1 ? c.quantita + ' x ' : ''}${esc(c.prodotto)}${c.dettaglio ? ` <small>— ${esc(c.dettaglio)}</small>` : ''}
                <small>${esc(c.nomeCliente)} · coperto fino al ${c.coperturaFino}</small></div>
                <button class="btn-small" onclick="QodnetRiscontro.segnaServizio('${esc(c.idUltimaRiga)}', 'Annullato', this)">Annullato</button>
                <button class="btn-small" onclick="QodnetRiscontro.segnaServizio('${esc(c.idUltimaRiga)}', 'Sostituito', this)">Sostituito</button></div>`);

        const ignorati = esiti.filter(e => e.tipo === 'ignorato');
        if (ignorati.length) {
            html += `<details class="qodnet-dettagli"><summary>${ignorati.length} servizi ignorati</summary>
                ${ignorati.map(e => `<div class="qodnet-voce"><div class="qodnet-voce-desc">${esc(e.s.prodotto)} <small>${esc(nomeCrm(e.s))} · ID ${esc(e.s.id)} · ${esc(e.motivo)}</small></div>
                    <button class="btn-small" onclick="QodnetRiscontro.nonIgnorare('${esc(e.s.id)}', this)">Ripristina</button></div>`).join('')}
            </details>`;
        }

        box.innerHTML = html;
    }

    async function salvaAbbinamentiPannello(btn) {
        const voci = {};
        let errore = '';
        document.querySelectorAll('[id^="qodnetRiscPann"]').forEach(inp => {
            const id = inp.id.replace('qodnetRiscPann', '');
            const v = inp.value.trim();
            if (!v) return;
            if (!clientiCRM.includes(v)) errore = errore || `«${v}» non è in anagrafica`;
            voci[id] = v;
        });
        if (errore) { alert('⚠️ ' + errore); return; }
        const fine = inAttesa(btn, 'Salvataggio...');
        try {
            await salvaConfig({ clientiPannello: voci });
            renderPannello(confrontaPannello(ultimoPannello, qodnetDati));
        } catch (err) { fine(); alert('❌ ' + err.message); }
    }

    async function ignora(idServizio, btn) {
        const motivo = prompt('Perché ignorarlo? (es. contratto annullato, vendita hardware, gestito fuori QODNET)');
        if (motivo === null) return;
        const fine = inAttesa(btn);
        try {
            await salvaConfig({ ignorati: { [idServizio]: motivo.trim() || 'ignorato' } });
            renderPannello(confrontaPannello(ultimoPannello, qodnetDati));
        } catch (err) { fine(); alert('❌ ' + err.message); }
    }

    async function nonIgnorare(idServizio, btn) {
        const fine = inAttesa(btn);
        try {
            await salvaConfig({ ignorati: { [idServizio]: null } });
            renderPannello(confrontaPannello(ultimoPannello, qodnetDati));
        } catch (err) { fine(); alert('❌ ' + err.message); }
    }

    async function segnaServizio(idRiga, stato, btn) {
        if (!confirm(`Segnare il servizio come «${stato}»?`)) return;
        const fine = inAttesa(btn);
        try {
            await chiama('aggiorna_righe_qodnet', { ids: idRiga, stato_servizio: stato });
            window.markTabDirty && window.markTabDirty('vendite');
            await rianalizza();
        } catch (err) { fine(); alert('❌ ' + err.message); }
    }

    function svuota() {
        const t = document.getElementById('qodnetRiscontroTesto');
        if (t) t.value = '';
        ultimoReport = null; ultimoPannello = null;
        const box = contenitore();
        if (box) box.innerHTML = '';
    }

    return {
        // interfaccia
        caricaPdf, analizza, svuota, aggiornaConferme, importaDocumento, segnaPagato, aggiungiVoce, allinea,
        salvaAbbinamentiPannello, ignora, nonIgnorare, segnaServizio,
        // per i test
        _leggiReport: leggiReport, _leggiPannello: leggiPannello, _famiglia: famiglia,
        _confrontaReport: (report, dati, cfg, clienti) => { config = cfg; clientiCRM = clienti || []; qodnetDati = dati; return confrontaReport(report, dati); },
        _confrontaPannello: (servizi, dati, cfg, clienti) => { config = cfg; clientiCRM = clienti || []; qodnetDati = dati; return confrontaPannello(servizi, dati); }
    };
})();

if (typeof window !== 'undefined') window.QodnetRiscontro = QodnetRiscontro;
