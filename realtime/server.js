#!/usr/bin/env node
/*
 * Servidor de tempo real do Rolê: sala ao vivo (presença e movimento), sinalização da voz e credenciais TURN.
 * Roda numa VPS pequena. NÃO guarda dados: conta, rolês e chat continuam no Supabase.
 *
 * Quem é a pessoa e se ela pode estar na sala é conferido no Supabase com o token DELA (o mesmo do app),
 * então este servidor não precisa de nenhuma chave secreta do Supabase. Só da chave pública (publishable).
 *
 * Protocolo (JSON em /rt). Cliente -> servidor, todos com { id, op }:
 *   hello {token, peer}      identifica a aba (peer = id estável da aba, para retomar após queda)
 *   token {token}            token renovado
 *   join {room, d}           entra na sala "role-<id>" (precisa ser membro do rolê)
 *   presence {room, d}       estado do avatar (posição, ação, visual)
 *   leave {room}
 *   voice {room, on, m}      entra/sai da voz; m = mudo
 *   sig {room, to, kind, data}  sinalização WebRTC entre dois participantes da voz
 *   ping                     mantém a conexão viva
 * Servidor -> cliente: { id, r } | { id, err } | { room, ev: 'up'|'left'|'voice'|'sig'|'kick', ... }
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

function loadEnv(f) {
  try {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) { /* sem .env */ }
}

const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

function configFromEnv(env = process.env) {
  return {
    port: +env.RT_PORT || 3100,
    host: env.RT_HOST || '0.0.0.0',
    supabaseUrl: (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, ''),
    key: env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    origins: list(env.ALLOWED_ORIGINS),
    prod: env.NODE_ENV === 'production',
    turnSecret: env.TURN_SECRET || '',
    turnUrls: list(env.TURN_URLS),
    stunUrls: list(env.STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478'),
    graceMs: +env.RT_GRACE_MS || 10000,
    recheckMs: +env.RT_RECHECK_MS || 60000,
    voiceMax: +env.VOICE_MAX || 8,
    defaultMax: +env.MAX_SALA || 50,
    maxPerIp: +env.RT_MAX_PER_IP || 300,   // alto de propósito: no 4G brasileiro muita gente divide o mesmo IP (CGNAT)
  };
}

const ROOM_ID = /^[a-z0-9]{6,16}$/;
const PEER_ID = /^[A-Za-z0-9_-]{6,24}$/;
const SIG_KINDS = new Set(['desc', 'ice']);

function createRealtime(cfg) {
  const rooms = new Map(); // roomId -> Map(peerId -> entry)
  const log = (...a) => { if (!cfg.quiet) console.log('[rt]', ...a); };

  /* ---------------------------------------------------------------- Supabase (com o token da própria pessoa) */
  async function sb(p, token, init = {}) {
    const r = await fetch(cfg.supabaseUrl + p, {
      ...init,
      headers: { apikey: cfg.key, authorization: 'Bearer ' + token, 'content-type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw Object.assign(new Error('supabase ' + r.status), { status: r.status });
    return r.json();
  }

  /* { ok:true, ... } se a pessoa está logada e é membro (não banida) do rolê; { ok:false, err } se NÃO pode; lança se não deu para saber */
  async function acesso(token, roomId) {
    let u, conta;
    try {
      [u, conta] = await Promise.all([sb('/auth/v1/user', token), sb('/rest/v1/rpc/minha_conta', token, { method: 'POST', body: '{}' })]);
    } catch (e) {
      if (e.status === 401 || e.status === 403) return { ok: false, err: 'auth' };
      throw e;
    }
    if (!conta || !conta.usuario) return { ok: false, err: 'auth' };
    const [roles, members] = await Promise.all([
      sb(`/rest/v1/roles?select=max_pessoas,status&id=eq.${roomId}`, token),
      sb(`/rest/v1/role_members?select=papel,banned_at&role_id=eq.${roomId}&user_id=eq.${u.id}`, token),
    ]);
    if (!roles.length || !members.length || members[0].banned_at) return { ok: false, err: 'perm' };
    return { ok: true, authUid: u.id, usuario: conta.usuario, nome: conta.nome, max: roles[0].max_pessoas || cfg.defaultMax, status: roles[0].status };
  }

  /* ---------------------------------------------------------------- salas */
  const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const view = e => ({ peer: e.peer, presence: e.presence, updatedAt: e.updatedAt });
  const voiceList = room => [...room.values()].filter(e => e.voice).map(e => ({ peer: e.peer, user: e.usuario, t: e.voice.t, m: e.voice.m }))
    .sort((a, b) => a.t - b.t || (a.peer < b.peer ? -1 : 1));

  function broadcast(roomId, msg, exceptPeer, onlyVoice) {
    const room = rooms.get(roomId);
    if (!room) return;
    const s = JSON.stringify({ room: 'role-' + roomId, ...msg });   // serializa uma vez só, não uma por destinatário
    for (const e of room.values()) if (e.peer !== exceptPeer && (!onlyVoice || e.voice) && e.c.ws.readyState === 1) e.c.ws.send(s);
  }
  function pushVoice(roomId) {
    const room = rooms.get(roomId);
    if (room) broadcast(roomId, { ev: 'voice', members: voiceList(room) }, null, true);
  }

  function removeEntry(roomId, e, why) {
    const room = rooms.get(roomId);
    if (!room || room.get(e.peer) !== e) return;
    clearTimeout(e.ghost); clearTimeout(e.flush);
    room.delete(e.peer);
    const hadVoice = !!e.voice;
    if (!room.size) rooms.delete(roomId);
    else {
      broadcast(roomId, { ev: 'left', peer: e.peer });
      if (hadVoice) pushVoice(roomId);
    }
    if (why) send(e.c.ws, { room: 'role-' + roomId, ev: 'kick', why });
  }

  const clean = d => {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
    const s = JSON.stringify(d);
    return s.length > 2048 ? {} : JSON.parse(s);
  };

  function iceFor(usuario) {
    const servers = [{ urls: cfg.stunUrls }];
    if (cfg.turnSecret && cfg.turnUrls.length) {
      const username = Math.floor(Date.now() / 1000) + 6 * 3600 + ':' + usuario;   // credencial temporária (TURN REST API, coturn use-auth-secret)
      servers.push({ urls: cfg.turnUrls, username, credential: crypto.createHmac('sha1', cfg.turnSecret).update(username).digest('base64') });
    }
    return servers;
  }

  /* ---------------------------------------------------------------- HTTP + WebSocket */
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      let pessoas = 0; rooms.forEach(r => { pessoas += r.size; });
      const cpu = process.cpuUsage();
      return res.end(JSON.stringify({ ok: true, salas: rooms.size, pessoas, conexoes: wss.clients.size, cpuMs: Math.round((cpu.user + cpu.system) / 1000), rssMb: Math.round(process.memoryUsage().rss / 1048576) }));
    }
    res.writeHead(404); res.end();
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const perIp = new Map();

  server.on('upgrade', (req, sock, head) => {
    if (new URL(req.url, 'http://x').pathname !== '/rt') return sock.destroy();
    const o = req.headers.origin;
    if (cfg.origins.length ? !(o && cfg.origins.includes(o)) : cfg.prod) return sock.destroy();
    const ip = (req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress);
    if ((perIp.get(ip) || 0) >= (cfg.maxPerIp || 300)) return sock.destroy();   // conexões por IP
    wss.handleUpgrade(req, sock, head, ws => { ws._ip = ip; wss.emit('connection', ws, req); });
  });

  wss.on('connection', ws => {
    perIp.set(ws._ip, (perIp.get(ws._ip) || 0) + 1);
    const c = { ws, token: '', clientPeer: '', rooms: new Map(), bucket: 40, last: Date.now() };
    ws._alive = true;
    ws.on('pong', () => { ws._alive = true; });

    const reply = (id, r, err) => { if (id != null) send(ws, err ? { id, err } : { id, r }); };

    ws.on('message', async buf => {
      const now = Date.now();
      c.bucket = Math.min(40, c.bucket + (now - c.last) * 0.03);   // ~30 mensagens/s, rajada de 40
      c.last = now;
      if (c.bucket < 1) return;
      c.bucket--;

      let m;
      try { m = JSON.parse(buf); } catch (_) { return; }
      if (!m || typeof m.op !== 'string') return;
      const { id, op } = m;
      try {
        switch (op) {
          case 'ping': return send(ws, { pong: now });
          case 'hello':
            if (typeof m.token !== 'string' || m.token.length > 4096 || !PEER_ID.test(m.peer || '')) return reply(id, null, 'invalid');
            c.token = m.token; c.clientPeer = m.peer;
            return reply(id, true);
          case 'token':
            if (typeof m.token === 'string' && m.token.length <= 4096) c.token = m.token;
            return reply(id, true);

          case 'join': {
            const roomId = String(m.room || '').replace(/^role-/, '');
            if (!c.token || !ROOM_ID.test(roomId)) return reply(id, null, 'invalid');
            const a = await acesso(c.token, roomId);
            if (!a.ok) return reply(id, null, a.err);
            if (a.status !== 'ativo') return reply(id, null, 'closed');
            const peer = crypto.createHash('sha1').update(a.usuario).digest('hex').slice(0, 6) + '-' + c.clientPeer;
            let room = rooms.get(roomId);
            if (!room) rooms.set(roomId, (room = new Map()));
            let e = room.get(peer);
            const resumed = !!e;
            if (e) {   // a mesma aba voltou depois de uma queda: retoma o lugar, ninguém vê ela sumir
              clearTimeout(e.ghost); e.ghost = null;
              e.c = c;
            } else {
              if (room.size >= a.max) { if (!room.size) rooms.delete(roomId); return reply(id, null, 'full'); }
              e = { peer, c, roomId, usuario: a.usuario, authUid: a.authUid, presence: {}, updatedAt: now, ghost: null, flush: null, voice: null };
              room.set(peer, e);
            }
            if (m.d !== undefined) { e.presence = clean(m.d); e.updatedAt = now; }
            c.rooms.set(roomId, e);
            reply(id, { peer, peers: [...room.values()].map(view), max: a.max, resumed, voice: voiceList(room) });
            if (!resumed || m.d !== undefined) broadcast(roomId, { ev: 'up', p: view(e) }, peer);
            return;
          }

          case 'presence': {
            const e = c.rooms.get(String(m.room || '').replace(/^role-/, ''));
            if (!e) return;
            e.presence = clean(m.d); e.updatedAt = now;
            if (!e.flush) e.flush = setTimeout(() => { e.flush = null; broadcast(e.roomId, { ev: 'up', p: view(e) }, e.peer); }, 80);   // junta rajadas
            return;
          }

          case 'leave': {
            const roomId = String(m.room || '').replace(/^role-/, '');
            const e = c.rooms.get(roomId);
            if (e) { c.rooms.delete(roomId); removeEntry(roomId, e); }
            return reply(id, true);
          }

          case 'voice': {
            const roomId = String(m.room || '').replace(/^role-/, '');
            const e = c.rooms.get(roomId), room = rooms.get(roomId);
            if (!e || !room) return reply(id, null, 'perm');
            if (m.on === false) { e.voice = null; pushVoice(roomId); return reply(id, true); }
            if (!e.voice) {
              if (voiceList(room).length >= cfg.voiceMax) return reply(id, null, 'full');
              e.voice = { t: now, m: !!m.m };
            } else e.voice.m = !!m.m;
            pushVoice(roomId);
            return reply(id, { members: voiceList(room), ice: iceFor(e.usuario), t: e.voice.t, peer: e.peer });
          }

          case 'sig': {
            const roomId = String(m.room || '').replace(/^role-/, '');
            const e = c.rooms.get(roomId), room = rooms.get(roomId);
            if (!e || !room || !e.voice || !SIG_KINDS.has(m.kind) || typeof m.to !== 'string') return;
            if (JSON.stringify(m.data || '').length > 8192) return;
            const t = room.get(m.to);
            if (t && t.voice) send(t.c.ws, { room: 'role-' + roomId, ev: 'sig', from: e.peer, kind: m.kind, data: m.data });
            return;
          }
          default: return reply(id, null, 'op');
        }
      } catch (err) {
        if (typeof err === 'string') return reply(id, null, err);
        log('erro em', op, err.message);
        reply(id, null, 'server');
      }
    });

    ws.on('close', () => {
      const n = (perIp.get(ws._ip) || 1) - 1;
      if (n > 0) perIp.set(ws._ip, n); else perIp.delete(ws._ip);
      for (const [roomId, e] of c.rooms) {
        if (e.c !== c) continue;   // já retomada por outra conexão
        e.ghost = setTimeout(() => removeEntry(roomId, e), cfg.graceMs);   // tolerância: queda rápida não derruba o avatar nem a voz
      }
    });
  });

  /* ---------------------------------------------------------------- manutenção */
  const beat = setInterval(() => {
    wss.clients.forEach(ws => { if (!ws._alive) return ws.terminate(); ws._alive = false; ws.ping(); });
  }, 25000);

  // quem foi banido ou perdeu acesso sai da sala (só age se o Supabase respondeu "não pode"; falha de rede não derruba ninguém)
  const recheck = setInterval(async () => {
    for (const [roomId, room] of [...rooms]) {
      for (const e of [...room.values()]) {
        if (e.ghost || !e.c.token) continue;
        try {
          const rows = await sb(`/rest/v1/role_members?select=banned_at&role_id=eq.${roomId}&user_id=eq.${e.authUid}`, e.c.token);
          if (!rows.length || rows[0].banned_at) { e.c.rooms.delete(roomId); removeEntry(roomId, e, 'perm'); }
        } catch (_) { /* sem resposta: mantém */ }
      }
    }
  }, cfg.recheckMs);

  const stop = () => new Promise(res => {
    clearInterval(beat); clearInterval(recheck);
    rooms.forEach(r => r.forEach(e => { clearTimeout(e.ghost); clearTimeout(e.flush); }));
    wss.clients.forEach(ws => ws.close(1001));
    server.close(() => res());
    setTimeout(res, 1500).unref();
  });

  return { server, wss, rooms, stop, listen: () => new Promise(res => server.listen(cfg.port, cfg.host, () => res(server.address().port))) };
}

module.exports = { createRealtime, configFromEnv };

if (require.main === module) {
  loadEnv(path.join(__dirname, '..', '.env'));
  loadEnv(path.join(__dirname, '.env'));
  const cfg = configFromEnv();
  const missing = ['supabaseUrl', 'key'].filter(k => !cfg[k]);
  if (cfg.prod && !cfg.origins.length) missing.push('ALLOWED_ORIGINS');
  if (missing.length) { console.error('[rt] faltou configurar: ' + missing.join(', ') + ' (veja .env.example)'); process.exit(1); }
  const rt = createRealtime(cfg);
  rt.listen().then(p => console.log(`[rt] tempo real no ar na porta ${p} (sala até ${cfg.defaultMax}, voz até ${cfg.voiceMax}${cfg.turnSecret ? ', TURN ligado' : ', sem TURN'})`));
  const bye = () => rt.stop().then(() => process.exit(0));
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}
