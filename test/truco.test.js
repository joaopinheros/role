/* Testes das regras do truco mineiro (node --test test/truco.test.js) */
const test = require('node:test');
const assert = require('node:assert');
const T = require('../src/engine/truco.js');

const card = (suit, rank) => suit * 10 + T.TR_RANKS.indexOf(rank);
const ZAP = card(0, '4'), COPAS7 = card(1, '7'), ESPADILHA = card(2, 'A'), OUROS7 = card(3, '7');

test('a ordem das cartas: manilhas fixas, depois 3, 2, ás, rei, valete, dama, 7, 6, 5, 4', () => {
  const ordem = [ZAP, COPAS7, ESPADILHA, OUROS7, card(0, '3'), card(1, '2'), card(0, 'A'), card(2, 'K'), card(3, 'J'), card(1, 'Q'), card(0, '7'), card(2, '6'), card(3, '5'), card(1, '4')];
  for (let i = 1; i < ordem.length; i++) assert.ok(T.trStrength(ordem[i - 1]) > T.trStrength(ordem[i]), `posição ${i - 1} deveria vencer ${i}`);
  assert.equal(T.trStrength(card(2, '7')), T.trStrength(card(0, '7')), '7 de espadas e de paus não são manilha e empatam');
  assert.equal(T.trStrength(card(1, 'A')), T.trStrength(card(0, 'A')), 'ás de copas e de paus empatam');
  assert.ok(T.trIsManilha(ZAP) && T.trIsManilha(COPAS7) && T.trIsManilha(ESPADILHA) && T.trIsManilha(OUROS7) && !T.trIsManilha(card(0, '7')));
});

test('o baralho tem 40 cartas diferentes, e a distribuição dá 3 para cada um sem repetir', () => {
  const d = T.trDeck(5);
  assert.equal(d.length, 40); assert.equal(new Set(d).size, 40);
  const mãos = T.trDeal(9);
  assert.equal(mãos.length, 4);
  assert.equal(new Set(mãos.flat()).size, 12);
  assert.deepEqual(T.trDeal(9), mãos, 'mesma semente, mesma distribuição');
  assert.notDeepEqual(T.trDeal(1), T.trDeal(2));
});

test('rodada: vence a maior carta; empate só entre duplas diferentes', () => {
  // lugares 0 e 2 são uma dupla; 1 e 3, a outra
  assert.deepEqual(T.trRoundResult([{ p: 0, c: card(0, '3') }, { p: 1, c: card(1, '2') }, { p: 2, c: card(2, 'K') }, { p: 3, c: card(3, '5') }]), { w: 0, by: 0 });
  assert.deepEqual(T.trRoundResult([{ p: 1, c: card(0, '3') }, { p: 2, c: card(1, '3') }, { p: 3, c: card(2, '5') }, { p: 0, c: card(3, '4') }]).w, -1, '3 contra 3 de duplas diferentes empata');
  const mesma = T.trRoundResult([{ p: 0, c: card(0, '3') }, { p: 1, c: card(1, '2') }, { p: 2, c: card(1, '3') }, { p: 3, c: card(3, '5') }]);
  assert.equal(mesma.w, 0, 'os dois 3 são da mesma dupla: a dupla ganha'); assert.equal(mesma.by, 0, 'e quem jogou primeiro leva a vez');
  assert.equal(T.trRoundResult([{ p: 0, c: ZAP }, { p: 1, c: COPAS7 }, { p: 2, c: ESPADILHA }, { p: 3, c: OUROS7 }]).w, 0, 'zap vence tudo');
});

test('quem leva a mão: duas rodadas, e os empates seguem a regra mineira', () => {
  const d = T.trDecide;
  assert.equal(d([0, 0], 1), 0);
  assert.equal(d([0, 1], 1), null, '1 a 1: tem terceira rodada');
  assert.equal(d([-1, 1], 0), 1, 'empatou a primeira: vale a segunda');
  assert.equal(d([0, -1], 1), 0, 'ganhou a primeira e empatou a segunda: leva');
  assert.equal(d([-1, -1], 0), null, 'empate duplo: decide a terceira');
  assert.equal(d([-1, -1, 1], 0), 1);
  assert.equal(d([0, 1, 1], 0), 1);
  assert.equal(d([0, 1, -1], 1), 0, 'terceira empatada: vale a primeira');
  assert.equal(d([-1, -1, -1], 1), 1, 'tudo empatado: leva quem abriu a mão');
});

test('uma mão completa: abre quem vem depois do carteador e a vez gira', () => {
  const m = T.trNew(); T.trStartHand(m);
  assert.equal(m.hand, 1); assert.equal(m.dealer, 0); assert.equal(m.mao, 1); assert.equal(m.turn, 1); assert.equal(m.stake, 2);
  assert.equal(T.trPlay(m, 0, 5).ok, false, 'fora da vez');
  const jog = (s, c) => { const r = T.trPlay(m, s, c); assert.ok(r.ok, `lugar ${s} jogando ${c}`); return r; };
  jog(1, card(0, '3')); assert.equal(m.turn, 2);
  jog(2, card(1, '2')); jog(3, card(2, 'K'));
  const r = jog(0, card(3, '5'));
  assert.equal(r.round.w, 1, 'o 3 dos lugares 1 vence');
  assert.equal(m.turn, 1, 'quem ganhou abre a próxima rodada');
  assert.equal(T.trPlay(m, 1, card(0, '3')).ok, false, 'a mesma carta não vale duas vezes');
  // segunda rodada: dupla de 1 e 3 ganha de novo e fecha a mão
  jog(1, card(1, 'A')); jog(2, card(2, '4')); jog(3, card(0, '7')); const f = jog(0, card(3, '4'));
  assert.ok(f.handDone); assert.equal(m.phase, 'done'); assert.equal(m.handWin, 1); assert.deepEqual(m.score, [0, 2]);
});

test('empate na primeira: quem abre de novo é quem abriu, e a segunda decide', () => {
  const m = T.trNew(); T.trStartHand(m);   // abre o lugar 1
  [[1, card(0, '3')], [2, card(1, '3')], [3, card(2, '5')], [0, card(3, '4')]].forEach(([s, c]) => assert.ok(T.trPlay(m, s, c).ok));
  assert.deepEqual(m.rounds, [-1]); assert.equal(m.turn, 1, 'no empate abre quem abriu');
  [[1, card(0, '2')], [2, card(1, '5')], [3, card(2, '6')], [0, card(3, 'Q')]].forEach(([s, c]) => assert.ok(T.trPlay(m, s, c).ok));
  assert.equal(m.phase, 'done'); assert.equal(m.handWin, 1, 'a segunda foi da dupla do 1: vale a mão');
});

test('truco: sobe de 2 para 4, 6, 10 e 12, e só quem não subiu por último pode subir', () => {
  const m = T.trNew(); T.trStartHand(m);       // vez do lugar 1
  assert.equal(T.trCall(m, 2).ok, false, 'só na sua vez');
  assert.ok(T.trCall(m, 1).ok); assert.equal(m.phase, 'call'); assert.deepEqual(m.pend, { by: 1, v: 4, to: 2 });
  assert.equal(T.trAnswer(m, 3, 'ok').ok, false, 'quem responde é o próximo à esquerda');
  assert.ok(T.trAnswer(m, 2, 'ok').ok); assert.equal(m.stake, 4); assert.equal(m.phase, 'play'); assert.equal(m.last, 1);
  assert.equal(T.trCanCall(m, 1), false, 'a dupla que acabou de subir não sobe de novo');
  // outra dupla sobe para 6 (na vez do lugar 2)
  T.trPlay(m, 1, card(0, '4')); assert.equal(m.turn, 2);
  assert.ok(T.trCall(m, 2).ok); assert.equal(m.pend.v, 6);
  assert.ok(T.trAnswer(m, 3, 'raise').ok); assert.equal(m.stake, 6); assert.deepEqual(m.pend, { by: 3, v: 10, to: 0 });
  assert.ok(T.trAnswer(m, 0, 'raise').ok); assert.equal(m.stake, 10); assert.equal(m.pend.v, 12);
  assert.ok(T.trAnswer(m, 1, 'ok').ok); assert.equal(m.stake, 12);
  assert.equal(T.trNextStake(12), 0);
});

test('correr: quem pediu leva os pontos de antes do pedido', () => {
  const m = T.trNew(); T.trStartHand(m);
  T.trCall(m, 1);
  const r = T.trAnswer(m, 2, 'run');
  assert.ok(r.handDone); assert.equal(m.handWin, 1); assert.deepEqual(m.score, [0, 2], 'valia 2 antes do truco');
  const n = T.trNew(); T.trStartHand(n); T.trCall(n, 1); T.trAnswer(n, 2, 'ok'); T.trPlay(n, 1, 7); T.trCall(n, 2); T.trAnswer(n, 3, 'ok');
  T.trPlay(n, 2, 8); T.trPlay(n, 3, 9); T.trPlay(n, 0, 11);
  T.trCall(n, 1);   // 1 não pode (última vez que subiu foi a dupla de 1)... mas a vez agora é de quem ganhou a rodada
});

test('a partida acaba aos 12 pontos', () => {
  const m = T.trNew(); T.trStartHand(m); m.score = [0, 10];
  T.trCall(m, 1); T.trAnswer(m, 2, 'run');
  assert.equal(m.score[1], 12); assert.equal(m.over, 1);
});
