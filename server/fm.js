/*
 * Rolê FM no servidor próprio (modo Node): as mesmas regras do supabase/fm.sql, guardadas no store em fm/<sala>.
 * O servidor só guarda o que está tocando, desde quando (relógio daqui) e a fila. Cada pessoa toca o vídeo no
 * próprio aparelho. Toda mudança avisa a sala ao vivo (mensagem "fm") e as principais viram mensagem do bot no chat.
 *
 * Variáveis de ambiente: YOUTUBE_API_KEY (opcional: duração e lives), FM_FAKE=1 (testes, sem rede).
 */
const { FM_CFG, fmVideoId, fmIsoDur } = require('../src/engine/fmcore.js');

module.exports = function makeFm({ store, notify, env = process.env, fetchImpl = (...a) => fetch(...a) }) {
  const hits = new Map();   // usuario -> [instantes do /music no último minuto]
  const path = role => 'fm/' + role;
  const load = role => {
    const d = store.get(path(role)) || {};
    return { np: d.np || { status: 'parado', version: 0, qv: 0 }, queue: d.queue || [], djs: d.djs || [], quem: d.quem || 'todos', seq: d.seq || 0 };
  };
  const save = (role, d) => { store.set(path(role), d); notify(role); };
  const nome = u => (store.get('perfis/' + u) || {}).nome || u;

  function papel(c, role) {
    if (!c.uid || !c.usuario) throw 'auth';
    const r = store.get('roles/' + role);
    if (!r) throw 'perm';
    if (r.dono === c.usuario) return 'dono';
    if (!store.get(`roles/${role}/gente/${c.usuario}`)) throw 'perm';
    return load(role).djs.includes(c.usuario) ? 'dj' : 'membro';
  }
  const chefe = p => p === 'dono' || p === 'dj';

  function bot(role, c, t, d) {
    store.add(`roles/${role}/chat`, { u: c.usuario, n: nome(c.usuario), t: String(t).slice(0, 280), at: Date.now(), k: 'bot', d });
  }
  const touch = d => { d.np.qv = (d.np.qv || 0) + 1; };

  /* toca a próxima da fila (ou para tudo) */
  function next(role, d, c) {
    const q = d.queue.shift();
    if (q) {
      d.np = { status: 'tocando', video: q.video, title: q.title, thumb: q.thumb, dur: q.dur, by: q.by, started: Date.now(), paused: null, version: d.np.version + 1, qv: (d.np.qv || 0) + 1 };
      bot(role, c, 'Tocando agora: ' + q.title, { k: 'agora', video: q.video, title: q.title });
      return true;
    }
    if (d.np.status !== 'parado') {
      d.np = { status: 'parado', version: d.np.version + 1, qv: (d.np.qv || 0) + 1 };
      bot(role, c, 'Fila vazia. O som da sala voltou.', { k: 'vazia' });
    }
    return false;
  }

  async function resolve(id) {
    if (env.FM_FAKE) {   // testes: sem rede. "bloq…" não deixa incorporar, "long…" passa de 15 min
      if (id.startsWith('bloq')) throw 'embed';
      return { title: 'Música ' + id, dur: id.startsWith('long') ? 3600 : +(env.FM_FAKE_DUR || 180) };
    }
    const oe = await fetchImpl('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (oe.status === 401 || oe.status === 403) throw 'embed';
    if (!oe.ok) throw 'notfound';
    const o = await oe.json();
    let dur = null;
    if (env.YOUTUBE_API_KEY) {
      const r = await fetchImpl(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,status&id=${id}&key=${env.YOUTUBE_API_KEY}`);
      if (r.ok) {
        const it = ((await r.json()).items || [])[0];
        if (!it) throw 'notfound';
        if (it.snippet && it.snippet.liveBroadcastContent && it.snippet.liveBroadcastContent !== 'none') throw 'live';
        if (it.status && it.status.embeddable === false) throw 'embed';
        dur = fmIsoDur(it.contentDetails && it.contentDetails.duration);
        if (dur === 0) throw 'live';
      }
    }
    return { title: String(o.title || '').trim().slice(0, 200) || 'Música sem título', dur };
  }

  return {
    now: () => Date.now(),

    state(c, role) {
      const p = papel(c, role), d = load(role);
      return { papel: p, quem: d.quem, priv: 'link', eu: c.usuario, now: Date.now(), np: d.np, queue: d.queue.map(({ id, video, title, thumb, dur, by }) => ({ id, video, title, thumb, dur, by })), djs: d.djs };
    },

    async add(c, role, link) {
      const p = papel(c, role);
      const id = fmVideoId(link);
      if (!id) throw 'link';
      if (load(role).quem === 'djs' && !chefe(p)) throw 'djs';
      const now = Date.now(), h = (hits.get(c.usuario) || []).filter(t => now - t < 60e3);
      if (h.length >= FM_CFG.perMinute) throw 'rapido';
      h.push(now); hits.set(c.usuario, h);
      const meta = await resolve(id);
      if (meta.dur != null && meta.dur > FM_CFG.maxDurS) throw 'longo';
      const d = load(role);   // de novo: a busca no YouTube pode ter demorado
      if (d.queue.length >= FM_CFG.maxQueue) throw 'fila_cheia';
      if (!chefe(p) && d.queue.filter(q => q.by === c.usuario).length >= FM_CFG.perUser) throw 'limite';
      const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      d.seq++;
      d.queue.push({ id: d.seq, video: id, title: meta.title, thumb, dur: meta.dur, by: c.usuario });
      bot(role, c, `@${c.usuario} colocou: ${meta.title}`, { k: 'colocou', video: id, title: meta.title, u: c.usuario });
      let tocando = false;
      if (d.np.status === 'parado') tocando = next(role, d, c); else touch(d);
      save(role, d);
      return { ok: true, tocando, pos: d.queue.length, title: meta.title, video: id, thumb, dur: meta.dur };
    },

    act(c, role, op, a = {}) {
      const p = papel(c, role), d = load(role), np = d.np;
      switch (op) {
        case 'advance': {
          const skip = !!a.skip;
          if (skip && !chefe(p)) throw 'perm';
          if (np.version !== (a.version | 0) || np.status === 'parado') return { ok: false, version: np.version };
          if (!skip) {
            if (np.status !== 'tocando') return { ok: false, version: np.version };
            const fim = np.started + ((np.dur != null ? np.dur : FM_CFG.maxDurS) - FM_CFG.endSlackS) * 1000;
            if (Date.now() < fim && !(np.dur == null && chefe(p))) throw 'cedo';
          } else bot(role, c, `@${c.usuario} pulou a música`, { k: 'pulou', u: c.usuario });
          next(role, d, c);
          save(role, d);
          return { ok: true, version: d.np.version };
        }
        case 'pause':
          if (!chefe(p)) throw 'perm';
          if (np.status === 'tocando') { Object.assign(np, { status: 'pausado', paused: Date.now(), version: np.version + 1 }); bot(role, c, `@${c.usuario} pausou a música`, { k: 'pausou' }); save(role, d); }
          return null;
        case 'play':
          if (!chefe(p)) throw 'perm';
          if (np.status === 'pausado') { Object.assign(np, { status: 'tocando', started: np.started + (Date.now() - np.paused), paused: null, version: np.version + 1 }); bot(role, c, `@${c.usuario} soltou a música de novo`, { k: 'voltou' }); save(role, d); }
          return null;
        case 'limpar': {
          if (!chefe(p)) throw 'perm';
          const n = d.queue.length;
          d.queue = []; touch(d);
          if (n) bot(role, c, `@${c.usuario} limpou a fila`, { k: 'limpou' });
          save(role, d);
          return n;
        }
        case 'tirar': {
          const pos = a.pos | 0;
          let i = -1;
          if (pos <= 0) { for (let k = d.queue.length - 1; k >= 0; k--) if (d.queue[k].by === c.usuario) { i = k; break; } }
          else { i = pos - 1; if (d.queue[i] && d.queue[i].by !== c.usuario && !chefe(p)) throw 'perm'; }
          if (!d.queue[i]) throw 'vazio';
          const [q] = d.queue.splice(i, 1);
          touch(d); save(role, d);
          return q.title;
        }
        case 'dj': {
          if (p !== 'dono') throw 'perm';
          const u = String(a.u || '').toLowerCase().replace(/^@/, '');
          if (!store.get(`roles/${role}/gente/${u}`)) throw 'ninguem';
          if (u === c.usuario) throw 'dono';
          const has = d.djs.includes(u);
          if (a.on && !has) { d.djs.push(u); bot(role, c, `@${u} agora é DJ`, { k: 'dj', u }); }
          if (!a.on && has) { d.djs = d.djs.filter(x => x !== u); bot(role, c, `@${u} não é mais DJ`, { k: 'undj', u }); }
          touch(d); save(role, d);
          return null;
        }
        case 'duracao':
          if (!chefe(p)) throw 'perm';
          if (np.version === (a.version | 0) && np.dur == null) { np.dur = Math.max(1, Math.min(86400, a.dur | 0)); save(role, d); }
          return null;
        case 'quem':
          if (p !== 'dono') throw 'perm';
          if (!['todos', 'djs'].includes(a.quem)) throw 'invalid';
          d.quem = a.quem; touch(d); save(role, d);
          return null;
        default: throw 'op';
      }
    },
  };
};
