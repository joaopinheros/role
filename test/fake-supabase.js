/*
 * Supabase de mentira para testar o servidor de tempo real sem rede: só as 4 rotas que ele usa.
 * Token "tok-<usuario>" vale como a pessoa <usuario>. "bad-..." dá 401. "nosess-..." é anônimo sem conta.
 */
const http = require('http');

function createFakeSupabase() {
  const roles = new Map();    // id -> { max, status, members: Map(usuario -> { banned }) }
  const calls = { n: 0 };
  const server = http.createServer((req, res) => {
    calls.n++;
    const url = new URL(req.url, 'http://x');
    const tok = String(req.headers.authorization || '').replace('Bearer ', '');
    const json = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (tok.startsWith('bad-')) return json(401, { msg: 'bad jwt' });
    const usuario = tok.replace(/^(tok|nosess)-/, '');
    if (url.pathname === '/auth/v1/user') return json(200, { id: 'auth-' + usuario });
    if (url.pathname === '/rest/v1/rpc/minha_conta') return json(200, tok.startsWith('nosess-') ? null : { usuario, nome: usuario.toUpperCase() });
    const q = k => (url.searchParams.get(k) || '').replace(/^eq\./, '');
    if (url.pathname === '/rest/v1/roles') {
      const r = roles.get(q('id'));
      return json(200, r ? [{ max_pessoas: r.max, status: r.status }] : []);
    }
    if (url.pathname === '/rest/v1/role_members') {
      const r = roles.get(q('role_id'));
      const m = r && r.members.get(q('user_id').replace('auth-', ''));
      return json(200, m ? [{ papel: 'convidado', banned_at: m.banned ? new Date().toISOString() : null }] : []);
    }
    json(404, {});
  });
  return {
    server, calls,
    role(id, members, { max = 50, status = 'ativo' } = {}) { roles.set(id, { max, status, members: new Map(members.map(u => [u, { banned: false }])) }); },
    ban(id, u) { roles.get(id).members.get(u).banned = true; },
    listen: () => new Promise(res => server.listen(0, '127.0.0.1', () => res(server.address().port))),
    close: () => new Promise(res => { server.closeAllConnections && server.closeAllConnections(); server.close(res); }),
  };
}

module.exports = { createFakeSupabase };
