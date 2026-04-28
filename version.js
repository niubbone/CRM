/**
 * CRM Studio Smart - Version Manager
 * 
 * UNICO PUNTO PER AGGIORNARE LA VERSIONE
 * 
 * Quando rilasci una nuova versione:
 * 1. Cambia VERSION qui sotto
 * 2. Aggiungi entry in CHANGELOG (riga 65)
 * 3. Copia lo stesso numero in service-worker.js (riga 11)
 * 4. Tutto il resto si aggiorna automaticamente:
 *    - UI (box utilities)
 *    - Console logs
 *    - Page title
 *    - Footer
 */

// ============================================
// CAMBIA SOLO QUESTO NUMERO
// ============================================
export const VERSION = '4.8.5';
// ============================================

// DOPO aver cambiato VERSION sopra:
// Apri service-worker.js
// Cerca "const VERSION = " (riga 11)
// Copia lo stesso numero li
// Fatto!

// Metadata versione (auto-generated)
export const VERSION_INFO = {
  number: VERSION,
  name: 'Pannello Cliente Edition',
  date: '27 Aprile 2026',
  codename: 'ProformaFix',

  // Changelog corrente versione
  changelog: [
    'Fix SyntaxError in proforma-list.js riga 266: clienteEscaped estratto prima del template literal',
    'Risolto: proforma-list.js non caricava mai perché il file non veniva parsato dal browser',
  ],
  
  // Features principali
  features: {
    backend: 'v4.0 Refactored + Cleanup',
    frontend: 'v4.0 PWA + Cleanup',
    pwa: true,
    offline: true,
    serviceWorker: true
  }
};

// Build info (opzionale)
export const BUILD_INFO = {
  environment: 'production', // 'development' | 'staging' | 'production'
  buildDate: new Date().toISOString(),
  commit: 'manual' // se usi Git: processo automatico
};

// ============================================
// CHANGELOG COMPLETO - Aggiungi nuove versioni QUI IN CIMA
// ============================================
export const CHANGELOG = [
  {
    version: "4.8.5",
    date: "28/04/2026",
    type: "cleanup",
    changes: [
      "Rimossi 3 pulsanti ridondanti sotto 'Prodotti Attivi' nel pannello cliente (Modifica, Esporta, Crea Proforma)",
      "Le stesse azioni sono già disponibili nella sezione anagrafica e accanto al timesheet non fatturati"
    ]
  },
  {
    version: "4.8.4",
    date: "27/04/2026",
    type: "fix",
    changes: [
      "Fix SyntaxError in proforma-list.js riga 266: template literal annidato con .replace() e escape non valido",
      "clienteEscaped estratto come variabile prima del return — proforma-list.js finalmente si carica"
    ]
  },
  {
    version: "4.8.3",
    date: "27/04/2026",
    type: "cleanup",
    changes: [
      "Ripristino codice originale: rimossi MutationObserver, data-tab e modifiche intermedie (4.7.8→4.8.2)",
      "Unica modifica mantenuta: fix populateClientDropdown — usa window.clients + popola datalist corretto"
    ]
  },
  {
    version: "4.8.2",
    date: "28/04/2026",
    type: "fix",
    changes: [
      "Fix populateClientDropdown in proforma.js: usava data.data.clienti (struttura inesistente) invece di window.clients già caricato da timesheet.js",
      "Fix: aggiungeva <option> all'<input> invece che al <datalist id='proforma-client-list'> — nessun effetto visibile",
      "Rimossa chiamata API ridondante: i clienti sono già in window.clients dopo initTimesheet()"
    ]
  },
  {
    version: "4.8.1",
    date: "28/04/2026",
    type: "fix",
    changes: [
      "Fix proforma list: MutationObserver su proforma-tab — caricamento completamente autonomo da switchTab/setupTabs",
      "loadProformaList() non dipende più da main.js: si attiva ogni volta che proforma-tab acquista classe 'active'"
    ]
  },
  {
    version: "4.8.0",
    date: "27/04/2026",
    type: "fix",
    changes: [
      "Fix root cause proforma list bloccata: rimosso onclick dai pulsanti tab — elimina double-call che causava race condition",
      "setupTabs() ora usa data-tab attribute — unica fonte di verità per navigazione tab",
      "Bump versione SW forza invalidazione cache crm-v4.7.9 — file JS aggiornati subito senza stale-while-revalidate"
    ]
  },
  {
    version: "4.7.9",
    date: "27/04/2026",
    type: "fix",
    changes: [
      "Fix definitivo proforma list: non usa più _tabLoaded, carica sempre se il container non ha dati reali",
      "Risolto conflitto double-call onclick+addEventListener sui pulsanti tab"
    ]
  },
  {
    version: "4.7.8",
    date: "23/04/2026",
    type: "fix",
    changes: [
      "Fix proforma list: tab tornava in loading silenzioso se l'utente navigava via durante il caricamento",
      "Fix filtri anno/stato proforma: onchange ora usa filterProformaLocal() (nessuna richiesta server inutile)",
      "Rimossi addEventListener duplicati per anno/stato filter (consolidati in HTML onchange)"
    ]
  },
  {
    version: "4.7.7",
    date: "24/04/2026",
    type: "fix",
    changes: [
      "Backend createCliente: aggiunta invalidateCacheData() + flush dopo appendRow",
      "Frontend: dopo creazione cliente ricarica window.clients con cache-bust (nuovo cliente subito disponibile nel dropdown timesheet)"
    ]
  },
  {
    version: "4.7.6",
    date: "23/04/2026",
    type: "fix",
    changes: [
      "Frontend: isErrore usa .toLowerCase() — righe 'Errore pacchetto' mostrate correttamente (non più come 'Da fatturare')",
      "Backend: doPost scrive 'Errore pacchetto' (p minuscola) coerente col dropdown RIF",
      "Backend: convertiDaFatturare e riagganciaRigheOrfane usano confronto case-insensitive"
    ]
  },
  {
    version: "4.7.5",
    date: "23/04/2026",
    type: "fix",
    changes: [
      "doPost catch: errore salvato in ScriptProperties, visibile via get_last_warning invece di sparire silenziosamente",
      "getClienteTimesheet: filtro STATI_PENDENTI case-insensitive (risolve Errore pacchetto vs Errore Pacchetto)",
      "getLastWarning(bustCache=true): dopo il submit del form bypassa la cache SW per dati sempre aggiornati"
    ]
  },
  {
    version: "4.7.4",
    date: "23/04/2026",
    type: "fix",
    changes: [
      "'Omaggio' e 'Pagato' aggiunti alla convalida dati Mod_Addebito (non sovrascrivono più il dropdown)",
      "Nuova funzione aggiornaConvalidaModAddebito() per allineare l'intera colonna K in una volta",
      "abbuonaOreExtra e segnaPagato ora impostano la regola corretta invece di cancellarla"
    ]
  },
  {
    version: "4.7.3",
    date: "23/04/2026",
    type: "fix",
    changes: [
      "Fix abbuonaOreExtra: caso parziale (Scalato + Durata_Ore > oreExtra) ora splitta la riga",
      "Riga originale ridotta a (Durata_Ore - oreExtra) e mantiene stato 'Scalato'",
      "Nuova riga aggiunta con solo le ore extra, Mod_Addebito='Omaggio', Costo_Finale=0"
    ]
  },
  {
    version: "4.7.2",
    date: "23/04/2026",
    type: "fix",
    changes: [
      "Stampa pacchetto: righe 'Omaggio' integrate nella tabella principale con sfondo verde e '🎁 In omaggio' al posto del costo",
      "Stampa pacchetto: card riepilogativa 'In omaggio' con totale ore in verde",
      "Stampa pacchetto: footer tabella mostra ore in omaggio nella colonna Tipo"
    ]
  },
  {
    version: "4.7.1",
    date: "23/04/2026",
    type: "fix",
    changes: [
      "Mod_Addebito 'Abbuonato' rinominato in 'Omaggio' (backend + frontend)",
      "Nuovo valore Mod_Addebito 'Pagato' per pagamenti in contanti",
      "Bottone 💵 Pagato nel pannello timesheet cliente per righe Da fatturare",
      "Backend segnaPagato: bypass convalida dati foglio sulla singola cella"
    ]
  },
  {
    version: "4.7.0",
    date: "23/04/2026",
    type: "feature",
    changes: [
      "Pannello cliente: bottone 'Crea Proforma' accanto all'intestazione Timesheet Non Fatturati",
      "Pannello cliente: canoni e firme ora visibili in sezione dedicata (fix strict equality backend)",
      "Pannello cliente: prodotti raggruppati per tipo (Canoni & Firme / Pacchetti) con intestazioni visive"
    ]
  },
  {
    version: "4.6.0",
    date: "21/04/2026",
    type: "feature",
    changes: [
      "Ore extra: rimossa email immediata al salvataggio — gestione differita",
      "Ore extra: nuovo bottone Abbuona (🎁) nel pannello cliente",
      "Ore extra: trigger giornaliero invia reminder dopo 5 giorni di sospeso",
      "Ore extra: email riepilogativa consolidata raggruppata per cliente",
      "Stampa pacchetto: sezione 'Ore in omaggio' per righe Abbuonato",
      "Badge rosso sul tab Clienti con conteggio ore extra in sospeso",
      "Verifica Integrità: nuovo check ORE_EXTRA_IN_SOSPESO con tabella per cliente",
      "Backend: nuove action abbuona_ore_extra e get_ore_extra_count",
      "Righe orfane: check integrità integrato con bottone Riaggancia inline",
      "Proforma: filtro stato corretto (Proforma/Fatturata)",
      "Proforma: aggiornaProforma — aggiunge righe timesheet a proforma esistente",
      "Ultimi movimenti: accordion on-demand per migliori performance"
    ]
  },
  {
    version: "4.5.7",
    date: "08/04/2026",
    type: "feature",
    changes: [
      "QODNET: nuova sezione vendite con inserimento contratti, rinnovi e riepilogo",
      "Firme: collegamento fattura da riepilogo (numero + data) con calcolo ritenuta 20%",
      "Spinner overlay su tutte le chiamate fetch (card centrata, non invasiva)",
      "Cache tab per sessione: cambio tab non ricarica se dati già presenti",
      "Invalidazione cache selettiva dopo ogni inserimento (solo tab interessate)",
      "Pulsanti cliente semplificati: solo Dettaglio, Anagrafica, Modifica",
      "Ordinamento fatture: tiebreaker per numero fattura in caso di stessa data",
      "Fix: URL deployment stabile — nessun rischio perdita dati futura"
    ]
  },
  {
    version: "4.5.0",
    date: "02/04/2026",
    type: "feature",
    changes: [
      "Sezione Vendite ristrutturata: navigazione a 4 card (Pacchetti, Canoni, Firme, Scadenze)",
      "Subtab Nuovo / Riepilogo per ogni tipo prodotto con caricamento lazy",
      "Riepilogo Pacchetti: tutte le ore attive/terminate/over/scadute con barra utilizzo e stampa PDF",
      "Riepilogo Canoni: tutte le scadenze attive/scadute per cliente con badge fatturazione",
      "Riepilogo Firme: Token e Remota con countdown scadenza e rinnovo diretto",
      "Sincronizzazione pagamento Fatture→Proforma: aggiornamento automatico campo Pagato",
      "Tab bar fissa in cima durante lo scroll",
      "Fix: tab Fatture non si caricava (onclick mancante sul pulsante)"
    ]
  },
  {
    version: "4.4.0",
    date: "31/03/2026",
    type: "feature",
    changes: [
      "Storico pacchetti: sezione dedicata in Vendite con tutti i pacchetti TERMINATO/OVER/SCADUTO",
      "Filtro storico per cliente (datalist) e per stato",
      "Cards raggruppate per cliente con barra utilizzo ore e dati chiave",
      "Dettaglio interventi accessibile dallo storico con context completo (date, ore acquistate)",
      "Stampa riepilogo: report HTML print-ready con intestazione, tabella interventi, totali e progress bar",
      "Fix: scala ore extra aggiorna ID_Pacchetto sulla riga timesheet, intervento visibile nel nuovo pacchetto"
    ]
  },
  {
    version: "4.3.5",
    date: "25/03/2026",
    type: "feature",
    changes: [
      "Ore extra: display Xh+Yh nel timesheet, bottoni 💶 converti e 📦 scala inline",
      "Edit timesheet: riconosce automaticamente ore extra ed Errore Pacchetto con banner e azione integrata",
      "Tracciabilità: nota automatica in descrizione originale dopo conversione/scala ore extra",
      "Ricerca cliente uniformata a input+datalist in proforma (step-1), filtro proforma e filtro fatture",
      "Fix changelog utilities: animazione slideDown e badge major/cleanup corretti"
    ]
  },
  {
    version: "4.3.1",
    date: "24/03/2026",
    type: "fix",
    changes: [
      "Fix selettore clienti fatture: <select> sostituito con input + datalist alfabetico",
      "Fix copia dati cliente: card body non clickable, testo ora selezionabile",
      "Fix campo ID cliente: disabled → readonly, copiabile",
      "Fix quickView (👁️): usa modal selezionabile invece di alert()",
      "Card cliente: aggiunto pulsante 🔍 Dettaglio esplicito",
      "Riepilogo pacchetti ore: ore acquistate / utilizzate / residue con colori",
      "Scadenze: giorni rimanenti con colori verde/arancio/rosso",
      "Backend Clienti.js: getClienteProdotti restituisce oreAcquistate e oreUtilizzate"
    ]
  },
  {
    version: "4.3.0",
    date: "05/03/2026",
    type: "feature",
    changes: [
      "Nuovo modulo Fatture: tab dedicata con lista, filtri cliente/anno/stato e totali",
      "Fatture da proforma: registrazione automatica al momento della fatturazione",
      "Fatture dirette: inserimento senza proforma con calcolo IVA 22% automatico",
      "Gestione pagamenti: badge cliccabile per segnare pagata o annullare pagamento",
      "Supporto note di credito: importi negativi con badge rosso e label dedicata",
      "Backend: Fatture.js con tab Google Sheet 'Fatture' (12 colonne, IVA 22%)",
      "Router backend: 3 nuovi endpoint (get_fatture_list, insert_fattura_diretta, update_pagamento_fattura)"
    ]
  },
  {
    version: "4.0.6",
    date: "28/12/2024",
    type: "cleanup",
    changes: [
      "Clienti.gs: Micro-cache privata ELIMINATA (-80 righe)",
      "Timesheet.gs: Campo descrizione aggiunto in getTimesheetByIds()",
      "crm_email.gs: Tabella email proforma con colonna Descrizione",
      "Proforma.gs: Helper calculateProformaTotals() condiviso (query 3->1)",
      "proforma.js: Console.log debug rimossi (riga 60, 79-84)",
      "api.js: Parametro corretto 'cliente' in generateProforma()",
      "Performance: +15% manutenibilita, bug cache-null risolto"
    ]
  },
  {
    version: "4.0.4",
    date: "22/12/2024",
    type: "fix",
    changes: [
      "Fix campo cliente vendite: input con ricerca",
      "Fix backend Firme.gs e Canoni.gs: parametri GET",
      "Fix Service Worker: auto-detect base path",
      "Version display: styling light e centrato"
    ]
  },
  {
    version: "4.0.1",
    date: "21/12/2024",
    type: "feature",
    changes: [
      "Service Worker implementato",
      "PWA manifest con shortcuts",
      "Cache strategica performance",
      "Version display in Utilities"
    ]
  },
  {
    version: "4.0.0",
    date: "18/12/2024",
    type: "major",
    changes: [
      "Backend refactoring: 16 -> 11 file",
      "Eliminati 1500+ righe duplicate",
      "Micro-cache +70% performance"
    ]
  }
];

/**
 * Format versione per display
 */
export function getVersionString() {
  return `v${VERSION}`;
}

/**
 * Format versione completa con nome
 */
export function getFullVersionString() {
  return `v${VERSION} "${VERSION_INFO.name}"`;
}

/**
 * Format versione con data
 */
export function getVersionWithDate() {
  return `v${VERSION} - ${VERSION_INFO.date}`;
}

/**
 * Check se versione e piu recente
 */
export function isNewerThan(otherVersion) {
  const current = VERSION.split('.').map(n => parseInt(n));
  const other = otherVersion.split('.').map(n => parseInt(n));
  
  for (let i = 0; i < 3; i++) {
    if (current[i] > other[i]) return true;
    if (current[i] < other[i]) return false;
  }
  
  return false;
}

/**
 * Get cache name per Service Worker
 * Usa questo per generare cache version automaticamente
 */
export function getCacheName(prefix = 'crm') {
  return `${prefix}-v${VERSION}`;
}

/**
 * Log versione in console
 */
export function logVersion() {
  console.log(
    `%cCRM Studio Smart v${VERSION}`,
    'font-size: 16px; font-weight: bold; color: #667eea;'
  );
  console.log(`${VERSION_INFO.date} - "${VERSION_INFO.name}"`);
  console.log('Changelog:');
  VERSION_INFO.changelog.forEach(item => console.log(`  ${item}`));
}

/**
 * Get version object per API
 */
export function getVersionObject() {
  return {
    version: VERSION,
    versionInfo: VERSION_INFO,
    buildInfo: BUILD_INFO,
    changelog: CHANGELOG
  };
}

// Auto-log in development
if (BUILD_INFO.environment === 'development') {
  logVersion();
}
