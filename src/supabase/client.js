/*
 * Cliente do Supabase para o app. Traduz os caminhos que o app usa ("roles/<id>", "roles/<id>/chat"…)
 * para as tabelas e funções de supabase/schema.sql, e entrega objetos com a mesma forma do servidor próprio:
 *   net  login por código (authStart / authVerify / hello / logout), igual ao protocolo do server/server.js
 *   db   get / set / update / list / add / watchDoc / watchColl
 *   room sala ao vivo (Realtime Presence)
 *   voice chat de voz da sala (WebRTC; veja voice.js)
 * Quem decide o que pode é o banco (RLS e funções). Aqui só traduzimos.
 *
 * Mapa dos caminhos:
 *   data/users/<uid>/conta         conta própria                  rpc minha_conta / salvar_fig
 *   data/users/<uid>/r_<rolê>      "meus rolês"                   role_members
 *   perfis/<usuario>               perfil público                 users
 *   roles/<id>                     rolê (prévia do convite)       rpc ver_role / criar_role / atualizar_role
 *   roles/<id>/gente/<usuario>     aceitar o convite              rpc entrar_role / listar_gente
 *   roles/<id>/chat                mensagens                      chat_messages / rpc enviar_mensagem
 */
import { createClient } from '@supabase/supabase-js';
import { makeVoice } from './voice.js';

/* ---------- diagnóstico: window.__rt guarda eventos e contadores; com ?debug=1 aparece um painel na tela ---------- */
const rt = (typeof window !== 'undefined' && (window.__rt = window.__rt || { log: [], n: {}, sent: 0, recv: 0, sentB: 0, recvB: 0, t0: Date.now(), socket: 'abrindo', reconexoes: 0, canais: {}, pcs: () => [] })) || { log: [], n: {}, canais: {} };
const note = (ev, info) => { rt.n[ev] = (rt.n[ev] || 0) + 1; rt.log.push({ t: Date.now() - rt.t0, ev, info: info === undefined ? '' : String(info).slice(0, 80) }); if (rt.log.length > 300) rt.log.shift(); };
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const coded = code => Object.assign(new Error(code), { code });

/* erros do banco: as funções levantam códigos curtos ("taken", "perm"…); permissão negada vira "perm" */
function check(error) {
  if (!error) return;
  const m = String(error.message || '');
  throw coded(/^[a-z_]{3,20}$/.test(m) ? m : error.code === '42501' || /permission denied|row-level security/i.test(m) ? 'perm' : error.code || 'db');
}

function arrange(rows, o = {}) {
  let l = rows;
  if (o.order) l = [...l].sort((a, b) => (a.data[o.order] || 0) - (b.data[o.order] || 0));
  if (o.limit) l = l.slice(-Math.min(500, o.limit | 0));
  return l;
}

/* painel de diagnóstico: abra o app com ?debug=1 */
function overlay() {
  if (typeof document === 'undefined' || !/[?&]debug=1/.test(location.search)) return;
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;max-width:94vw;max-height:55vh;overflow:auto;margin:0;padding:8px;background:rgba(0,0,0,.84);color:#9f9;font:11px/1.35 ui-monospace,Consolas,monospace;border-radius:6px;pointer-events:none;white-space:pre-wrap';
  document.body.append(el);
  let prev = { s: 0, r: 0, t: Date.now() };
  const ctype = (stats, id) => { const c = id && stats.get(id); return c ? c.candidateType : '?'; };
  setInterval(async () => {
    const now = Date.now(), dt = (now - prev.t) / 1000;
    const up = ((rt.sent - prev.s) / dt).toFixed(1), down = ((rt.recv - prev.r) / dt).toFixed(1);
    prev = { s: rt.sent, r: rt.recv, t: now };
    const NL = String.fromCharCode(10);
    let out = 'RT  socket: ' + rt.socket + '  hb: ' + (rt.hb || '-') + '  reconexoes: ' + rt.reconexoes + '  envia ' + up + '/s  recebe ' + down + '/s' + NL;
    out += 'canais: ' + (Object.entries(rt.canais).map(([k, v]) => k + '=' + v).join(' ') || '-') + NL;
    out += 'eventos: ' + (Object.entries(rt.n).map(([k, v]) => k + ':' + v).join('  ') || '-') + NL;
    for (const [k, pc] of (rt.pcs ? rt.pcs() : [])) {
      let tipo = '?', rx = 0;
      try {
        const st = await pc.getStats();
        st.forEach(r => {
          if (r.type === 'inbound-rtp' && r.kind === 'audio') rx += r.bytesReceived;
          if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') tipo = ctype(st, r.localCandidateId) + '/' + ctype(st, r.remoteCandidateId);
        });
      } catch (_) {}
      out += 'voz ' + k.slice(-4) + '  conn=' + pc.connectionState + '  ice=' + pc.iceConnectionState + '  candidato(local/remoto)=' + tipo + '  rx=' + (rx / 1024).toFixed(0) + 'KB' + NL;
    }
    out += rt.log.slice(-8).map(x => (x.t / 1000).toFixed(0).padStart(4) + 's ' + x.ev + ' ' + x.info).join(NL);
    el.textContent = out;
  }, 1000);
}

export async function connect({ url, key, ice }) {
  overlay();
  const sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 }, heartbeatCallback: (st, lat) => { rt.hb = st + (lat ? ' ' + lat + 'ms' : ''); if (st !== 'sent' && st !== 'ok') note('heartbeat ' + st); } } });

  /* o navegador entra como anônimo; o usuário de verdade é ligado a essa sessão pelo código (auth_verify) */
  let { data: { session } } = await sb.auth.getSession();
  if (session && (await sb.auth.getUser()).error) { await sb.auth.signOut({ scope: 'local' }); session = null; }
  if (!session) {
    const r = await sb.auth.signInAnonymously();
    if (r.error) throw r.error;
  }

  /* conta mensagens do socket e as reconexões (o socket é recriado a cada reconexão, por isso o gancho se repete) */
  const hook = () => {
    let c = null;
    try { c = sb.realtime.socketAdapter.socket.conn; } catch (_) { /* detalhe interno do realtime-js: só o painel de debug usa */ }
    if (!c || c.__rt) return;
    c.__rt = 1;
    rt.socket = 'aberto';
    const send = c.send.bind(c);
    c.send = d => { rt.sent++; rt.sentB += String(d).length; return send(d); };
    c.addEventListener('message', e => { rt.recv++; rt.recvB += String(e.data).length; });
    c.addEventListener('close', e => { rt.socket = 'fechado'; rt.reconexoes++; note('socket fechado', e.code + ' ' + (e.reason || '')); });
    c.addEventListener('error', () => note('socket erro'));
  };
  setInterval(hook, 500);

  const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); check(error); return data; };
  const state = { uid: null };
  const hello = await rpc('hello');
  if (hello) state.uid = hello.uid;

  const net = {
    async call(op, a = {}) {
      if (op === 'authStart') {
        return rpc('auth_start', a.tipo === 'cadastro' ? { p_tipo: 'cadastro', p_conta: a.conta } : { p_tipo: 'login', p_q: a.q });
      }
      if (op === 'authVerify') {
        const r = await rpc('auth_verify', { p_code: String(a.code || ''), p_fig: a.fig || '' });
        if (r.err) throw coded(r.err);
        state.uid = r.uid;
        return { uid: r.uid, token: '', conta: r.conta };
      }
      throw coded('op');
    },
    async hello() { return { uid: state.uid }; },
    forget() { state.uid = null; return rpc('logout'); },
  };

  /* ---------- usuários por id (nome nas mensagens) */
  const names = new Map();
  async function nameOf(id) {
    if (!names.has(id)) {
      const { data } = await sb.from('users').select('usuario,nome').eq('id', id).maybeSingle();
      names.set(id, data || { usuario: '?', nome: '?' });
    }
    return names.get(id);
  }
  const chatDoc = (row, u) => ({ u: u.usuario, n: u.nome, t: row.texto, at: Date.parse(row.created_at), ...(row.tipo === 'bot' ? { k: 'bot', d: row.dados || {} } : {}) });
  let chatCols = 'id,texto,created_at,user_id,tipo,dados,user:users(usuario,nome)';   // tipo e dados vêm do supabase/fm.sql

  async function listChat(roleId, o = {}) {
    const q = () => sb.from('chat_messages').select(chatCols)
      .eq('role_id', roleId).is('deleted_at', null).order('id', { ascending: false }).limit(Math.min(500, o.limit | 0 || 200));
    let { data, error } = await q();
    if (error && error.code === '42703' && chatCols.includes('tipo')) { chatCols = 'id,texto,created_at,user_id,user:users(usuario,nome)'; ({ data, error } = await q()); }   // fm.sql ainda não rodou
    check(error);
    return data.reverse().map(x => {
      if (x.user) names.set(x.user_id, x.user);
      return { id: String(x.id), data: chatDoc(x, x.user || { usuario: '?', nome: '?' }) };
    });
  }

  /* onReady roda quando o canal fica ativo (e de novo se ele reconectar): buscar o histórico só aí não deixa
     buraco entre "li o que já existia" e "comecei a ouvir", que perderia mensagens de quem escreve nesse intervalo */
  const roleChanges = (filter, table, onEvent, onReady) => sb.channel(table + ':' + rid())
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, onEvent)
    .subscribe(status => { if (status === 'SUBSCRIBED') onReady(); });

  const perm = () => { throw coded('perm'); };
  const seg = p => p.split('/');

  const db = {
    local: false, supabase: true, findConta: null,

    async get(p) {
      const s = seg(p);
      if (s[0] === 'roles' && s.length === 2) return rpc('ver_role', { p_id: s[1] });
      if (s[0] === 'data' && s[1] === 'users' && s.length === 4) {
        if (s[2] !== state.uid) return null;
        if (s[3] === 'conta') return rpc('minha_conta');
        if (s[3].startsWith('r_')) {
          const eid = s[3].slice(2);
          const { data, error } = await sb.from('role_members').select('papel,created_at')
            .eq('role_id', eid).eq('user_id', state.uid).is('banned_at', null).maybeSingle();
          check(error);
          return data ? { eid, papel: data.papel, at: Date.parse(data.created_at) } : null;
        }
      }
      if (s[0] === 'perfis' && s.length === 2) {
        const { data, error } = await sb.from('users').select('id,nome,fig').eq('usuario', s[1]).maybeSingle();
        check(error);
        return data ? { nome: data.nome, fig: data.fig, dono: data.id } : null;
      }
      return perm();
    },

    async list(p, o = {}) {
      const s = seg(p);
      if (s[0] === 'data' && s[1] === 'users' && s.length === 3 && s[2] === state.uid) {
        const { data, error } = await sb.from('role_members').select('role_id,papel,created_at').eq('user_id', state.uid).is('banned_at', null);
        check(error);
        return data.map(x => ({ id: 'r_' + x.role_id, data: { eid: x.role_id, papel: x.papel, at: Date.parse(x.created_at) } }));
      }
      if (s[0] === 'roles' && s[2] === 'gente' && s.length === 3) {
        const l = await rpc('listar_gente', { p_id: s[1] });
        return l.map(g => ({ id: g.usuario, data: { nome: g.nome, papel: g.papel, at: g.at } }));
      }
      if (s[0] === 'roles' && s[2] === 'chat' && s.length === 3) return arrange(await listChat(s[1], o), o);
      return perm();
    },

    async set(p, d) {
      const s = seg(p);
      if (s[0] === 'roles' && s.length === 2) {
        return void await rpc('criar_role', { p_id: s[1], p_nome: d.nome, p_data: d.data, p_hora: d.hora, p_cena: d.cena, p_noite: !!d.noite });
      }
      if (s[0] === 'roles' && s[2] === 'gente' && s.length === 4) return void await rpc('entrar_role', { p_id: s[1] });
      if (s[0] === 'data' && s[1] === 'users' && s[3] && s[3].startsWith('r_')) return; // vem de role_members
      return perm();
    },

    async update(p, d) {
      const s = seg(p);
      if (s[0] === 'roles' && s.length === 2) return void await rpc('atualizar_role', { p_id: s[1], p_patch: d });
      if ((s[0] === 'perfis' && s.length === 2) || (s[0] === 'data' && s[3] === 'conta')) {
        if (typeof d.fig === 'string') await rpc('salvar_fig', { p_fig: d.fig });
        return;
      }
      return perm();
    },

    async add(p, d) {
      const s = seg(p);
      if (s[0] === 'roles' && s[2] === 'chat' && s.length === 3) return rpc('enviar_mensagem', { p_role: s[1], p_texto: d.t });
      return perm();
    },

    async del() { return perm(); },

    watchDoc(p, cb) {
      const s = seg(p);
      if (!(s[0] === 'roles' && s.length === 2)) { cb(null); return () => {}; }
      let on = true;
      const load = () => rpc('ver_role', { p_id: s[1] }).then(v => { if (on) cb(v); }).catch(e => console.warn('db', e));
      const ch = roleChanges('id=eq.' + s[1], 'roles', load, load);
      load();
      return () => { on = false; sb.removeChannel(ch); };
    },

    watchColl(p, cb, o = {}) {
      const s = seg(p);
      if (!(s[0] === 'roles' && s[2] === 'chat' && s.length === 3)) { cb([]); return () => {}; }
      let on = true;
      const map = new Map();
      const emit = () => { if (on) cb(arrange([...map].map(([id, data]) => ({ id, data })), o)); };
      const sync = () => listChat(s[1], o).then(l => { l.forEach(x => { if (!map.has(x.id)) map.set(x.id, x.data); }); emit(); }).catch(e => console.warn('db', e));
      const ch = roleChanges('role_id=eq.' + s[1], 'chat_messages', async e => {
        const row = e.new;
        if (!row || !row.id) return;
        if (row.deleted_at) map.delete(String(row.id));
        else map.set(String(row.id), chatDoc(row, await nameOf(row.user_id)));
        emit();
      }, sync);
      sync();
      return () => { on = false; sb.removeChannel(ch); };
    },
  };

  /* ---------- sala ao vivo ----------
     O Supabase limita cada cliente a 5 atualizações de presença a cada 30 s (em todos os planos) e derruba o canal
     quando passa disso. Por isso a presença leva só o que muda pouco (quem é, nome, visual) e o movimento, as ações
     e as mensagens de jogo vão por broadcast, que não tem esse limite. Cada aba reenvia o próprio estado a cada 6 s,
     então quem perdeu uma mensagem se acerta sozinho. O canal não é recriado à mão: o supabase-js religa sozinho. */
  const STATIC_KEYS = ['u', 'n', 'f', 'j'];
  const GHOST_MS = 10000, TRACK_GAP = 7000, MV_GAP = 100, BEAT_MS = 6000, DOWN_AFTER = 3000;

  function room(name) {
    const key = rid();
    const hs = new Set(), ss = new Set(), ms = new Set();
    const dyn = new Map();      // peer -> { d }   estado que muda toda hora (posição, ação…)
    const ghost = new Map();    // peer -> { entry, timer }   quem saiu há pouco: some só depois de GHOST_MS
    let ch = null, mine = {}, dead = false, connected = false, reported = false;
    let lastSentStatic = '', downTimer = 0, watchdog = 0, trackAt = 0, trackTimer = 0, mvTimer = 0, mvAt = 0, lastStatic = '', opening = false;

    const split = d => { const st = {}, dy = {}; for (const k in d) (STATIC_KEYS.includes(k) ? st : dy)[k] = d[k]; return { st, dy }; };

    function peers() {
      const out = [], seen = new Set();
      const add = (peer, st) => {
        seen.add(peer);
        const dy = peer === key ? mine : (dyn.get(peer) || {}).d;
        if (!dy) return;                        // ainda não mandou posição: não aparece (evita boneco no canto 0,0)
        out.push({ peer, isMe: peer === key, presence: { ...st, ...dy }, updatedAt: Date.now() });
      };
      for (const [peer, metas] of Object.entries(ch ? ch.presenceState() : {})) add(peer, (metas[metas.length - 1] || {}).d || {});
      for (const [peer, g] of ghost) if (!seen.has(peer)) add(peer, g.entry);
      return out;
    }
    const fire = () => { const l = peers(); hs.forEach(h => h({ peers: l, joined: [], left: [], updated: [] })); };

    /* avisa "caiu" só depois de DOWN_AFTER sem conexão; "voltou" é imediato */
    function setUp(v, why) {
      connected = v;
      rt.canais[name] = v ? 'ok' : 'caido';
      note('sala ' + (v ? 'conectada' : 'caiu'), why);
      clearTimeout(downTimer);
      if (v) { if (reported) { reported = false; ss.forEach(f => f('up')); } }
      else downTimer = setTimeout(() => { if (!connected && !dead) { reported = true; ss.forEach(f => f('down')); } }, DOWN_AFTER);
    }

    /* presença (quem é): no máximo uma atualização a cada TRACK_GAP, para ficar longe do limite de 5 por 30 s */
    function track() {
      if (!ch || !connected || !Object.keys(split(mine).st).length) return;   // sem identidade ainda: não gasta o orçamento de presença
      const st = JSON.stringify(split(mine).st);
      if (st === lastStatic && trackAt) return;
      const wait = trackAt + TRACK_GAP - Date.now();
      if (wait > 0) { if (!trackTimer) trackTimer = setTimeout(() => { trackTimer = 0; track(); }, wait); return; }
      lastStatic = st; trackAt = Date.now();
      ch.track({ d: JSON.parse(st) }).then(r => { if (r !== 'ok') note('track ' + r); }, () => {});
    }

    /* movimento e ações: broadcast, juntando rajadas (no máximo 10 por segundo) */
    function sendMv(force) {
      if (!ch || !connected || !Object.keys(mine).length) return;
      const wait = mvAt + MV_GAP - Date.now();
      if (!force && wait > 0) { if (!mvTimer) mvTimer = setTimeout(() => { mvTimer = 0; sendMv(); }, wait); return; }
      mvAt = Date.now();
      const st = JSON.stringify(split(mine).st), full = force || st !== lastSentStatic;   // identidade vai junto quando é novidade ou reenvio completo
      lastSentStatic = st;
      ch.send({ type: 'broadcast', event: 'mv', payload: { k: key, d: full ? mine : split(mine).dy } }).catch(() => {});
    }

    const lastSeen = new Map();   // peer -> última presença conhecida (para segurar o boneco durante a tolerância)
    function onGone(peerKey) {
      if (peerKey === key || ghost.has(peerKey)) return;
      ghost.set(peerKey, {
        entry: lastSeen.get(peerKey) || {},
        timer: setTimeout(() => { ghost.delete(peerKey); lastSeen.delete(peerKey); dyn.delete(peerKey); fire(); }, GHOST_MS),
      });
    }

    function open() {
      if (dead || opening) return;
      opening = true;
      note('sala: abre canal', 'inicio');
      const c = ch = sb.channel(name, { config: { presence: { key }, broadcast: { self: false } } });
      c.on('presence', { event: 'sync' }, () => {
        for (const [peer, metas] of Object.entries(c.presenceState())) {
          lastSeen.set(peer, (metas[metas.length - 1] || {}).d || {});
          const g = ghost.get(peer); if (g) { clearTimeout(g.timer); ghost.delete(peer); }
        }
        fire();
      });
      c.on('presence', { event: 'leave' }, ({ key: k }) => { onGone(k); fire(); });
      c.on('broadcast', { event: 'mv' }, ({ payload }) => {
        if (!payload || payload.k === key || typeof payload.k !== 'string') return;
        dyn.set(payload.k, { d: { ...((dyn.get(payload.k) || {}).d || {}), ...(payload.d || {}) } });   // junta: o movimento não repete a identidade
        fire();
      });
      c.on('broadcast', { event: 'hi' }, ({ payload }) => {   // alguém entrou: manda para ele onde estou (com pequeno atraso, para 50 pessoas não responderem juntas)
        if (payload && payload.k !== key) setTimeout(() => sendMv(true), Math.random() * 400);
      });
      c.on('broadcast', { event: 'g' }, ({ payload }) => {    // mensagens dos jogos
        if (!payload || payload.k === key || (payload.to && payload.to !== key)) return;
        note('jogo recebido', payload.t + ' ' + ((payload.d || {}).t || ''));
        ms.forEach(h => { try { h(payload.t, payload.d, payload.k); } catch (e) { console.warn('jogo', e); } });
      });
      clearTimeout(watchdog);
      watchdog = setTimeout(async () => {   // nunca conectou: refaz do zero (esperando o canal antigo sair, senão o supabase-js devolve o mesmo)
        if (dead || connected) return;
        note('sala: refaz canal', 'não conectou em 15s');
        opening = false;
        try { await sb.removeChannel(c); } catch (_) {}
        if (ch === c) ch = null;
        open();
      }, 15000);
      c.subscribe(status => {
        if (dead || c !== ch) return;
        note('sala status', status);
        if (status === 'SUBSCRIBED') {
          opening = false; clearTimeout(watchdog);
          setUp(true);
          trackAt = 0; lastStatic = ''; track();
          c.send({ type: 'broadcast', event: 'hi', payload: { k: key } }).catch(() => {});
          sendMv(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setUp(false, status);
      });
    }

    const beat = setInterval(() => { if (connected) sendMv(true); }, BEAT_MS);
    const wake = () => {
      if (dead || (typeof document !== 'undefined' && document.hidden)) return;
      note('sala wake', connected ? 'ok' : 'caida');
      if (connected) { sendMv(true); if (ch) ch.send({ type: 'broadcast', event: 'hi', payload: { k: key } }).catch(() => {}); }
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', wake);
    if (typeof window !== 'undefined') window.addEventListener('online', wake);

    const api = {
      async presence(d) { mine = { ...mine, ...d }; track(); sendMv(); fire(); },
      peers,
      onPeers(h) { hs.add(h); return () => hs.delete(h); },
      onStatus(h) { ss.add(h); h(reported ? 'down' : 'up'); return () => ss.delete(h); },
      /* mensagens de jogo para a sala (to = peer de destino, opcional); devolve false se não deu para enviar */
      send(kind, data, to) {
        if (!ch || !connected) return false;
        note('jogo enviado', kind + ' ' + ((data || {}).t || '') + (to ? ' -> ' + to.slice(-4) : ''));
        ch.send({ type: 'broadcast', event: 'g', payload: { k: key, t: kind, d: data, to } }).catch(() => {});
        return true;
      },
      onMsg(h) { ms.add(h); return () => ms.delete(h); },
      get me() { return key; },
      async leave() {
        dead = true;
        clearInterval(beat); clearTimeout(downTimer); clearTimeout(watchdog); clearTimeout(trackTimer); clearTimeout(mvTimer);
        ghost.forEach(g => clearTimeout(g.timer)); ghost.clear();
        hs.clear(); ss.clear(); ms.clear();
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', wake);
        if (typeof window !== 'undefined') window.removeEventListener('online', wake);
        if (ch) await sb.removeChannel(ch);
      },
    };
    open();
    return new Promise(res => {   // entra na sala mesmo se o Realtime demorar; segue conectando por trás
      const t = setInterval(() => { if (connected) { clearInterval(t); res(api); } }, 50);
      setTimeout(() => { clearInterval(t); res(api); }, 6000);
    });
  }

  /* ---------- Rolê FM (supabase/fm.sql + Edge Function music-resolve) ----------
     O aviso de "mudou" não usa canal próprio: quem muda avisa a sala ao vivo (mensagem "fm"), e as mensagens do bot
     no chat também fazem os aparelhos relerem o estado. Assim, se o fm.sql ainda não rodou, nada mais quebra. */
  const FM_ARGS = {
    advance: a => ({ p_version: a.version | 0, p_skip: !!a.skip }), pause: () => ({}), play: () => ({}), limpar: () => ({}),
    tirar: a => ({ p_pos: a.pos | 0 }), dj: a => ({ p_usuario: String(a.u || ''), p_on: !!a.on }),
    duracao: a => ({ p_version: a.version | 0, p_dur: a.dur | 0 }), quem: a => ({ p_quem: String(a.quem || '') }),
    trocar: a => ({ p_msg: Number(a.msg) || 0, p_idx: a.idx | 0 }),
  };
  const fm = {
    async now() { return Number(await rpc('fm_now')); },
    state: role => rpc('fm_estado', { p_role: role }),
    /* link ou nome: a Edge Function decide (nome vira busca no YouTube, com cache e cota) */
    async call(body) {
      const { data, error } = await sb.functions.invoke('music-resolve', { body });
      if (error) {
        const st = error.context && error.context.status;
        let code = st === 401 ? 'auth' : st === 404 ? 'nofn' : 'server';
        try { const b = await error.context.json(); if (b && b.error) code = b.error; } catch (_) { /* sem corpo */ }
        throw coded(code);
      }
      if (data && data.error) throw coded(data.error);
      return data;
    },
    add(role, input) {
      /* uma função music-resolve antiga (sem busca por nome) responde "link" a um nome: avisa em vez de parecer defeito do texto */
      return fm.call({ role, link: input }).catch(e => { throw (e && e.code === 'link' && !fmIsLink(input)) ? coded('fnvelha') : e; });
    },
    search(role, q) { return fm.call({ role, q, mode: 'search' }); },
    act(role, op, a = {}) {
      const f = FM_ARGS[op];
      if (!f) return Promise.reject(coded('op'));
      return rpc('fm_' + op, { p_role: role, ...f(a) });
    },
  };

  return { uid: state.uid, conta: hello ? hello.conta : null, net, db, room, fm, voice: id => makeVoice(sb, id, ice) };
}
