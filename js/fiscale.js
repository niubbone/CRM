// =======================================================================
// === CALCOLO FISCALE UNICO (anteprime) ===
// =======================================================================
// Stessa formula di calcolaFiscale nel backend (Backend/crm_utils.js): le
// anteprime di proforma, fattura diretta, QODNET e Ferrari passano tutte da qui,
// così quello che vedi prima di salvare è quello che il backend registra.
// Se cambia una percentuale, va cambiata in tutti e due i posti.
//
//   quota      = 4% del compenso (solo se richiesta)
//   imponibile = compenso + quota
//   IVA        = 22% dell'imponibile
//   ritenuta   = 20% dell'imponibile, tranne i clienti forfettari
//   netto      = imponibile + IVA - ritenuta
//
// Script classico (non modulo): definisce window.calcolaFiscale.
(function () {
    const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

    /**
     * @param {number} compenso - compenso prima della quota 4%
     * @param {{quota?: boolean, ritenuta?: boolean}} [opzioni] - ritenuta: default sì
     * @returns {{subtotale, quota, imponibile, ritenuta, iva, lordo, netto}}
     */
    window.calcolaFiscale = function (compenso, opzioni) {
        const o = opzioni || {};
        const S = parseFloat(compenso) || 0;
        // i negativi (note di credito) si calcolano sul valore assoluto, poi si rimette il segno
        const segno = S < 0 ? -1 : 1;
        const A = Math.abs(S);
        const quota = o.quota ? r2(A * 0.04) : 0;
        const imponibile = r2(A + quota);
        const ritenuta = o.ritenuta === false ? 0 : r2(imponibile * 0.20);
        const iva = r2(imponibile * 0.22);
        const lordo = r2(imponibile + iva);
        const netto = r2(lordo - ritenuta);
        return {
            subtotale: S, quota: segno * quota, imponibile: segno * imponibile,
            ritenuta: segno * ritenuta, iva: segno * iva, lordo: segno * lordo, netto: segno * netto
        };
    };
})();
