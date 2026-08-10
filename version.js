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
export const VERSION = '4.26.0';
// ============================================

// DOPO aver cambiato VERSION sopra:
// Apri service-worker.js
// Cerca "const VERSION = " (riga 11)
// Copia lo stesso numero li
// Fatto!

// Metadata versione (auto-generated)
export const VERSION_INFO = {
  number: VERSION,
  name: 'Home Edition',
  date: '10 Agosto 2026',
  codename: 'Home',

  // Changelog corrente versione
  changelog: [
    'Feat: nuova tab Home, aperta di default — promemoria, pendenze e Startup Kleos in un colpo solo',
    'Feat: TODO con priorità e scadenza facoltativa, ordinati per urgenza',
    'Feat: Startup Kleos — monti ore informali con cliente a testo libero, senza ID né fatturazione',
    'Feat: registrazione ore con rapportino e tipo (Formazione/Configurazione/Altro), scalo automatico',
    'Feat: contatori cliccabili (controlli, scadenze, ore extra, proforma) che portano alla sezione giusta',
    'Backend: nuovi moduli Todo.gs, StartupKleos.gs, Home.gs + fogli Todo, Startup_Kleos, Startup_Kleos_Movimenti',
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
    version: "4.26.0",
    date: "10/08/2026",
    type: "fix",
    changes: [
      "Card ToDo: ora conta TUTTO cio' che incombe nella Home (promemoria da fare + controlli in sospeso), non i soli controlli. Cliccandola si scorre alla sezione Da fare invece di cambiare tab",
      "Promemoria piu' leggibili: testo 15px in peso medio e colore piu' contrastato (16px su telefono), meta 12.5/13px",
      "Nuovo Da fare: priorita', scadenza e pulsante ora affiancati su una riga sola, sia su PC che su telefono",
      "Fix mobile: select e campi data non hanno piu' il fondo grigio di sistema — sfondo bianco, testo scuro, freccia del select ridisegnata",
      "Campi a 16px su telefono: sotto quella soglia iOS zooma la pagina quando ci si clicca dentro",
      "Solo frontend (backend invariato @261)"
    ]
  },
  {
    version: "4.25.0",
    date: "10/08/2026",
    type: "fix",
    changes: [
      "Rimossa la libreria Phosphor Icons: era caricata da CDN ma non usata da nessuna parte (una richiesta di rete in meno all'avvio). Le icone sono e restano Font Awesome",
      "Barra tab ora scorrevole in orizzontale: con 7 tab su schermi stretti eccedeva la larghezza e veniva TAGLIATA (html ha overflow-x:hidden), rendendo irraggiungibili le ultime voci",
      "Blu unificato: --primary-color passa da #007bff a #1a73e8, il blu gia' usato da card e bottoni. Erano due blu diversi nella stessa interfaccia (35 punti in 8 file)",
      "Hover delle tab ora giallo: prima era un blu piu' scuro di quello della tab attiva, quindi una tab inattiva sotto il mouse sembrava piu' selezionata di quella vera. La tab attiva resta blu anche sotto il mouse",
      "Consolidate le regole CSS duplicate in main.css (.empty-state definita due volte, blocco bottoni modal pacchetto ripetuto): stessi valori effettivi di prima, nessun cambiamento a schermo",
      "Solo frontend (backend invariato @261)"
    ]
  },
  {
    version: "4.24.0",
    date: "10/08/2026",
    type: "feature",
    changes: [
      "Home: i controlli hanno ora una SEZIONE PROPRIA. L'ordine e' Da fare / Controlli / Startup Kleos",
      "Controlli: avviso quando il periodo dedotto dall'etichetta cade DOPO la scadenza del canone (etichetta incoerente col ciclo) — bordo giallo, riquadro di avviso e contatore 'da verificare' in testa alla sezione",
      "Controlli: link al canone di origine. Porta a Vendite -> Canoni -> Riepilogo, evidenzia la card e apre l'elenco dei suoi controlli",
      "Il link attende che la card compaia nel DOM invece di usare un ritardo fisso (il riepilogo si carica in modo asincrono)",
      "Backend @261 - Controlli.gs (oltreScadenzaCanone, canoneDescrizione)"
    ]
  },
  {
    version: "4.23.0",
    date: "10/08/2026",
    type: "feature",
    changes: [
      "Home / Da fare: i controlli periodici in sospeso compaiono ora nella lista insieme ai promemoria, con chip viola 'Controllo' e registrazione inline (data + rapportino)",
      "I controlli hanno finalmente una scadenza propria: viene DEDOTTA dall'etichetta-mese, senza aggiungere colonne al foglio. Canone dal 01/06/2026 con etichette 'Luglio' e 'Gennaio' -> luglio 2026 e gennaio 2027",
      "L'anno si ricava camminando in avanti dalla data di inizio canone, cosi' il ciclo annuale puo' scavalcare il capodanno",
      "Etichette che non sono mesi (es. 'Primo giro') restano senza data e ripiegano sulla scadenza del canone",
      "La lista Da fare e' ordinata per urgenza mescolando promemoria e controlli; il contatore in testa mostra il totale e quanti sono in ritardo",
      "Backend @260 - Controlli.gs (assegnaPeriodiPrevisti_), Home.gs"
    ]
  },
  {
    version: "4.22.0",
    date: "10/08/2026",
    type: "fix",
    changes: [
      "Home / Promemoria: priorita' Media ora gialla invece che arancione — rosso e arancione erano troppo simili per distinguerli a colpo d'occhio",
      "Home / Pendenze: la prima card si chiama 'ToDo'",
      "Solo frontend (backend invariato @259)"
    ]
  },
  {
    version: "4.21.0",
    date: "10/08/2026",
    type: "feature",
    changes: [
      "Home / Promemoria: pulsante Modifica su ogni TODO — la riga diventa un form inline con testo, priorita' e scadenza",
      "Svuotare il campo data rimuove la scadenza; Invio salva, Esc annulla",
      "Dopo il salvataggio la lista si riordina (cambiare priorita' o scadenza cambia la posizione)",
      "Home / Pendenze: nuova card 'Fatture non pagate' con il totale da incassare (Pagato != SI; le note di credito sono escluse)",
      "Home / Pendenze: la prima card si chiama ora 'Controlli' — 'Controlli da fare' si confondeva con la sezione 'Da fare'",
      "Backend @259 - Home.gs (contaFattureNonPagate_)"
    ]
  },
  {
    version: "4.20.0",
    date: "10/08/2026",
    type: "feature",
    changes: [
      "Nuova tab HOME, ora e' la schermata di apertura dell'app",
      "Home / Promemoria: lista TODO con priorita (Alta/Media/Bassa) e scadenza facoltativa, ordinati per urgenza; i completati sono nascosti e richiamabili",
      "Home / Pendenze: quattro contatori cliccabili (controlli da fare, scadenze 90gg, ore extra sospese, proforma da fatturare) che portano direttamente alla sezione che le gestisce",
      "Home / Startup Kleos: monti ore informali per i pacchetti compresi nelle vendite degli agenti Kleos. Cliente a TESTO LIBERO, nessun ID cliente, nessuna scadenza, nessuna fatturazione",
      "Startup Kleos: registrazione ore con data, rapportino e tipo (Formazione/Configurazione/Altro); lo scalo e' automatico e le ore residue si ricalcolano dai movimenti",
      "Startup Kleos: piu' monti ore per lo stesso cliente (uno per vendita), agente e riferimento vendita sulla testata, archiviazione quando le ore finiscono",
      "Tutta la Home arriva da una sola chiamata get_home (un solo round-trip verso GAS)",
      "Backend @258 - nuovi moduli Todo.gs, StartupKleos.gs, Home.gs"
    ]
  },
  {
    version: "4.19.0",
    date: "10/08/2026",
    type: "feature",
    changes: [
      "Firme rinnovate: mostrate come RINNOVATO invece di SCADUTO (stessa logica gia' attiva sui canoni). Rilevamento via catena ID_Precedente, copre anche i rinnovi passati senza migrazione dei dati",
      "Riepilogo Firme: il filtro di default mostra solo attive + scadute non rinnovate; le rinnovate sono accessibili come 'Rinnovate (storico)' o 'Tutti'",
      "Firma: pulsante 'Storico' che mostra inline la catena dei rinnovi (periodo, importo, stato di ogni ciclo)",
      "Fix: rinnovaFirma scriveva lo stato 'SCADUTA', valore non usato da nessun'altra parte del sistema (il foglio Firme usa 'Attivo'/'Scaduto'). Ora scrive 'Rinnovato'",
      "Backend @257 - Firme.gs + Rinnovi.gs"
    ]
  },
  {
    version: "4.18.0",
    date: "07/08/2026",
    type: "fix",
    changes: [
      "Fix Rinnova dal Riepilogo Canoni/Firme: openRinnovoModal cercava il prodotto solo tra quelli in scadenza <90gg (scadenzeData) → 'Prodotto non trovato' per canoni/firme con scadenza lontana. Ora fa fallback su canoniData/firmeData",
      "Rinnovo: dopo il completamento ricarica anche il riepilogo canoni/firme (non solo le scadenze)",
      "Data scadenza nel modal rinnovo gestita sia come gg/mm/aaaa sia come Date",
      "Solo frontend (backend invariato @256)"
    ]
  },
  {
    version: "4.17.0",
    date: "07/08/2026",
    type: "feature",
    changes: [
      "Riepilogo Canoni: i canoni-controlli sono distinti graficamente (bordo sinistro arancio + chip 'Controlli')",
      "Riepilogo Canoni: pulsante 'Controlli (N)' sulla card apre lo storico completo delle visite (fatte con data+rapportino e da fare), con Registra/Modifica/Azzera direttamente lì",
      "Solo frontend (backend invariato @256)"
    ]
  },
  {
    version: "4.16.0",
    date: "06/08/2026",
    type: "fix",
    changes: [
      "Timeout caricamento proforma e fatture alzati da 15s a 30s (safety 20s→35s): GAS ha picchi di latenza ~18-25s che facevano scattare il timeout durante il caricamento delle liste",
      "Solo frontend (nessuna modifica backend, resta @256)"
    ]
  },
  {
    version: "4.15.0",
    date: "06/08/2026",
    type: "feature",
    changes: [
      "Canoni rinnovati: mostrati come RINNOVATO invece di SCADUTO. Rilevamento via catena ID_Precedente, copre anche i rinnovi passati (memorizzati come SCADUTO nel foglio). rinnovaCanone ora salva RINNOVATO",
      "Riepilogo Canoni: default mostra solo attivi + scaduti non rinnovati; i rinnovati sono nascosti (accessibili come 'Rinnovati (storico)' o 'Tutti')",
      "Canone: pulsante 'Storico' che mostra inline la catena dei rinnovi (periodo, importo, stato di ogni ciclo)",
      "Scadenze: get_scadenze e get_controlli_da_fare ora in parallelo (attesa ~dimezzata)",
      "SW: guard anti-loop sul reload (hotfix 4.14.x)",
      "Backend @256 — Canoni.gs + Rinnovi.gs"
    ]
  },
  {
    version: "4.14.0",
    date: "06/08/2026",
    type: "feature",
    changes: [
      "Controlli da fare anche nella dashboard Scadenze generale (Vendite → Scadenze), in cima e con registrazione inline",
      "Fix: pacchetti con ore esaurite non generano più l'alert email di scadenza — getPacchettiScaduti salta i pacchetti con ore residue <= 0 (la scadenza per data non è rilevante se le ore sono finite)",
      "Refactor UI controlli: funzioni namespaced (prefix) riusabili fra subtab Canoni e dashboard Scadenze senza collisioni di ID",
      "Backend @255 — Pacchetti.gs"
    ]
  },
  {
    version: "4.13.0",
    date: "06/08/2026",
    type: "feature",
    changes: [
      "Vista d'insieme 'Controlli da fare': terzo subtab sotto Vendite → Canoni con tutti i controlli pendenti dei canoni ATTIVI, raggruppati per cliente e ordinati per scadenza canone",
      "Registrazione controllo inline dalla dashboard (data + report) senza passare dal pannello cliente",
      "Backend: nuova action get_controlli_da_fare + getControlliDaFare() (cross-check canoni ATTIVI)",
      "Backend @254 — Controlli.gs + Codice.gs"
    ]
  },
  {
    version: "4.12.0",
    date: "06/08/2026",
    type: "feature",
    changes: [
      "Canoni tipo CONTROLLI: ibrido canone/pacchetto per controlli periodici — abbonamento a N visite/controlli per ciclo annuale, fatturato una volta l'anno come canone normale",
      "Foglio Canoni: nuove colonne Tipo (STANDARD|CONTROLLI) e N_Controlli con migrazione header automatica",
      "Nuovo foglio Controlli + modulo Controlli.gs: ogni visita tracciata con data eseguita, report testuale e stato (Da fare|Eseguito)",
      "Form Nuovo Canone: checkbox 'Controlli periodici' con numero controlli e etichette libere per slot (es. Luglio, Dicembre)",
      "Pannello cliente: sotto il canone-controlli, elenco slot con mini-form per registrare data + report (Registra/Modifica/Azzera)",
      "Rinnovo canone-controlli: rigenera automaticamente gli slot del nuovo ciclo ereditando le etichette del ciclo precedente (restano modificabili)",
      "Router backend: 4 nuove action (get_controlli, get_controlli_cliente, registra_controllo, update_controllo)",
      "Backend @248 — Controlli.gs (nuovo) + Canoni.gs + Rinnovi.gs + Clienti.gs + Codice.gs"
    ]
  },
  {
    version: "4.10.0",
    date: "13/07/2026",
    type: "feature",
    changes: [
      "Modal unificato Modifica Proforma: causale, flag forfettario e aggiunta voci timesheet in un'unica interfaccia",
      "Regime forfettario cliente (art. 1 c. 69 L. 190/2014): ritenuta d'acconto = 0, IVA 22% invariata — flag persistito nel foglio Proforma",
      "Checkbox forfettario pre-compilata alla riapertura del modal (getProformaList ora espone il campo)",
      "Gestione cliente rinominato: CLIENT_NOT_FOUND mostra selector inline nel modal + aggiorna record nel foglio",
      "Elimina proforma: cancellazione fisica riga + PDF nel cestino Drive + ripristino voci timesheet a 'Da fatturare' + decremento contatore L2 se ultima dell'anno",
      "Reinvia email proforma: invia il PDF già su Drive al cliente senza rigenerare o ricalcolare",
      "Fix: corpo email rispetta flag forfettario — sendProformaEmail usa calcolaFiscaleForfettario se necessario",
      "UI: Font Awesome 6.5.1 via CDN — icone card proforma (fa-file-pdf, fa-pen, fa-paper-plane, fa-file-invoice, fa-trash)",
      "UI: bordi card uniformi a 2px #b0b8c1 in tutte le sezioni (proforma, clienti, storico pacchetti, utility)",
      "UI: bottoni card proforma standardizzati a tre colori (verde=visualizza/invia, blu=azione, rosso=distruttivo)",
      "Backend @247 — Proforma.js + crm_email.js + Codice.js"
    ]
  },
  {
    version: "4.9.0",
    date: "01/07/2026",
    type: "fix",
    changes: [
      "calcolaFiscale(subtotale, applicaQuota) in crm_utils.js: funzione pura condivisa per calcolo fiscale (ritenuta 20% sempre, IVA 22%, quota 4% opzionale)",
      "Fix fattura da proforma (updateNumeroFattura): passava Importo_Totale (netto) come imponibile causando double IVA e ritenuta=0 — ora usa calcolaFiscale con subtotale corretto",
      "Tab Fatture: aggiunta colonna Ritenuta (col M) con migrazione automatica su foglio esistente",
      "Fix aggiornaProforma: Google Sheets legge '1/2026' come Date nel foglio Timesheet — confronto ora Date-aware, totali aggregati correttamente quando si aggiungono voci",
      "Feat generate_proforma_pacchetto: nuova action backend + generateProformaDaPacchetto() — genera proforma da acquisto pacchetto ore con PDF, email e salvataggio record"
    ]
  },
  {
    version: "4.8.9",
    date: "29/04/2026",
    type: "fix",
    changes: [
      "Fix pulsanti proforma card: .btn-small ora sovrascrive padding/margin-top/width di .btn-primary con !important",
      "PDF, Aggiungi voci ed Emetti Fattura ora hanno la stessa altezza"
    ]
  },
  {
    version: "4.8.8",
    date: "28/04/2026",
    type: "fix",
    changes: [
      "Fix grafico pulsanti affiancati: width:auto e margin-top:0 nei flex row (.btn-row, .cliente-card-actions)",
      "Ripristinato !important in forms.css — pulsanti form tornano alla grandezza originale",
      "Unificati div Salva/Annulla (cliente + timesheet modal) alla classe .btn-row"
    ]
  },
  {
    version: "4.8.7",
    date: "28/04/2026",
    type: "fix",
    changes: [
      "Fix grafico: rimosso !important da padding/width/margin-top su .btn-primary e .btn-secondary",
      "I pulsanti affiancati ora hanno altezza uniforme — margin-top e width non bloccano più i flex layout"
    ]
  },
  {
    version: "4.8.6",
    date: "28/04/2026",
    type: "fix",
    changes: [
      "Fix pannello cliente: chiudere il form modifica anagrafica non nasconde più prodotti e timesheet",
      "Nuova closeClienteEditForm(): chiude solo il form, riporta la vista su Prodotti Attivi"
    ]
  },
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
