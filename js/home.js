// =======================================================================
// === HOME — TODO + Startup Kleos + pendenze ===
// =======================================================================
// Schermata di apertura dell'app. Tre blocchi:
//   1. Pendenze  → contatori cliccabili che portano alle sezioni esistenti
//   2. TODO      → promemoria scritti a mano (hosting, crm-todo.php)
//   3. Startup Kleos → monti ore informali non fatturati (hosting, crm-startup.php)
//
// Pendenze e controlli arrivano da una sola chiamata `get_home`: la latenza
// GAS è alta e questa è la prima schermata che si apre, quindi si paga un
// round-trip solo. I TODO e i monti ore Startup Kleos invece (dal 26/09/2026)
// stanno sull'hosting di studio-smart.it e si chiedono a parte: rispondono in
// ~100 ms, quindi si rileggono a ogni apertura della Home e dopo ogni
// modifica, senza cache da tenere allineata fra dispositivi e senza rifare
// get_home.
// =======================================================================

// NB: nome diverso da getAPIUrl() di vendite.js — sono entrambi script non
// modulari e condividono lo scope globale: un secondo `const getAPIUrl`
// sarebbe un errore di ridichiarazione.
const _homeApiUrl = () => {
    if (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.APPS_SCRIPT_URL) {
        return window.CONFIG.APPS_SCRIPT_URL;
    }
    if (typeof CONFIG !== 'undefined' && CONFIG.APPS_SCRIPT_URL) {
        return CONFIG.APPS_SCRIPT_URL;
    }
    throw new Error('URL backend non configurato (CONFIG.APPS_SCRIPT_URL mancante)');
};

const _todoApiUrl = () => {
    const c = (typeof window !== 'undefined' && window.CONFIG) || (typeof CONFIG !== 'undefined' ? CONFIG : null);
    if (c && c.TODO_API_URL) return c.TODO_API_URL;
    throw new Error('URL dei TODO non configurato (CONFIG.TODO_API_URL mancante)');
};

const _startupApiUrl = () => {
    const c = (typeof window !== 'undefined' && window.CONFIG) || (typeof CONFIG !== 'undefined' ? CONFIG : null);
    if (c && c.STARTUP_API_URL) return c.STARTUP_API_URL;
    throw new Error('URL Startup Kleos non configurato (CONFIG.STARTUP_API_URL mancante)');
};

let homeData = null;
let todoDati = null;               // { todos, daFare, scaduti } dall'hosting
let startupDati = null;            // { startup, attivi, oreResidueTotali } dall'hosting
let startupDettaglioAperti = {};   // idStartup -> true quando il dettaglio è espanso
let todoById = {};                 // idTodo -> record, serve alla modifica inline
let homeAggiornatoIl = null;       // timestamp (ms) dei dati attualmente a schermo
let _rinviaRinfresco = null;       // timer del rinfresco rimandato (vedi _homeInModifica)

// --- Cache locale della Home ------------------------------------------
// get_home costa 5-10 secondi (latenza GAS + lettura di sette fogli) per
// restituire 2 KB, e switchTab la richiama a OGNI ritorno sulla tab. Qui i
// dati vengono tenuti in localStorage: la Home si apre subito con l'ultima
// fotografia e si rinfresca da sola solo quando serve davvero.
const HOME_CACHE_KEY  = 'crm_home_cache_v1';
const HOME_STALE_KEY  = 'crm_home_stale';   // scritta dal wrapper fetch in index.html
const HOME_MAX_ETA_MS = 5 * 60 * 1000;      // oltre questa età si rinfresca in sottofondo

function _leggiCacheHome() {
    try {
        const raw = localStorage.getItem(HOME_CACHE_KEY);
        if (!raw) return null;
        const c = JSON.parse(raw);
        return (c && c.dati && c.ts) ? c : null;
    } catch (e) {
        return null;
    }
}

function _scriviCacheHome(dati) {
    try {
        localStorage.setItem(HOME_CACHE_KEY, JSON.stringify({ ts: Date.now(), dati: dati }));
    } catch (e) {
        // quota piena o storage negato: la Home continua a funzionare senza cache
    }
}

/** true se una scrittura fatta in qualunque tab ha reso vecchi i contatori. */
function _homeDaRinfrescare() {
    try {
        return localStorage.getItem(HOME_STALE_KEY) === '1';
    } catch (e) {
        return false;
    }
}

function _segnaHomeAggiornata() {
    try {
        localStorage.removeItem(HOME_STALE_KEY);
    } catch (e) {}
}

function _oraBreve(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function _escHome(s) {
    return (s === null || s === undefined ? '' : s.toString())
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _oggiISO() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().split('T')[0];
}

/** Formatta le ore senza decimali inutili: 2 → "2", 1.5 → "1,5" */
function _fmtOre(n) {
    const v = parseFloat(n) || 0;
    return (Math.round(v * 100) / 100).toString().replace('.', ',');
}

/** gg/mm/aaaa → aaaa-mm-gg (formato richiesto da <input type="date">) */
function _dataPerInput(s) {
    if (!s) return '';
    const p = s.split('/');
    if (p.length !== 3) return '';
    return `${p[2]}-${p[1]}-${p[0]}`;
}

/** Indicizza una lista di TODO per id, così la modifica inline li ritrova. */
function _indicizzaTodo(lista) {
    (lista || []).forEach(t => { todoById[t.idTodo] = t; });
    return lista || [];
}

// =======================================================================
// === CARICAMENTO ===
// =======================================================================

/**
 * Apertura della Home: mostra subito l'ultima fotografia salvata e decide se
 * vale la pena richiedere dati nuovi. Il rinfresco avviene in sottofondo,
 * senza spinner e senza svuotare lo schermo: i numeri si assestano da soli.
 */
function initHome() {
    const cache = _leggiCacheHome();

    // TODO e Startup si rileggono sempre: costano poco e così ogni
    // dispositivo vede le modifiche degli altri appena torna sulla Home.
    caricaTodo();
    caricaStartup();

    if (!cache) {
        loadHome();
        return;
    }

    homeData = cache.dati;
    homeAggiornatoIl = cache.ts;
    renderHome();

    const troppoVecchia = (Date.now() - cache.ts) > HOME_MAX_ETA_MS;
    if (troppoVecchia || _homeDaRinfrescare()) {
        loadHome({ silenzioso: true });
    }
}

/**
 * @param {object} opzioni - { silenzioso: true } aggiorna senza toccare quello
 *        che è già a schermo (nessun "Caricamento...", nessuno spinner).
 */
async function loadHome(opzioni) {
    const container = document.getElementById('homeContainer');
    if (!container) return;

    const silenzioso = !!(opzioni && opzioni.silenzioso) && !!homeData;
    const forzato    = !!(opzioni && opzioni.forzato);

    // Il rinfresco ricostruisce tutto l'HTML della Home: se parte mentre si
    // sta scrivendo un promemoria o registrando delle ore, il testo sparisce
    // sotto le dita. In quel caso si rimanda. Il pulsante ↻ è esplicito e
    // passa comunque (chi lo preme sta chiedendo proprio quello).
    if (silenzioso && !forzato && _homeInModifica()) {
        clearTimeout(_rinviaRinfresco);
        _rinviaRinfresco = setTimeout(() => loadHome({ silenzioso: true }), 60000);
        return;
    }

    if (!silenzioso) {
        container.innerHTML = '<div class="loading-scadenze">Caricamento...</div>';
    } else {
        _segnaRinfrescoInCorso(true);
    }

    try {
        const res = await fetch(`${_homeApiUrl()}?action=get_home`,
                                silenzioso ? { noSpinner: true } : undefined);
        const result = await res.json();

        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');

        homeData = result;
        homeAggiornatoIl = Date.now();
        _scriviCacheHome(result);
        _segnaHomeAggiornata();
        renderHome();

    } catch (error) {
        console.error('Errore caricamento home:', error);

        // In sottofondo un errore non deve cancellare i dati buoni che l'utente
        // sta guardando: si tiene la fotografia vecchia e lo si dice nel
        // timestamp, che è l'unico posto dove la cosa è rilevante.
        if (silenzioso) {
            _segnaRinfrescoInCorso(false, true);
            return;
        }

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div>Errore: ${_escHome(error.message)}</div>
                <button class="home-btn" style="margin-top:12px;" onclick="loadHome()">Riprova</button>
            </div>`;
    }
}

/**
 * true se l'utente ha qualcosa in mano nella Home: un campo a fuoco oppure
 * del testo già digitato e non ancora salvato (il form "nuovo promemoria" è
 * sempre presente nel DOM, quindi il solo fuoco non basterebbe).
 */
function _homeInModifica() {
    const c = document.getElementById('homeContainer');
    if (!c) return false;

    const attivo = document.activeElement;
    if (attivo && c.contains(attivo) && /^(INPUT|TEXTAREA|SELECT)$/.test(attivo.tagName)) {
        return true;
    }

    return Array.from(c.querySelectorAll('input, textarea')).some(el => {
        if (el.type === 'checkbox' || el.type === 'radio') return false;
        return el.value && el.value.trim() !== '';
    });
}

/** Fa girare l'icona del pulsante mentre il rinfresco silenzioso è in corso. */
function _segnaRinfrescoInCorso(inCorso, fallito) {
    const bar = document.getElementById('home-aggiornamento');
    if (!bar) return;
    bar.classList.toggle('in-corso', !!inCorso);
    if (fallito) {
        const ts = document.getElementById('home-timestamp');
        if (ts) ts.textContent = 'agg. ' + _oraBreve(homeAggiornatoIl) + ' · rete non raggiungibile';
    }
}

function renderHome() {
    const container = document.getElementById('homeContainer');
    if (!container || !homeData) return;

    container.innerHTML =
        renderBarraAggiornamento() +
        renderPendenze(homeData.pendenze || {}, homeData.controlli || [], homeData.qodnet) +
        renderTodoSezione(todoDati) +
        renderControlliSezione(homeData.controlli || []) +
        renderStartupSezione(startupDati);

    _riapriMovimenti();

    // Alimenta il badge "ore extra" (in cima) col dettaglio già calcolato da
    // get_home: evita una seconda scansione integrale del Timesheet all'avvio.
    if (typeof window.renderOreExtraBadge === 'function' && homeData.oreExtraDettaglio) {
        window.renderOreExtraBadge(
            homeData.oreExtraDettaglio.count,
            homeData.oreExtraDettaglio.perCliente
        );
    }
}

/**
 * Riga di servizio sopra le pendenze: quando risalgono i dati e come
 * chiederne di nuovi. Deliberatamente minuscola e allineata a destra — la
 * Home è già densa, questa riga non deve rubare spazio alle informazioni.
 */
function renderBarraAggiornamento() {
    return `
    <div class="home-aggiornamento" id="home-aggiornamento">
        <span id="home-timestamp">agg. ${_oraBreve(homeAggiornatoIl) || '—'}</span>
        <button type="button" title="Aggiorna i dati della Home"
                onclick="loadHome({ silenzioso: true, forzato: true })">
            <i class="fas fa-rotate-right"></i>
        </button>
    </div>`;
}

// =======================================================================
// === BLOCCO 1 — PENDENZE ===
// =======================================================================

function renderPendenze(p, controlli, qodnet) {
    const card = (numero, label, icona, colore, onclick, extra) => `
        <div class="home-pendenza-card ${numero > 0 ? '' : 'vuota'}" onclick="${onclick}">
            <div class="home-pendenza-icon ${colore}"><i class="fas ${icona}"></i></div>
            <div>
                <div class="home-pendenza-numero">${numero}</div>
                <div class="home-pendenza-label">${label}</div>
                ${extra ? `<div class="home-pendenza-extra">${extra}</div>` : ''}
            </div>
        </div>`;

    const importo = p.importoNonPagato
        ? '€ ' + p.importoNonPagato.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';

    // Niente card per i promemoria (tolta il 26/09/2026, non serviva): la
    // sezione "Da fare" ha già il suo conteggio. Qui restano i controlli
    // periodici in sospeso, che la card porta a vedere più sotto.
    return `
    <div class="home-pendenze">
        ${card((controlli || []).length, 'Controlli', 'fa-clipboard-check', 'arancio', "vaiA('controlli-home')")}
        ${card(p.scadenzeTotale || 0, 'Scadenze 90gg', 'fa-calendar-day', (p.scadenzeCritiche > 0 ? 'rosso' : 'blu'), "vaiA('scadenze')")}
        ${card(p.oreExtra || 0, 'Ore extra sospese', 'fa-hourglass-half', 'rosso', "vaiA('oreextra')")}
        ${card(p.proformaDaFatturare || 0, 'Proforma da fatturare', 'fa-file-invoice', 'verde', "vaiA('proforma')")}
        ${card(p.fattureNonPagate || 0, 'Fatture non pagate', 'fa-money-bill-wave', 'rosso', "vaiA('fatture')", importo)}
        ${qodnet ? card(qodnet.attenzione || 0, 'QODNET', 'fa-globe', 'blu', "vaiA('qodnet')", _extraQodnet(qodnet)) : ''}
    </div>`;
}

/**
 * Riga sotto il numero della card QODNET: cosa c'è da guardare e il saldo
 * provvigioni da fatturare (che non è un'urgenza, solo un promemoria).
 */
function _extraQodnet(q) {
    const pezzi = [];
    if (q.scoperti) pezzi.push(`${q.scoperti} scopert${q.scoperti === 1 ? 'o' : 'i'}`);
    if (q.nonPagatiVecchi) pezzi.push(`${q.nonPagatiVecchi} non pagat${q.nonPagatiVecchi === 1 ? 'o' : 'i'}`);
    if (q.daConfermareVecchie) pezzi.push(`${q.daConfermareVecchie} da confermare`);
    if (q.daFatturare) pezzi.push('€ ' + q.daFatturare.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '');
    return pezzi.join(' · ');
}

/** Porta l'utente alla sezione esistente che gestisce quella pendenza. */
function vaiA(dove) {
    const vaiVendite = (sezione, subtab) => {
        if (typeof window.switchTab === 'function') window.switchTab('vendite');
        // Il pannello Vendite deve esistere nel DOM prima di cambiarne sezione
        setTimeout(() => {
            if (typeof switchVenditeSection === 'function') switchVenditeSection(sezione);
            if (subtab && typeof switchVenditeSubtab === 'function') switchVenditeSubtab(sezione, subtab);
        }, 50);
    };

    switch (dove) {
        // La card ToDo conta roba che sta già in questa pagina: invece di
        // cambiare tab, porto lo schermo sulla sezione.
        case 'dafare':
            document.getElementById('sezione-dafare')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
        case 'controlli-home':
            document.getElementById('sezione-controlli')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
        case 'controlli': vaiVendite('canoni', 'controlli'); break;
        case 'scadenze':  vaiVendite('scadenze'); break;
        case 'oreextra':
            if (typeof window.switchTab === 'function') window.switchTab('clienti');
            break;
        // I due contatori sotto portavano alla lista completa, lasciando
        // all'utente il compito di ritrovare a mano le righe contate. Ora la
        // vista arriva già filtrata sullo stesso criterio del contatore.
        case 'proforma':  apriProformaDaFatturare();  break;
        case 'fatture':   apriFattureNonPagate();     break;
        case 'qodnet': {
            // Servizi scoperti → vista Servizi filtrata; altrimenti Provvigioni
            const q = (homeData && homeData.qodnet) || {};
            if (q.scoperti) {
                _impostaFiltro('qodnet-filter-stato', 'Scoperto');
                vaiVendite('qodnet', 'riepilogo');
                setTimeout(() => { if (typeof filterQodnet === 'function') filterQodnet(); }, 100);
            } else {
                vaiVendite('qodnet', 'provvigioni');
            }
            break;
        }
    }
}

/** Imposta il valore di un campo filtro se esiste nel DOM. */
function _impostaFiltro(id, valore) {
    const el = document.getElementById(id);
    if (el) el.value = valore;
}

/**
 * Tab Proforma mostrando solo quelle non ancora fatturate — lo stesso insieme
 * contato da contaProformaDaFatturare_ (N_Proforma valorizzato, N_Fattura no,
 * che nella lista corrisponde allo stato "Proforma").
 * Il filtro cliente viene azzerato: il contatore non guarda il cliente.
 */
function apriProformaDaFatturare() {
    if (typeof window.switchTab !== 'function') return;

    const giaAperta = window.isTabLoaded && window.isTabLoaded('proforma');

    _impostaFiltro('filter-cliente-proforma', '');
    _impostaFiltro('filter-stato-proforma', 'Proforma');

    window.switchTab('proforma');

    // Alla prima apertura ci pensa il caricamento della tab, che legge i
    // filtri appena impostati. Se la tab era già aperta i dati sono lì e
    // vanno solo rifiltrati, in locale.
    if (giaAperta && typeof filterProformaList === 'function') filterProformaList();
}

/**
 * Tab Fatture mostrando solo quelle da incassare. L'anno viene azzerato di
 * proposito: la tab di suo parte dall'anno corrente, mentre il contatore
 * della Home conta le non pagate di TUTTI gli anni — con l'anno impostato si
 * vedrebbero meno righe del numero cliccato.
 */
function apriFattureNonPagate() {
    if (typeof window.switchTab !== 'function') return;

    const giaAperta = window.isTabLoaded && window.isTabLoaded('fatture');

    _impostaFiltro('fatture-filter-cliente', '');
    _impostaFiltro('fatture-filter-pagato', 'NO');
    _impostaFiltro('fatture-filter-anno', '');

    // Segnala a initFattureTab di non rimettere l'anno corrente sopra la
    // nostra scelta (lo fa solo quando il campo è vuoto, cioè proprio ora).
    if (!giaAperta) window._fattureFiltriPreimpostati = true;

    window.switchTab('fatture');

    if (giaAperta && typeof applyFattureFilters === 'function') applyFattureFilters();
}

// =======================================================================
// === BLOCCO 2 — TODO ===
// =======================================================================

/** Elenco dei TODO; null = non ancora arrivati dall'hosting. */
function renderTodoLista(t) {
    if (!t) return '<div class="loading-scadenze">Caricamento...</div>';
    const todos = _indicizzaTodo(t.todos || []);
    return todos.length
        ? todos.map(renderTodoItem).join('')
        : `<div class="empty-state" style="padding:20px;">
               <div class="empty-state-icon">✅</div>
               <div>${todoMostraFatti ? 'Nessun promemoria.' : 'Nessun promemoria. Tutto sotto controllo.'}</div>
           </div>`;
}

function renderTodoConteggi(t) {
    if (!t) return '';
    return (t.daFare ? `<span class="home-count">${t.daFare}</span>` : '') +
        (t.scaduti ? `<span class="home-count" style="background:#f8d7da;color:#721c24;">${t.scaduti} scaduti</span>` : '');
}

function renderTodoSezione(t) {
    return `
    <div class="home-section" id="sezione-dafare">
        <div class="home-section-header">
            <div class="home-section-title">
                <i class="fas fa-list-check"></i> Da fare
                <span id="todo-conteggi">${renderTodoConteggi(t)}</span>
            </div>
            <button class="home-btn piccolo secondario" onclick="toggleTodoFatti()">
                <i class="fas fa-clock-rotate-left"></i> <span id="todo-toggle-label">${todoMostraFatti ? 'Nascondi completati' : 'Mostra completati'}</span>
            </button>
        </div>

        <div class="home-todo-form">
            <input type="text" id="todo-nuovo-testo" placeholder="Cosa c'è da fare?"
                   onkeydown="if(event.key==='Enter') { event.preventDefault(); aggiungiTodo(); }">
            <div class="home-todo-form-mini">
                <select id="todo-nuova-priorita" title="Priorità">
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Bassa">Bassa</option>
                </select>
                <input type="date" id="todo-nuova-scadenza" title="Scadenza (facoltativa)">
                <button class="home-btn" id="todo-aggiungi-btn" onclick="aggiungiTodo()"><i class="fas fa-plus"></i> Aggiungi</button>
            </div>
        </div>

        <div id="todoLista">${renderTodoLista(t)}</div>
    </div>`;
}

// --- Caricamento dei TODO dall'hosting ----------------------------------
let _todoRichiesta = 0;   // numero dell'ultima lettura partita: vince la più recente

/**
 * Rilegge i TODO e ridisegna SOLO la loro sezione: il resto della Home e il
 * testo che si sta scrivendo nel form "nuovo promemoria" non si toccano.
 * Una riga aperta in modifica non viene travolta: si rimanda il disegno.
 */
async function caricaTodo() {
    const mia = ++_todoRichiesta;
    try {
        const res = await fetch(`${_todoApiUrl()}?action=get_todos&includi_fatti=${todoMostraFatti}`, { noSpinner: true });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        if (mia !== _todoRichiesta) return;   // nel frattempo ne è partita un'altra
        todoDati = result;
        _disegnaTodo();
    } catch (e) {
        console.error('Errore caricamento TODO:', e);
        if (mia !== _todoRichiesta) return;
        const lista = document.getElementById('todoLista');
        if (lista && !todoDati) {
            lista.innerHTML = `<div class="empty-state"><div>Errore: ${_escHome(e.message)}</div>
                <button class="home-btn" style="margin-top:12px;" onclick="caricaTodo()">Riprova</button></div>`;
        }
    }
}

function _disegnaTodo() {
    const lista = document.getElementById('todoLista');
    if (!lista) return;   // la Home non è ancora disegnata: ci penserà renderHome
    if (lista.querySelector('.in-modifica')) return;
    lista.innerHTML = renderTodoLista(todoDati);
    const conteggi = document.getElementById('todo-conteggi');
    if (conteggi) conteggi.innerHTML = renderTodoConteggi(todoDati);
}

// Tornando sull'app (cambio finestra, telefono riacceso) i TODO potrebbero
// essere stati cambiati da un altro dispositivo: se la Home è a schermo si
// rileggono. Costa una chiamata da ~100 ms.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const c = document.getElementById('homeContainer');
    if (c && c.offsetParent !== null) {
        caricaTodo();
        caricaStartup();
    }
});

function renderTodoItem(t) {
    const classePriorita = 'priorita-' + (t.priorita || 'Media').toLowerCase();

    let scadenzaHtml = '';
    if (t.dataScadenza) {
        let cls = '';
        let testo = t.dataScadenza;
        if (!t.fatto && t.giorniAllaScadenza !== null) {
            if (t.giorniAllaScadenza < 0) {
                cls = 'scaduta';
                testo = `${t.dataScadenza} — scaduto da ${Math.abs(t.giorniAllaScadenza)}gg`;
            } else if (t.giorniAllaScadenza === 0) {
                cls = 'oggi';
                testo = `${t.dataScadenza} — oggi`;
            } else if (t.giorniAllaScadenza <= 7) {
                cls = 'oggi';
                testo = `${t.dataScadenza} — tra ${t.giorniAllaScadenza}gg`;
            }
        }
        scadenzaHtml = `<span class="home-todo-scadenza ${cls}"><i class="fas fa-calendar"></i> ${_escHome(testo)}</span>`;
    }

    return `
    <div class="home-todo-item ${classePriorita} ${t.fatto ? 'fatto' : ''}" id="todo-item-${t.idTodo}">
        <input type="checkbox" class="home-todo-check" ${t.fatto ? 'checked' : ''}
               onchange="segnaTodo('${t.idTodo}', this.checked)">
        <div class="home-todo-corpo">
            <div class="home-todo-testo">${_escHome(t.testo)}</div>
            <div class="home-todo-meta">
                <span>${_escHome(t.priorita)}</span>
                ${scadenzaHtml}
                ${t.fatto && t.dataCompletamento ? `<span>fatto il ${_escHome(t.dataCompletamento)}</span>` : ''}
            </div>
        </div>
        <div class="home-todo-azioni">
            <button title="Modifica" class="modifica" onclick="modificaTodo('${t.idTodo}')"><i class="fas fa-pen"></i></button>
            <button title="Elimina" onclick="eliminaTodo('${t.idTodo}')"><i class="fas fa-trash"></i></button>
        </div>
    </div>`;
}

// =======================================================================
// === BLOCCO 3 — CONTROLLI PERIODICI ===
// =======================================================================
// Sezione a sé, non mescolata ai promemoria: sono cose da fare che nascono
// da un canone, non scritte a mano. La scadenza è dedotta dall'etichetta-mese
// (es. "Luglio" su un canone del 01/06/2026 → luglio 2026).

function renderControlliSezione(controlli) {
    const ctrl = controlli || [];

    const lista = ctrl.length
        ? ctrl.map(renderControlloItem).join('')
        : `<div class="empty-state" style="padding:20px;">
               <div class="empty-state-icon">📋</div>
               <div>Nessun controllo in sospeso.</div>
           </div>`;

    const inRitardo   = ctrl.filter(c => c.inRitardo).length;
    const incoerenti  = ctrl.filter(c => c.oltreScadenzaCanone).length;

    return `
    <div class="home-section" id="sezione-controlli">
        <div class="home-section-header">
            <div class="home-section-title">
                <i class="fas fa-clipboard-check"></i> Controlli
                ${ctrl.length ? `<span class="home-count">${ctrl.length}</span>` : ''}
                ${inRitardo ? `<span class="home-count" style="background:#f8d7da;color:#721c24;">${inRitardo} in ritardo</span>` : ''}
                ${incoerenti ? `<span class="home-count" style="background:#fff3cd;color:#856404;">${incoerenti} da verificare</span>` : ''}
            </div>
        </div>
        <div id="controlliLista">${lista}</div>
    </div>`;
}

/**
 * Voce "controllo periodico".
 * Non è modificabile come un TODO: si registra (data + rapportino) e sparisce.
 */
function renderControlloItem(c) {
    let quando = '';
    let cls = '';

    if (c.periodoPrevisto) {
        if (c.giorniAllaScadenza !== null && c.giorniAllaScadenza < 0) {
            cls = 'scaduta';
            quando = `${c.periodoPrevisto} — in ritardo`;
        } else if (c.giorniAllaScadenza !== null && c.giorniAllaScadenza <= 31) {
            cls = 'oggi';
            quando = `${c.periodoPrevisto} — da fare`;
        } else {
            quando = c.periodoPrevisto;
        }
    } else {
        // Etichetta non riconosciuta come mese: ripiego sulla scadenza del canone
        quando = c.canoneScadenza ? `entro il ${c.canoneScadenza}` : 'periodo non indicato';
    }

    const titolo = c.etichetta
        ? `${_escHome(c.nomeCliente)} — ${_escHome(c.etichetta)}`
        : `${_escHome(c.nomeCliente)} — controllo ${c.nControllo}`;

    // L'etichetta colloca il controllo oltre la fine del ciclo: il calcolo è
    // giusto, è l'etichetta a non stare dentro il canone.
    const avviso = c.oltreScadenzaCanone
        ? `<div class="home-avviso">
               <i class="fas fa-triangle-exclamation"></i>
               Il periodo dedotto (${_escHome(c.periodoPrevisto)}) cade <strong>dopo la scadenza del canone</strong>
               (${_escHome(c.canoneScadenza)}): controlla l'etichetta.
           </div>`
        : '';

    return `
    <div class="home-todo-item controllo ${c.oltreScadenzaCanone ? 'incoerente' : ''}" id="controllo-item-${c.idControllo}">
        <div class="home-todo-icona"><i class="fas fa-clipboard-check"></i></div>
        <div class="home-todo-corpo">
            <div class="home-todo-testo">
                ${titolo}
                <span class="home-chip-controllo">Controllo</span>
            </div>
            <div class="home-todo-meta">
                <span class="home-todo-scadenza ${cls}"><i class="fas fa-calendar"></i> ${_escHome(quando)}</span>
                <a class="home-link-canone" title="Apri il canone da cui nasce questo controllo"
                   onclick="apriCanone('${c.idCanone}')">
                    <i class="fas fa-arrow-up-right-from-square"></i> ${_escHome(c.idCanone)}${c.canoneDescrizione ? ' · ' + _escHome(c.canoneDescrizione) : ''}
                </a>
            </div>
            ${avviso}
            <div id="reg-controllo-${c.idControllo}" class="home-inline-form" style="display:none;">
                <div class="riga">
                    <input type="date" id="ctrl-data-${c.idControllo}" value="${_oggiISO()}">
                </div>
                <textarea id="ctrl-report-${c.idControllo}" placeholder="Rapportino: cosa è stato fatto"></textarea>
                <div style="margin-top:8px;">
                    <button class="home-btn piccolo" onclick="salvaControllo('${c.idControllo}')">
                        <i class="fas fa-check"></i> Salva
                    </button>
                    <button class="home-btn piccolo secondario" onclick="toggleRegistraControllo('${c.idControllo}')">
                        Annulla
                    </button>
                </div>
            </div>
        </div>
        <div class="home-todo-azioni">
            <button title="Registra controllo" class="modifica" onclick="toggleRegistraControllo('${c.idControllo}')">
                <i class="fas fa-check-double"></i>
            </button>
        </div>
    </div>`;
}

/**
 * Apre il canone da cui nasce il controllo, nel riepilogo Vendite → Canoni.
 *
 * Il riepilogo si carica in modo asincrono: invece di indovinare un ritardo
 * fisso, aspetto che la card compaia nel DOM (fino a 15s) e poi ci porto
 * sopra lo schermo aprendo l'elenco dei suoi controlli.
 */
function apriCanone(idCanone) {
    if (typeof window.switchTab === 'function') window.switchTab('vendite');

    setTimeout(() => {
        if (typeof switchVenditeSection === 'function') switchVenditeSection('canoni');
        if (typeof switchVenditeSubtab === 'function') switchVenditeSubtab('canoni', 'riepilogo');
    }, 50);

    let tentativi = 0;
    const timer = setInterval(() => {
        tentativi++;

        const box = document.getElementById(`canone-controlli-${idCanone}`);
        if (box) {
            clearInterval(timer);

            const card = box.closest('.storico-card');
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('evidenziato');
                setTimeout(() => card.classList.remove('evidenziato'), 2500);
            }

            // Apre l'elenco controlli del canone se non è già aperto
            if (box.style.display === 'none' && typeof toggleControlliCanoneCard === 'function') {
                toggleControlliCanoneCard(idCanone);
            }
            return;
        }

        if (tentativi > 60) clearInterval(timer);   // ~15s, poi lascio perdere
    }, 250);
}

function toggleRegistraControllo(idControllo) {
    const box = document.getElementById(`reg-controllo-${idControllo}`);
    if (!box) return;
    const aperto = box.style.display !== 'none';
    box.style.display = aperto ? 'none' : 'block';
    if (!aperto) document.getElementById(`ctrl-report-${idControllo}`)?.focus();
}

async function salvaControllo(idControllo) {
    const data = document.getElementById(`ctrl-data-${idControllo}`)?.value || '';

    if (!data) { alert('Indica la data di esecuzione'); return; }

    const params = new URLSearchParams({
        action: 'registra_controllo',
        id_controllo: idControllo,
        data_eseguita: data,
        report: (document.getElementById(`ctrl-report-${idControllo}`)?.value || '').trim()
    });

    try {
        const res = await fetch(`${_homeApiUrl()}?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        await loadHome();
    } catch (e) {
        alert('Errore registrazione controllo: ' + e.message);
    }
}

/**
 * Trasforma la riga del TODO in un form di modifica inline.
 * Testo, priorità e scadenza sono tutti modificabili; svuotare la data
 * rimuove la scadenza (il backend tratta data_scadenza='' come "togli").
 */
function modificaTodo(idTodo) {
    const t = todoById[idTodo];
    const item = document.getElementById(`todo-item-${idTodo}`);
    if (!t || !item) return;

    item.classList.add('in-modifica');
    item.innerHTML = `
        <div class="home-todo-edit">
            <input type="text" id="edit-testo-${idTodo}" value="${_escHome(t.testo)}"
                   onkeydown="if(event.key==='Enter') salvaModificaTodo('${idTodo}'); if(event.key==='Escape') annullaModificaTodo('${idTodo}');">
            <div class="riga">
                <select id="edit-priorita-${idTodo}">
                    <option value="Alta"  ${t.priorita === 'Alta'  ? 'selected' : ''}>Alta</option>
                    <option value="Media" ${t.priorita === 'Media' ? 'selected' : ''}>Media</option>
                    <option value="Bassa" ${t.priorita === 'Bassa' ? 'selected' : ''}>Bassa</option>
                </select>
                <input type="date" id="edit-scadenza-${idTodo}" value="${_dataPerInput(t.dataScadenza)}">
                <button class="home-btn piccolo" onclick="salvaModificaTodo('${idTodo}')">
                    <i class="fas fa-check"></i> Salva
                </button>
                <button class="home-btn piccolo secondario" onclick="annullaModificaTodo('${idTodo}')">
                    Annulla
                </button>
            </div>
        </div>`;

    const input = document.getElementById(`edit-testo-${idTodo}`);
    if (input) { input.focus(); input.select(); }
}

/** Ripristina la riga senza salvare. */
function annullaModificaTodo(idTodo) {
    const t = todoById[idTodo];
    const item = document.getElementById(`todo-item-${idTodo}`);
    if (!t || !item) return;
    item.outerHTML = renderTodoItem(t);
}

async function salvaModificaTodo(idTodo) {
    const testo = (document.getElementById(`edit-testo-${idTodo}`)?.value || '').trim();

    if (!testo) {
        alert('Il testo non può essere vuoto');
        return;
    }

    const params = new URLSearchParams({
        action: 'update_todo',
        id_todo: idTodo,
        testo: testo,
        priorita: document.getElementById(`edit-priorita-${idTodo}`)?.value || 'Media',
        data_scadenza: document.getElementById(`edit-scadenza-${idTodo}`)?.value || ''
    });

    try {
        const res = await fetch(`${_todoApiUrl()}?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        // Si rilegge l'elenco: cambiando priorità o scadenza cambia l'ordine.
        // La riga in modifica va chiusa prima, altrimenti _disegnaTodo aspetta.
        document.getElementById(`todo-item-${idTodo}`)?.classList.remove('in-modifica');
        await caricaTodo();

    } catch (e) {
        alert('Errore modifica TODO: ' + e.message);
    }
}

// Finché il server non ha risposto il pulsante resta bloccato, altrimenti si
// preme di nuovo e nascono promemoria uguali (con Apps Script succedeva: ci
// metteva decine di secondi; l'hosting risponde subito, la guardia resta).
let _todoInCorso = false;

async function aggiungiTodo() {
    const inputTesto = document.getElementById('todo-nuovo-testo');
    const testo = (inputTesto?.value || '').trim();

    if (!testo) {
        inputTesto?.focus();
        return;
    }
    if (_todoInCorso) return;

    const priorita = document.getElementById('todo-nuova-priorita')?.value || 'Media';
    const scadenza = document.getElementById('todo-nuova-scadenza')?.value || '';

    let url = `${_todoApiUrl()}?action=insert_todo&testo=${encodeURIComponent(testo)}&priorita=${encodeURIComponent(priorita)}`;
    if (scadenza) url += `&data_scadenza=${encodeURIComponent(scadenza)}`;

    const btn = document.getElementById('todo-aggiungi-btn');
    const testoBtn = btn ? btn.innerHTML : '';
    _todoInCorso = true;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aggiungo...'; }
    if (inputTesto) inputTesto.disabled = true;

    try {
        const res = await fetch(url);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        inputTesto.value = '';
        document.getElementById('todo-nuova-scadenza').value = '';
        if (result.duplicato) alert('Questo promemoria era già stato aggiunto poco fa: non l\'ho ripetuto.');
        await caricaTodo();
        document.getElementById('todo-nuovo-testo')?.focus();

    } catch (e) {
        alert('Errore aggiunta TODO: ' + e.message + '\n\nControlla l\'elenco prima di riprovare: il promemoria potrebbe essere stato comunque aggiunto.');
    } finally {
        _todoInCorso = false;
        const b = document.getElementById('todo-aggiungi-btn');
        if (b) { b.disabled = false; b.innerHTML = testoBtn || '<i class="fas fa-plus"></i> Aggiungi'; }
        const i = document.getElementById('todo-nuovo-testo');
        if (i) i.disabled = false;
    }
}

async function segnaTodo(idTodo, fatto) {
    try {
        const res = await fetch(`${_todoApiUrl()}?action=toggle_todo&id_todo=${encodeURIComponent(idTodo)}&fatto=${fatto}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        await caricaTodo();
    } catch (e) {
        alert('Errore aggiornamento TODO: ' + e.message);
        await caricaTodo();
    }
}

async function eliminaTodo(idTodo) {
    if (!confirm('Eliminare definitivamente questo promemoria?')) return;

    try {
        const res = await fetch(`${_todoApiUrl()}?action=delete_todo&id_todo=${encodeURIComponent(idTodo)}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        await caricaTodo();
    } catch (e) {
        alert('Errore eliminazione TODO: ' + e.message);
    }
}

let todoMostraFatti = false;

async function toggleTodoFatti() {
    todoMostraFatti = !todoMostraFatti;

    const lista = document.getElementById('todoLista');
    const label = document.getElementById('todo-toggle-label');
    if (!lista) return;

    lista.innerHTML = '<div class="loading-scadenze">Caricamento...</div>';
    if (label) label.textContent = todoMostraFatti ? 'Nascondi completati' : 'Mostra completati';

    await caricaTodo();
}

// =======================================================================
// === BLOCCO 3 — STARTUP KLEOS ===
// =======================================================================

/** Schede dei monti ore; null = non ancora arrivati dall'hosting. */
function renderStartupLista(s) {
    if (!s) return '<div class="loading-scadenze">Caricamento...</div>';
    const lista = s.startup || [];
    return lista.length
        ? lista.map(renderStartupCard).join('')
        : `<div class="empty-state" style="padding:20px;">
               <div class="empty-state-icon">📦</div>
               <div>Nessun monte ore attivo.</div>
           </div>`;
}

function renderStartupConteggi(s) {
    if (!s) return '';
    return (s.attivi ? `<span class="home-count">${s.attivi} attivi</span>` : '') +
        (s.oreResidueTotali ? `<span class="home-count">${_fmtOre(s.oreResidueTotali)}h residue</span>` : '');
}

function renderStartupSezione(s) {
    return `
    <div class="home-section">
        <div class="home-section-header">
            <div class="home-section-title">
                <i class="fas fa-graduation-cap"></i> Startup Kleos
                <span id="startup-conteggi">${renderStartupConteggi(s)}</span>
            </div>
            <button class="home-btn piccolo" onclick="toggleNuovoStartup()">
                <i class="fas fa-plus"></i> Nuovo monte ore
            </button>
        </div>

        <div id="nuovoStartupForm" class="home-inline-form" style="display:none;">
            <div class="riga">
                <input type="text" id="startup-cliente" placeholder="Cliente" style="flex:1 1 220px;">
                <input type="number" id="startup-ore" placeholder="Ore totali" step="0.5" min="0.5" style="width:120px;">
                <input type="date" id="startup-data" value="${_oggiISO()}">
            </div>
            <div class="riga">
                <input type="text" id="startup-agente" placeholder="Agente Kleos" style="flex:1 1 180px;">
                <input type="text" id="startup-riferimento" placeholder="Riferimento vendita" style="flex:1 1 180px;">
            </div>
            <div class="riga">
                <input type="text" id="startup-note" placeholder="Note (facoltative)" style="flex:1 1 100%;">
            </div>
            <button class="home-btn" onclick="creaStartup()"><i class="fas fa-check"></i> Crea</button>
            <button class="home-btn secondario" onclick="toggleNuovoStartup()">Annulla</button>
        </div>

        <div id="startupLista" style="margin-top:12px;">${renderStartupLista(s)}</div>
    </div>`;
}

// --- Caricamento dei monti ore dall'hosting ------------------------------
let _startupRichiesta = 0;   // numero dell'ultima lettura partita: vince la più recente

/**
 * Rilegge i monti ore e ridisegna SOLO le loro schede (il form "Nuovo monte
 * ore" sta fuori dall'elenco e non si tocca). Se in una scheda si stanno
 * registrando ore, il disegno si rimanda: il testo sparirebbe sotto le dita.
 */
async function caricaStartup() {
    const mia = ++_startupRichiesta;
    try {
        const res = await fetch(`${_startupApiUrl()}?action=get_startup_list`, { noSpinner: true });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        if (mia !== _startupRichiesta) return;
        startupDati = result;
        _disegnaStartup();
    } catch (e) {
        console.error('Errore caricamento Startup Kleos:', e);
        if (mia !== _startupRichiesta) return;
        const lista = document.getElementById('startupLista');
        if (lista && !startupDati) {
            lista.innerHTML = `<div class="empty-state"><div>Errore: ${_escHome(e.message)}</div>
                <button class="home-btn" style="margin-top:12px;" onclick="caricaStartup()">Riprova</button></div>`;
        }
    }
}

function _disegnaStartup() {
    const lista = document.getElementById('startupLista');
    if (!lista) return;   // la Home non è ancora disegnata: ci penserà renderHome
    const inCorso = Array.from(lista.querySelectorAll('[id^="registra-ore-"]')).some(box =>
        box.style.display !== 'none' &&
        Array.from(box.querySelectorAll('input[type="number"], textarea')).some(el => el.value.trim() !== ''));
    if (inCorso) return;
    lista.innerHTML = renderStartupLista(startupDati);
    const conteggi = document.getElementById('startup-conteggi');
    if (conteggi) conteggi.innerHTML = renderStartupConteggi(startupDati);
    _riapriMovimenti();
}

/** Dopo un ridisegno riapre i movimenti che erano aperti. */
function _riapriMovimenti() {
    Object.keys(startupDettaglioAperti).forEach(id => {
        if (startupDettaglioAperti[id]) caricaMovimenti(id);
    });
}

function renderStartupCard(s) {
    const sforato  = s.oreResidue < 0;
    const esaurito = s.oreResidue <= 0;
    const classeCard = sforato ? 'sforato' : (esaurito ? 'esaurito' : '');

    const sub = [s.agente, s.riferimento].filter(Boolean).join(' · ');

    const coloreBarra = sforato ? 'over' : (esaurito ? 'terminato' : 'attivo');

    return `
    <div class="home-startup-card ${classeCard}">
        <div class="home-startup-header">
            <div>
                <div class="home-startup-cliente">${_escHome(s.cliente)}</div>
                ${sub ? `<div class="home-startup-sub">${_escHome(sub)}</div>` : ''}
            </div>
            <span class="storico-badge ${esaurito ? 'scaduto' : 'attivo'}">${_escHome(s.stato)}</span>
        </div>

        <div class="storico-progress-bar">
            <div class="storico-progress-fill ${coloreBarra}" style="width:${s.percentualeUso}%;"></div>
        </div>

        <div class="home-startup-ore">
            <div class="storico-stat">
                <span class="storico-stat-label">Totali</span>
                <span class="storico-stat-value">${_fmtOre(s.oreTotali)}h</span>
            </div>
            <div class="storico-stat">
                <span class="storico-stat-label">Usate</span>
                <span class="storico-stat-value">${_fmtOre(s.oreUtilizzate)}h</span>
            </div>
            <div class="storico-stat">
                <span class="storico-stat-label">Residue</span>
                <span class="storico-stat-value ${esaurito ? 'home-startup-residue esaurito' : ''}">${_fmtOre(s.oreResidue)}h</span>
            </div>
        </div>

        ${s.note ? `<div class="storico-date" style="margin-bottom:6px;">${_escHome(s.note)}</div>` : ''}

        <div class="storico-actions">
            <button class="btn-small btn-storico-detail" onclick="toggleRegistraOre('${s.idStartup}')">
                <i class="fas fa-stopwatch"></i> Registra ore
            </button>
            <button class="btn-small" onclick="toggleMovimenti('${s.idStartup}')">
                <i class="fas fa-clock-rotate-left"></i> Movimenti
            </button>
            <button class="btn-small" onclick="archiviaStartupUI('${s.idStartup}')">
                <i class="fas fa-box-archive"></i> Archivia
            </button>
        </div>

        <div id="registra-ore-${s.idStartup}" class="home-inline-form" style="display:none;">
            <div class="riga">
                <input type="date" id="ore-data-${s.idStartup}" value="${_oggiISO()}">
                <input type="number" id="ore-quantita-${s.idStartup}" placeholder="Ore" step="0.5" min="0.5" style="width:100px;">
                <select id="ore-tipo-${s.idStartup}">
                    <option value="Formazione">Formazione</option>
                    <option value="Configurazione">Configurazione</option>
                    <option value="Altro">Altro</option>
                </select>
            </div>
            <textarea id="ore-rapportino-${s.idStartup}" placeholder="Rapportino: cosa è stato fatto"></textarea>
            <div style="margin-top:8px;">
                <button class="home-btn" onclick="salvaOre('${s.idStartup}')"><i class="fas fa-check"></i> Salva</button>
                <button class="home-btn secondario" onclick="toggleRegistraOre('${s.idStartup}')">Annulla</button>
            </div>
        </div>

        <div id="movimenti-${s.idStartup}" style="display:none;margin-top:10px;"></div>
    </div>`;
}

function toggleNuovoStartup() {
    const form = document.getElementById('nuovoStartupForm');
    if (!form) return;
    const aperto = form.style.display !== 'none';
    form.style.display = aperto ? 'none' : 'block';
    if (!aperto) document.getElementById('startup-cliente')?.focus();
}

async function creaStartup() {
    const cliente = (document.getElementById('startup-cliente')?.value || '').trim();
    const ore     = document.getElementById('startup-ore')?.value || '';

    if (!cliente) { alert('Il nome del cliente è obbligatorio'); return; }
    if (!ore || parseFloat(ore) <= 0) { alert('Indica le ore totali'); return; }

    const params = new URLSearchParams({
        action: 'insert_startup',
        cliente: cliente,
        ore_totali: ore,
        data_inizio: document.getElementById('startup-data')?.value || '',
        agente: (document.getElementById('startup-agente')?.value || '').trim(),
        riferimento: (document.getElementById('startup-riferimento')?.value || '').trim(),
        note: (document.getElementById('startup-note')?.value || '').trim()
    });

    try {
        const res = await fetch(`${_startupApiUrl()}?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        ['startup-cliente', 'startup-ore', 'startup-agente', 'startup-riferimento', 'startup-note']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        toggleNuovoStartup();
        await caricaStartup();
    } catch (e) {
        alert('Errore creazione monte ore: ' + e.message);
    }
}

function toggleRegistraOre(idStartup) {
    const box = document.getElementById(`registra-ore-${idStartup}`);
    if (!box) return;
    const aperto = box.style.display !== 'none';
    box.style.display = aperto ? 'none' : 'block';
    if (!aperto) document.getElementById(`ore-quantita-${idStartup}`)?.focus();
}

async function salvaOre(idStartup) {
    const ore = document.getElementById(`ore-quantita-${idStartup}`)?.value || '';

    if (!ore || parseFloat(ore) <= 0) { alert('Indica le ore erogate'); return; }

    const params = new URLSearchParams({
        action: 'registra_ore_startup',
        id_startup: idStartup,
        data: document.getElementById(`ore-data-${idStartup}`)?.value || '',
        ore: ore,
        tipo: document.getElementById(`ore-tipo-${idStartup}`)?.value || 'Altro',
        rapportino: (document.getElementById(`ore-rapportino-${idStartup}`)?.value || '').trim()
    });

    try {
        const res = await fetch(`${_startupApiUrl()}?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        if (result.sforato) alert(result.message);

        startupDettaglioAperti[idStartup] = true;   // dopo il refresh mostra i movimenti
        // Il form è salvato: si chiude, altrimenti il ridisegno aspetterebbe
        const box = document.getElementById(`registra-ore-${idStartup}`);
        if (box) box.style.display = 'none';
        await caricaStartup();

    } catch (e) {
        alert('Errore registrazione ore: ' + e.message);
    }
}

function toggleMovimenti(idStartup) {
    const box = document.getElementById(`movimenti-${idStartup}`);
    if (!box) return;

    const aperto = box.style.display !== 'none';
    if (aperto) {
        box.style.display = 'none';
        startupDettaglioAperti[idStartup] = false;
    } else {
        box.style.display = 'block';
        startupDettaglioAperti[idStartup] = true;
        caricaMovimenti(idStartup);
    }
}

async function caricaMovimenti(idStartup) {
    const box = document.getElementById(`movimenti-${idStartup}`);
    if (!box) return;

    box.style.display = 'block';
    box.innerHTML = '<div style="font-size:12px;color:#888;">⏳ Caricamento movimenti...</div>';

    try {
        const res = await fetch(`${_startupApiUrl()}?action=get_startup_movimenti&id_startup=${encodeURIComponent(idStartup)}`, { noSpinner: true });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        const movimenti = result.movimenti || [];

        if (!movimenti.length) {
            box.innerHTML = '<div style="font-size:12px;color:#888;">Nessuna ora ancora registrata.</div>';
            return;
        }

        box.innerHTML = movimenti.map(m => `
            <div class="home-mov-row ${(m.tipo || '').toLowerCase()}">
                <div class="home-mov-head">
                    <span>${_escHome(m.data)} · ${_fmtOre(m.ore)}h · ${_escHome(m.tipo)}</span>
                    <button class="btn-small" style="background:none;color:#bbb;padding:2px 6px;"
                            title="Elimina movimento"
                            onclick="eliminaMovimento('${m.idMovimento}', '${idStartup}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                ${m.rapportino ? `<div class="home-mov-rapportino">${_escHome(m.rapportino)}</div>` : ''}
            </div>`).join('');

    } catch (e) {
        box.innerHTML = `<div style="font-size:12px;color:#dc3545;">Errore: ${_escHome(e.message)}</div>`;
    }
}

async function eliminaMovimento(idMovimento, idStartup) {
    if (!confirm('Eliminare questo movimento? Le ore torneranno disponibili.')) return;

    try {
        const res = await fetch(`${_startupApiUrl()}?action=delete_movimento_startup&id_movimento=${encodeURIComponent(idMovimento)}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        startupDettaglioAperti[idStartup] = true;
        await caricaStartup();

    } catch (e) {
        alert('Errore eliminazione movimento: ' + e.message);
    }
}

async function archiviaStartupUI(idStartup) {
    if (!confirm('Archiviare questo monte ore? Sparisce dalla Home ma resta consultabile.')) return;

    try {
        const res = await fetch(`${_startupApiUrl()}?action=archivia_startup&id_startup=${encodeURIComponent(idStartup)}&archivia=true`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        delete startupDettaglioAperti[idStartup];
        await caricaStartup();

    } catch (e) {
        alert('Errore archiviazione: ' + e.message);
    }
}

// =======================================================================
// === ESPOSIZIONE GLOBALE (onclick inline) ===
// =======================================================================

window.initHome = initHome;
window.loadHome = loadHome;
window.vaiA = vaiA;

window.aggiungiTodo = aggiungiTodo;
window.segnaTodo = segnaTodo;
window.eliminaTodo = eliminaTodo;
window.toggleTodoFatti = toggleTodoFatti;
window.modificaTodo = modificaTodo;
window.toggleRegistraControllo = toggleRegistraControllo;
window.salvaControllo = salvaControllo;
window.apriCanone = apriCanone;
window.salvaModificaTodo = salvaModificaTodo;
window.annullaModificaTodo = annullaModificaTodo;

window.toggleNuovoStartup = toggleNuovoStartup;
window.creaStartup = creaStartup;
window.toggleRegistraOre = toggleRegistraOre;
window.salvaOre = salvaOre;
window.toggleMovimenti = toggleMovimenti;
window.eliminaMovimento = eliminaMovimento;
window.archiviaStartupUI = archiviaStartupUI;
window.caricaStartup = caricaStartup;
window.caricaTodo = caricaTodo;
