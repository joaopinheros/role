// Teste do supabase/fm.sql num Postgres de verdade (embedded), simulando o que o Supabase fornece.
// Uso (uma vez: npm i --no-save embedded-postgres pg):
//   node test/sql/entrada.test.mjs <pasta-temporária>
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'fs';
import assert from 'assert';

const dir = process.argv[2] + '/data-entrada';
fs.rmSync(dir, { recursive: true, force: true });
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port: 54332, persistent: false });
await server.initialise(); await server.start();
const c = new pg.Client({ host: 'localhost', port: 54332, user: 'postgres', password: 'pw', database: 'postgres' });
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
const [A, B, C, D, E, F] = [1, 2, 3, 4, 5, 6].map(U);
for (const u of [A, B, C, D, E, F]) await c.query('insert into auth.users values ($1)', [u]);
const rd = f => fs.readFileSync(f, 'utf8');
await c.query(rd('supabase/schema.sql')); await c.query(rd('supabase/fm.sql'));
const er = rd('supabase/entrada-rapida.sql');
await c.query(er); await c.query(er);
console.log('schema + fm + entrada-rapida (2x): ok');

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


let g = await ok('visitante entra só com o nome', rpc(A, 'auth_guest', 'Ana Lúcia', ''));
assert.equal(g.v.conta.usuario, 'analucia'); assert.equal(g.v.conta.visitante, true);
await ok('outro visitante', rpc(B, 'auth_guest', 'Beto', ''));
await ok('hello devolve a conta', rpc(A, 'hello'));
await no('auth_start não existe mais', rpc(A, 'auth_start', 'login', null, 'x'), 'does not exist');
await no('auth_verify não existe mais', rpc(A, 'auth_verify', '1234', ''), 'does not exist');
await ok('visitante cria sala', rpc(A, 'criar_role', 'sala12345', 'Rolê', '2026-11-01', '00:00', 'festa', true));
await ok('outro visitante entra', rpc(B, 'entrar_role', 'sala12345'));
await ok('visitante manda mensagem', rpc(B, 'enviar_mensagem', 'sala12345', 'oi'));
await ok('fm_estado funciona para visitante', rpc(B, 'fm_estado', 'sala12345'));
await c.query('select public.limpar_antigos()'); console.log('ok    a limpeza agendada não quebra');
console.log('tudo certo');
await done(0);
