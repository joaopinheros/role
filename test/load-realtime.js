#!/usr/bin/env node
/*
 * Teste de carga do servidor de tempo real: N salas com P pessoas cada, todas andando (presença) durante T segundos.
 * Mede quantas mensagens o servidor entrega por segundo, a latência de ponta a ponta e o CPU/memória DO SERVIDOR
 * (lidos do /healthz, com o servidor em outro processo). O Supabase é de mentira (test/fake-supabase.js).
 *
 * Uso: node test/load-realtime.js [salas=20] [pessoas=50] [segundos=30] [intervaloDeCliqueEmSegundos=3]
 * Obs.: os clientes de teste rodam na mesma máquina e disputam CPU com o servidor, então os números do servidor são conservadores.
 */
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const { createFakeSupabase } = require('./fake-supabase');

const [ROOMS, PER, SECS, EVERY] = [+process.argv[2] || 20, +process.argv[3] || 50, +process.argv[4] || 30, +process.argv[5] || 3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;

(async () => {
  const fake = createFakeSupabase();
  const sp = await fake.listen();
  const roomIds = Array.from({ length: ROOMS }, (_, i) => 'load' + String(i).padStart(2, '0') + 'aa');
  const users = r => Array.from({ length: PER }, (_, j) => `u${r}x${j}`);
  roomIds.forEach((id, r) => fake.role(id, users(r), { max: PER + 5 }));

  const port = 3290;
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'realtime', 'server.js')], {
    env: { ...process.env, RT_PORT: String(port), RT_HOST: '127.0.0.1', SUPABASE_URL: 'http://127.0.0.1:' + sp, SUPABASE_PUBLISHABLE_KEY: 'pk', NODE_ENV: 'development', ALLOWED_ORIGINS: '', RT_MAX_PER_IP: '5000' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /no ar/.test(d) && res()); setTimeout(() => rej(new Error('servidor não subiu')), 10000); });
  const health = async () => (await fetch(`http://127.0.0.1:${port}/healthz`)).json();

  const lat = []; let recv = 0, sent = 0, errors = 0;
  const clients = [];
  const t0 = Date.now();
  for (let r = 0; r < ROOMS; r++) {
    await Promise.all(users(r).map(async (u, j) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/rt`);
      await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
      const pend = new Map(); let seq = 0;
      const call = (op, a) => new Promise(res => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ op, id, ...a })); });
      ws.on('message', b => {
        const m = JSON.parse(b);
        if (m.id != null) { const f = pend.get(m.id); if (f) { pend.delete(m.id); f(m); } return; }
        if (m.ev === 'up' && m.p.presence.t) { recv++; lat.push(Date.now() - m.p.presence.t); }
      });
      await call('hello', { token: 'tok-' + u, peer: `peer${r}x${j}` });
      const j2 = await call('join', { room: 'role-' + roomIds[r], d: { u, x: 0, y: 0 } });
      if (!j2.r) { errors++; return; }
      clients.push({ ws, room: 'role-' + roomIds[r], u });
    }));
  }
  console.log(`${clients.length} pessoas conectadas em ${((Date.now() - t0) / 1000).toFixed(1)}s (${errors} erros) · ${fake.calls.n} chamadas ao Supabase de mentira para autorizar`);
  await sleep(1500);
  lat.length = 0; recv = 0;

  const h0 = await health(), w0 = Date.now();
  const timers = clients.map(c => {
    let x = 0;
    return setInterval(() => { c.ws.send(JSON.stringify({ op: 'presence', room: c.room, d: { u: c.u, x: ++x % 40, y: x % 30, a: '', t: Date.now() } })); sent++; }, EVERY * 1000 * (0.7 + Math.random() * 0.6));
  });
  await sleep(SECS * 1000);
  timers.forEach(clearInterval);
  const h1 = await health(), dt = (Date.now() - w0) / 1000;
  await sleep(500);

  const cpuPct = (h1.cpuMs - h0.cpuMs) / 1000 / dt * 100;
  console.log(`\n=== ${ROOMS} salas x ${PER} pessoas = ${clients.length} conexões · cada pessoa anda a cada ~${EVERY}s · ${SECS}s ===`);
  console.log(`enviadas pelos clientes: ${(sent / dt).toFixed(0)} msg/s  |  entregues pelo servidor: ${(recv / dt).toFixed(0)} msg/s`);
  console.log(`latência de ponta a ponta (ms): p50 ${pct(lat, .5)} · p95 ${pct(lat, .95)} · p99 ${pct(lat, .99)} · máx ${lat.reduce((m, x) => x > m ? x : m, 0)}`);
  console.log(`servidor: CPU ${cpuPct.toFixed(0)}% de 1 núcleo · memória ${h1.rssMb} MB · ${h1.conexoes} conexões`);

  clients.forEach(c => c.ws.close());
  srv.kill('SIGTERM'); await fake.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
