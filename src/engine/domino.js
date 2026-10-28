/*
 * Dominó (duplo-seis) para 2 pessoas: regras do jogo, sem tela e sem rede.
 *
 * 28 pedras; pedra = índice em DO_T, cada uma [a, b] com a <= b. Cada pessoa recebe 7 e sobram 14 no monte.
 * Abre quem tem a maior bucha (pedra dupla), jogando essa bucha. Na sua vez: encaixa uma pedra numa das pontas;
 * sem pedra que sirva, compra do monte até poder jogar; com o monte vazio, passa.
 * Ganha quem bater (ficar sem pedras). Se os dois passarem seguido, o jogo trancou: ganha quem tem menos pontos na mão.
 * Os pontos da vitória são os da mão de quem perdeu.
 * chain é a fila de pedras da esquerda para a direita ({t, a, b}: a é o número do lado esquerdo); left = quantas ficaram à esquerda da primeira.
 */
const DO_T = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) DO_T.push([a, b]);
const doPips = t => DO_T[t][0] + DO_T[t][1];
const doDouble = t => DO_T[t][0] === DO_T[t][1];

function doDeck(seed) {
  const d = Array.from({ length: 28 }, (_, i) => i);
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = d[i]; d[i] = d[j]; d[j] = t; }
  return d;
}

function doNew(seed) {
  const d = doDeck(seed), hands = [d.slice(0, 7), d.slice(7, 14)], pile = d.slice(14);
  // abre a maior bucha; sem bucha nenhuma (raríssimo), abre o lugar 0 com qualquer pedra
  let turn = 0, must = -1;
  for (let v = 6; v >= 0 && must < 0; v--) {
    const t = DO_T.findIndex(x => x[0] === v && x[1] === v);
    for (let p = 0; p < 2; p++) if (hands[p].includes(t)) { turn = p; must = t; }
  }
  return { hands, pile, chain: [], left: 0, turn, must, passes: 0, n: 0, over: -1, why: '', pts: 0, last: null };
}

const doEnds = m => (m.chain.length ? [m.chain[0].a, m.chain[m.chain.length - 1].b] : null);

/* em quais pontas a pedra encaixa: [] não serve, [0] esquerda, [1] direita, [0, 1] nas duas */
function doFits(m, t) {
  if (!m.chain.length) return m.must < 0 || t === m.must ? [1] : [];
  const [l, r] = doEnds(m), [a, b] = DO_T[t], out = [];
  if (a === l || b === l) out.push(0);
  if (a === r || b === r) out.push(1);
  return out;
}
const doPlayable = (m, p) => m.hands[p].filter(t => doFits(m, t).length);
const doHandPips = (m, p) => m.hands[p].reduce((s, t) => s + doPips(t), 0);

function doPlay(m, p, t, end) {
  if (m.over !== -1 || m.turn !== p || !m.hands[p].includes(t)) return { ok: false };
  const fits = doFits(m, t);
  if (!fits.length) return { ok: false };
  if (!fits.includes(end)) end = fits[0];
  const [a, b] = DO_T[t];
  if (!m.chain.length) m.chain.push({ t, a, b });
  else if (end === 0) { const l = m.chain[0].a; m.chain.unshift({ t, a: a === l ? b : a, b: l }); m.left = (m.left || 0) + 1; }
  else { const r = m.chain[m.chain.length - 1].b; m.chain.push({ t, a: r, b: a === r ? b : a }); }
  m.hands[p] = m.hands[p].filter(x => x !== t);
  m.must = -1; m.passes = 0; m.n++; m.last = { p, t, end };
  if (!m.hands[p].length) { m.over = p; m.why = 'bateu'; m.pts = doHandPips(m, 1 - p); }
  else m.turn = 1 - p;
  return { ok: true, end };
}

/* comprar: só sem pedra que sirva e com monte */
function doBuy(m, p) {
  if (m.over !== -1 || m.turn !== p || !m.pile.length || doPlayable(m, p).length) return { ok: false };
  const t = m.pile.shift();
  m.hands[p].push(t); m.n++; m.last = { p, buy: 1 };
  return { ok: true, t };
}

/* passar: só sem pedra que sirva e com o monte vazio */
function doPass(m, p) {
  if (m.over !== -1 || m.turn !== p || m.pile.length || doPlayable(m, p).length) return { ok: false };
  m.passes++; m.n++; m.last = { p, pass: 1 };
  m.turn = 1 - p;
  if (m.passes >= 2) {   // trancou: ganha quem tem menos pontos na mão
    const s0 = doHandPips(m, 0), s1 = doHandPips(m, 1);
    m.over = s0 === s1 ? 2 : s0 < s1 ? 0 : 1; m.why = 'trancou';
    m.pts = m.over === 2 ? 0 : Math.abs(s0 - s1);
  }
  return { ok: true };
}

if (typeof module !== 'undefined') module.exports = { DO_T, doPips, doDouble, doDeck, doNew, doEnds, doFits, doPlayable, doHandPips, doPlay, doBuy, doPass };
