/*
 * Sinuca (bola 8 simplificada): física e regras. Roda igual em todos os navegadores.
 * Todo mundo na sala simula a mesma tacada a partir do mesmo estado, então só a tacada viaja pela rede.
 * Por isso aqui só entram + - * / e Math.sqrt (o padrão IEEE manda o mesmo resultado em qualquer lugar).
 * Nada de Math.sin, Math.cos nem Math.hypot: eles variam entre motores.
 *
 * Mesa: 400 x 200, origem no canto superior esquerdo da área de jogo. Bola 0 é a branca, 8 é a preta,
 * 1-7 são lisas e 9-15 são listradas.
 */
const POOL = {
  W: 400, H: 200, R: 5.5, DT: 1 / 240,
  // caçapas: x, y, raio (nos cantos e no meio dos lados mais compridos)
  POCKET: [[-1, -1, 13], [401, -1, 13], [-1, 201, 13], [401, 201, 13], [200, -4, 13], [200, 204, 13]],
  HEAD: [100, 100], APEX: [288, 100],
};

const poolGroup = id => id === 0 ? 'cue' : id === 8 ? 'eight' : id >= 9 ? 'stripe' : 'solid';

/* posição inicial: triângulo com a 8 no meio, resto embaralhado pela semente (igual para todo mundo) */
function poolRack(seed) {
  const ids = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
  ids.splice(4, 0, 8);
  const R = POOL.R, balls = [{ id: 0, x: POOL.HEAD[0], y: POOL.HEAD[1], vx: 0, vy: 0, in: false }];
  let k = 0;
  for (let row = 0; row < 5; row++) {
    for (let c = 0; c <= row; c++) {
      balls.push({ id: ids[k++], x: POOL.APEX[0] + row * (R * 1.7320508075688772 + 0.15), y: POOL.APEX[1] + (c - row / 2) * (2 * R + 0.3), vx: 0, vy: 0, in: false });
    }
  }
  return balls;
}

/* um passo da simulação; devolve os ids das bolas que caíram nele */
function poolStep(balls, dt) {
  const R = POOL.R, W = POOL.W, H = POOL.H, out = [];
  for (const a of balls) {
    if (a.in) continue;
    a.x += a.vx * dt; a.y += a.vy * dt;
    const sp = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
    if (sp > 0) {                                  // atrito: desacelera até parar
      const ns = sp - (70 + sp * 0.35) * dt;
      if (ns <= 4) { a.vx = 0; a.vy = 0; } else { const k = ns / sp; a.vx *= k; a.vy *= k; }
    }
  }
  for (let i = 0; i < balls.length; i++) {         // choques entre bolas, sempre na mesma ordem
    const a = balls[i];
    if (a.in) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const c = balls[j];
      if (c.in) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy, m = 2 * R;
      if (d2 < m * m && d2 > 0) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (m - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
        const p = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (p > 0) { const imp = p * 0.97; a.vx -= imp * nx; a.vy -= imp * ny; c.vx += imp * nx; c.vy += imp * ny; }
      }
    }
  }
  for (const a of balls) {                         // caçapas e tabelas
    if (a.in) continue;
    let fell = false;
    for (const p of POOL.POCKET) { const dx = a.x - p[0], dy = a.y - p[1]; if (dx * dx + dy * dy < p[2] * p[2]) { fell = true; break; } }
    if (fell) { a.in = true; a.vx = 0; a.vy = 0; out.push(a.id); continue; }
    if (a.x < R) { a.x = R; a.vx = -a.vx * 0.78; } else if (a.x > W - R) { a.x = W - R; a.vx = -a.vx * 0.78; }
    if (a.y < R) { a.y = R; a.vy = -a.vy * 0.78; } else if (a.y > H - R) { a.y = H - R; a.vy = -a.vy * 0.78; }
  }
  return out;
}

const poolMoving = balls => { for (const a of balls) if (!a.in && (a.vx || a.vy)) return true; return false; };

/* tacada: (qx, qy) é a direção e qp a força de 0 a 1000. São inteiros porque é isso que viaja pela rede */
function poolShoot(balls, qx, qy, qp) {
  const cue = balls[0], l = Math.sqrt(qx * qx + qy * qy) || 1, sp = 60 + qp * 0.64;
  cue.vx = qx / l * sp; cue.vy = qy / l * sp;
}

/* roda até tudo parar (ou até o limite de segurança) */
function poolRun(balls, maxSteps) {
  const out = [];
  let n = 0;
  const lim = maxSteps || 240 * 25;
  while (poolMoving(balls) && n++ < lim) for (const id of poolStep(balls, POOL.DT)) out.push(id);
  return out;
}

/*
 * Regras depois de uma tacada. m = { groups: [g0, g1] (null até alguém encaçapar a primeira), balls }.
 * Devolve { turn, groups, winner, foul, respot8 }.
 *  - encaçapou bola do seu grupo (ou qualquer uma, antes dos grupos): joga de novo
 *  - a branca caiu: falta, vez do outro (a branca volta para o início)
 *  - a 8 caiu: ganha quem já limpou o seu grupo e não fez falta; do contrário perde
 */
function poolRules(m, potted, shooter) {
  const groups = m.groups.slice(), cue = potted.includes(0), eight = potted.includes(8);
  if (!groups[0] && !groups[1]) {
    const first = potted.find(id => id !== 0 && id !== 8);
    if (first) { const g = poolGroup(first); groups[shooter] = g; groups[1 - shooter] = g === 'solid' ? 'stripe' : 'solid'; }
  }
  const mine = groups[shooter];
  const left = g => m.balls.filter(b => !b.in && poolGroup(b.id) === g).length;
  if (eight) {
    if (!mine) return { turn: 1 - shooter, groups, winner: -1, foul: cue, respot8: true };   // a 8 na abertura volta para a mesa
    return { turn: shooter, groups, winner: (left(mine) === 0 && !cue) ? shooter : 1 - shooter, foul: cue };
  }
  const own = potted.some(id => id !== 0 && (!mine || poolGroup(id) === mine));
  return { turn: (own && !cue) ? shooter : 1 - shooter, groups, winner: -1, foul: cue };
}

/* a branca volta para o início da mesa (e sai de cima de outra bola, se houver) */
function poolRespotCue(balls) {
  const c = balls[0];
  c.in = false; c.vx = 0; c.vy = 0; c.x = POOL.HEAD[0]; c.y = POOL.HEAD[1];
  for (let t = 0; t < 40; t++) {
    const hit = balls.find(b => b !== c && !b.in && ((b.x - c.x) * (b.x - c.x) + (b.y - c.y) * (b.y - c.y)) < 4 * POOL.R * POOL.R);
    if (!hit) break;
    c.x -= POOL.R * 2;
    if (c.x < POOL.R) { c.x = POOL.HEAD[0]; c.y += POOL.R * 2; }
  }
}
function poolRespot8(balls) {
  const b = balls.find(x => x.id === 8);
  b.in = false; b.vx = 0; b.vy = 0; b.x = POOL.APEX[0]; b.y = POOL.APEX[1];
}

/* foto do estado para mandar pela rede (e corrigir qualquer diferença de arredondamento) */
const poolSnap = balls => balls.map(b => [b.id, Math.round(b.x * 100) / 100, Math.round(b.y * 100) / 100, b.in ? 1 : 0]);
const poolFromSnap = snap => snap.map(([id, x, y, i]) => ({ id, x, y, vx: 0, vy: 0, in: !!i }));

if (typeof module !== 'undefined') module.exports = { POOL, poolGroup, poolRack, poolStep, poolMoving, poolShoot, poolRun, poolRules, poolRespotCue, poolRespot8, poolSnap, poolFromSnap };
