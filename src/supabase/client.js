/*
 * Cliente do Supabase para o app: banco de documentos por caminho + salas ao vivo (Realtime Presence).
 * Devolve objetos com a mesma forma que o app já usa (ServerDB / RemoteDB e room.join),
 * então o app.js só precisa de uma linha em initCaps. Esquema e regras: supabase/schema.sql.
 */
import { createClient } from '@supabase/supabase-js';

const TABLE = 'docs';
const idOf = p => p.slice(p.lastIndexOf('/') + 1);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function check(error) {
  if (!error) return;
  const code = error.code === '42501' || /row-level security/i.test(error.message || '') ? 'perm' : error.code || 'db';
  throw Object.assign(new Error(error.message || 'db'), { code });
}

/* ordena como o app espera: por campo (ex.: "at") ou por ordem de criação; limit pega os últimos */
function arrange(rows, o = {}) {
  let l = rows;
  if (o.order) l = [...l].sort((a, b) => (a.data[o.order] || 0) - (b.data[o.order] || 0));
  if (o.limit) l = l.slice(-Math.min(500, o.limit | 0));
  return l;
}

function makeDB(sb) {
  const t = () => sb.from(TABLE);

  async function get(p) {
    const { data, error } = await t().select('data').eq('path', p).maybeSingle();
    check(error);
    return data ? data.data : null;
  }

  async function list(p, o = {}) {
    const { data, error } = await t().select('path,data').eq('coll', p)
      .order('created_at', { ascending: false }).limit(Math.min(500, o.limit | 0 || 500));
    check(error);
    return arrange(data.reverse().map(x => ({ id: idOf(x.path), data: x.data })), o);
  }

  function changes(filter, name, onEvent) {
    return sb.channel(name + ':' + rid())
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter }, onEvent)
      .subscribe();
  }

  return {
    local: false, supabase: true,
    get,
    list,
    async set(p, d) { check((await t().upsert({ path: p, data: d }, { onConflict: 'path' })).error); },
    async update(p, d) { check((await sb.rpc('doc_merge', { p, d })).error); },
    async del() { throw Object.assign(new Error('perm'), { code: 'perm' }); },
    async add(p, d) {
      const id = rid();
      check((await t().insert({ path: p + '/' + id, data: d })).error);
      return id;
    },
    watchDoc(p, cb) {
      let on = true;
      const ch = changes('path=eq.' + p, 'doc', e => { if (on) cb(e.eventType === 'DELETE' ? null : e.new.data); });
      get(p).then(v => { if (on) cb(v); }).catch(e => console.warn('db', e));
      return () => { on = false; sb.removeChannel(ch); };
    },
    watchColl(p, cb, o = {}) {
      let on = true;
      const map = new Map();
      const emit = () => { if (on) cb(arrange([...map].map(([id, data]) => ({ id, data })), o)); };
      const ch = changes('coll=eq.' + p, 'coll', e => {
        if (e.eventType === 'DELETE') map.delete(idOf(e.old.path)); else map.set(idOf(e.new.path), e.new.data);
        emit();
      });
      list(p, o).then(l => { l.forEach(x => { if (!map.has(x.id)) map.set(x.id, x.data); }); emit(); }).catch(e => console.warn('db', e));
      return () => { on = false; sb.removeChannel(ch); };
    },
    findConta: null,
  };
}

/* sala ao vivo: quem está no canal aparece em "peers"; o Realtime remove quem cai */
function makeRoom(sb, name) {
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

/* entra como anônimo (a sessão fica no navegador) e devolve { uid, db, room } */
export async function connect({ url, key }) {
  const sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } });
  let { data: { session } } = await sb.auth.getSession();
  if (session && (await sb.auth.getUser()).error) { await sb.auth.signOut({ scope: 'local' }); session = null; }
  if (!session) {
    const r = await sb.auth.signInAnonymously();
    if (r.error) throw r.error;
    session = r.data.session;
  }
  return { uid: session.user.id, db: makeDB(sb), room: n => makeRoom(sb, n) };
}
