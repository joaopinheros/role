// Teste do supabase/admin.sql num Postgres de verdade (embedded), simulando o que o Supabase fornece.
// Uso (uma vez: npm i --no-save embedded-postgres pg):
//   node test/sql/admin.test.mjs <pasta-temporária>
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'fs';
import assert from 'assert';

const dir = process.argv[2] + '/data-admin';
fs.rmSync(dir, { recursive: true, force: true });
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port: 54333, persistent: false });
await server.initialise(); await server.start();
const c = new pg.Client({ host: 'localhost', port: 54333, user: 'postgres', password: 'pw', database: 'postgres' });
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
const [A, B, C, D, E] = [1, 2, 3, 4, 5].map(U);
for (const u of [A, B, C, D, E]) await c.query('insert into auth.users values ($1)', [u]);
const rd = f => fs.readFileSync(f, 'utf8');
await c.query(rd('supabase/schema.sql')); await c.query(rd('supabase/fm.sql')); await c.query(rd('supabase/entrada-rapida.sql'));
const ad = rd('supabase/admin.sql');
await c.query(ad); await c.query(ad);
console.log('schema + fm + entrada-rapida + admin (2x): ok');

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
const ok = async (n, p) => { const r = await p; assert(r.ok, `${n} deveria passar: ${r.err}`); console.log('ok   ', n); return r; };
const no = async (n, p, msg) => { const r = await p; assert(!r.ok, `${n} deveria falhar`); if (msg) assert(r.err.includes(msg), `${n}: esperava "${msg}", veio "${r.err}"`); console.log('nega ', n, '->', r.err); };
const sqlv = async (q, p = []) => (await c.query(q, p)).rows;

// três visitantes, uma sala com músicas
const ga = (await ok('visitante A', rpc(A, 'auth_guest', 'Ana', ''))).v.uid;
const gb = (await ok('visitante B', rpc(B, 'auth_guest', 'Beto', ''))).v.uid;
await ok('visitante C', rpc(C, 'auth_guest', 'Caio', ''));
await ok('cria sala', rpc(A, 'criar_role', 'sala12345', 'Festa da Ana', '2026-11-01', '00:00', 'festa', true));
await ok('B entra', rpc(B, 'entrar_role', 'sala12345'));
await ok('A manda mensagem', rpc(A, 'enviar_mensagem', 'sala12345', 'segredo do chat'));
const bot = (k, extra = {}) => c.query(`select public.fm_bot('sala12345', $1, 'x', $2)`, [ga, JSON.stringify({ k, ...extra })]);
await bot('agora', { title: 'Música A' }); await bot('pulou'); await bot('agora', { title: 'Música B' }); await bot('agora', { title: 'Música A' });
await c.query(`insert into public.room_now_playing (role_id, video_id, title, thumb_url, duration_s, added_by, started_at, status)
  values ('sala12345', 'abcdefghijk', 'Música A', 'https://i.ytimg.com/x', 200, $1, now(), 'tocando')`, [gb]);

// antes de definir a senha
await no('sem ser admin: painel negado', rpc(A, 'admin_painel'), 'perm');
assert.equal((await ok('admin_eu falso', rpc(A, 'admin_eu'))).v, false);
assert.equal((await ok('entrar sem senha definida', rpc(A, 'admin_entrar', 'qualquer'))).v.err, 'sem_senha');
await no('o site não pode definir a senha', rpc(A, 'admin_definir_senha', 'minhasenhalonga'), 'permission denied');
await no('senha curta é recusada', c.query(`select public.admin_definir_senha('curta')`).then(r => ({ ok: true, rows: r.rows })).catch(e => ({ ok: false, err: e.message })), 'pelo menos 10');
await c.query(`select public.admin_definir_senha('minha senha longa')`);
const cfg = (await sqlv(`select value from public.admin_cfg where key = 'senha'`))[0].value;
assert(!cfg.includes('minha senha longa'), 'a senha não pode ficar em texto puro');
console.log('ok    senha guardada só com sal e hash');

// senha errada e certa
assert.equal((await ok('senha errada', rpc(A, 'admin_entrar', 'errada errada'))).v.err, 'senha');
await no('continua sem acesso', rpc(A, 'admin_painel'), 'perm');
assert.equal((await ok('senha certa', rpc(A, 'admin_entrar', 'minha senha longa'))).v.ok, true);
assert.equal((await ok('admin_eu verdadeiro', rpc(A, 'admin_eu'))).v, true);
await no('outro navegador continua sem acesso', rpc(B, 'admin_painel'), 'perm');
await no('tabela admins não é lida pelo site', as(A, 'select * from public.admins'), 'permission denied');
await no('tabela admin_cfg não é lida pelo site', as(A, 'select * from public.admin_cfg'), 'permission denied');

// o painel
const p = (await ok('painel abre', rpc(A, 'admin_painel'))).v;
assert.equal(p.totais.contas, 3); assert.equal(p.totais.visitantes, 3);
assert.equal(p.totais.salas_ativas, 1); assert.equal(p.totais.salas_24h, 1);
assert.equal(p.totais.msgs_24h, 1);
assert.equal(p.totais.tocadas_24h, 3); assert.equal(p.totais.puladas_24h, 1);
const s = p.salas[0];
assert.equal(s.nome, 'Festa da Ana'); assert.equal(s.dono, 'ana'); assert.equal(s.membros, 2); assert.equal(s.cena, 'festa');
assert.equal(s.tocando.titulo, 'Música A'); assert.equal(s.tocando.por, 'beto'); assert.equal(s.tocando.status, 'tocando');
assert.equal(s.tocadas, 3); assert.equal(s.puladas, 1); assert.equal(s.msgs_total, 1);
assert.deepEqual(s.ultimas.map(x => [x.titulo, x.pulada]), [['Música A', false], ['Música B', false], ['Música A', true]]);
const a = p.top.find(x => x.titulo === 'Música A');
assert.equal(a.vezes, 2); assert.equal(a.puladas, 1);
assert.equal(p.dias.length, 7); assert.equal(p.dias[6].contas, 3); assert.equal(p.dias[6].tocadas, 3);
assert.equal(p.contas_novas.length, 3);
assert(!JSON.stringify(p).includes('segredo do chat'), 'o painel não pode mostrar o texto das conversas');
console.log('ok    números do painel conferem (e o texto do chat não aparece)');

// sala encerrada some da lista de ativas
await c.query(`update public.roles set status = 'encerrado' where id = 'sala12345'`);
assert.equal((await ok('painel sem sala ativa', rpc(A, 'admin_painel'))).v.salas.length, 0);
await c.query(`update public.roles set status = 'ativo' where id = 'sala12345'`);

// sair, expirar, trocar a senha
await ok('sair do painel', rpc(A, 'admin_sair')); await no('depois de sair, sem acesso', rpc(A, 'admin_painel'), 'perm');
await rpc(A, 'admin_entrar', 'minha senha longa');
await c.query(`update public.admins set created_at = now() - interval '31 days'`);
await no('acesso vence em 30 dias', rpc(A, 'admin_painel'), 'perm');
await rpc(A, 'admin_entrar', 'minha senha longa');
await c.query(`select public.admin_definir_senha('outra senha bem longa')`);
await no('trocar a senha desconecta os aparelhos', rpc(A, 'admin_painel'), 'perm');
assert.equal((await ok('senha antiga não vale mais', rpc(A, 'admin_entrar', 'minha senha longa'))).v.err, 'senha');
assert.equal((await ok('senha nova vale', rpc(A, 'admin_entrar', 'outra senha bem longa'))).v.ok, true);

// tentativa em massa trava (mesmo para quem sabe a senha), até a senha ser redefinida
for (let i = 0; i < 10; i++) await rpc([B, C, D, E][i % 4], 'admin_entrar', 'chute' + i);
assert.equal((await ok('trava depois de muitos erros', rpc(D, 'admin_entrar', 'outra senha bem longa'))).v.err, 'slow');
await c.query(`select public.admin_definir_senha('mais uma senha longa')`);
assert.equal((await ok('redefinir a senha destrava', rpc(D, 'admin_entrar', 'mais uma senha longa'))).v.ok, true);

console.log('tudo certo');
await done(0);
