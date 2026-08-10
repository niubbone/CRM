// =======================================================================
// === HOME — TODO + Startup Kleos + pendenze ===
// =======================================================================
// Schermata di apertura dell'app. Tre blocchi:
//   1. Pendenze  → contatori cliccabili che portano alle sezioni esistenti
//   2. TODO      → promemoria scritti a mano (foglio Todo)
//   3. Startup Kleos → monti ore informali non fatturati (foglio Startup_Kleos)
//
// Tutto arriva da una sola chiamata `get_home`: la latenza GAS è alta e
// questa è la prima schermata che si apre, quindi si paga un round-trip solo.
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

let homeData = null;
let startupDettaglioAperti = {};   // idStartup -> true quando il dettaglio è espanso
let todoById = {};                 // idTodo -> record, serve alla modifica inline

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

function initHome() {
    loadHome();
}

async function loadHome() {
    const container = document.getElementById('homeContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading-scadenze">Caricamento...</div>';

    try {
        const res = await fetch(`${_homeApiUrl()}?action=get_home`);
        const result = await res.json();

        if (!result.success) throw new Error(result.error || 'Errore sconosciuto');

        homeData = result;
        renderHome();

    } catch (error) {
        console.error('Errore caricamento home:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div>Errore: ${_escHome(error.message)}</div>
                <button class="home-btn" style="margin-top:12px;" onclick="loadHome()">Riprova</button>
            </div>`;
    }
}

function renderHome() {
    const container = document.getElementById('homeContainer');
    if (!container || !homeData) return;

    container.innerHTML =
        renderPendenze(homeData.pendenze || {}) +
        renderTodoSezione(homeData.todos || {}) +
        renderStartupSezione(homeData.startup || {});

    // Ripristina i dettagli che erano aperti prima del refresh
    Object.keys(startupDettaglioAperti).forEach(id => {
        if (startupDettaglioAperti[id]) caricaMovimenti(id);
    });
}

// =======================================================================
// === BLOCCO 1 — PENDENZE ===
// =======================================================================

function renderPendenze(p) {
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

    return `
    <div class="home-pendenze">
        ${card(p.controlliDaFare || 0, 'Controlli', 'fa-clipboard-check', 'arancio', "vaiA('controlli')")}
        ${card(p.scadenzeTotale || 0, 'Scadenze 90gg', 'fa-calendar-day', (p.scadenzeCritiche > 0 ? 'rosso' : 'blu'), "vaiA('scadenze')")}
        ${card(p.oreExtra || 0, 'Ore extra sospese', 'fa-hourglass-half', 'rosso', "vaiA('oreextra')")}
        ${card(p.proformaDaFatturare || 0, 'Proforma da fatturare', 'fa-file-invoice', 'verde', "vaiA('proforma')")}
        ${card(p.fattureNonPagate || 0, 'Fatture non pagate', 'fa-money-bill-wave', 'rosso', "vaiA('fatture')", importo)}
    </div>`;
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
        case 'controlli': vaiVendite('canoni', 'controlli'); break;
        case 'scadenze':  vaiVendite('scadenze'); break;
        case 'oreextra':
            if (typeof window.switchTab === 'function') window.switchTab('clienti');
            break;
        case 'proforma':
            if (typeof window.switchTab === 'function') window.switchTab('proforma');
            break;
        case 'fatture':
            if (typeof window.switchTab === 'function') window.switchTab('fatture');
            break;
    }
}

// =======================================================================
// === BLOCCO 2 — TODO ===
// =======================================================================

function renderTodoSezione(t) {
    const todos = t.todos || [];

    const lista = todos.length
        ? _indicizzaTodo(todos).map(renderTodoItem).join('')
        : `<div class="empty-state" style="padding:20px;">
               <div class="empty-state-icon">✅</div>
               <div>Nessun promemoria. Tutto sotto controllo.</div>
           </div>`;

    return `
    <div class="home-section">
        <div class="home-section-header">
            <div class="home-section-title">
                <i class="fas fa-list-check"></i> Da fare
                ${t.daFare ? `<span class="home-count">${t.daFare}</span>` : ''}
                ${t.scaduti ? `<span class="home-count" style="background:#f8d7da;color:#721c24;">${t.scaduti} scaduti</span>` : ''}
            </div>
            <button class="home-btn piccolo secondario" onclick="toggleTodoFatti()">
                <i class="fas fa-clock-rotate-left"></i> <span id="todo-toggle-label">Mostra completati</span>
            </button>
        </div>

        <div class="home-todo-form">
            <input type="text" id="todo-nuovo-testo" placeholder="Cosa c'è da fare?"
                   onkeydown="if(event.key==='Enter') aggiungiTodo()">
            <select id="todo-nuova-priorita" title="Priorità">
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
                <option value="Bassa">Bassa</option>
            </select>
            <input type="date" id="todo-nuova-scadenza" title="Scadenza (facoltativa)">
            <button class="home-btn" onclick="aggiungiTodo()"><i class="fas fa-plus"></i> Aggiungi</button>
        </div>

        <div id="todoLista">${lista}</div>
    </div>`;
}

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
        const res = await fetch(`${_homeApiUrl()}?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        // Ricarico tutto: cambiando priorità o scadenza cambia anche l'ordine
        await loadHome();

    } catch (e) {
        alert('Errore modifica TODO: ' + e.message);
    }
}

async function aggiungiTodo() {
    const inputTesto = document.getElementById('todo-nuovo-testo');
    const testo = (inputTesto?.value || '').trim();

    if (!testo) {
        inputTesto?.focus();
        return;
    }

    const priorita = document.getElementById('todo-nuova-priorita')?.value || 'Media';
    const scadenza = document.getElementById('todo-nuova-scadenza')?.value || '';

    let url = `${_homeApiUrl()}?action=insert_todo&testo=${encodeURIComponent(testo)}&priorita=${encodeURIComponent(priorita)}`;
    if (scadenza) url += `&data_scadenza=${encodeURIComponent(scadenza)}`;

    try {
        const res = await fetch(url);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        inputTesto.value = '';
        document.getElementById('todo-nuova-scadenza').value = '';
        await loadHome();
        document.getElementById('todo-nuovo-testo')?.focus();

    } catch (e) {
        alert('Errore aggiunta TODO: ' + e.message);
    }
}

async function segnaTodo(idTodo, fatto) {
    try {
        const res = await fetch(`${_homeApiUrl()}?action=toggle_todo&id_todo=${encodeURIComponent(idTodo)}&fatto=${fatto}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        await loadHome();
    } catch (e) {
        alert('Errore aggiornamento TODO: ' + e.message);
        await loadHome();
    }
}

async function eliminaTodo(idTodo) {
    if (!confirm('Eliminare definitivamente questo promemoria?')) return;

    try {
        const res = await fetch(`${_homeApiUrl()}?action=delete_todo&id_todo=${encodeURIComponent(idTodo)}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        await loadHome();
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

    try {
        const res = await fetch(`${_homeApiUrl()}?action=get_todos&includi_fatti=${todoMostraFatti}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        lista.innerHTML = (result.todos || []).length
            ? _indicizzaTodo(result.todos).map(renderTodoItem).join('')
            : `<div class="empty-state" style="padding:20px;"><div class="empty-state-icon">✅</div><div>Nessun promemoria.</div></div>`;

    } catch (e) {
        lista.innerHTML = `<div class="empty-state"><div>Errore: ${_escHome(e.message)}</div></div>`;
    }
}

// =======================================================================
// === BLOCCO 3 — STARTUP KLEOS ===
// =======================================================================

function renderStartupSezione(s) {
    const lista = s.startup || [];

    const cards = lista.length
        ? lista.map(renderStartupCard).join('')
        : `<div class="empty-state" style="padding:20px;">
               <div class="empty-state-icon">📦</div>
               <div>Nessun monte ore attivo.</div>
           </div>`;

    return `
    <div class="home-section">
        <div class="home-section-header">
            <div class="home-section-title">
                <i class="fas fa-graduation-cap"></i> Startup Kleos
                ${s.attivi ? `<span class="home-count">${s.attivi} attivi</span>` : ''}
                ${s.oreResidueTotali ? `<span class="home-count">${_fmtOre(s.oreResidueTotali)}h residue</span>` : ''}
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

        <div id="startupLista" style="margin-top:12px;">${cards}</div>
    </div>`;
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
        const res = await fetch(`${_homeApiUrl()}?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');
        await loadHome();
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
        const res = await fetch(`${_homeApiUrl()}?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        if (result.sforato) alert(result.message);

        startupDettaglioAperti[idStartup] = true;   // dopo il refresh mostra i movimenti
        await loadHome();

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
        const res = await fetch(`${_homeApiUrl()}?action=get_startup_movimenti&id_startup=${encodeURIComponent(idStartup)}`, { noSpinner: true });
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
        const res = await fetch(`${_homeApiUrl()}?action=delete_movimento_startup&id_movimento=${encodeURIComponent(idMovimento)}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        startupDettaglioAperti[idStartup] = true;
        await loadHome();

    } catch (e) {
        alert('Errore eliminazione movimento: ' + e.message);
    }
}

async function archiviaStartupUI(idStartup) {
    if (!confirm('Archiviare questo monte ore? Sparisce dalla Home ma resta consultabile.')) return;

    try {
        const res = await fetch(`${_homeApiUrl()}?action=archivia_startup&id_startup=${encodeURIComponent(idStartup)}&archivia=true`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Errore');

        delete startupDettaglioAperti[idStartup];
        await loadHome();

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
window.salvaModificaTodo = salvaModificaTodo;
window.annullaModificaTodo = annullaModificaTodo;

window.toggleNuovoStartup = toggleNuovoStartup;
window.creaStartup = creaStartup;
window.toggleRegistraOre = toggleRegistraOre;
window.salvaOre = salvaOre;
window.toggleMovimenti = toggleMovimenti;
window.eliminaMovimento = eliminaMovimento;
window.archiviaStartupUI = archiviaStartupUI;
