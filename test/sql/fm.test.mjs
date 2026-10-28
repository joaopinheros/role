// Teste do supabase/fm.sql num Postgres de verdade (embedded), simulando o que o Supabase fornece.
// Uso (uma vez: npm i --no-save embedded-postgres pg):
//   node test/sql/fm.test.mjs <pasta-temporária> supabase/schema.sql supabase/fm.sql
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'fs';
import assert from 'assert';

const dir = process.argv[2] + '/data-fm';
fs.rmSync(dir, { recursive: true, force: true });
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port: 54331, persistent: false });
await server.initialise(); await server.start();
const c = new pg.Client({ host: 'localhost', port: 54331, user: 'postgres', password: 'pw', database: 'postgres' });
await c.connect();
const done = async code => { try { await c.end(); await server.stop(); } catch (_) {} process.exit(code); };
process.on('uncaughtException', e => { console.error(e); done(1); });
process.on('unhandledRejection', e => { console.error(e); done(1); });

await c.query(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create publication supabase_realtime;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);
const U = n => `${String(n).repeat(8)}-${String(n).repeat(4)}-${String(n).repeat(4)}-${String(n).repeat(4)}-${String(n).repeat(12)}`;
const [A, B, C, D] = [1, 2, 3, 4].map(U);
for (const u of [A, B, C, D]) await c.query('insert into auth.users values ($1)', [u]);
const schema = fs.readFileSync(process.argv[3], 'utf8'), fm = fs.readFileSync(process.argv[4], 'utf8');
await c.query(schema); await c.query(fm); await c.query(fm); await c.query(schema); await c.query(fm);
console.log('schema + fm aplicados várias vezes: ok');

const HDR = JSON.stringify({ 'cf-connecting-ip': '9.9.9.9' });
async function as(uid, q, params = [], role = 'authenticated') {
  await c.query('begin');
  try {
    await c.query(`set local role ${role}`);
    if (uid) await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    await c.query(`select set_config('request.headers', $1, true)`, [HDR]);
    const r = await c.query(q, params);
    await c.query('commit');
    return { ok: true, rows: r.rows, v: r.rows[0] && Object.values(r.rows[0])[0] };
  } catch (e) { await c.query('rollback'); return { ok: false, err: e.message }; }
}
const rpc = (uid, fn, ...a) => as(uid, `select public.${fn}(${a.map((_, i) => '$' + (i + 1)).join(',')})`, a.map(x => typeof x === 'object' && x !== null ? JSON.stringify(x) : x));
const svc = (fn, ...a) => as(null, `select public.${fn}(${a.map((_, i) => '$' + (i + 1)).join(',')})`, a, 'service_role');
const ok = async (n, p) => { const r = await p; assert(r.ok, `${n} deveria passar: ${r.err}`); console.log('ok   ', n); return r; };
const no = async (n, p, msg) => { const r = await p; assert(!r.ok, `${n} deveria falhar`); if (msg) assert(r.err.includes(msg), `${n}: esperava "${msg}", veio "${r.err}"`); console.log('nega ', n, '->', r.err); };
const sqlv = async q => (await c.query(q)).rows;

/* contas e sala: A dona, B e D convidados, C de fora */
async function conta(uid, nome, usuario, tel) {
  const r = await rpc(uid, 'auth_start', 'cadastro', { nome, usuario, email: usuario + '@x.com', tel }, null);
  assert(r.ok, r.err);
  const v = await rpc(uid, 'auth_verify', r.v.dev, '');
  assert(v.ok && v.v.uid, JSON.stringify(v));
}
await conta(A, 'Ana', 'ana', '11911111111'); await conta(B, 'Beto', 'beto', '11922222222');
await conta(C, 'Caio', 'caio', '11933333333'); await conta(D, 'Duda', 'duda', '11944444444');
await ok('A cria a sala', rpc(A, 'criar_role', 'sala12345', 'Rolê', '2026-11-01', '20:00', 'festa', true));
await ok('B entra', rpc(B, 'entrar_role', 'sala12345'));
await ok('D entra', rpc(D, 'entrar_role', 'sala12345'));
const R = 'sala12345', V = n => 'vid' + String(n).padStart(8, '0');
const add = (who, n, dur = 200) => svc('fm_add', who, R, V(n), 'Música ' + n, null, dur);

/* permissões básicas */
await no('ninguém logado chama fm_estado', as(null, `select public.fm_estado('sala12345')`, [], 'anon'), 'permission denied');
await no('membro não chama fm_add direto (só a Edge Function)', rpc(B, 'fm_add', B, R, V(1), 'x', null, 10), 'permission denied');
await no('membro não chama as auxiliares', rpc(B, 'fm_next', R, B), 'permission denied');
await no('membro não escreve na fila', as(B, `insert into room_queue (role_id, video_id, title, thumb_url, added_by, position) values ('sala12345','${V(9)}','x','https://i.ytimg.com/x', (select public.me()), 1)`), 'permission denied');
await no('quem é de fora não vê o estado', rpc(C, 'fm_estado', R), 'perm');
await no('quem é de fora não põe música', add(C, 1), 'perm');
let r = await ok('fm_now devolve o relógio do banco', rpc(B, 'fm_now'));
assert(Math.abs(+r.v - Date.now()) < 5000);

/* pôr música: nada tocando, começa na hora */
r = await ok('B põe a 1ª: começa a tocar', add(B, 1));
assert.equal(r.v.tocando, true);
let st = (await ok('B lê o estado', rpc(B, 'fm_estado', R))).v;
assert.equal(st.np.status, 'tocando'); assert.equal(st.np.video, V(1)); assert.equal(st.np.version, 1); assert.equal(st.np.by, 'beto');
assert.equal(st.queue.length, 0); assert.equal(st.papel, 'membro');
assert(Math.abs(st.np.started - Date.now()) < 5000, 'started_at vem do relógio do banco');
let bots = await sqlv(`select texto, dados->>'k' k from chat_messages where tipo='bot' order by id`);
assert.deepEqual(bots.map(b => b.k), ['colocou', 'agora']); console.log('ok    bot: "colocou" e "Tocando agora"');
await no('vídeo acima de 15 min', add(B, 2, 1000), 'longo');
await ok('B põe a 2ª', add(B, 2)); await ok('B põe a 3ª', add(B, 3)); await ok('B põe a 4ª', add(B, 4));
await no('4ª esperando na fila: limite de 3 por pessoa', add(B, 5), 'limite');
r = await ok('a dona não tem limite', add(A, 6)); assert.equal(r.v.tocando, false);
st = (await rpc(B, 'fm_estado', R)).v;
assert.deepEqual(st.queue.map(q => q.video), [V(2), V(3), V(4), V(6)]);
await no('C (de fora) não lê a fila pela tabela', as(C, `select count(*)::int n from room_queue`).then(x => x.v === 0 ? { ok: false, err: 'vazio pela RLS' } : x), 'vazio');
r = await as(B, `select count(*)::int n from room_queue`); assert.equal(r.v, 4); console.log('ok    membro lê a fila pela RLS');

/* /skip: só dono e DJ; compare-and-swap */
await no('B (membro) não pula', rpc(B, 'fm_advance', R, 1, true), 'perm');
await no('B não pausa', rpc(B, 'fm_pause', R), 'perm');
await no('D não dá DJ (só a dona)', rpc(D, 'fm_dj', R, 'beto', true), 'perm');
await ok('a dona faz o B DJ', rpc(A, 'fm_dj', R, 'beto', true));
st = (await rpc(B, 'fm_estado', R)).v; assert.equal(st.papel, 'dj'); assert.deepEqual(st.djs, ['beto']);
r = await ok('B (agora DJ) pula', rpc(B, 'fm_advance', R, 1, true)); assert.equal(r.v.ok, true); assert.equal(r.v.version, 2);
r = await ok('A pula com a versão velha: não avança de novo', rpc(A, 'fm_advance', R, 1, true)); assert.equal(r.v.ok, false);
st = (await rpc(B, 'fm_estado', R)).v; assert.equal(st.np.video, V(2)); assert.equal(st.queue.length, 3);
console.log('ok    dois pulos com a mesma versão: só um vale');

/* fim natural: membro só avança depois do fim */
await no('D pede "acabou" cedo demais', rpc(D, 'fm_advance', R, 2, false), 'cedo');
await c.query(`update room_now_playing set started_at = now() - interval '199 seconds' where role_id = '${R}'`);
r = await ok('D pede "acabou" no fim: avança', rpc(D, 'fm_advance', R, 2, false)); assert.equal(r.v.ok, true);
st = (await rpc(D, 'fm_estado', R)).v; assert.equal(st.np.video, V(3));

/* pausa: a posição congela e volta do mesmo ponto */
await c.query(`update room_now_playing set started_at = now() - interval '50 seconds' where role_id = '${R}'`);
await ok('B pausa', rpc(B, 'fm_pause', R));
await c.query(`update room_now_playing set paused_at = paused_at - interval '30 seconds', started_at = started_at - interval '30 seconds' where role_id = '${R}'`);   // pausada há 30 s
await ok('B solta', rpc(B, 'fm_play', R));
st = (await rpc(B, 'fm_estado', R)).v;
const pos = (Date.now() - st.np.started) / 1000;
assert(Math.abs(pos - 50) < 3, 'voltou do segundo 50, veio ' + pos); assert.equal(st.np.status, 'tocando'); assert.equal(st.np.paused, null);
console.log('ok    pausa de 30 s não andou a música (', pos.toFixed(1), 's )');

/* tirar e limpar */
r = await ok('B tira a última que colocou', rpc(B, 'fm_tirar', R, 0)); assert.equal(r.v, 'Música 4');
await no('D tira uma que não é dela', rpc(D, 'fm_tirar', R, 1), 'perm');
r = await ok('a dona tira a da posição 1', rpc(A, 'fm_tirar', R, 1)); assert.equal(r.v, 'Música 6');
await no('D não limpa', rpc(D, 'fm_limpar', R), 'perm');
await ok('B (DJ) limpa', rpc(B, 'fm_limpar', R));
st = (await rpc(B, 'fm_estado', R)).v; assert.equal(st.queue.length, 0);

/* fila acaba: para e avisa */
await c.query(`update room_now_playing set started_at = now() - interval '300 seconds' where role_id = '${R}'`);
r = await ok('acabou a última', rpc(D, 'fm_advance', R, st.np.version, false));
st = (await rpc(B, 'fm_estado', R)).v; assert.equal(st.np.status, 'parado');
bots = await sqlv(`select dados->>'k' k from chat_messages where tipo='bot' order by id desc limit 1`); assert.equal(bots[0].k, 'vazia');
console.log('ok    fila vazia: "o som da sala voltou"');

/* só DJs põem música */
await ok('a dona fecha para DJs', rpc(A, 'fm_quem', R, 'djs'));
await no('D (membro) não põe mais', add(D, 7), 'djs');
await ok('B (DJ) põe', add(B, 8));
await ok('a dona tira o DJ do B', rpc(A, 'fm_dj', R, 'beto', false));
await no('B (de novo membro) não pula', rpc(B, 'fm_advance', R, (await rpc(B, 'fm_estado', R)).v.np.version, true), 'perm');

/* limite por minuto */
await ok('a dona abre de novo', rpc(A, 'fm_quem', R, 'todos'));
await c.query(`delete from fm_hits`);
for (let i = 0; i < 5; i++) await c.query(`insert into fm_hits (user_id) select id from users where usuario = 'duda'`);
await no('6º /music no mesmo minuto', add(D, 10), 'rapido');

/* chat: mensagem do bot não trava o próximo texto */
await ok('B escreve logo depois de uma ação do bot', rpc(B, 'enviar_mensagem', R, 'oi'));
r = await as(B, `select tipo, dados from chat_messages where tipo='bot' order by id desc limit 1`); assert.equal(r.rows[0].tipo, 'bot');
console.log('ok    membro lê tipo e dados das mensagens');

console.log('\ntudo certo');
await done(0);
