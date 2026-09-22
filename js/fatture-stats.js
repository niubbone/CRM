// =======================================================================
// === Studio Smart CRM - Statistiche Fatture ===
// =======================================================================
// Andamento per anno e confronto mese per mese tra due anni, in SVG senza
// librerie (funziona anche offline). Valore = Importo_Totale, lo stesso del
// riquadro «Totale fatturato»: è l'unico presente anche nelle fatture storiche,
// che non hanno imponibile. Le note di credito (totale negativo) si sottraggono.

let _statsFatture = null;         // tutte le fatture, scaricate una volta per apertura
let _statsAperte = false;
let _statsLarghezza = 720;        // larghezza del grafico = quella del riquadro (testi leggibili sul telefono)

const STATS_MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const STATS_COLORI = { a: '#2a78d6', b: '#eb6834' };   // palette validata (CVD ΔE 24.7)

function statsEuro(n, decimali) {
  const d = decimali === undefined ? 0 : decimali;
  // useGrouping 'always': in italiano 7496 resterebbe senza punto
  return '€ ' + (n || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
}

function statsEscape(t) {
  return (t == null ? '' : t.toString()).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Variazione con freccia e segno: il colore non è mai l'unica informazione */
function statsVariazione(att, prec) {
  if (!prec) return '<span style="color:#6c757d;">—</span>';
  const diff = att - prec;
  const pct = Math.round(diff / Math.abs(prec) * 1000) / 10;
  const su = diff >= 0;
  return `<span style="color:${su ? '#1e7e34' : '#c82333'};font-weight:600;white-space:nowrap;">${su ? '▲ +' : '▼ '}${pct.toLocaleString('it-IT')}%</span>`;
}

async function toggleStatisticheFatture() {
  const panel = document.getElementById('fatture-stats-panel');
  if (!panel) return;
  _statsAperte = !_statsAperte;
  panel.style.display = _statsAperte ? 'block' : 'none';
  const btn = document.getElementById('fatture-stats-btn');
  if (btn) btn.innerHTML = `<i class="fas fa-chart-column"></i> ${_statsAperte ? 'Chiudi statistiche' : 'Statistiche'}`;
  if (_statsAperte) await caricaStatisticheFatture();
}

async function caricaStatisticheFatture() {
  const panel = document.getElementById('fatture-stats-panel');
  panel.innerHTML = '<div style="padding:30px;text-align:center;">⏳ Caricamento statistiche...</div>';
  try {
    const API_URL = window.CONFIG?.APPS_SCRIPT_URL;
    if (!API_URL) throw new Error('CONFIG non disponibile');
    // Senza filtri: servono tutti gli anni
    const response = await fetch(`${API_URL}?action=get_fatture_list`, { cache: 'no-cache' });
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Errore caricamento');
    _statsFatture = (result.data || []).map(f => {
      const p = (f.dataFattura || '').split('/');
      return { anno: parseInt(p[2]) || 0, mese: (parseInt(p[1]) || 0) - 1, giorno: parseInt(p[0]) || 0, totale: parseFloat(f.totale) || 0 };
    });
    renderStatisticheFatture();
  } catch (error) {
    panel.innerHTML = buildFattureErrorHTML('Errore statistiche', error.message, 'caricaStatisticheFatture()');
  }
}

/** Totali per anno e per anno/mese; le fatture senza data restano fuori (e si dice quante) */
function statsAggrega() {
  const perAnno = {}, perMese = {};
  let senzaData = 0;
  _statsFatture.forEach(f => {
    if (!f.anno || f.mese < 0) { senzaData++; return; }
    perAnno[f.anno] = (perAnno[f.anno] || 0) + f.totale;
    if (!perMese[f.anno]) perMese[f.anno] = new Array(12).fill(0);
    perMese[f.anno][f.mese] += f.totale;
  });
  const anni = Object.keys(perAnno).map(Number).sort((a, b) => a - b);
  return { perAnno, perMese, anni, senzaData };
}

function renderStatisticheFatture() {
  const panel = document.getElementById('fatture-stats-panel');
  const { perAnno, perMese, anni, senzaData } = statsAggrega();
  _statsLarghezza = Math.max(320, Math.min(760, (panel.clientWidth || 760) - 34));
  if (!anni.length) { panel.innerHTML = '<div style="padding:20px;color:#6c757d;">Nessuna fattura con data.</div>'; return; }

  const oggi = new Date();
  const annoCorr = oggi.getFullYear();
  const annoA = anni.includes(annoCorr) ? annoCorr : anni[anni.length - 1];
  const annoB = anni.includes(annoA - 1) ? annoA - 1 : (anni.length > 1 ? anni[anni.length - 2] : annoA);
  const opzioni = sel => anni.slice().reverse().map(a => `<option value="${a}"${a === sel ? ' selected' : ''}>${a}</option>`).join('');

  panel.innerHTML = `
    <div class="stats-box">
      <div class="stats-titolo">Andamento per anno</div>
      <div class="stats-sotto">Totale fatturato (come nel riquadro in alto), note di credito sottratte</div>
      ${statsRiquadroAnnoInCorso(perMese, annoCorr, oggi)}
      <div id="stats-grafico-anni"></div>
      ${statsTabellaAnni(perAnno, anni, annoCorr, oggi)}
    </div>
    <div class="stats-box">
      <div class="stats-titolo">Confronto per mesi</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:8px 0 4px;">
        <label class="stats-legenda"><span class="stats-chip" style="background:${STATS_COLORI.a};"></span>
          <select id="stats-anno-a" onchange="renderConfrontoMesi()">${opzioni(annoA)}</select></label>
        <span style="color:#6c757d;font-size:13px;">confrontato con</span>
        <label class="stats-legenda"><span class="stats-chip" style="background:${STATS_COLORI.b};"></span>
          <select id="stats-anno-b" onchange="renderConfrontoMesi()">${opzioni(annoB)}</select></label>
      </div>
      <div id="stats-grafico-mesi"></div>
      <div id="stats-tabella-mesi"></div>
    </div>
    ${senzaData ? `<div class="stats-sotto" style="margin-top:4px;">${senzaData} ${senzaData === 1 ? 'fattura' : 'fatture'} senza data non ${senzaData === 1 ? 'è conteggiata' : 'sono conteggiate'} negli anni: se ne vedono i totali solo con «Tutti gli anni».</div>` : ''}`;

  document.getElementById('stats-grafico-anni').innerHTML =
    statsGraficoBarre(anni.map(String), [{ nome: 'Totale', colore: STATS_COLORI.a, valori: anni.map(a => perAnno[a]) }],
      (i) => `<strong>${anni[i]}</strong><br>${statsEuro(perAnno[anni[i]], 2)}` +
             (i > 0 ? `<br>rispetto al ${anni[i - 1]}: ${statsVariazione(perAnno[anni[i]], perAnno[anni[i - 1]])}` : '') +
             (anni[i] === annoCorr ? '<br><em>anno in corso</em>' : ''),
      anni.map(a => a === annoCorr));
  renderConfrontoMesi();
}

/** Totale di un anno da gennaio fino allo stesso giorno di oggi */
function statsPariPeriodo(anno, oggi) {
  const m = oggi.getMonth(), g = oggi.getDate();
  return _statsFatture.filter(f => f.anno === anno && (f.mese < m || (f.mese === m && f.giorno <= g)))
    .reduce((s, f) => s + f.totale, 0);
}

/** Anno in corso contro lo stesso periodo dell'anno prima: il confronto giusto a metà anno */
function statsRiquadroAnnoInCorso(perMese, annoCorr, oggi) {
  if (!perMese[annoCorr] || !perMese[annoCorr - 1]) return '';
  const meseCorr = oggi.getMonth(), giornoCorr = oggi.getDate();
  const att = statsPariPeriodo(annoCorr, oggi), prec = statsPariPeriodo(annoCorr - 1, oggi);
  const periodo = `1 gen – ${giornoCorr} ${STATS_MESI[meseCorr].toLowerCase()}`;
  return `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin:10px 0 6px;">
      <div class="stats-tile"><div class="stats-tile-val">${statsEuro(att)}</div><div class="stats-sotto">${annoCorr}, ${periodo}</div></div>
      <div class="stats-tile"><div class="stats-tile-val" style="color:#495057;">${statsEuro(prec)}</div><div class="stats-sotto">${annoCorr - 1}, stesso periodo</div></div>
      <div class="stats-tile"><div class="stats-tile-val">${statsVariazione(att, prec)}</div><div class="stats-sotto">${att - prec >= 0 ? '+' : '−'}${statsEuro(Math.abs(att - prec))} sullo stesso periodo</div></div>
    </div>`;
}

function statsTabellaAnni(perAnno, anni, annoCorr, oggi) {
  const righe = anni.slice().reverse().map(a => {
    // l'anno in corso si confronta con lo stesso periodo dell'anno prima, non con l'anno intero
    const inCorso = a === annoCorr && perAnno[a - 1] !== undefined;
    const att = inCorso ? statsPariPeriodo(a, oggi) : perAnno[a];
    const prec = inCorso ? statsPariPeriodo(a - 1, oggi) : perAnno[a - 1];
    const diff = prec !== undefined ? att - prec : null;
    return `<tr><td>${a}${a === annoCorr ? ' <span class="stats-sotto">(in corso)</span>' : ''}</td>
      <td class="num">${statsEuro(perAnno[a], 2)}</td>
      <td class="num stats-diff">${diff === null ? '—' : (diff >= 0 ? '+' : '−') + statsEuro(Math.abs(diff), 2)}</td>
      <td class="num">${prec !== undefined ? statsVariazione(att, prec) : '—'}${inCorso ? '<div class="stats-sotto">a pari periodo</div>' : ''}</td></tr>`;
  }).join('');
  return `<table class="stats-tabella"><thead><tr><th>Anno</th><th class="num">Totale</th><th class="num stats-diff">Differenza</th><th class="num">Variazione</th></tr></thead><tbody>${righe}</tbody></table>`;
}

function renderConfrontoMesi() {
  if (!_statsFatture) return;
  const { perMese } = statsAggrega();
  const a = parseInt(document.getElementById('stats-anno-a').value);
  const b = parseInt(document.getElementById('stats-anno-b').value);
  const va = perMese[a] || new Array(12).fill(0);
  const vb = perMese[b] || new Array(12).fill(0);
  const serie = a === b
    ? [{ nome: String(a), colore: STATS_COLORI.a, valori: va }]
    : [{ nome: String(a), colore: STATS_COLORI.a, valori: va }, { nome: String(b), colore: STATS_COLORI.b, valori: vb }];

  document.getElementById('stats-grafico-mesi').innerHTML = statsGraficoBarre(STATS_MESI, serie, i =>
    `<strong>${STATS_MESI[i]}</strong><br>` +
    `<span class="stats-chip" style="background:${STATS_COLORI.a};"></span> ${a}: ${statsEuro(va[i], 2)}` +
    (a !== b ? `<br><span class="stats-chip" style="background:${STATS_COLORI.b};"></span> ${b}: ${statsEuro(vb[i], 2)}<br>${statsVariazione(va[i], vb[i])}` : ''));

  // mesi non ancora arrivati (anno in corso): niente confronto, sarebbero tutti -100%
  const oggi = new Date();
  const futuro = (anno, i) => anno > oggi.getFullYear() || (anno === oggi.getFullYear() && i > oggi.getMonth());
  let cumA = 0, cumB = 0;
  const righe = STATS_MESI.map((m, i) => {
    const fut = futuro(a, i) || futuro(b, i);
    if (!fut) { cumA += va[i]; cumB += vb[i]; }
    const diff = va[i] - vb[i];
    const cella = (x, anno) => futuro(anno, i) ? '—' : statsEuro(x, 2);
    return `<tr${fut ? ' style="color:#adb5bd;"' : ''}><td>${m}</td><td class="num">${cella(va[i], a)}</td>${a !== b ? `<td class="num">${cella(vb[i], b)}</td>
      <td class="num stats-diff">${fut ? '—' : (diff >= 0 ? '+' : '−') + statsEuro(Math.abs(diff), 2)}</td><td class="num">${fut ? '—' : statsVariazione(va[i], vb[i])}</td>
      <td class="num stats-cum">${fut ? '—' : statsVariazione(cumA, cumB)}</td>` : ''}</tr>`;
  }).join('');
  const parziale = STATS_MESI.some((m, i) => futuro(a, i) || futuro(b, i));
  document.getElementById('stats-tabella-mesi').innerHTML = `
    <table class="stats-tabella"><thead><tr><th>Mese</th><th class="num">${a}</th>${a !== b ? `<th class="num">${b}</th>
      <th class="num stats-diff">Differenza</th><th class="num">Variazione</th><th class="num stats-cum" title="Da gennaio a quel mese">Progressivo</th>` : ''}</tr></thead>
      <tbody>${righe}</tbody>
      <tfoot><tr><td>${parziale ? 'Totale<div class="stats-sotto">mesi trascorsi</div>' : 'Totale'}</td><td class="num">${statsEuro(cumA, 2)}</td>${a !== b ? `<td class="num">${statsEuro(cumB, 2)}</td>
      <td class="num stats-diff">${(cumA - cumB >= 0 ? '+' : '−') + statsEuro(Math.abs(cumA - cumB), 2)}</td><td class="num">${statsVariazione(cumA, cumB)}</td><td class="stats-cum"></td>` : ''}</tr></tfoot></table>`;
}

/**
 * Grafico a colonne (una o più serie affiancate) in SVG.
 * etichette: nomi sull'asse x; serie: [{nome, colore, valori}];
 * tooltip(i): HTML per il gruppo i; evidenzia[i]: gruppo in tratteggio (anno in corso).
 */
function statsGraficoBarre(etichette, serie, tooltip, evidenzia) {
  const W = _statsLarghezza, H = W < 500 ? 220 : 260, sx = W < 500 ? 40 : 64, dx = 8, alto = 12, basso = 28;
  const pw = W - sx - dx, ph = H - alto - basso;
  const tutti = serie.flatMap(s => s.valori);
  const max = Math.max(0, ...tutti), min = Math.min(0, ...tutti);
  // passo "tondo" per le linee della griglia
  const grezzo = (max - min) / 4 || 1;
  const pot = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const passo = [1, 2, 2.5, 5, 10].map(k => k * pot).find(p => p >= grezzo);
  const top = Math.ceil(max / passo) * passo || passo, bot = Math.floor(min / passo) * passo;
  const y = v => alto + ph - (v - bot) / (top - bot) * ph;
  const gw = pw / etichette.length;
  const gap = 2, larghezzaGruppo = Math.min(gw * 0.72, serie.length * 28);
  const bw = (larghezzaGruppo - gap * (serie.length - 1)) / serie.length;
  const fmtAsse = v => Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'k' : v.toLocaleString('it-IT');

  let svg = '';
  for (let v = bot; v <= top + passo / 2; v += passo) {
    svg += `<line x1="${sx}" x2="${W - dx}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? '#adb5bd' : '#e9ecef'}" stroke-width="1"/>`;
    svg += `<text x="${sx - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#6c757d">${fmtAsse(v)}</text>`;
  }
  etichette.forEach((et, i) => {
    const x0 = sx + i * gw + (gw - larghezzaGruppo) / 2;
    serie.forEach((s, k) => {
      const v = s.valori[i] || 0;
      if (!v) return;
      const x = x0 + k * (bw + gap), y1 = y(Math.max(v, 0)), y2 = y(Math.min(v, 0));
      const h = Math.max(y2 - y1, 1), r = Math.min(4, bw / 2, h);
      // estremità arrotondata dal lato del valore, base piatta sullo zero
      const d = v >= 0
        ? `M${x},${y2} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y2} Z`
        : `M${x},${y1} V${y2 - r} Q${x},${y2} ${x + r},${y2} H${x + bw - r} Q${x + bw},${y2} ${x + bw},${y2 - r} V${y1} Z`;
      const tratteggio = evidenzia && evidenzia[i];
      svg += `<path d="${d}" fill="${tratteggio ? 'url(#stats-trat)' : s.colore}" ${tratteggio ? `stroke="${s.colore}" stroke-width="1.5"` : ''}/>`;
    });
    svg += `<text x="${sx + i * gw + gw / 2}" y="${H - 10}" text-anchor="middle" font-size="${gw < 34 ? 10 : 12}" fill="#495057">${statsEscape(et)}</text>`;
    // area di aggancio del tooltip, più grande delle colonne
    svg += `<rect class="stats-hit" x="${sx + i * gw}" y="${alto}" width="${gw}" height="${ph}" fill="transparent" data-i="${i}"/>`;
  });
  const defs = `<defs><pattern id="stats-trat" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" fill="${serie[0].colore}" opacity="0.35"/><line x1="0" y1="0" x2="0" y2="6" stroke="${serie[0].colore}" stroke-width="2"/></pattern></defs>`;
  const id = 'stats-g-' + Math.random().toString(36).slice(2, 8);
  setTimeout(() => statsAgganciaTooltip(id, tooltip), 0);
  return `<div class="stats-grafico" id="${id}"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Grafico a colonne">${defs}${svg}</svg><div class="stats-tooltip"></div></div>`;
}

function statsAgganciaTooltip(id, tooltip) {
  const box = document.getElementById(id);
  if (!box) return;
  const tip = box.querySelector('.stats-tooltip');
  box.querySelectorAll('.stats-hit').forEach(r => {
    const mostra = ev => {
      box.querySelectorAll('.stats-hit').forEach(x => x.setAttribute('fill', 'transparent'));
      r.setAttribute('fill', 'rgba(0,0,0,0.04)');
      tip.innerHTML = tooltip(parseInt(r.dataset.i));
      tip.style.display = 'block';
      const b = box.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - b.left;
      tip.style.left = Math.min(Math.max(px - tip.offsetWidth / 2, 0), b.width - tip.offsetWidth) + 'px';
    };
    r.addEventListener('mousemove', mostra);
    r.addEventListener('touchstart', mostra, { passive: true });
  });
  box.addEventListener('mouseleave', () => {
    tip.style.display = 'none';
    box.querySelectorAll('.stats-hit').forEach(x => x.setAttribute('fill', 'transparent'));
  });
}

window.toggleStatisticheFatture = toggleStatisticheFatture;
window.caricaStatisticheFatture = caricaStatisticheFatture;
window.renderConfrontoMesi = renderConfrontoMesi;
