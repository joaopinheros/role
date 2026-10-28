/* Testes das regras do dominó (node --test test/domino.test.js) */
const test = require('node:test');
const assert = require('node:assert');
const D = require('../src/engine/domino.js');

const T = (a, b) => D.DO_T.findIndex(x => x[0] === Math.min(a, b) && x[1] === Math.max(a, b));

test('28 pedras, 7 para cada um e 14 no monte, sem repetir', () => {
  assert.equal(D.DO_T.length, 28);
  const m = D.doNew(42);
  assert.equal(m.hands[0].length, 7); assert.equal(m.hands[1].length, 7); assert.equal(m.pile.length, 14);
  assert.equal(new Set([...m.hands[0], ...m.hands[1], ...m.pile]).size, 28);
  assert.deepEqual(D.doNew(42), m, 'mesma semente, mesma distribuição');
});

test('abre quem tem a maior bucha, e tem que abrir com ela', () => {
  for (let seed = 1; seed < 40; seed++) {
    const m = D.doNew(seed);
    const top = [6, 5, 4, 3, 2, 1, 0].map(v => T(v, v)).find(t => m.hands[0].includes(t) || m.hands[1].includes(t));
    assert.equal(m.must, top); assert.ok(m.hands[m.turn].includes(top));
    const other = m.hands[m.turn].find(t => t !== top);
    assert.equal(D.doPlay(m, m.turn, other, 1).ok, false, 'outra pedra na saída não vale');
    assert.ok(D.doPlay(m, m.turn, top, 1).ok);
  }
});

const fixed = (h0, h1, pile = [], chain = []) => ({ hands: [h0.map(([a, b]) => T(a, b)), h1.map(([a, b]) => T(a, b))], pile: pile.map(([a, b]) => T(a, b)), chain, turn: 0, must: -1, passes: 0, n: 0, over: -1, why: '', pts: 0, last: null });

test('encaixe nas duas pontas, com a pedra virada do jeito certo', () => {
  const m = fixed([[6, 6], [3, 6], [1, 6], [2, 4]], [[5, 6], [0, 0]]);
  assert.ok(D.doPlay(m, 0, T(6, 6), 1).ok);
  assert.deepEqual(D.doEnds(m), [6, 6]);
  assert.ok(D.doPlay(m, 1, T(5, 6), 0).ok);
  assert.deepEqual(D.doEnds(m), [5, 6], 'a ponta esquerda virou 5');
  assert.deepEqual(D.doFits(m, T(3, 6)), [1]);
  assert.ok(D.doPlay(m, 0, T(3, 6), 1).ok);
  assert.deepEqual(D.doEnds(m), [5, 3]);
  assert.deepEqual(m.chain.map(x => [x.a, x.b]), [[5, 6], [6, 6], [6, 3]]);
  assert.equal(D.doPlay(m, 1, T(0, 0), 0).ok, false, '0-0 não encaixa');
});

test('sem pedra que sirva: compra do monte; com o monte vazio, passa', () => {
  const m = fixed([[1, 1]], [[2, 2], [0, 3]], [[4, 5], [1, 2]], [{ t: T(1, 1), a: 1, b: 1 }]);
  m.hands[0] = [T(0, 5)]; m.turn = 1;
  assert.equal(D.doPass(m, 1).ok, false, 'com monte não pode passar');
  const b1 = D.doBuy(m, 1);
  assert.ok(b1.ok); assert.equal(b1.t, T(4, 5));
  const b2 = D.doBuy(m, 1);
  assert.ok(b2.ok); assert.equal(b2.t, T(1, 2));
  assert.equal(D.doBuy(m, 1).ok, false, 'agora tem pedra que serve: não compra mais');
  assert.ok(D.doPlay(m, 1, T(1, 2), 1).ok);
  assert.equal(m.turn, 0);
  assert.equal(D.doBuy(m, 0).ok, false, 'monte vazio');
  assert.ok(D.doPass(m, 0).ok);
});

test('bateu: ganha e leva os pontos da mão do outro', () => {
  const m = fixed([[6, 6]], [[2, 3], [4, 4]]);
  const r = D.doPlay(m, 0, T(6, 6), 1);
  assert.ok(r.ok); assert.equal(m.over, 0); assert.equal(m.why, 'bateu'); assert.equal(m.pts, 13);
});

test('trancou: os dois passam e ganha quem tem menos pontos', () => {
  const m = fixed([[0, 0], [5, 5]], [[1, 1], [6, 6]], [], [{ t: T(3, 3), a: 3, b: 3 }]);
  assert.ok(D.doPass(m, 0).ok); assert.equal(m.over, -1);
  assert.ok(D.doPass(m, 1).ok);
  assert.equal(m.over, 0); assert.equal(m.why, 'trancou'); assert.equal(m.pts, 4);
});
