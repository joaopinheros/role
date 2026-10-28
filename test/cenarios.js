#!/usr/bin/env node
/*
 * Confere os 11 cenários sem servidor: a partir da entrada, dá para chegar a pé em todo assento e em toda atividade?
 * (um tapete de sentar ou uma mesa no lugar errado pode isolar um canto inteiro). Também lista casas livres isoladas.
 * Uso: node test/cenarios.js   (precisa do dist/local.html: npm run build; ROLE_DIST=pasta, se não for dist/)
 */
const path = require('path');
const { chromium } = require('playwright');
const DIST = process.env.ROLE_DIST ? path.resolve(process.env.ROLE_DIST) : path.join(__dirname, '..', 'dist');
const IDS = ['churrasco', 'festa', 'pijama', 'parque', 'boate', 'boteco', 'piscina', 'vulcao', 'templo', 'praia', 'rooftop'];
let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failed++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL(path.join(DIST, 'local.html')).href);
  await p.waitForFunction(() => window.__role, null, { timeout: 15000 });
  for (const id of IDS) {
    const s = await p.evaluate(id => window.__role.scene(id), id);
    const blocked = new Set(s.blocked), soft = new Set(s.soft), seats = new Set(s.seats.filter(k => !soft.has(k))), W = s.gw, H = s.gh;   // tapete (soft) dá para atravessar
    const pass = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !blocked.has(x + ',' + y) && !seats.has(x + ',' + y);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    // entrada: a casa livre mais perto do ponto de nascimento
    let start = null;
    for (let r = 0; r < 6 && !start; r++) for (let dx = -r; dx <= r && !start; dx++) for (let dy = -r; dy <= r && !start; dy++) if (pass(s.spawn[0] + dx, s.spawn[1] + dy)) start = [s.spawn[0] + dx, s.spawn[1] + dy];
    const seen = new Set([start.join(',')]), q = [start];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || !pass(nx, ny)) continue;
        if (dx && dy && (!pass(x + dx, y) || !pass(x, y + dy))) continue;   // mesma regra do jogo: nada de atravessar quina
        seen.add(k); q.push([nx, ny]);
      }
    }
    const near = (x, y) => dirs.concat([[0, 0]]).some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)));
    const lostSeats = s.seats.filter(k => { const [x, y] = k.split(',').map(Number); return !near(x, y); });
    const lostActs = s.acts.filter(([, x, y, w, d]) => { for (let i = -1; i <= w; i++) for (let j = -1; j <= d; j++) if (seen.has((x + i) + ',' + (y + j))) return false; return true; });
    let free = 0; for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (pass(x, y)) free++;
    ok(!lostSeats.length && !lostActs.length && seen.size >= free * .9, `${id}: ${seen.size} de ${free} casas livres alcançáveis; assentos isolados: ${lostSeats.length}${lostSeats.length ? ' (' + lostSeats.slice(0, 4).join(' ') + ')' : ''}; atividades isoladas: ${lostActs.length}${lostActs.length ? ' (' + lostActs.map(a => a[0]).join(' ') + ')' : ''}`);
  }
  ok(!errs.length, 'sem erros de JS' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(failed ? `\n${failed} falha(s)` : '\ntudo certo');
  process.exit(failed ? 1 : 0);
})();
