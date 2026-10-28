/* Testes da física e das regras da sinuca (node --test test/poolsim.test.js) */
const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/engine/poolsim.js');

const clone = b => JSON.parse(JSON.stringify(b));

test('a mesa começa com 16 bolas, a 8 no meio do triângulo, sem sobreposição', () => {
  const b = P.poolRack(123);
  assert.equal(b.length, 16);
  assert.deepEqual(b.map(x => x.id).sort((a, c) => a - c), [...Array(16).keys()]);
  assert.equal(b[5].id, 8, 'a 8 é a bola do meio da 3ª fileira');
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    const d = Math.sqrt((b[i].x - b[j].x) ** 2 + (b[i].y - b[j].y) ** 2);
    assert.ok(d >= 2 * P.POOL.R - 0.01, `bolas ${b[i].id} e ${b[j].id} sobrepostas (${d.toFixed(2)})`);
  }
  assert.notDeepEqual(P.poolRack(1).map(x => x.id), P.poolRack(2).map(x => x.id), 'sementes diferentes embaralham diferente');
  assert.deepEqual(P.poolRack(7), P.poolRack(7), 'mesma semente, mesma mesa');
});

test('determinismo: a mesma tacada dá exatamente o mesmo resultado, sempre', () => {
  const a = P.poolRack(99), b = clone(a);
  P.poolShoot(a, 9000, 1200, 800); P.poolShoot(b, 9000, 1200, 800);
  const pa = P.poolRun(a), pb = P.poolRun(b);
  assert.deepEqual(pa, pb);
  assert.deepEqual(a, b, 'posição final idêntica, bit a bit');
  assert.ok(a.some(x => x.vx === 0 && (x.x !== P.poolRack(99)[a.indexOf(x)].x)), 'a tacada mexeu nas bolas');
});

test('tudo para, ninguém sai da mesa e a física não perde bolas', () => {
  for (const [qx, qy, qp] of [[10000, 0, 1000], [-3000, 7000, 650], [4000, -9000, 300], [10000, 100, 1000]]) {
    const b = P.poolRack(5);
    P.poolShoot(b, qx, qy, qp);
    P.poolRun(b);
    assert.equal(P.poolMoving(b), false, 'terminou parado');
    for (const x of b) if (!x.in) assert.ok(x.x >= P.POOL.R - 1e-9 && x.x <= P.POOL.W - P.POOL.R + 1e-9 && x.y >= P.POOL.R - 1e-9 && x.y <= P.POOL.H - P.POOL.R + 1e-9, 'bola dentro da mesa');
    assert.equal(b.length, 16);
  }
});

test('quebra forte espalha as bolas; tacada fraca quase não move', () => {
  const forte = P.poolRack(5); P.poolShoot(forte, 10000, 0, 1000); P.poolRun(forte);
  const moved = forte.slice(1).filter((x, i) => Math.abs(x.x - P.poolRack(5)[i + 1].x) > 1 || Math.abs(x.y - P.poolRack(5)[i + 1].y) > 1).length;
  assert.ok(moved >= 6, `quebra moveu ${moved} bolas`);
  const fraca = P.poolRack(5); P.poolShoot(fraca, 10000, 0, 0); P.poolRun(fraca);
  assert.ok(fraca[0].x < 200, 'tacada fraca não chega ao triângulo');
});

test('bola na caçapa cai e sai do jogo', () => {
  const b = [{ id: 0, x: 100, y: 100, vx: 0, vy: 0, in: false }, { id: 3, x: 40, y: 6, vx: 0, vy: 0, in: false }];
  b[1].vx = -300; b[1].vy = -60;            // vai para o canto superior esquerdo
  const potted = P.poolRun(b);
  assert.deepEqual(potted, [3]); assert.equal(b[1].in, true);
});

test('regras: continua quem encaçapa do próprio grupo, e o primeiro encaçapamento define os grupos', () => {
  const balls = P.poolRack(1).map(b => ({ ...b }));
  const m = { groups: [null, null], balls };
  balls.find(b => b.id === 3).in = true;
  let r = P.poolRules(m, [3], 0);
  assert.equal(r.turn, 0, 'continua'); assert.deepEqual(r.groups, ['solid', 'stripe']);
  r = P.poolRules({ groups: ['solid', 'stripe'], balls }, [12], 0);
  assert.equal(r.turn, 1, 'encaçapou do adversário: passa a vez');
  r = P.poolRules({ groups: ['solid', 'stripe'], balls }, [], 1);
  assert.equal(r.turn, 0, 'errou: passa a vez');
});

test('regras: a branca na caçapa é falta; a 8 decide o jogo', () => {
  const balls = P.poolRack(1).map(b => ({ ...b }));
  let r = P.poolRules({ groups: ['solid', 'stripe'], balls }, [0], 0);
  assert.equal(r.turn, 1); assert.equal(r.foul, true);
  // 8 antes de limpar o grupo: perde
  balls.find(b => b.id === 8).in = true;
  r = P.poolRules({ groups: ['solid', 'stripe'], balls }, [8], 0);
  assert.equal(r.winner, 1, 'perdeu: ainda tinha bolas lisas');
  // limpou o grupo: ganha
  balls.forEach(b => { if (P.poolGroup(b.id) === 'solid') b.in = true; });
  r = P.poolRules({ groups: ['solid', 'stripe'], balls }, [8], 0);
  assert.equal(r.winner, 0);
  // 8 junto com a branca: perde mesmo limpando
  r = P.poolRules({ groups: ['solid', 'stripe'], balls }, [8, 0], 0);
  assert.equal(r.winner, 1);
  // 8 na abertura (sem grupos): volta para a mesa, ninguém ganha
  r = P.poolRules({ groups: [null, null], balls: P.poolRack(1) }, [8], 0);
  assert.equal(r.winner, -1); assert.equal(r.respot8, true);
});

test('a branca volta para o início sem ficar em cima de outra bola', () => {
  const b = P.poolRack(1);
  b[0].in = true; b[0].x = 300;
  b[1].x = P.POOL.HEAD[0]; b[1].y = P.POOL.HEAD[1];   // alguém ocupa o lugar
  P.poolRespotCue(b);
  assert.equal(b[0].in, false);
  for (const x of b.slice(1)) assert.ok(((x.x - b[0].x) ** 2 + (x.y - b[0].y) ** 2) >= 4 * P.POOL.R * P.POOL.R - 1e-6);
});

test('foto do estado: ida e volta mantém as posições (1 centésimo)', () => {
  const b = P.poolRack(8); P.poolShoot(b, 5000, 800, 700); P.poolRun(b);
  const back = P.poolFromSnap(P.poolSnap(b));
  back.forEach((x, i) => { assert.ok(Math.abs(x.x - b[i].x) <= 0.006 && Math.abs(x.y - b[i].y) <= 0.006); assert.equal(x.in, b[i].in); });
});
