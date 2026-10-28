/*
 * Rolê FM no servidor próprio (modo Node): as mesmas regras do supabase/fm.sql, guardadas no store em fm/<sala>.
 * O servidor só guarda o que está tocando, desde quando (relógio daqui) e a fila. Cada pessoa toca o vídeo no
 * próprio aparelho. Toda mudança avisa a sala ao vivo (mensagem "fm") e as principais viram mensagem do bot no chat.
 *
 * Variáveis de ambiente: YOUTUBE_API_KEY (opcional: duração e lives), FM_FAKE=1 (testes, sem rede).
 */
const { FM_CFG, fmVideoId, fmIsLink, fmIsoDur, fmNorm, fmRank, fmQuotaDay } = require('../src/engine/fmcore.js');

module.exports = function makeFm({ store, notify, env = process.env, fetchImpl = (...a) => fetch(...a) }) {
  const hits = new Map();   // usuario -> [instantes do /music no último minuto]
  const searches = new Map();   // usuario -> [instantes das buscas que foram ao YouTube, na última hora]
  const busy = new Set();   // salas com uma busca rodando (uma por vez)
  const stats = { api: 0 };   // chamadas à API do YouTube (os testes conferem o cache)
  const path = role => 'fm/' + role;
  const load = role => {
    const d = store.get(path(role)) || {};
    return { np: d.np || { status: 'parado', version: 0, qv: 0 }, queue: d.queue || [], djs: d.djs || [], quem: d.quem || 'todos', seq: d.seq || 0, last: d.last || {} };
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
  const chefe = p => !!p;   // todo mundo da sala (até 8) pode tudo

  function bot(role, c, t, d) {
    return store.add(`roles/${role}/chat`, { u: c.usuario, n: nome(c.usuario), t: String(t).slice(0, 280), at: Date.now(), k: 'bot', d });
  }
  const touch = d => { d.np.qv = (d.np.qv || 0) + 1; };

  /* toca a próxima da fila (ou para tudo) */
  function next(role, d, c) {
    const q = d.queue.shift();
    if (q) {
      d.np = { status: 'tocando', qid: q.id, video: q.video, title: q.title, thumb: q.thumb, dur: q.dur, by: q.by, started: Date.now(), paused: null, version: d.np.version + 1, qv: (d.np.qv || 0) + 1 };
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

  /* ---------- busca por nome: cache de 30 dias, cota do dia (fuso do Pacífico), 10 por hora por pessoa ---------- */
  const decode = t => String(t).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const fakeHash = t => { let h = 7; for (const ch of t) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0; return h; };
  const quotaKey = () => 'fm_quota/' + fmQuotaDay();
  const quotaUsed = () => (env.FM_FAKE_QUOTA ? Math.round(FM_CFG.quotaDay * +env.FM_FAKE_QUOTA) : 0) + ((store.get(quotaKey()) || {}).n || 0);

  async function ytSearch(q) {
    if (env.FM_FAKE) {   // testes: cinco resultados fixos para a consulta, sem rede
      stats.api += 2;
      const h = fakeHash(q).toString(36).padStart(7, '0').slice(0, 7);
      return [0, 1, 2, 3, 4, 5].map(i => ({ video: 'bs' + h + String(i).padStart(2, '0'), title: i === 2 ? q + ' (Clipe Oficial)' : q + ' (resultado ' + (i + 1) + ')', canal: 'Canal ' + i, dur: i === 4 ? 3600 : i === 5 ? null : 150 + i, live: i === 3 }));
    }
    const u = new URL('https://www.googleapis.com/youtube/v3/search');
    Object.entries({ part: 'snippet', type: 'video', videoEmbeddable: 'true', videoCategoryId: '10', regionCode: 'BR', relevanceLanguage: 'pt', safeSearch: 'moderate', maxResults: '5', q, key: env.YOUTUBE_API_KEY })
      .forEach(([k, v]) => u.searchParams.set(k, v));
    stats.api++;
    const r = await fetchImpl(u);
    if (r.status === 403 || r.status === 429) throw 'cota';
    if (!r.ok) throw 'server';
    const items = ((await r.json()).items || []).filter(i => i.id && i.id.videoId);
    if (!items.length) return [];
    stats.api++;
    const d = await fetchImpl(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${items.map(i => i.id.videoId).join(',')}&key=${env.YOUTUBE_API_KEY}`);
    const det = {};
    if (d.ok) for (const v of (await d.json()).items || []) det[v.id] = { dur: fmIsoDur(v.contentDetails && v.contentDetails.duration), live: !!(v.snippet && v.snippet.liveBroadcastContent && v.snippet.liveBroadcastContent !== 'none') };
    return items.map(i => ({ video: i.id.videoId, title: decode((i.snippet && i.snippet.title) || ''), canal: decode((i.snippet && i.snippet.channelTitle) || ''), dur: (det[i.id.videoId] || {}).dur ?? null, live: !!(det[i.id.videoId] || {}).live }));
  }
  /* os resultados da consulta (do cache ou do YouTube). Erros: ocupado, buscas, cota, semchave, nada */
  async function lookup(c, role, text) {
    const q = fmNorm(text);
    if (q.length < 2) throw 'invalid';
    const hit = store.get('fm_cache/' + q);
    if (hit && Date.now() - hit.at < FM_CFG.cacheDays * 864e5) return { q, results: hit.results, cached: true };
    if (busy.has(role)) throw 'ocupado';
    const now = Date.now(), l = (searches.get(c.usuario) || []).filter(t => now - t < 3600e3);
    if (l.length >= FM_CFG.searchPerHour) throw 'buscas';
    if (quotaUsed() * 100 >= FM_CFG.quotaDay * FM_CFG.quotaWarnPct) throw 'cota';
    if (!env.FM_FAKE && !env.YOUTUBE_API_KEY) throw 'semchave';
    busy.add(role); l.push(now); searches.set(c.usuario, l);
    try {
      let raw;
      try { raw = await ytSearch(q); } catch (e) { if (e === 'cota') store.set(quotaKey(), { n: (store.get(quotaKey()) || {}).n + FM_CFG.searchCost || FM_CFG.searchCost }); throw e; }
      store.set(quotaKey(), { n: ((store.get(quotaKey()) || {}).n || 0) + FM_CFG.searchCost });
      const results = fmRank(raw).slice(0, 1 + FM_CFG.altCount).map(({ video, title, canal, dur }) => ({ video, title, canal, dur }));
      if (!results.length) throw 'nada';
      store.set('fm_cache/' + q, { at: Date.now(), results });
      return { q, results, cached: false };
    } finally { busy.delete(role); }
  }

  return {
    now: () => Date.now(),
    stats: () => ({ ...stats, quota: quotaUsed() }),

    /* /buscar: mostra os resultados, sem tocar */
    async search(c, role, text) {
      const p = papel(c, role);
      if (load(role).quem === 'djs' && !chefe(p)) throw 'djs';
      const r = await lookup(c, role, text);
      return { results: r.results, cached: r.cached };
    },

    state(c, role) {
      const p = papel(c, role), d = load(role);
      return { papel: p, quem: d.quem, priv: 'link', eu: c.usuario, now: Date.now(), np: d.np, queue: d.queue.map(({ id, video, title, thumb, dur, by }) => ({ id, video, title, thumb, dur, by })), djs: d.djs };
    },

    async add(c, role, input) {
      const p = papel(c, role);
      let id = fmVideoId(input), meta = null, extra = null;
      if (!id && fmIsLink(input)) throw 'link';
      if (load(role).quem === 'djs' && !chefe(p)) throw 'djs';
      const now = Date.now(), h = (hits.get(c.usuario) || []).filter(t => now - t < 60e3);
      if (h.length >= FM_CFG.perMinute) throw 'rapido';
      h.push(now); hits.set(c.usuario, h);
      if (!id) {   // texto: busca por nome; o primeiro resultado entra e o resto vira "Não era essa?"
        const r = await lookup(c, role, input);
        const [first, ...alts] = r.results;
        id = first.video; meta = { title: first.title.slice(0, 200) || 'Música sem título', dur: first.dur };
        extra = { q: r.q, alts: alts.slice(0, FM_CFG.altCount) };
      } else meta = await resolve(id);
      if (meta.dur != null && meta.dur > FM_CFG.maxDurS) throw 'longo';
      const d = load(role);   // de novo: a busca no YouTube pode ter demorado
      if (d.queue.length >= FM_CFG.maxQueue) throw 'fila_cheia';
      if (!chefe(p) && d.queue.filter(q => q.by === c.usuario).length >= FM_CFG.perUser) throw 'limite';
      const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      d.seq++;
      d.queue.push({ id: d.seq, video: id, title: meta.title, thumb, dur: meta.dur, by: c.usuario });
      const msg = bot(role, c, `@${c.usuario} colocou: ${meta.title}`, { k: 'colocou', video: id, title: meta.title, u: c.usuario, qid: d.seq, ...(extra || {}) });
      if (extra) { d.last = d.last || {}; d.last[c.usuario] = { qid: d.seq, alts: extra.alts, at: Date.now(), done: false }; }
      let tocando = false;
      if (d.np.status === 'parado') tocando = next(role, d, c); else touch(d);
      save(role, d);
      return { ok: true, tocando, pos: d.queue.length, title: meta.title, video: id, thumb, dur: meta.dur, alts: extra ? extra.alts : undefined, msg };
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
        case 'trocar': {   // "Não era essa?": troca a música recém-pedida pela alternativa idx (só quem pediu, em até 60 s)
          const l = d.last && d.last[c.usuario];
          if (!l || l.done || Date.now() - l.at > FM_CFG.swapS * 1000) throw 'tarde';
          const alt = l.alts[a.idx | 0];
          if (!alt) throw 'invalid';
          const q = d.queue.find(x => x.id === l.qid);
          const th = `https://i.ytimg.com/vi/${alt.video}/hqdefault.jpg`;
          if (q) Object.assign(q, { video: alt.video, title: alt.title, thumb: th, dur: alt.dur });
          else if (np.qid === l.qid && np.status !== 'parado') Object.assign(np, { video: alt.video, title: alt.title, thumb: th, dur: alt.dur, started: Date.now(), paused: null, status: 'tocando', version: np.version + 1 });
          else throw 'tarde';
          l.done = true; touch(d);
          bot(role, c, `@${c.usuario} trocou por: ${alt.title}`, { k: 'trocou', video: alt.video, title: alt.title, u: c.usuario });
          save(role, d);
          return { ok: true, title: alt.title };
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
