#!/usr/bin/env node
/*
 * Servidor do Rolê: entrega a página (com SEO por convite), arquivos estáticos,
 * e um WebSocket em /ws com banco de documentos, login por código e salas ao vivo.
 * Variáveis de ambiente: veja .env.example
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { Store } = require('./store');

loadEnv(path.join(__dirname, '..', '.env'));

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
const MAX_SALA = +process.env.MAX_SALA || 50;
const SMS_WEBHOOK_URL = process.env.SMS_WEBHOOK_URL || '';
const SMS_DEV = SMS_WEBHOOK_URL ? process.env.SMS_DEV === '1' : process.env.SMS_DEV !== '0';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const PROD = process.env.NODE_ENV === 'production';

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PUB = path.join(ROOT, 'public');

const store = new Store(DATA_FILE);

/* ------------------------------------------------------------------ página e SEO */

const CENAS = {
  churrasco: 'Quintal com varanda', festa: 'Festa em casa', pijama: 'Noite do pijama', parque: 'Parque com lago',
  boate: 'Boate', boteco: 'Boteco de esquina', piscina: 'Casa com piscina', vulcao: 'Ilha do vulcão',
  templo: 'Templo e lago de carpas', praia: 'Luau na praia', rooftop: 'Rooftop na cidade',
};
const DEFAULT_SEO = {
  title: 'Rolê: o convite vira uma sala em pixel art',
  desc: 'Crie o rolê, escolha o lugar e mande o link no grupo. Cada convite vira uma sala em pixel art com avatar estilo Y2K, chat, pets e house tocando.',
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function origin(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0] || (req.socket.encrypted ? 'https' : 'http');
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

function seoTags({ title, desc, url, image, noindex }) {
  const ld = { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Rolê', url, description: desc,
    applicationCategory: 'SocialNetworkingApplication', operatingSystem: 'Web', inLanguage: 'pt-BR',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' } };
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index,follow">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Rolê">',
    '<meta property="og:locale" content="pt_BR">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="Sala de festa em pixel art com avatares">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}

function fmtWhen(data, hora) {
  try {
    const [y, m, d] = data.split('-').map(Number);
    const s = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\./g, '');
    return s + ', ' + String(hora || '').replace(':', 'h').replace('h00', 'h');
  } catch (_) { return ''; }
}

let tpl = { mtime: 0, html: '' };
function template() {
  const f = path.join(DIST, 'index.html');
  const st = fs.statSync(f);
  if (st.mtimeMs !== tpl.mtime) tpl = { mtime: st.mtimeMs, html: fs.readFileSync(f, 'utf8') };
  return tpl;
}

const pageCache = new Map(); // chave -> { etag, raw, gz, br, at }
function renderPage(req, eid) {
  const t = template();
  const base = origin(req);
  let seo = { ...DEFAULT_SEO, url: base + '/', image: base + '/og.png' };
  if (eid) {
    const r = store.get('roles/' + eid);
    if (r) {
      const quem = r.donoNome || '@' + r.dono;
      seo = {
        title: `${r.nome}: ${quem} te chamou | Rolê`,
        desc: `${fmtWhen(r.data, r.hora)} · ${CENAS[r.cena] || 'Rolê'}${r.noite ? ' à noite' : ''}. Aceita o convite e entra na sala.`,
        url: base + '/r/' + eid, image: base + '/og.png', noindex: true,
      };
    } else seo = { ...seo, url: base + '/r/' + eid, noindex: true };
  }
  const key = t.mtime + '|' + seo.url + '|' + seo.title + '|' + seo.desc;
  let p = pageCache.get(key);
  if (!p) {
    const raw = Buffer.from(t.html.replace('<!--SEO-->', seoTags(seo)));
    p = { etag: '"' + crypto.createHash('sha1').update(raw).digest('base64url').slice(0, 20) + '"', raw };
    if (pageCache.size > 300) pageCache.delete(pageCache.keys().next().value);
    pageCache.set(key, p);
  }
  return p;
}

/* ------------------------------------------------------------------ HTTP */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = /text|json|xml|svg|manifest/;

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (PROD) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
}

function send(req, res, status, body, type, { etag, cache, entry } = {}) {
  securityHeaders(res);
  res.setHeader('Content-Type', type);
  if (cache) res.setHeader('Cache-Control', cache);
  if (etag) {
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end(); }
  }
  res.setHeader('Vary', 'Accept-Encoding');
  const ae = String(req.headers['accept-encoding'] || '');
  if (COMPRESSIBLE.test(type) && body.length > 1024) {
    if (/\bbr\b/.test(ae)) {
      const b = entry ? (entry.br ||= zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } })) : zlib.brotliCompressSync(body);
      res.setHeader('Content-Encoding', 'br'); res.writeHead(status); return res.end(req.method === 'HEAD' ? undefined : b);
    }
    if (/\bgzip\b/.test(ae)) {
      const g = entry ? (entry.gz ||= zlib.gzipSync(body, { level: 9 })) : zlib.gzipSync(body);
      res.setHeader('Content-Encoding', 'gzip'); res.writeHead(status); return res.end(req.method === 'HEAD' ? undefined : g);
    }
  }
  res.writeHead(status);
  res.end(req.method === 'HEAD' ? undefined : body);
}

const staticCache = new Map();
function serveStatic(req, res, rel) {
  const f = path.normalize(path.join(PUB, rel));
  if (!f.startsWith(PUB + path.sep)) return false;
  let st;
  try { st = fs.statSync(f); } catch (_) { return false; }
  if (!st.isFile()) return false;
  let e = staticCache.get(f);
  if (!e || e.mtime !== st.mtimeMs) {
    const body = fs.readFileSync(f);
    e = { mtime: st.mtimeMs, body, etag: '"' + crypto.createHash('sha1').update(body).digest('base64url').slice(0, 20) + '"' };
    staticCache.set(f, e);
  }
  send(req, res, 200, e.body, TYPES[path.extname(f)] || 'application/octet-stream', { etag: e.etag, cache: 'public, max-age=604800', entry: e });
  return true;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  try {
    if (p === '/healthz') return send(req, res, 200, Buffer.from(JSON.stringify({ ok: true, salas: rooms.size, conexoes: wss.clients.size })), 'application/json', { cache: 'no-store' });
    if (p === '/robots.txt') return send(req, res, 200, Buffer.from(`User-agent: *\nAllow: /\nDisallow: /r/\nSitemap: ${origin(req)}/sitemap.xml\n`), 'text/plain; charset=utf-8', { cache: 'public, max-age=86400' });
    if (p === '/sitemap.xml') return send(req, res, 200, Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(origin(req))}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>\n`), 'application/xml', { cache: 'public, max-age=86400' });
    const m = /^\/r\/([a-z0-9]{6,16})\/?$/.exec(p);
    if (p === '/' || p === '/index.html' || m) {
      const pg = renderPage(req, m && m[1]);
      return send(req, res, 200, pg.raw, TYPES['.html'], { etag: pg.etag, cache: 'no-cache', entry: pg });
    }
    if (serveStatic(req, res, p.slice(1))) return;
    send(req, res, 404, Buffer.from('Não encontrado'), 'text/plain; charset=utf-8');
  } catch (e) {
    console.error('[http]', e);
    send(req, res, 500, Buffer.from('Erro no servidor'), 'text/plain; charset=utf-8');
  }
});

/* ------------------------------------------------------------------ regras de acesso */

const isStr = (v, max) => typeof v === 'string' && v.length <= max;
const MAX_DOC = 8 * 1024;

function canRead(c, p) {
  const s = p.split('/');
  if (s[0] === 'data') return s[1] === 'users' && !!c.uid && s[2] === c.uid;
  return s[0] === 'perfis' || s[0] === 'roles';
}

/* devolve null se pode, ou o código do erro */
function canWrite(c, op, p, d) {
  if (!c.uid) return 'auth';
  if (d !== undefined && JSON.stringify(d).length > MAX_DOC) return 'big';
  const s = p.split('/');
  if (s[0] === 'data') {
    if (s[1] !== 'users' || s[2] !== c.uid || s.length !== 4) return 'perm';
    if (s[3] === 'conta') return op === 'update' && onlyKeys(d, ['fig']) ? null : 'perm'; // a conta em si só muda pelo login
    return null;
  }
  if (s[0] === 'perfis' && s.length === 2) {
    const cur = store.get(p);
    if (op === 'update' && cur && cur.dono === c.uid && onlyKeys(d, ['fig', 'nome'])) return null;
    return 'perm';
  }
  if (s[0] === 'roles') {
    if (s.length === 2) {
      const cur = store.get(p);
      if (!cur && op === 'set') return d && isStr(d.nome, 60) && d.dono === c.usuario ? null : 'perm';
      if (cur && cur.dono === c.usuario && (op === 'update' || op === 'set')) return null;
      return 'perm';
    }
    if (!store.get('roles/' + s[1])) return 'perm';
    if (s.length === 4 && s[2] === 'gente' && s[3] === c.usuario && op === 'set') return null;
    if (s.length === 3 && s[2] === 'chat' && op === 'add') return d && isStr(d.t, 280) && d.u === c.usuario ? null : 'perm';
  }
  return 'perm';
}
const onlyKeys = (d, keys) => d && typeof d === 'object' && Object.keys(d).every(k => keys.includes(k));

/* ------------------------------------------------------------------ login com código */

const authHits = new Map(); // ip -> [timestamps]
function slow(ip) {
  const now = Date.now();
  const l = (authHits.get(ip) || []).filter(t => now - t < 10 * 60e3);
  l.push(now);
  authHits.set(ip, l);
  return l.length > 8;
}
setInterval(() => { const now = Date.now(); for (const [ip, l] of authHits) if (!l.some(t => now - t < 10 * 60e3)) authHits.delete(ip); }, 60e3).unref();

async function sendSms(tel, text) {
  if (!SMS_WEBHOOK_URL) return;
  const r = await fetch(SMS_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: '+55' + tel, text }) });
  if (!r.ok) throw new Error('sms ' + r.status);
}

const tokenKey = t => 'sys/sessions/' + crypto.createHash('sha256').update(String(t)).digest('hex');
const okMail = m => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m) && m.length <= 120;
const okTel = t => /^\d{10,11}$/.test(t);
const okUser = u => /^[a-z0-9._]{3,16}$/.test(u);

async function authStart(c, a) {
  if (slow(c.ip)) throw 'slow';
  let pend;
  if (a.tipo === 'cadastro') {
    const k = a.conta || {};
    const conta = { nome: String(k.nome || '').trim().slice(0, 40), usuario: String(k.usuario || ''), email: String(k.email || '').toLowerCase(), tel: String(k.tel || '') };
    if (conta.nome.length < 2 || !okUser(conta.usuario) || !okMail(conta.email) || !okTel(conta.tel)) throw 'invalid';
    if (store.findConta(conta.email) || store.findConta(conta.tel)) throw 'exists';
    if (store.get('perfis/' + conta.usuario)) throw 'taken';
    pend = { tipo: 'cadastro', conta, tel: conta.tel };
  } else if (a.tipo === 'login') {
    const q = String(a.q || '').toLowerCase();
    const f = store.findConta(q);
    if (!f) throw 'notfound';
    pend = { tipo: 'login', uid: f.uid, tel: f.conta.tel };
  } else throw 'invalid';
  pend.code = String(crypto.randomInt(1000, 10000));
  pend.exp = Date.now() + 10 * 60e3;
  pend.tries = 0;
  c.pend = pend;
  await sendSms(pend.tel, `Seu código do Rolê é ${pend.code}`);
  const masked = pend.tel.slice(0, 2) + '•••••' + pend.tel.slice(-4);
  return { tel: a.tipo === 'login' ? masked : pend.tel, dev: SMS_DEV ? pend.code : undefined };
}

function authVerify(c, a) {
  const p = c.pend;
  if (!p) throw 'expired';
  if (Date.now() > p.exp) { c.pend = null; throw 'expired'; }
  if (String(a.code) !== p.code) { if (++p.tries >= 5) c.pend = null; throw 'badcode'; }
  c.pend = null;
  let uid;
  if (p.tipo === 'cadastro') {
    if (store.get('perfis/' + p.conta.usuario)) throw 'taken';
    uid = 'u' + crypto.randomBytes(9).toString('base64url');
    const fig = isStr(a.fig, 600) ? a.fig : '';
    store.set(`data/users/${uid}/conta`, { ...p.conta, verificado: true, fig, criado: Date.now() });
    store.set('perfis/' + p.conta.usuario, { nome: p.conta.nome, fig, dono: uid });
  } else uid = p.uid;
  const token = crypto.randomBytes(32).toString('base64url');
  store.set(tokenKey(token), { uid, at: Date.now() });
  bindUser(c, uid);
  return { uid, token, conta: store.get(`data/users/${uid}/conta`) };
}

function bindUser(c, uid) {
  const conta = store.get(`data/users/${uid}/conta`);
  c.uid = uid;
  c.usuario = conta ? conta.usuario : null;
}

/* ------------------------------------------------------------------ salas ao vivo */

const rooms = new Map(); // nome -> Map(peerId -> { c, presence, updatedAt })

function roomPeers(r) {
  return [...r.entries()].map(([peer, x]) => ({ peer, presence: x.presence, updatedAt: x.updatedAt }));
}
function roomSend(name, r, msg, except) {
  const s = JSON.stringify({ room: name, ...msg });
  for (const [peer, x] of r) if (peer !== except && x.c.ws.readyState === 1) x.c.ws.send(s);
}
function leaveRoom(c, name) {
  const peer = c.rooms.get(name);
  if (!peer) return;
  c.rooms.delete(name);
  const r = rooms.get(name);
  if (!r) return;
  r.delete(peer);
  if (!r.size) rooms.delete(name);
  else roomSend(name, r, { ev: 'left', peer });
}
function cleanPresence(d) {
  if (!d || typeof d !== 'object') return {};
  const s = JSON.stringify(d);
  return s.length > 2048 ? {} : JSON.parse(s);
}

/* ------------------------------------------------------------------ WebSocket */

const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

server.on('upgrade', (req, sock, head) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') return sock.destroy();
  const o = req.headers.origin;
  if (ALLOWED_ORIGINS.length && o && !ALLOWED_ORIGINS.includes(o)) return sock.destroy();
  wss.handleUpgrade(req, sock, head, ws => wss.emit('connection', ws, req));
});

const watchers = new Map(); // caminho -> Set({ c, id, kind, o })
function addWatch(c, id, kind, p, o) {
  const w = { c, id, kind, p, o };
  c.watches.set(id, w);
  let s = watchers.get(p);
  if (!s) watchers.set(p, (s = new Set()));
  s.add(w);
  pushWatch(w);
}
function dropWatch(c, id) {
  const w = c.watches.get(id);
  if (!w) return;
  c.watches.delete(id);
  const s = watchers.get(w.p);
  if (s) { s.delete(w); if (!s.size) watchers.delete(w.p); }
}
function collView(p, o = {}) {
  let l = store.list(p);
  if (o && o.order) l.sort((a, b) => (a.data[o.order] || 0) - (b.data[o.order] || 0));
  if (o && o.limit) l = l.slice(-Math.min(200, o.limit | 0));
  return l;
}
function pushWatch(w) {
  if (w.c.ws.readyState !== 1) return;
  const v = w.kind === 'doc' ? store.get(w.p) : collView(w.p, w.o);
  w.c.ws.send(JSON.stringify({ w: w.id, v }));
}
const pendingPush = new Set();
store.listeners.add(p => {
  const coll = Store.split(p)[0];
  for (const key of [p, coll]) {
    const s = watchers.get(key);
    if (s) for (const w of s) if ((key === p && w.kind === 'doc') || (key === coll && w.kind === 'coll')) pendingPush.add(w);
  }
  if (pendingPush.size) setImmediate(flushPush);
});
function flushPush() {
  const l = [...pendingPush];
  pendingPush.clear();
  l.forEach(pushWatch);
}

wss.on('connection', (ws, req) => {
  const c = {
    ws, ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress,
    uid: null, usuario: null, pend: null, watches: new Map(), rooms: new Map(),
    bucket: 80, last: Date.now(), lastChat: 0,
  };

  const reply = (id, r, err) => { if (id != null && ws.readyState === 1) ws.send(JSON.stringify(err ? { id, err } : { id, r })); };

  ws.on('message', async buf => {
    // limite: ~40 mensagens/s com rajada de 80
    const now = Date.now();
    c.bucket = Math.min(80, c.bucket + (now - c.last) * 0.04);
    c.last = now;
    if (c.bucket < 1) return;
    c.bucket--;

    let m;
    try { m = JSON.parse(buf); } catch (_) { return; }
    if (!m || typeof m.op !== 'string') return;
    const { id, op } = m;
    const p = typeof m.p === 'string' ? m.p.slice(0, 200) : '';
    try {
      switch (op) {
        case 'hello': {
          const s = store.get(tokenKey(m.token));
          if (!s) { c.uid = null; c.usuario = null; return reply(id, null, 'badtoken'); }
          bindUser(c, s.uid);
          return reply(id, { uid: s.uid });
        }
        case 'logout': {
          c.uid = null; c.usuario = null;
          return reply(id, true);
        }
        case 'authStart': return reply(id, await authStart(c, m));
        case 'authVerify': return reply(id, authVerify(c, m));

        case 'get': return canRead(c, p) ? reply(id, store.get(p)) : reply(id, null, 'perm');
        case 'list': return canRead(c, p) ? reply(id, store.list(p)) : reply(id, null, 'perm');
        case 'set': case 'update': {
          const e = canWrite(c, op, p, m.d);
          if (e) return reply(id, null, e);
          store[op](p, m.d);
          return reply(id, true);
        }
        case 'del': return reply(id, null, 'perm');
        case 'add': {
          const e = canWrite(c, 'add', p, m.d);
          if (e) return reply(id, null, e);
          if (/\/chat$/.test(p)) {
            if (now - c.lastChat < 600) return reply(id, null, 'slow');
            c.lastChat = now;
            m.d = { u: c.usuario, n: String(m.d.n || '').slice(0, 40), t: m.d.t, at: Date.now() };
          }
          return reply(id, store.add(p, m.d));
        }
        case 'watchDoc': case 'watchColl': {
          if (!canRead(c, p) || c.watches.size > 40) return;
          dropWatch(c, m.id);
          return addWatch(c, m.id, op === 'watchDoc' ? 'doc' : 'coll', p, m.o);
        }
        case 'unwatch': return dropWatch(c, m.id);

        case 'join': {
          const name = String(m.room || '');
          if (!/^role-[a-z0-9]{6,16}$/.test(name)) return reply(id, null, 'invalid');
          if (!c.uid) return reply(id, null, 'auth');
          leaveRoom(c, name);
          let r = rooms.get(name);
          if (!r) rooms.set(name, (r = new Map()));
          if (r.size >= MAX_SALA) return reply(id, null, 'full');
          const peer = crypto.randomBytes(6).toString('base64url');
          r.set(peer, { c, presence: cleanPresence(m.d), updatedAt: Date.now() });
          c.rooms.set(name, peer);
          reply(id, { peer, peers: roomPeers(r) });
          return roomSend(name, r, { ev: 'up', p: { peer, presence: r.get(peer).presence, updatedAt: Date.now() } }, peer);
        }
        case 'presence': {
          const name = String(m.room || '');
          const peer = c.rooms.get(name);
          const r = rooms.get(name);
          if (!peer || !r || !r.get(peer)) return;
          const x = r.get(peer);
          x.presence = cleanPresence(m.d);
          x.updatedAt = Date.now();
          return roomSend(name, r, { ev: 'up', p: { peer, presence: x.presence, updatedAt: x.updatedAt } }, peer);
        }
        case 'leave': return leaveRoom(c, String(m.room || ''));
        default: return reply(id, null, 'op');
      }
    } catch (e) {
      if (typeof e === 'string') return reply(id, null, e);
      console.error('[ws]', op, e);
      reply(id, null, 'server');
    }
  });

  ws.on('close', () => {
    for (const name of [...c.rooms.keys()]) leaveRoom(c, name);
    for (const wid of [...c.watches.keys()]) dropWatch(c, wid);
  });
});

const beat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws._dead) return ws.terminate();
    ws._dead = true;
    ws.ping();
  });
}, 30e3);
wss.on('connection', ws => ws.on('pong', () => { ws._dead = false; }));

/* ------------------------------------------------------------------ início e desligamento */

function loadEnv(f) {
  try {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) { /* sem .env */ }
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.log('[server] dist/index.html não existe, montando…');
  require('../scripts/build.js');
}

server.listen(PORT, HOST, () => {
  console.log(`[server] Rolê no ar em http://localhost:${PORT}  (sala até ${MAX_SALA} pessoas${SMS_DEV ? ', SMS de teste: código aparece na tela' : ''})`);
});

function shutdown() {
  console.log('\n[server] desligando, salvando dados…');
  clearInterval(beat);
  store.close();
  wss.clients.forEach(ws => ws.close(1001));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { server, store };
