/* Testes do servidor de tempo real (node --test test/realtime.test.js). Usa um Supabase de mentira. */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const WebSocket = require('ws');
const { createRealtime } = require('../realtime/server');
const { createFakeSupabase } = require('./fake-supabase');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function setup(extra = {}) {
  const fake = createFakeSupabase();
  const sp = await fake.listen();
  const rt = createRealtime({
    port: 0, host: '127.0.0.1', supabaseUrl: 'http://127.0.0.1:' + sp, key: 'pk', origins: [], prod: false, quiet: true,
    turnSecret: 'segredo', turnUrls: ['turn:turn.exemplo.com:3478?transport=udp', 'turns:turn.exemplo.com:443?transport=tcp'], stunUrls: ['stun:stun.exemplo.com:3478'],
    graceMs: 300, recheckMs: 60000, voiceMax: 2, defaultMax: 50, ...extra,
  });
  const port = await rt.listen();
  return { fake, rt, port, async close() { await rt.stop(); await fake.close(); } };
}

/* cliente de teste: guarda os eventos e deixa esperar por um deles */
async function client(port, usuario, peer, { hello = true } = {}) {
  const ws = new WebSocket('ws://127.0.0.1:' + port + '/rt');
  const c = { ws, events: [], seq: 0, pend: new Map() };
  ws.on('message', b => {
    const m = JSON.parse(b);
    if (m.id != null && c.pend.has(m.id)) { c.pend.get(m.id)(m); c.pend.delete(m.id); } else c.events.push(m);
  });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  c.call = (op, a = {}) => new Promise(res => { const id = ++c.seq; c.pend.set(id, res); ws.send(JSON.stringify({ op, id, ...a })); });
  c.send = (op, a = {}) => ws.send(JSON.stringify({ op, ...a }));
  c.wait = async (pred, ms = 2000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = c.events.find(pred); if (e) return e; await sleep(10); } return null; };
  if (hello) assert.equal((await c.call('hello', { token: 'tok-' + usuario, peer })).r, true);
  return c;
}

test('só entra na sala quem é membro do rolê', async () => {
  const t = await setup(); t.fake.role('abc12345', ['ana']);
  const ana = await client(t.port, 'ana', 'tabAna01'), zeca = await client(t.port, 'zeca', 'tabZeca1');
  assert.equal((await zeca.call('join', { room: 'role-abc12345' })).err, 'perm');
  assert.equal((await ana.call('join', { room: 'role-nao12345' })).err, 'perm');
  assert.equal((await ana.call('join', { room: 'invalido!' })).err, 'invalid');
  const r = (await ana.call('join', { room: 'role-abc12345', d: { u: 'ana' } })).r;
  assert.equal(r.peers.length, 1); assert.equal(r.peers[0].presence.u, 'ana'); assert.equal(r.max, 50);
  await t.close();
});

test('token ruim ou sem conta é recusado', async () => {
  const t = await setup(); t.fake.role('abc12345', ['ana']);
  const bad = await client(t.port, 'ana', 'tabBad001', { hello: false });
  await bad.call('hello', { token: 'bad-x', peer: 'tabBad001' });
  assert.equal((await bad.call('join', { room: 'role-abc12345' })).err, 'auth');
  const anon = await client(t.port, 'ana', 'tabAnon01', { hello: false });
  await anon.call('hello', { token: 'nosess-ana', peer: 'tabAnon01' });
  assert.equal((await anon.call('join', { room: 'role-abc12345' })).err, 'auth');
  const nojoin = await client(t.port, 'ana', 'tabNoHe01', { hello: false });
  assert.equal((await nojoin.call('join', { room: 'role-abc12345' })).err, 'invalid');
  await t.close();
});

test('presença chega para os outros, não para quem enviou, e rajadas são juntadas', async () => {
  const t = await setup(); t.fake.role('abc12345', ['ana', 'beto']);
  const ana = await client(t.port, 'ana', 'tabAna01'), beto = await client(t.port, 'beto', 'tabBeto1');
  await ana.call('join', { room: 'role-abc12345', d: { u: 'ana', x: 1 } });
  const rb = (await beto.call('join', { room: 'role-abc12345', d: { u: 'beto', x: 9 } })).r;
  assert.equal(rb.peers.length, 2);
  assert.ok(await ana.wait(e => e.ev === 'up' && e.p.presence.u === 'beto'), 'ana vê o beto entrar');
  ana.events.length = 0; beto.events.length = 0;
  for (let i = 0; i < 10; i++) ana.send('presence', { room: 'role-abc12345', d: { u: 'ana', x: i } });
  await sleep(300);
  const ups = beto.events.filter(e => e.ev === 'up');
  assert.ok(ups.length >= 1 && ups.length < 10, 'rajada juntada: ' + ups.length + ' updates para 10 envios');
  assert.equal(ups[ups.length - 1].p.presence.x, 9, 'o último estado vence');
  assert.equal(ana.events.filter(e => e.ev === 'up').length, 0, 'quem enviou não recebe o próprio');
  await t.close();
});

test('lotação: respeita o limite do rolê', async () => {
  const t = await setup(); t.fake.role('abc12345', ['a1', 'a2', 'a3'], { max: 2 });
  const [a, b, c] = await Promise.all(['a1', 'a2', 'a3'].map(u => client(t.port, u, 'tab' + u + '000')));
  assert.ok((await a.call('join', { room: 'role-abc12345' })).r);
  assert.ok((await b.call('join', { room: 'role-abc12345' })).r);
  assert.equal((await c.call('join', { room: 'role-abc12345' })).err, 'full');
  await t.close();
});

test('queda rápida: a mesma aba retoma o lugar e ninguém vê o avatar sumir', async () => {
  const t = await setup(); t.fake.role('abc12345', ['ana', 'beto']);
  const ana = await client(t.port, 'ana', 'tabAna01'), beto = await client(t.port, 'beto', 'tabBeto1');
  await ana.call('join', { room: 'role-abc12345', d: { u: 'ana' } });
  await beto.call('join', { room: 'role-abc12345', d: { u: 'beto' } });
  beto.events.length = 0;
  ana.ws.terminate();                       // a rede de ana caiu
  await sleep(100);
  const ana2 = await client(t.port, 'ana', 'tabAna01');   // voltou com o mesmo id de aba
  const r = (await ana2.call('join', { room: 'role-abc12345' })).r;
  assert.equal(r.resumed, true); assert.equal(r.peers.length, 2);
  await sleep(500);                         // mais que a tolerância
  assert.equal(beto.events.filter(e => e.ev === 'left').length, 0, 'ninguém recebeu "left"');
  assert.equal(t.rt.rooms.get('abc12345').size, 2);
  await t.close();
});

test('queda longa: depois da tolerância, a pessoa sai da sala', async () => {
  const t = await setup(); t.fake.role('abc12345', ['ana', 'beto']);
  const ana = await client(t.port, 'ana', 'tabAna01'), beto = await client(t.port, 'beto', 'tabBeto1');
  await ana.call('join', { room: 'role-abc12345', d: { u: 'ana' } });
  await beto.call('join', { room: 'role-abc12345', d: { u: 'beto' } });
  beto.events.length = 0;
  ana.ws.terminate();
  assert.equal(await beto.wait(e => e.ev === 'left', 150), null, 'ainda dentro da tolerância');
  assert.ok(await beto.wait(e => e.ev === 'left', 1500), 'saiu depois da tolerância');
  await t.close();
});

test('voz: entra, lista, TURN com credencial temporária, limite e sinalização', async () => {
  const t = await setup(); t.fake.role('abc12345', ['ana', 'beto', 'caio']);
  const [ana, beto, caio] = await Promise.all(['ana', 'beto', 'caio'].map(u => client(t.port, u, 'tab' + u + '00')));
  for (const c of [ana, beto, caio]) await c.call('join', { room: 'role-abc12345', d: {} });
  const va = (await ana.call('voice', { room: 'role-abc12345', on: true })).r;
  assert.equal(va.members.length, 1);
  const turn = va.ice.find(s => s.username);
  assert.ok(turn && turn.urls.length === 2, 'tem TURN');
  const expect = crypto.createHmac('sha1', 'segredo').update(turn.username).digest('base64');
  assert.equal(turn.credential, expect, 'credencial HMAC (coturn use-auth-secret)');
  assert.ok(+turn.username.split(':')[0] > Date.now() / 1000, 'credencial vale no futuro');
  assert.ok(va.ice[0].urls.includes('stun:stun.exemplo.com:3478'));
  const vb = (await beto.call('voice', { room: 'role-abc12345', on: true })).r;
  assert.equal(vb.members.length, 2);
  assert.equal((await caio.call('voice', { room: 'role-abc12345', on: true })).err, 'full', 'limite de 2 na voz');
  assert.ok(await ana.wait(e => e.ev === 'voice' && e.members.length === 2), 'ana é avisada que o beto entrou');
  assert.equal(caio.events.filter(e => e.ev === 'voice').length, 0, 'quem não está na voz não recebe a lista');

  // sinalização: só entre quem está na voz
  ana.events.length = 0; beto.events.length = 0; caio.events.length = 0;
  ana.send('sig', { room: 'role-abc12345', to: vb.peer, kind: 'desc', data: { type: 'offer', sdp: 'x' } });
  const got = await beto.wait(e => e.ev === 'sig');
  assert.ok(got && got.from === va.peer && got.data.type === 'offer');
  caio.send('sig', { room: 'role-abc12345', to: va.peer, kind: 'desc', data: {} });   // caio não está na voz
  await sleep(150);
  assert.equal(ana.events.filter(e => e.ev === 'sig').length, 0, 'quem está fora da voz não consegue sinalizar');

  // mudo e saída
  beto.events.length = 0;
  await ana.call('voice', { room: 'role-abc12345', on: true, m: true });
  const mu = await beto.wait(e => e.ev === 'voice' && e.members.find(m => m.user === 'ana' && m.m));
  assert.ok(mu, 'mudo aparece para os outros');
  await ana.call('voice', { room: 'role-abc12345', on: false });
  assert.ok(await beto.wait(e => e.ev === 'voice' && e.members.length === 1), 'saída aparece');
  await t.close();
});

test('quem é banido durante a sala é retirado', async () => {
  const t = await setup({ recheckMs: 150 }); t.fake.role('abc12345', ['ana', 'beto']);
  const ana = await client(t.port, 'ana', 'tabAna01'), beto = await client(t.port, 'beto', 'tabBeto1');
  await ana.call('join', { room: 'role-abc12345', d: {} }); await beto.call('join', { room: 'role-abc12345', d: {} });
  ana.events.length = 0;
  t.fake.ban('abc12345', 'beto');
  assert.ok(await beto.wait(e => e.ev === 'kick', 2000), 'beto recebe kick');
  assert.ok(await ana.wait(e => e.ev === 'left'), 'ana vê o beto sair');
  assert.equal(t.rt.rooms.get('abc12345').size, 1);
  await t.close();
});

test('ping, healthz e saída limpa', async () => {
  const t = await setup(); t.fake.role('abc12345', ['ana']);
  const ana = await client(t.port, 'ana', 'tabAna01');
  await ana.call('join', { room: 'role-abc12345', d: {} });
  ana.send('ping');
  assert.ok(await ana.wait(e => e.pong));
  const h = await (await fetch('http://127.0.0.1:' + t.port + '/healthz')).json();
  assert.equal(h.pessoas, 1); assert.equal(h.salas, 1);
  await ana.call('leave', { room: 'role-abc12345' });
  assert.equal(t.rt.rooms.size, 0);
  await t.close();
});
