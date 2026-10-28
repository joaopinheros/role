/* Testes das regras das damas brasileiras (node --test test/damas.test.js) */
const test = require('node:test');
const assert = require('node:assert');
const D = require('../src/engine/damas.js');

const sq = (r, c) => r * 8 + c;
const empty = (turn = 0) => ({ b: new Array(64).fill(0), turn, n: 0, quiet: 0, last: null, over: -1 });
const paths = m => D.dmMoves(m).map(x => x.path.join('-')).sort();

test('posição inicial: 12 pedras de cada lado, só nas casas escuras, e as claras têm 7 lances', () => {
  const m = D.dmNew();
  assert.equal(D.dmCount(m, 0), 12); assert.equal(D.dmCount(m, 1), 12);
  m.b.forEach((p, i) => { if (p) assert.equal(((i >> 3) + (i & 7)) % 2, 1, 'peça em casa clara: ' + i); });
  assert.equal(D.dmMoves(m).length, 7);
  assert.ok(D.dmMoves(m).every(x => (x.path[1] >> 3) === 4), 'as claras sobem');
});

test('pedra anda para a frente; lance fora da regra é recusado', () => {
  const m = D.dmNew();
  assert.equal(D.dmPlay(m, [sq(5, 0), sq(6, 1)]), null, 'para trás não');
  assert.equal(D.dmPlay(m, [sq(5, 0), sq(3, 2)]), null, 'duas casas não');
  assert.ok(D.dmPlay(m, [sq(5, 0), sq(4, 1)]));
  assert.equal(m.turn, 1);
  assert.equal(D.dmPlay(m, [sq(5, 2), sq(4, 3)]), null, 'fora da vez');
});

test('captura é obrigatória, para a frente e para trás', () => {
  const m = empty();
  m.b[sq(4, 3)] = 1; m.b[sq(5, 4)] = 3; m.b[sq(0, 7)] = 3; m.b[sq(7, 0)] = 1;
  assert.deepEqual(paths(m), [`${sq(4, 3)}-${sq(6, 5)}`], 'só vale a captura (para trás), nenhum lance simples');
  const mv = D.dmPlay(m, [sq(4, 3), sq(6, 5)]);
  assert.deepEqual(mv.taken, [sq(5, 4)]); assert.equal(m.b[sq(5, 4)], 0);
});

test('lei da maioria: tem que tomar o máximo de peças', () => {
  const m = empty();
  // a pedra em (7,0) pode tomar 1 subindo pela direita... ou 2 em sequência pelo outro caminho
  m.b[sq(6, 3)] = 1;
  m.b[sq(5, 2)] = 3;                       // caminho A: toma 1 e para em (4,1)
  m.b[sq(5, 4)] = 3; m.b[sq(3, 4)] = 3;     // caminho B: (6,3)->(4,5)->(2,3): toma 2
  m.b[sq(0, 1)] = 3;
  const mv = D.dmMoves(m);
  assert.equal(mv.length, 1); assert.equal(mv[0].taken.length, 2);
  assert.deepEqual(mv[0].path, [sq(6, 3), sq(4, 5), sq(2, 3)]);
  assert.equal(D.dmPlay(m, [sq(6, 3), sq(4, 1)]), null, 'a captura menor não vale');
});

test('dama voa: anda e captura à distância, pousando em qualquer casa livre depois', () => {
  const m = empty();
  m.b[sq(7, 0)] = 2; m.b[sq(4, 3)] = 3; m.b[sq(0, 1)] = 3;
  const caps = D.dmMoves(m);
  assert.deepEqual(caps.map(x => x.path[1]).sort((a, b) => a - b), [sq(0, 7), sq(1, 6), sq(2, 5), sq(3, 4)].sort((a, b) => a - b));
  const q = empty(); q.b[sq(7, 0)] = 2; q.b[sq(0, 1)] = 3;
  assert.equal(D.dmMoves(q).length, 7, 'sem captura, a dama anda a diagonal inteira');
});

test('as peças tomadas não são puladas duas vezes e a dama faz curva capturando', () => {
  const m = empty();
  m.b[sq(7, 0)] = 2; m.b[sq(5, 2)] = 3; m.b[sq(2, 1)] = 3;   // dama toma (5,2), pousa em (4,3) e vira para tomar (2,1)
  const mv = D.dmMoves(m);
  assert.equal(mv.length, 1);
  assert.deepEqual(mv[0].path, [sq(7, 0), sq(4, 3), sq(1, 0)]);
  assert.deepEqual(mv[0].taken, [sq(5, 2), sq(2, 1)]);
  for (const x of mv) assert.equal(new Set(x.taken).size, x.taken.length, 'nenhuma peça tomada duas vezes');
});

test('vira dama ao terminar na última linha; passar por ela capturando não conta', () => {
  const m = empty();
  m.b[sq(1, 2)] = 1; m.b[sq(6, 7)] = 3;
  D.dmPlay(m, [sq(1, 2), sq(0, 1)]);
  assert.equal(m.b[sq(0, 1)], 2); assert.ok(m.last.crown);

  const n = empty();
  // a pedra clara pula para a linha 0 e de lá continua capturando para trás: termina como pedra
  n.b[sq(2, 1)] = 1; n.b[sq(1, 2)] = 3; n.b[sq(1, 4)] = 3; n.b[sq(7, 6)] = 3;
  const mv = D.dmMoves(n);
  assert.equal(mv[0].taken.length, 2);
  D.dmPlay(n, mv[0].path);
  const end = mv[0].path[mv[0].path.length - 1];
  assert.notEqual(end >> 3, 0); assert.equal(n.b[end], 1, 'continua pedra');
});

test('quem fica sem lance perde; 20 lances só de damas sem captura empatam', () => {
  const m = empty();
  m.b[sq(6, 1)] = 3;                                                   // a escura fica cercada
  [[7, 0], [7, 2], [5, 0], [5, 2], [4, 3]].forEach(([r, c]) => { m.b[sq(r, c)] = 1; });
  assert.ok(D.dmPlay(m, [sq(5, 0), sq(4, 1)]));
  assert.equal(m.over, 0, 'a escura não tem lance: as claras vencem');

  const d = empty();
  d.b[sq(7, 0)] = 2; d.b[sq(0, 1)] = 4;   // as duas damas nunca ficam na mesma diagonal
  const a = [sq(7, 0), sq(6, 1)], b = [sq(0, 1), sq(1, 0)];
  for (let i = 0; i < 20 && d.over === -1; i++) {
    const me = d.turn === 0 ? a : b;
    assert.ok(D.dmPlay(d, i % 4 < 2 ? me : me.slice().reverse()), 'lance ' + i);
  }
  assert.equal(d.over, 2);
});
