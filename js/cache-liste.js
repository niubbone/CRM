// =======================================================================
// === CACHE PERSISTENTE DELLE LISTE ===
// =======================================================================
// Lo schema della Home (js/home.js) reso riusabile. L'ultima lettura di ogni
// lista resta in localStorage: la lista si apre subito con quella e va al
// server solo quando serve davvero:
//  - i dati hanno più di MAX_ETA_MS, oppure
//  - dopo la loro lettura c'è stata una scrittura, in qualunque tab, oppure
//  - lo chiedi tu con il pulsante Aggiorna.
//
// L'ora dell'ultima scrittura la registra lo strato comune del fetch in
// index.html (chiave crm_ultima_scrittura), all'inizio e alla fine di ogni
// chiamata che non è una lettura. Ogni lettura salvata porta l'ora in cui la
// richiesta è PARTITA: una risposta partita prima di una scrittura, o mentre
// la scrittura era in corso, non può essere scambiata per fresca.
(function () {
    const PREFISSO = 'crm_lista_v1_';
    const CHIAVE_SCRITTURA = 'crm_ultima_scrittura';
    const MAX_ETA_MS = 5 * 60 * 1000;
    const RIPROVA_RIMANDATO_MS = 3000;

    const inCorso = {};    // chiave -> promise del caricamento in corso
    const rimandati = {};  // contenitore -> timer del disegno rimandato

    function _leggi(chiave) {
        try {
            const c = JSON.parse(localStorage.getItem(PREFISSO + chiave) || 'null');
            return (c && c.ts && 'dati' in c) ? c : null;
        } catch (e) {
            return null;
        }
    }

    function _scrivi(chiave, dati, ts) {
        try {
            localStorage.setItem(PREFISSO + chiave, JSON.stringify({ ts: ts, dati: dati }));
        } catch (e) {
            // quota piena o storage negato: la lista funziona lo stesso, senza cache
        }
    }

    function _ultimaScrittura() {
        try {
            return parseInt(localStorage.getItem(CHIAVE_SCRITTURA) || '0', 10) || 0;
        } catch (e) {
            return 0;
        }
    }

    // Minore stretto: la lettura che parte subito dopo la fine di una scrittura
    // cade spesso nello stesso millisecondo, ed è fresca. Una lettura partita
    // mentre la scrittura era ancora in volo resta coperta dalla marcatura di
    // fine, che arriva dopo ed è più recente.
    function daRinfrescare(c) {
        return !c || (Date.now() - c.ts) > MAX_ETA_MS || c.ts < _ultimaScrittura();
    }

    /** «dati delle 10:32», oppure «dati del 14/09 alle 10:32» se non sono di oggi. */
    function etichetta(ts) {
        const d = new Date(ts);
        const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        if (d.toDateString() === new Date().toDateString()) return 'dati delle ' + ora;
        const giorno = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        return 'dati del ' + giorno + ' alle ' + ora;
    }

    // Riga di servizio sopra la lista: stesso aspetto di quella della Home
    // (classe home-aggiornamento in css/home.css, che è caricato ovunque).
    function _barra(contenitoreId, aggiorna) {
        const cont = document.getElementById(contenitoreId);
        if (!cont || !cont.parentNode) return null;
        const id = contenitoreId + '-agg';
        let bar = document.getElementById(id);
        if (!bar) {
            bar = document.createElement('div');
            bar.id = id;
            bar.className = 'home-aggiornamento lista-aggiornamento';
            bar.innerHTML = '<span class="lista-agg-testo"></span>'
                + '<button type="button" title="Rileggi dal server"><i class="fas fa-rotate-right"></i> Aggiorna</button>';
            cont.parentNode.insertBefore(bar, cont);
        }
        bar.querySelector('button').onclick = aggiorna;
        return bar;
    }

    function _stato(bar, ts, fase) {
        if (!bar) return;
        bar.classList.toggle('in-corso', fase === 'in-corso');
        let testo = ts ? etichetta(ts) : '';
        if (fase === 'in-corso') testo += (testo ? ' · ' : '') + 'aggiornamento…';
        if (fase === 'errore') testo += ' · aggiornamento non riuscito';
        if (fase === 'rimandato') testo += ' · dati nuovi pronti, li mostro appena finisci di scrivere';
        bar.querySelector('.lista-agg-testo').textContent = testo;
        bar.style.display = testo ? '' : 'none';
    }

    /**
     * true se nella lista c'è qualcosa in mano: un campo a fuoco, oppure del
     * testo visibile già digitato e non salvato. Ridisegnare la lista lo
     * cancellerebbe sotto le dita (stesso problema risolto nella Home).
     */
    function _inModifica(cont) {
        if (!cont) return false;
        const attivo = document.activeElement;
        if (attivo && cont.contains(attivo) && /^(INPUT|TEXTAREA|SELECT)$/.test(attivo.tagName)) return true;
        return Array.from(cont.querySelectorAll('textarea, input[type="text"], input[type="number"], input:not([type])'))
            .some(el => el.value && el.value.trim() !== '' && el.offsetParent !== null);
    }

    function _mostraQuandoLibero(opz, bar, dati, ts) {
        const cont = document.getElementById(opz.contenitore);
        if (!opz.forzato && _inModifica(cont)) {
            _stato(bar, ts, 'rimandato');
            clearTimeout(rimandati[opz.contenitore]);
            rimandati[opz.contenitore] = setTimeout(() => _mostraQuandoLibero(opz, bar, dati, ts), RIPROVA_RIMANDATO_MS);
            return;
        }
        opz.mostra(dati);
        _stato(bar, ts);
    }

    /**
     * Apre una lista dalla cache e decide se andare al server.
     *
     * opz = {
     *   chiave:      nome della lista in cache; null = niente cache (es. filtri lato server attivi)
     *   contenitore: id dell'elemento della lista; la riga «dati delle…» va subito sopra
     *   scarica:     async (opzioniFetch) => dati. Deve lanciare se la risposta non è buona.
     *                opzioniFetch va passato a fetch (contiene noSpinner nei rinfreschi in sottofondo)
     *   mostra:      (dati) => disegna la lista
     *   caricamento: () => schermata «Caricamento…», quando non c'è ancora niente da mostrare
     *   errore:      (err) => schermata d'errore, quando non c'è niente da mostrare
     *   aggiorna:    () => cosa fa il pulsante Aggiorna
     *   forzato:     true = rileggi dal server anche se la cache è fresca
     *   salvabile:   (dati) => false per non salvare una risposta incompleta (facoltativo)
     * }
     */
    function carica(opz) {
        const bar = _barra(opz.contenitore, opz.aggiorna);
        clearTimeout(rimandati[opz.contenitore]);

        const cache = opz.chiave ? _leggi(opz.chiave) : null;
        if (cache) {
            opz.mostra(cache.dati);
            if (!opz.forzato && !daRinfrescare(cache)) {
                _stato(bar, cache.ts);
                return Promise.resolve();
            }
        }

        if (opz.chiave && inCorso[opz.chiave]) {
            _stato(bar, cache && cache.ts, 'in-corso');
            return inCorso[opz.chiave];
        }

        const inSottofondo = !!cache;
        const lavoro = (async () => {
            const inizio = Date.now();
            if (inSottofondo) {
                _stato(bar, cache.ts, 'in-corso');
            } else {
                _stato(bar, null);
                opz.caricamento();
            }
            try {
                const dati = await opz.scarica(inSottofondo ? { noSpinner: true } : undefined);
                if (opz.chiave && (!opz.salvabile || opz.salvabile(dati))) _scrivi(opz.chiave, dati, inizio);
                if (inSottofondo) {
                    _mostraQuandoLibero(opz, bar, dati, inizio);
                } else {
                    opz.mostra(dati);
                    _stato(bar, inizio);
                }
            } catch (err) {
                console.error('Errore caricamento ' + (opz.chiave || opz.contenitore) + ':', err);
                if (inSottofondo) {
                    // I dati buoni già a schermo restano: lo si dice solo nella riga di servizio.
                    _stato(bar, cache.ts, 'errore');
                } else {
                    _stato(bar, null);
                    opz.errore(err);
                }
            }
        })();

        if (opz.chiave) {
            inCorso[opz.chiave] = lavoro;
            lavoro.then(() => { delete inCorso[opz.chiave]; });
        }
        return lavoro;
    }

    window.crmCache = { carica, etichetta, daRinfrescare, leggi: _leggi };
})();
