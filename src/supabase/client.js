/*
 * Cliente do Supabase para o app. Traduz os caminhos que o app usa ("roles/<id>", "roles/<id>/chat"…)
 * para as tabelas e funções de supabase/schema.sql, e entrega objetos com a mesma forma do servidor próprio:
 *   net  login por código (authStart / authVerify / hello / logout), igual ao protocolo do server/server.js
 *   db   get / set / update / list / add / watchDoc / watchColl
 *   room sala ao vivo (Realtime Presence)
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

export async function connect({ url, key }) {
  const sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } });

  /* o navegador entra como anônimo; o usuário de verdade é ligado a essa sessão pelo código (auth_verify) */
  let { data: { session } } = await sb.auth.getSession();
  if (session && (await sb.auth.getUser()).error) { await sb.auth.signOut({ scope: 'local' }); session = null; }
  if (!session) {
    const r = await sb.auth.signInAnonymously();
    if (r.error) throw r.error;
  }

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
  const chatDoc = (row, u) => ({ u: u.usuario, n: u.nome, t: row.texto, at: Date.parse(row.created_at) });

  async function listChat(roleId, o = {}) {
    const { data, error } = await sb.from('chat_messages').select('id,texto,created_at,user_id,user:users(usuario,nome)')
      .eq('role_id', roleId).is('deleted_at', null).order('id', { ascending: false }).limit(Math.min(500, o.limit | 0 || 200));
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

  /* ---------- sala ao vivo: quem está no canal aparece em "peers"; o Realtime remove quem cai */
  function room(name) {
    const key = rid();
    const ch = sb.channel(name, { config: { presence: { key } } });
    const hs = new Set();
    let mine = {};
    const peers = () => Object.entries(ch.presenceState()).map(([peer, metas]) => {
      const m = metas[metas.length - 1] || {};
      return { peer, isMe: peer === key, presence: m.d || {}, updatedAt: m.at || 0 };
    });
    ch.on('presence', { event: 'sync' }, () => { const l = peers(); hs.forEach(h => h({ peers: l, joined: [], left: [], updated: [] })); });
    const track = () => ch.track({ d: mine, at: Date.now() });

    return new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('timeout')), 10000);
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          track().then(() => res({
            async presence(d) { mine = { ...mine, ...d }; await track(); },
            peers,
            onPeers(h) { hs.add(h); return () => hs.delete(h); },
            async leave() { hs.clear(); await sb.removeChannel(ch); },
          }), rej);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); rej(new Error(status)); }
      });
    });
  }

  return { uid: state.uid, conta: hello ? hello.conta : null, net, db, room };
}
