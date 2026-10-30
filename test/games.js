#!/usr/bin/env node
/*
 * Teste de ponta a ponta dos jogos da sala, com o servidor Node real e três navegadores:
 * dois jogadores e uma pessoa assistindo (que chega no meio da partida).
 * Uso: node test/games.js [sinuca|xadrez|truco|damas|domino|memoria|volei|solo|todos]   (SHOTS=pasta para salvar capturas)
 * "solo" testa as atividades de uma pessoa (pesca, telescópio) e o chão é lava.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const PORT = 3197, BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || '';
const WHICH = process.argv[2] || 'todos';
const has = n => WHICH === 'todos' || WHICH.split(',').includes(n);   // ex.: node test/games.js damas,volei
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'role-games-'));
const tag = Math.random().toString(36).slice(2, 6);
const rnd = n => String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failed++; };
const shot = (p, n) => SHOTS && p.screenshot({ path: path.join(SHOTS, n + '.png') });
const waitFor = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (_) { /* a página ainda está mudando */ } await sleep(150); } return null; };
const errs = [];
const VIEW = (process.env.VIEW || '1100x760').split('x').map(Number).reduce((w, h) => ({ width: w, height: h }));   // ex.: VIEW=1920x945

async function signup(page, nome, user) {
  await sleep(250);   // a tela de entrada tira o foco para o 1º campo 30 ms depois de abrir: espera isso passar antes de preencher
  await page.waitForSelector('#scrLanding:not([hidden]), #scrAuth:not([hidden])'); if (await page.isVisible('#landEnter')) await page.click('#landEnter'); await page.fill('#suNome', nome); await page.fill('#suUser', user);
  await page.fill('#suEmail', user + '@exemplo.com'); await page.fill('#suTel', '11' + (user.charCodeAt(0) % 2 ? '9' : '9') + rnd(8));
  await sleep(120);   // dá tempo de os campos formatarem o que foi preenchido antes de enviar
  await page.click('#fSignup button[type=submit]');
  try { await page.waitForSelector('#smsText:not(:empty)'); }
  catch (e) { console.log('   cadastro travou:', JSON.stringify(await page.evaluate(() => ({ err: document.querySelector('#suErr').textContent, auth: !document.querySelector('#scrAuth').hidden, nome: document.querySelector('#suNome').value, user: document.querySelector('#suUser').value, email: document.querySelector('#suEmail').value, tel: document.querySelector('#suTel').value })))); throw e; }
  await page.fill('#vCode', (await page.textContent('#smsText')).match(/\d{4}/)[0]);
}
const inRoom = p => p.waitForFunction(() => !document.querySelector('#roomUI').hidden, null, { timeout: 20000 });
const games = p => p.evaluate(() => window.__role.games());
const stageOn = p => p.evaluate(() => document.querySelector('#stage').classList.contains('on'));
const label = async p => ((await p.isVisible('#rAct')) ? (await p.textContent('#rAct')).trim() : '');

async function newPage(browser, name) {
  const ctx = await browser.newContext({ viewport: VIEW, permissions: ['microphone'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name + ' ' + e.message));
  return p;
}

/* cria o rolê na cena pedida (posição na grade de cenários, de 1 a 11) e põe A, B e C dentro; C entra depois (parâmetro lateC) */
async function setup(browser, sceneNth, who) {
  const a = await newPage(browser, 'A');
  await a.goto(BASE + (process.env.SINK ? '/?debug=1' : '/'));
  await signup(a, 'Ana ' + tag, who + 'a' + tag);
  await a.waitForSelector('#scrHome:not([hidden])');
  await a.click('#newRole'); await a.fill('#cNome', 'Jogos ' + tag); await a.click('#c1 button[type=submit]');
  await a.click(`.scn:nth-child(${sceneNth})`); await a.click('#c2Next');
  await a.waitForFunction(() => document.querySelector('#c3Link').value);
  const link = await a.inputValue('#c3Link');
  await a.click('#c3Enter'); await inRoom(a);
  const join = async (name, nome, user) => {
    const p = await newPage(browser, name);
    await p.goto(link);
    await p.waitForFunction(() => document.querySelector('#invName').textContent.trim() !== '…');
    await p.click('#invAccept'); await signup(p, nome, user); await inRoom(p);
    return p;
  };
  const b = await join('B', 'Bia ' + tag, who + 'b' + tag);
  await sleep(1500);
  return { a, b, join: (i = 0) => join('C' + i, ['Caio', 'Duda', 'Eli', 'Fabi', 'Gui', 'Hugo', 'Iris', 'Jaime', 'Lara', 'Mica'][i] + ' ' + tag, who + 'c' + i + tag) };
}

/* os dois jogadores chegam perto da atividade; A convida e B aceita */
async function startMatch(a, b, spotA, spotB, act, nome) {
  ok(await a.evaluate(([x, y]) => window.__role.go(x, y), spotA) && await b.evaluate(([x, y]) => window.__role.go(x, y), spotB), 'os dois andam até a mesa de ' + nome);
  const parado = p => p.evaluate(() => window.__role.avs()[0].p === 0);
  await waitFor(async () => (await parado(a)) && (await parado(b)), 25000);   // só olha o botão com os dois parados: no caminho eles passam por outras mesas
  ok(!!await waitFor(async () => (await label(a)) && (await label(b)), 20000), 'o botão da atividade aparece perto da mesa: "' + (await label(a)) + '"');
  if (process.env.GDBG) for (const p of [a, b]) console.log('   dbg', JSON.stringify(await p.evaluate(() => ({ gon: window.__role.gon(), eu: window.__role.games(), avs: window.__role.avs() }))), errs.join(' | '));
  await a.click('#rAct');
  ok(!!await waitFor(async () => /Jogar com/.test(await label(b)), 8000), 'B vê "' + (await label(b)) + '" (a mesa fica esperando gente)');
  await sleep(500); await shot(b, 'espera_' + act);
  await waitFor(async () => (await b.evaluate(() => window.__role.avs()[0].p)) === 0, 8000);   // clica parado (o botão é da mesa mais perto)
  await b.click('#rAct');
  const started = !!await waitFor(async () => (await games(a)).some(g => g.id.startsWith(act) && g.status === 'playing') && (await games(b)).some(g => g.id.startsWith(act) && g.status === 'playing'), 10000);
  ok(started, 'a partida começa nos dois');
  if (!started) for (const p of [a, b]) console.log('   estado', JSON.stringify(await p.evaluate(() => ({ gon: window.__role.gon(), g: window.__role.games().map(x => [x.id, x.status, x.players, x.seat]), eu: window.__role.avs()[0], btn: document.querySelector('#rAct').hidden ? '' : document.querySelector('#rAct').textContent }))), errs.slice(-3).join(' | '));
  ok(!!await waitFor(async () => (await stageOn(a)) && (await stageOn(b)), 5000), 'os dois entram na tela do jogo');
}

const mine = (list, act) => list.find(g => g.id.startsWith(act));

async function sinuca(browser) {
  console.log('\nsinuca (boteco)');
  const { a, b, join } = await setup(browser, 6, 's');
  await startMatch(a, b, [6, 5], [7, 3], 'sinuca', 'sinuca');
  await sleep(800); await shot(a, 'sinuca_a');
  if (process.env.SINK) { await a.evaluate(() => window.__role.sink()); for (const ms of [0, 0, 0, 0]) { await sleep(ms); await shot(a, 'sinuca_cai_' + ms); } }
  const c = await join();
  ok(!!await waitFor(async () => mine(await games(c), 'sinuca')?.status === 'playing', 10000), 'quem chega no meio recebe a partida em andamento');
  ok(!(await stageOn(c)) && !/Jogar sinuca/.test(await label(c)), 'quem assiste não entra na tela do jogo nem pode abrir outra partida');
  await c.evaluate(() => { window.__role.go(5, 6); }); await sleep(3000); await c.evaluate(() => window.__role.look(7, 4));
  const box = await a.locator('#stageCv').boundingBox(), mx = box.x + box.width * .5, my = box.y + box.height * .55;
  await a.mouse.move(mx, my); await a.mouse.down(); await a.mouse.move(mx - 90, my + 4, { steps: 6 }); await a.mouse.up();
  ok(!!await waitFor(async () => mine(await games(a), 'sinuca').rolando && mine(await games(b), 'sinuca').rolando && mine(await games(c), 'sinuca').rolando, 4000), 'a tacada rola nos três ao mesmo tempo');
  await sleep(400); await shot(c, 'sinuca_assistindo');
  ok(!!await waitFor(async () => (await Promise.all([a, b, c].map(games))).every(l => { const g = mine(l, 'sinuca'); return !g.rolando && g.shot === 1; }), 25000), 'a tacada termina nos três');
  await sleep(600);
  const st = (await Promise.all([a, b, c].map(games))).map(l => JSON.stringify((g => [g.turn, g.bolas, g.pos])(mine(l, 'sinuca'))));
  ok(st[0] === st[1] && st[1] === st[2], 'os três terminam com a MESMA mesa e a mesma vez');
  await b.click('#stageExit'); await b.waitForTimeout(300); await b.click('#stageExit');
  ok(!!await waitFor(async () => { const g = mine(await games(a), 'sinuca'); return !g || g.status !== 'playing'; }, 8000), 'desistir encerra a partida para o outro');
  ok(!!await waitFor(async () => { const g = mine(await games(c), 'sinuca'); return !g || g.status === 'idle'; }, 9000), 'a mesa volta a ficar livre');
  await Promise.all([a, b, c].map(p => p.context().close()));
}

async function xadrez(browser) {
  console.log('xadrez (parque)');
  const { a, b, join } = await setup(browser, 4, 'x');
  await startMatch(a, b, [2, 3], [4, 3], 'xadrez', 'xadrez');
  const clickSq = async (p, sq, flip) => {   // clica numa casa do tabuleiro da tela do jogo (casa 28px, origem 128,42 em 480x270)
    const box = await p.locator('#stageCv').boundingBox();
    let c = 'abcdefgh'.indexOf(sq[0]), r = 8 - +sq[1];
    if (flip) { c = 7 - c; r = 7 - r; }
    await p.mouse.click(box.x + (128 + c * 28 + 14) / 480 * box.width, box.y + (42 + r * 28 + 14) / 290 * box.height);
  };
  const play = async (p, flip, from, to) => { await clickSq(p, from, flip); await sleep(200); await clickSq(p, to, flip); };
  const fen = async p => mine(await games(p), 'xadrez')?.fen;
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  ok((await fen(a)) === START && (await fen(b)) === START, 'a partida começa na posição inicial nos dois');
  await sleep(500); await shot(a, 'xadrez_a'); await shot(b, 'xadrez_b');

  await play(b, true, 'e7', 'e5'); await sleep(500);
  ok((await fen(a)) === START, 'as pretas não jogam fora da vez');
  await play(a, false, 'e2', 'e5'); await sleep(500);
  ok((await fen(a)) === START, 'lance ilegal é recusado');
  await play(a, false, 'f2', 'f3');
  ok(!!await waitFor(async () => (await fen(a)) === (await fen(b)) && (await fen(a)).startsWith("rnbqkbnr/pppppppp/8/8/8/5P2/"), 5000), 'lance das brancas (f3) aparece nos dois');

  const c = await join();
  ok(!!await waitFor(async () => (await fen(c)) === (await fen(a)), 10000), 'quem chega no meio recebe o tabuleiro atual');
  ok(!(await stageOn(c)), 'quem assiste não entra na tela do jogo');
  await c.evaluate(() => { window.__role.go(3, 5); }); await sleep(3000); await c.evaluate(() => window.__role.look(3, 3));

  await clickSq(b, 'e7', true); await sleep(500); await shot(b, 'xadrez_b_sel'); await clickSq(b, 'e5', true); await sleep(500);
  console.log('   fen depois do e5:', await fen(a));
  await play(a, false, 'g2', 'g4'); await sleep(400);
  await shot(c, 'xadrez_assistindo');
  console.log('   fen antes do mate:', await fen(a), '|', await fen(b));
  await play(b, true, 'd8', 'h4'); await sleep(800); console.log('   fen depois:', await fen(a), '|', await fen(b), '|', JSON.stringify((await games(a)).map(g => [g.status, g.over])));   // mate do louco: 1.f3 e5 2.g4 Dh4#
  ok(!!await waitFor(async () => (await Promise.all([a, b, c].map(games))).every(l => mine(l, 'xadrez')?.status === 'over'), 8000), 'xeque-mate encerra a partida nos três');
  const ov = (await Promise.all([a, b, c].map(games))).map(l => mine(l, 'xadrez').over);
  ok(ov.every(v => v === 1), 'as pretas (quem aceitou) vencem nos três: ' + ov);
  await sleep(500); await shot(a, 'xadrez_fim');
  ok(!!await waitFor(async () => !(await stageOn(a)) && !(await stageOn(b)), 8000), 'os jogadores saem da tela do jogo');
  await Promise.all([a, b, c].map(p => p.context().close()));
}

async function truco(browser) {
  console.log('truco mineiro (boteco, 4 pessoas)');
  const { a, join } = await setup(browser, 6, 't');
  const players = [a];
  for (let i = 0; i < 3; i++) players.push(await join(i));
  await sleep(1500);
  const seatTiles = [[8, 2], [10, 2], [9, 1], [9, 3]];   // as quatro cadeiras da mesa
  for (let i = 0; i < 4; i++) await players[i].evaluate(([x, y]) => window.__role.go(x, y), seatTiles[i]);
  await waitFor(async () => (await Promise.all(players.map(p => p.evaluate(() => window.__role.avs()[0].p === 0)))).every(Boolean), 30000);   // só olha o botão com todos parados
  ok(!!await waitFor(async () => (await Promise.all(players.map(label))).every(Boolean), 25000), 'os quatro chegam perto da mesa e veem o botão: "' + (await label(players[0])) + '"');
  await players[0].click('#rAct');
  ok(!!await waitFor(async () => /Entrar na mesa \(1\/4\)/.test(await label(players[1])), 8000), 'a mesa fica esperando gente: "' + (await label(players[1])) + '"');
  await shot(players[1], 'truco_fila');
  await players[1].click('#rAct');
  ok(!!await waitFor(async () => /\(2\/4\)/.test(await label(players[2])), 8000), 'o contador sobe: "' + (await label(players[2])) + '"');
  await players[2].click('#rAct');
  ok(!!await waitFor(async () => /\(3\/4\)/.test(await label(players[3])), 8000), 'terceiro entrou: "' + (await label(players[3])) + '"');
  ok(!(await Promise.all(players.map(stageOn))).some(Boolean), 'com 3 pessoas a partida ainda não começa');
  await players[3].click('#rAct');
  ok(!!await waitFor(async () => (await Promise.all(players.map(stageOn))).every(Boolean), 12000), 'com 4 a partida começa e todos entram na tela do jogo');
  await sleep(1800);

  const tg = p => p.evaluate(() => window.__role.games().find(g => g.id.startsWith('truco')));
  const all = async () => Promise.all(players.map(tg));
  const hands = (await all()).map(g => g.tmine || []);
  ok(hands.every(h => h.length === 3), 'cada um recebeu 3 cartas');
  ok(new Set(hands.flat()).size === 12, 'as 12 cartas são todas diferentes (ninguém recebeu a carta de outro)');
  const spec = await join(9);
  ok(!!await waitFor(async () => (await tg(spec))?.status === 'playing', 10000), 'o espectador que chega no meio recebe a partida');
  const sg = await tg(spec);
  ok(sg.seat === -1 && !sg.tmine, 'o espectador não tem mão nem lugar na mesa');
  ok(!(await stageOn(spec)), 'e não entra na tela do jogo');
  await shot(players[0], 'truco_mesa_A'); await shot(players[1], 'truco_mesa_B');

  // joga a carta mais forte de quem está na vez, até a mão acabar
  const playOne = async () => {
    const g = await all(), turn = g[0].turn, i = g.findIndex(x => x.seat === turn);
    const mineLeft = g[i].tmine, box = await players[i].locator('#stageCv').boundingBox();
    const n = mineLeft.length, x0 = 240 - (n * 40 + (n - 1) * 6) / 2;
    await players[i].mouse.move(box.x + (x0 + 20) / 480 * box.width, box.y + 255 / 290 * box.height);
    await players[i].mouse.click(box.x + (x0 + 20) / 480 * box.width, box.y + 255 / 290 * box.height);
    return i;
  };
  const sameState = async label => {
    const g = [...(await all()), await tg(spec)];
    const key = x => JSON.stringify([x.mao, x.stake, x.placar, x.jogadas, x.rodadas, x.fase, x.turn]);
    return ok(g.every(x => key(x) === key(g[0])), 'os cinco navegadores concordam ' + label + ': ' + key(g[0]));
  };
  const hand1 = (await all())[0].mao;
  let guard = 0;
  while (guard++ < 14) {
    const g = (await all())[0];
    if (g.mao !== hand1 || g.fase === 'done') break;
    const before = g.jogadas;
    await playOne();
    await waitFor(async () => (await all())[0].jogadas !== before || (await all())[0].fase === 'done', 4000);
    await sleep(120);
  }
  await sleep(600);
  await sameState('depois da primeira mão');
  const p1 = (await all())[0].placar;
  ok(p1[0] + p1[1] === 2, 'a mão valeu 2 pontos para uma das duplas: ' + JSON.stringify(p1));
  await shot(players[0], 'truco_fim_mao');
  ok(!!await waitFor(async () => (await all())[0].mao === hand1 + 1, 9000), 'o anfitrião distribui a mão seguinte sozinho');
  await sleep(1500);
  ok((await all()).every(g => (g.tmine || []).length === 3), 'cada um recebe 3 cartas novas');

  // truco: quem está na vez pede e a outra dupla sobe até o doze
  const btn = (p, re) => p.locator('#sbtns button').filter({ hasText: re });
  const turnPlayer = async () => { const g = await all(); return g.findIndex(x => x.seat === g[0].turn); };
  let caller = await turnPlayer();
  await btn(players[caller], /^TRUCO!/).click();
  ok(!!await waitFor(async () => (await all()).every(g => g.fase === 'call'), 6000), 'o pedido de truco aparece para todos');
  await shot(players[(caller + 1) % 4], 'truco_pedido');
  const rise = async (idxAns, re) => { await btn(players[idxAns], re).click(); };
  // a outra dupla sobe: seis; depois quem pediu sobe: nove; depois doze
  await rise((caller + 1) % 4, /AUMENTAR: SEIS/);
  ok(!!await waitFor(async () => (await all())[0].stake === 4, 5000), 'ao subir, o truco vale 4 enquanto espera a resposta');
  await rise((caller + 2) % 4, /AUMENTAR: NOVE/);
  await rise((caller + 3) % 4, /AUMENTAR: DOZE/);
  await rise((caller + 4) % 4, /^ACEITO/);
  ok(!!await waitFor(async () => (await all()).every(g => g.stake === 12 && g.fase === 'play'), 6000), 'depois de aceitar o doze, a mão vale 12 nos quatro');
  await sameState('no doze');

  // joga a mão até o fim: a dupla que vence a mão ganha 12 pontos e a partida
  guard = 0;
  while (guard++ < 14) {
    const g = (await all())[0];
    if (g.fase === 'done' || g.status !== 'playing') break;
    const before = g.jogadas;
    await playOne();
    await waitFor(async () => { const x = (await all())[0]; return x.jogadas !== before || x.fase === 'done' || x.status !== 'playing'; }, 4000);
    await sleep(120);
  }
  ok(!!await waitFor(async () => (await all()).every(g => g.status === 'over'), 8000), 'a partida termina nos quatro');
  const fin = await all();
  ok(fin.every(g => JSON.stringify(g.venceu) === JSON.stringify(fin[0].venceu)) && fin[0].venceu.length === 2, 'vence uma dupla inteira: lugares ' + JSON.stringify(fin[0].venceu));
  ok(fin[0].venceu.every(s => s % 2 === fin[0].venceu[0] % 2), 'os dois vencedores são parceiros (lugares de mesma paridade)');
  await shot(players[0], 'truco_fim_partida');
  ok(!!await waitFor(async () => !(await Promise.all(players.map(stageOn))).some(Boolean), 9000), 'todos saem da tela do jogo e a mesa volta a ficar livre');
  await Promise.all([...players, spec].map(p => p.context().close()));
}

const dbgOf = async (p, act) => mine(await games(p), act)?.d;
const go = (p, x, y) => p.evaluate(([x, y]) => window.__role.go(x, y), [x, y]);
const act = (p, type, cmd, arg) => p.evaluate(([t, c, a]) => window.__role.act(t, c, a), [type, cmd, arg]);
const clickAt = async (p, x, y) => { const box = await p.locator('#stageCv').boundingBox(); await p.mouse.click(box.x + x / 480 * box.width, box.y + y / 290 * box.height); };
const logHas = (p, re) => p.evaluate(src => [...document.querySelectorAll('#log > div')].some(d => new RegExp(src).test(d.textContent)), re.source);

async function damas(browser) {
  console.log('\ndamas (templo)');
  const { a, b, join } = await setup(browser, 9, 'd');
  await startMatch(a, b, [1, 6], [3, 6], 'damas', 'damas');
  const sq = async (p, r, c, flip) => { if (flip) { r = 7 - r; c = 7 - c; } await clickAt(p, 128 + c * 28 + 14, 42 + r * 28 + 14); };
  const mv = async (p, flip, [r0, c0], [r1, c1]) => { await sq(p, r0, c0, flip); await sleep(150); await sq(p, r1, c1, flip); await sleep(500); };
  const board = async p => (await dbgOf(p, 'damas'))?.b;
  const b0 = await board(a);
  ok(b0 && b0 === await board(b), 'os dois começam com o mesmo tabuleiro (12 x 12)');
  await mv(b, true, [2, 1], [3, 0]);
  ok((await board(a)) === b0, 'as escuras não jogam fora da vez');
  await mv(a, false, [5, 2], [4, 3]);
  ok(!!await waitFor(async () => (await board(b)) !== b0 && (await board(b)) === (await board(a)), 5000), 'lance das claras aparece nos dois');
  await mv(b, true, [2, 5], [3, 4]);
  const before = await board(a);
  await mv(a, false, [5, 0], [4, 1]);
  ok((await board(a)) === before, 'captura é obrigatória: lance simples recusado');
  const c = await join();
  ok(!!await waitFor(async () => (await board(c)) === (await board(a)), 10000), 'quem chega no meio recebe o tabuleiro atual');
  await mv(a, false, [4, 3], [2, 5]);
  ok(!!await waitFor(async () => (await Promise.all([a, b, c].map(p => dbgOf(p, 'damas')))).every(d => d.escuras === 11), 5000), 'as claras tomam uma peça: 11 escuras nos três');
  await c.evaluate(() => { window.__role.go(2, 8); }); await sleep(2500); await c.evaluate(() => window.__role.look(2, 6));
  await shot(a, 'damas_a'); await shot(b, 'damas_b'); await shot(c, 'damas_assistindo');
  await b.click('#stageExit'); await b.waitForTimeout(300); await b.click('#stageExit');
  ok(!!await waitFor(async () => { const g = mine(await games(a), 'damas'); return !g || g.status !== 'playing'; }, 8000), 'desistir encerra a partida');
  await Promise.all([a, b, c].map(p => p.context().close()));
}

async function domino(browser) {
  console.log('\ndominó (parque)');
  const { a, b, join } = await setup(browser, 4, 'o');
  await startMatch(a, b, [4, 9], [6, 9], 'domino', 'dominó');
  await sleep(600);
  const [da, db] = [await dbgOf(a, 'domino'), await dbgOf(b, 'domino')];
  ok(da.mine.length === 7 && db.mine.length === 7 && !da.mine.some(t => db.mine.includes(t)), 'cada um tem 7 pedras e ninguém tem a pedra do outro');
  await shot(a, 'domino_a');
  const c = await join();
  ok(!!await waitFor(async () => (await dbgOf(c, 'domino'))?.n === (await dbgOf(a, 'domino')).n, 10000), 'quem chega no meio recebe a mesa');
  let guard = 0, last = '';
  while (guard++ < 90) {
    const d = await dbgOf(a, 'domino');
    if (!d || d.over !== -1) break;
    const p = d.vez === (await mine(await games(a), 'domino')).seat ? a : b;
    last = await act(p, 'domino', 'auto');
    await waitFor(async () => { const x = await dbgOf(a, 'domino'); return !x || x.n !== d.n; }, 4000);
    if (guard === 6) await shot(a, 'domino_meio');
  }
  const fin = await Promise.all([a, b, c].map(p => dbgOf(p, 'domino')));
  ok(fin.every(x => x && x.over !== -1), 'a partida chega ao fim nos três (' + (fin[0] && fin[0].why) + ', ' + guard + ' jogadas)');
  ok(fin.every(x => JSON.stringify([x.mesa, x.monte, x.maos, x.over]) === JSON.stringify([fin[0].mesa, fin[0].monte, fin[0].maos, fin[0].over])), 'os três terminam com a mesma mesa: ' + JSON.stringify([fin[0].mesa, fin[0].monte, fin[0].maos]));
  await shot(a, 'domino_fim');
  await Promise.all([a, b, c].map(p => p.context().close()));
}

async function memoria(browser) {
  console.log('\nmemória (noite do pijama)');
  const { a, b } = await setup(browser, 3, 'm');
  await startMatch(a, b, [8, 4], [10, 4], 'memoria', 'memória');
  const at = i => [114 + (i % 5) * 52 + 22, 34 + Math.floor(i / 5) * 62 + 27];
  const d = await dbgOf(a, 'memoria');
  const pair = (cards, v) => cards.map((x, i) => x === v ? i : -1).filter(i => i >= 0);
  const [i1, i2] = pair(d.cards, d.cards[0]);
  await clickAt(a, ...at(i1)); await sleep(250); await clickAt(a, ...at(i2));
  ok(!!await waitFor(async () => (await dbgOf(b, 'memoria')).placar[0] === 1, 5000), 'A acha um par: 1 x 0 nos dois');
  ok((await dbgOf(a, 'memoria')).vez === 0, 'quem acha par joga de novo');
  const other = d.cards.findIndex((x, i) => x !== d.cards[0] && i !== i1 && i !== i2), wrong = d.cards.findIndex((x, i) => x !== d.cards[other] && x !== d.cards[0]);
  await clickAt(a, ...at(other)); await sleep(250); await clickAt(a, ...at(wrong));
  ok(!!await waitFor(async () => (await dbgOf(b, 'memoria')).vez === 1, 5000), 'errou o par: a vez passa para B');
  await sleep(300); await shot(b, 'memoria_b');
  await Promise.all([a, b].map(p => p.context().close()));
}

async function volei(browser) {
  console.log('\nvôlei de praia (luau)');
  const { a, b, join } = await setup(browser, 10, 'v');
  await startMatch(a, b, [4, 3], [9, 3], 'volei', 'vôlei');
  const c = await join();
  await c.evaluate(() => window.__role.go(6, 6)); await sleep(2000); await c.evaluate(() => window.__role.look(7, 3));
  const players = [a, b];
  const w = async p => act(p, 'volei', 'where');
  ok(!!await waitFor(async () => (await w(a)).srv === 0, 3000), 'quem convidou saca primeiro');
  await act(a, 'volei', 'hit');
  ok(!!await waitFor(async () => (await w(b)).by === 0, 3000), 'o saque chega no outro lado');
  // B corre para onde a bola vai cair e bate quando ela desce ao alcance
  const rally = async (recv) => {
    const p = players[recv], info = await w(p);
    await act(p, 'volei', 'go', info.x1 + (recv === 1 ? -22 : 22));   // um pouco antes de onde ela cai, do lado da rede
    const ok_ = await waitFor(async () => { const x = await w(p); if (process.env.VDBG) console.log('   ', JSON.stringify(x)); if (x.by === recv) return true; if (x.u > .45 && x.z < 150 && x.z > 50) { await act(p, 'volei', 'hit'); } return false; }, 6000);
    return !!ok_;
  };
  ok(await rally(1), 'B devolve a bola com um toque');
  await sleep(200); await shot(c, 'volei_assistindo'); await shot(b, 'volei_b');
  ok(!!await waitFor(async () => (await dbgOf(a, 'volei')).h === 2, 3000), 'A vê a devolução (2 toques no ponto)');
  // agora A não alcança (fica parado do outro lado): ponto para B
  await act(a, 'volei', 'go', (await w(a)).x1 > 140 ? 40 : 230);
  ok(!!await waitFor(async () => (await Promise.all([a, b, c].map(p => dbgOf(p, 'volei')))).every(d => d && d.placar[1] === 1), 8000), 'a bola cai do lado de A: 0 x 1 nos três');
  ok((await dbgOf(a, 'volei')).srv === 1, 'quem fez o ponto saca');
  await Promise.all([a, b, c].map(p => p.context().close()));
}

/* atividades de uma pessoa: pesca e telescópio; e o chão é lava */
async function solo(browser) {
  console.log('\npesca (templo)');
  {
    const { a, b } = await setup(browser, 9, 'p');
    await go(a, 5, 5); await go(b, 6, 10);
    ok(!!await waitFor(async () => /Pescar/.test(await label(a)), 15000), 'no banquinho aparece "' + (await label(a)) + '"');
    await a.click('#rAct');
    ok(!!await waitFor(() => stageOn(a), 5000), 'a câmera vai para o lago');
    ok(!!await waitFor(async () => mine(await games(b), 'pesca')?.status === 'playing', 5000), 'a sala fica sabendo que A está pescando');
    await act(a, 'pesca', 'cast'); await sleep(700); await shot(a, 'pesca_lago');
    await act(a, 'pesca', 'bite'); await act(a, 'pesca', 'strike');
    ok((await dbgOf(a, 'pesca')).local === 'reel', 'fisgou: começa a briga');
    await sleep(300); await shot(a, 'pesca_briga');
    await act(a, 'pesca', 'win');
    ok(!!await waitFor(async () => (await dbgOf(a, 'pesca')).local === 'catch', 4000), 'pegou a carpa');
    ok(!!await waitFor(() => logHas(b, /pescou|chinelo/), 5000), 'a sala vê o aviso do peixe');
    await sleep(400); await shot(a, 'pesca_pegou'); await b.evaluate(() => window.__role.look(5, 5)); await sleep(300); await shot(b, 'pesca_mundo');
    await a.click('#stageExit');
    ok(!!await waitFor(async () => mine(await games(b), 'pesca')?.status !== 'playing', 5000), 'sair da pesca libera o banquinho');
    await Promise.all([a, b].map(p => p.context().close()));
  }
  console.log('telescópio (rooftop)');
  {
    const { a, b } = await setup(browser, 11, 'e');
    await go(a, 6, 6);   // o telescópio fica no meio do terraço
    ok(!!await waitFor(async () => /telesc/.test(await label(a)), 15000), 'perto da luneta aparece "' + (await label(a)) + '"');
    await a.click('#rAct'); await waitFor(() => stageOn(a), 5000);
    for (const e of ['casal', 'chuveiro', 'vigilante']) {
      await act(a, 'telescopio', 'look', e);
      ok(!!await waitFor(async () => (await dbgOf(a, 'telescopio'))?.achados.includes(e), 4000), 'achou: ' + e);
      await sleep(900); await shot(a, 'telescopio_' + e);
    }
    ok(!!await waitFor(() => logHas(b, /pelo telescópio/), 5000), 'a sala fica sabendo do que A viu');
    const sp = Object.entries((await dbgOf(a, 'telescopio')).spots).filter(([k]) => !['ovni', 'vigilante', 'gato'].includes(k));
    const clash = sp.flatMap(([k, p], i) => sp.slice(i + 1).filter(([, q]) => Math.abs(p.x - q.x) < 36 && Math.abs(p.y - q.y) < 26).map(([j]) => k + '/' + j));
    ok(!clash.length, 'as janelas especiais não se sobrepõem' + (clash.length ? ': ' + clash.join(', ') : ''));
    await a.click('#stageExit');
    await Promise.all([a, b].map(p => p.context().close()));
  }
  console.log('NPCs, piscina e dragão');
  {
    const { a, b } = await setup(browser, 6, 'n');
    const npcs = await a.evaluate(() => window.__role.npcs());
    ok(npcs.length === 1 && npcs[0].n === 'Zé do Balcão', 'o boteco tem só o barman: ' + npcs.map(n => n.n).join(', '));
    ok(!!await waitFor(async () => (await a.evaluate(() => window.__role.npcs()[0])).x === 0, 3000), 'o barman fica atrás do balcão');
    const ys = new Set(); for (let i = 0; i < 40; i++) { ys.add((await a.evaluate(() => window.__role.npcs()[0])).y); await sleep(500); }
    ok(ys.size > 1, 'e passeia por lá: ' + [...ys]);
    ok((await a.textContent('#count')).trim() === '2 na sala', 'os NPCs não contam como gente na sala: "' + (await a.textContent('#count')).trim() + '"');
    await a.evaluate(() => window.__role.go(5, 0));   // o balcão é fechado: não dá para entrar atrás dele
    const behind = await a.evaluate(() => window.__role.go(0, 3));
    ok(behind === false, 'ninguém entra atrás do balcão (fechado)');
    await Promise.all([a, b].map(p => p.context().close()));
  }
  {
    const { a, b } = await setup(browser, 6, 'q');
    ok(/Restam 7h|Restam 8h/.test(await a.textContent('#rWhen')), 'o chip mostra quanto falta das 8 horas: ' + await a.textContent('#rWhen'));
    await a.evaluate(() => window.__role.expira());
    ok(!!await waitFor(() => a.isVisible('#scrHome'), 14000), 'passadas as 8 horas, todo mundo volta para o início');
    await Promise.all([a, b].map(p => p.context().close()));
  }
  {
    const { a, b } = await setup(browser, 7, 'w');
    ok(!(await a.evaluate(() => window.__role.nadando())), 'fora da piscina, ninguém está nadando');
    ok(await a.evaluate(() => window.__role.go(6, 5)), 'dá para andar para dentro da piscina');
    ok(!!await waitFor(() => a.evaluate(() => window.__role.nadando()), 12000), 'e lá dentro o boneco nada');
    await sleep(300); await shot(a, 'piscina_nadando');
    await Promise.all([a, b].map(p => p.context().close()));
  }
  {
    const { a, b } = await setup(browser, 8, 'g');
    ok(!!await a.evaluate(() => window.__role.pets().some(p => p.t === 'dragao')), 'o pet do vulcão é o dragão-de-Komodo');
    ok(await a.evaluate(() => window.__role.dragonTest()), 'posiciona o dragão e a pessoa na frente dele');
    ok(!!await waitFor(async () => (await a.evaluate(() => window.__role.lava())).queimando, 5000), 'o fogo do dragão queima quem está na frente');
    const bu = (await a.evaluate(() => window.__role.avs()))[0].u;
    ok(!!await waitFor(async () => (await b.evaluate(() => window.__role.lava())).burns !== undefined && await b.evaluate(() => window.__role.avs().some(v => v.u && v.p === 0)), 3000), 'o outro está na sala e vê a cena');
    ok(!!await waitFor(async () => !(await a.evaluate(() => window.__role.lava())).queimando, 4000), 'e a queimadura passa (1,5 s)');
    await Promise.all([a, b].map(p => p.context().close()));
  }
  console.log('o chão é lava (vulcão)');
  {
    const { a, b } = await setup(browser, 8, 'l');
    await go(a, 2, 8);
    ok(!!await waitFor(async () => /gongo/.test(await label(a)), 15000), 'perto do gongo aparece "' + (await label(a)) + '"');
    await a.click('#rAct');
    ok(!!await waitFor(async () => (await b.evaluate(() => window.__role.lava())).on, 5000), 'bateu o gongo: começa para os dois');
    await sleep(500); await shot(b, 'lava_comeco');
    await Promise.all([a, b].map(p => p.evaluate(() => window.__role.lava('fast'))));
    const cellsOf = p => p.evaluate(() => window.__role.lava());
    ok(!!await waitFor(async () => (await cellsOf(a)).cells > 0 && (await cellsOf(b)).cells > 0, 4000), 'as casas da primeira rodada aparecem');
    const [la, lb] = [await cellsOf(a), await cellsOf(b)];
    ok(JSON.stringify(la.lista.sort()) === JSON.stringify(lb.lista.sort()), 'os dois sorteiam as mesmas casas (' + la.cells + ')');
    // B corre para a casa de lava mais perto
    const near = lb.lista.map(k => k.split(',').map(Number)).sort((p, q) => Math.hypot(p[0] - lb.eu[0], p[1] - lb.eu[1]) - Math.hypot(q[0] - lb.eu[0], q[1] - lb.eu[1]));
    for (const [x, y] of near) { if (await go(b, x, y)) break; }
    ok(!!await waitFor(async () => (await cellsOf(b)).queimando, 6000), 'quem fica na lava queima');
    await sleep(200); await shot(b, 'lava_queimou');
    const bu = await b.evaluate(() => window.__role.avs()[0].u);
    ok(!!await waitFor(async () => ((await cellsOf(a)).burns[bu] || 0) >= 1, 4000), 'o outro vê a queimadura');
    await Promise.all([a, b].map(p => p.context().close()));
  }
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_FILE: path.join(tmp, 'db.json'), SMS_DEV: '1', SMS_WEBHOOK_URL: '', AUTH_LIMIT: '500' }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /no ar/.test(d) && res()); setTimeout(() => rej(new Error('servidor não subiu')), 15000); });
  const browser = await chromium.launch();
  try {
    if (has('sinuca')) await sinuca(browser);
    if (has('xadrez')) await xadrez(browser);
    if (has('truco')) await truco(browser);
    if (has('damas')) await damas(browser);
    if (has('domino')) await domino(browser);
    if (has('memoria')) await memoria(browser);
    if (has('volei')) await volei(browser);
    if (has('solo')) await solo(browser);
    ok(!errs.length, 'sem erros de JS' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  } catch (e) { console.error('\n' + e.stack); failed++; }
  finally {
    await browser.close(); srv.kill('SIGTERM'); await new Promise(r => srv.once('exit', r));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} falha(s)` : '\ntudo certo');
  process.exit(failed ? 1 : 0);
})();
