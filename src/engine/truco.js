/*
 * Truco mineiro para 4 pessoas (duas duplas): regras do jogo, sem tela e sem rede.
 *
 * Baralho de 40 cartas (sem 8, 9 e 10). Naipes: 0 paus, 1 copas, 2 espadas, 3 ouros. Carta = naipe*10 + posição em A,2,3,4,5,6,7,J,Q,K.
 * Manilhas fixas, da mais forte para a mais fraca: 4 de paus (zap), 7 de copas, ás de espadas, 7 de ouros.
 * Depois delas: 3, 2, ás, rei, valete, dama, 7, 6, 5, 4.
 * Os lugares são 0 a 3 em volta da mesa; 0 e 2 são uma dupla, 1 e 3 a outra.
 * Cada mão são até 3 rodadas; quem leva 2 ganha a mão. A mão vale 2 pontos; truco sobe para 4, depois 6, 10 e 12.
 * A partida vai a 12 pontos. Não tem "mão de onze" nem "mão de ferro".
 */
const TR_RANKS = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
const TR_SUITS = ['paus', 'copas', 'espadas', 'ouros'];
const TR_LADDER = [2, 4, 6, 10, 12];
const TR_CALLNAME = { 4: 'TRUCO', 6: 'SEIS', 10: 'NOVE', 12: 'DOZE' };

const trSuit = id => Math.floor(id / 10);
const trRank = id => id % 10;
const trTeam = seat => seat % 2;
const trIsManilha = id => id === 3 || id === 16 || id === 20 || id === 36;   // 4 de paus, 7 de copas, ás de espadas, 7 de ouros

function trStrength(id) {
  if (id === 3) return 14;      // zap
  if (id === 16) return 13;     // 7 de copas
  if (id === 20) return 12;     // ás de espadas
  if (id === 36) return 11;     // 7 de ouros
  return [8, 9, 10, 1, 2, 3, 4, 6, 5, 7][trRank(id)];   // A=8, 2=9, 3=10, 4=1, 5=2, 6=3, 7=4, J=6, Q=5, K=7
}

/* baralho embaralhado por uma semente */
function trDeck(seed) {
  const d = Array.from({ length: 40 }, (_, i) => i);
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = d[i]; d[i] = d[j]; d[j] = t; }
  return d;
}
/* 3 cartas para cada um dos 4 lugares */
const trDeal = seed => { const d = trDeck(seed); return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 12)]; };

function trNew() {
  return { score: [0, 0], hand: 0, dealer: 3, mao: 0, turn: 0, stake: 2, last: -1, pend: null, rounds: [], plays: [[], [], []],
    phase: 'wait', handWin: -1, run: false, over: -1 };
}

/* nova mão: o carteador gira e quem vem depois dele abre */
function trStartHand(m) {
  m.hand++; m.dealer = (m.dealer + 1) % 4; m.mao = (m.dealer + 1) % 4; m.turn = m.mao;
  m.stake = 2; m.last = -1; m.pend = null; m.rounds = []; m.plays = [[], [], []]; m.phase = 'play'; m.handWin = -1; m.run = false;
}

/* quem ganhou a rodada: { w: dupla ou -1 (empate), by: lugar da carta vencedora } */
function trRoundResult(plays) {
  let best = 0;
  for (const p of plays) best = Math.max(best, trStrength(p.c));
  const top = plays.filter(p => trStrength(p.c) === best);
  const teams = new Set(top.map(p => trTeam(p.p)));
  if (teams.size > 1) return { w: -1, by: plays[0].p };   // as melhores cartas são de duplas diferentes: empatou
  return { w: trTeam(top[0].p), by: top[0].p };
}

/* a mão já tem dono? r = resultado de cada rodada (dupla ou -1), maoTeam = dupla de quem abriu */
function trDecide(r, maoTeam) {
  const w = t => r.filter(x => x === t).length;
  if (w(0) >= 2) return 0;
  if (w(1) >= 2) return 1;
  if (r.length >= 2) {
    if (r[0] === -1 && r[1] !== -1) return r[1];        // empatou a primeira: vale a segunda
    if (r[0] !== -1 && r[1] === -1) return r[0];        // ganhou a primeira e empatou a segunda: leva
  }
  if (r.length === 3) {
    if (r[2] !== -1) return r[2];
    if (r[0] !== -1) return r[0];
    return maoTeam;                                     // tudo empatado: leva quem abriu a mão
  }
  return null;
}

function trEndHand(m, team, points) {
  m.score[team] += points; m.handWin = team; m.phase = 'done'; m.pend = null;
  if (m.score[team] >= 12) m.over = team;
}

const trAllPlayed = m => m.plays.flat().map(p => p.c);

/* jogar uma carta. Devolve { ok, round?, handDone? } */
function trPlay(m, seat, card) {
  if (m.phase !== 'play' || seat !== m.turn || !(card >= 0 && card < 40) || trAllPlayed(m).includes(card)) return { ok: false };
  const r = m.rounds.length;
  m.plays[r].push({ p: seat, c: card });
  if (m.plays[r].length < 4) { m.turn = (seat + 1) % 4; return { ok: true }; }
  const res = trRoundResult(m.plays[r]);
  m.rounds.push(res.w);
  const dec = trDecide(m.rounds, trTeam(m.mao));
  if (dec !== null) { trEndHand(m, dec, m.stake); return { ok: true, round: res, handDone: true }; }
  m.turn = res.w >= 0 ? res.by : m.plays[r][0].p;       // quem ganhou abre a próxima; no empate, abre quem abriu esta
  return { ok: true, round: res };
}

const trNextStake = v => TR_LADDER[TR_LADDER.indexOf(v) + 1] || 0;
/* quem pode pedir truco agora: na sua vez, sem pedido pendente, e a sua dupla não foi a última a subir */
const trCanCall = (m, seat) => m.phase === 'play' && !m.pend && seat === m.turn && m.stake < 12 && trTeam(seat) !== m.last;

function trCall(m, seat) {
  if (!trCanCall(m, seat)) return { ok: false };
  m.pend = { by: seat, v: trNextStake(m.stake), to: (seat + 1) % 4 };
  m.phase = 'call';
  return { ok: true };
}

/* resposta a um pedido: 'ok' aceita, 'run' corre (quem pediu leva os pontos de antes), 'raise' aceita e sobe */
function trAnswer(m, seat, a) {
  if (m.phase !== 'call' || !m.pend || seat !== m.pend.to) return { ok: false };
  const p = m.pend;
  if (a === 'ok') { m.stake = p.v; m.last = trTeam(p.by); m.pend = null; m.phase = 'play'; return { ok: true }; }
  if (a === 'run') { m.run = true; trEndHand(m, trTeam(p.by), m.stake); return { ok: true, handDone: true }; }
  if (a === 'raise' && trNextStake(p.v)) {
    m.stake = p.v; m.last = trTeam(p.by);
    m.pend = { by: seat, v: trNextStake(p.v), to: (seat + 1) % 4 };
    return { ok: true };
  }
  return { ok: false };
}

if (typeof module !== 'undefined') module.exports = { TR_RANKS, TR_SUITS, TR_LADDER, TR_CALLNAME, trSuit, trRank, trTeam, trIsManilha, trStrength, trDeck, trDeal, trNew, trStartHand, trRoundResult, trDecide, trPlay, trCall, trAnswer, trCanCall, trNextStake };
