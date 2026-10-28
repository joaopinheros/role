// Rolê FM: confere um link do YouTube (ou busca por nome) e põe a música na fila da sala.
//
// Publicar (escolha um):
//   * Painel: Supabase > Edge Functions > Deploy a new function > Via Editor, nome "music-resolve", cole este arquivo.
//     Depois, em Details da função, desligue "Verify JWT with legacy secret" (o login é conferido aqui dentro).
//   * Terminal: supabase functions deploy music-resolve --no-verify-jwt
// Segredos (Edge Functions > Secrets):
//   YOUTUBE_API_KEY   opcional para links (traz a duração e recusa lives); OBRIGATÓRIA para a busca por nome.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem em toda Edge Function.
//
// Pedidos (POST, com o login do app no Authorization):
//   { role, link }              põe o vídeo do link na fila
//   { role, q }                 busca por nome: o 1º resultado entra na fila (as alternativas vão junto na mensagem do bot)
//   { role, q, mode: "search" } só mostra os 5 resultados, sem tocar
// Resposta: { ok, tocando, pos, title, video, thumb, dur, alts? } | { results } | { error: "<código>" }
//   códigos: auth, invalid, link, embed, notfound, live, longo, nada, semchave, perm, privada, closed, djs, fila_cheia,
//            limite, rapido, ocupado, buscas, cota, server
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json' } });
const KNOWN = ['auth', 'perm', 'privada', 'closed', 'djs', 'fila_cheia', 'limite', 'rapido', 'longo', 'invalid', 'ocupado', 'buscas', 'cota'];
const MAX_DUR_S = 15 * 60, SEARCH_COST = 101, ALTS = 4;

/* mesmas regras de src/engine/fmcore.js (fmVideoId, fmIsoDur, fmNorm, fmRank) */
function videoId(raw: unknown): string | null {
  let s = String(raw ?? '').trim();
  if (!s || s.length > 300) return null;
  if (!/^[a-z]+:\/\//i.test(s)) s = 'https://' + s;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else { const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname); if (m) id = m[2]; }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
const isLink = (s: unknown) => /^(https?:\/\/)?([a-z0-9-]+\.)*(youtube\.com|youtu\.be)(\/|$)/i.test(String(s ?? '').trim());
function isoDur(s: unknown): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(s ?? ''));
  return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : null;
}
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 100);
type Item = { video: string; title: string; canal: string; dur: number | null; live?: boolean };
const OFFICIAL = /official|oficial|clipe|[aá]udio|lyric/i;
function rank(items: Item[]): Item[] {
  return items.filter(x => x.video && !x.live && !((x.dur ?? 0) > MAX_DUR_S) && x.dur !== 0)
    .map((x, i) => ({ x, k: i - (OFFICIAL.test(x.title) ? 1.5 : 0) })).sort((a, b) => a.k - b.k).map(o => o.x);
}
const decode = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/* YouTube Data API: search.list (100 unidades) + videos.list das 5 respostas numa chamada só (1 unidade) */
async function ytSearch(q: string, key: string): Promise<Item[]> {
  const u = new URL('https://www.googleapis.com/youtube/v3/search');
  Object.entries({ part: 'snippet', type: 'video', videoEmbeddable: 'true', videoCategoryId: '10', regionCode: 'BR', relevanceLanguage: 'pt',
    safeSearch: 'moderate', maxResults: '5', q, key }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  if (r.status === 403 || r.status === 429) throw 'cota';
  if (!r.ok) throw 'server';
  const items = (await r.json()).items || [];
  const ids = items.map((i: { id?: { videoId?: string } }) => i.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const d = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${ids.join(',')}&key=${key}`);
  const det: Record<string, { dur: number | null; live: boolean }> = {};
  if (d.ok) for (const v of (await d.json()).items || []) det[v.id] = { dur: isoDur(v.contentDetails?.duration), live: !!v.snippet?.liveBroadcastContent && v.snippet.liveBroadcastContent !== 'none' };
  return items.map((i: { id: { videoId: string }; snippet?: { title?: string; channelTitle?: string } }) =>
    ({ video: i.id.videoId, title: decode(i.snippet?.title || ''), canal: decode(i.snippet?.channelTitle || ''), dur: det[i.id.videoId]?.dur ?? null, live: det[i.id.videoId]?.live }));
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'invalid' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // quem pediu: o login (anônimo) do Supabase que o app usa; a sessão do Rolê é ligada a ele no banco
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !who?.user) return json({ error: 'auth' }, 401);

  let body: { role?: string; link?: string; q?: string; mode?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid' }, 400); }
  const role = String(body.role || '');
  if (!/^[a-z0-9]{6,16}$/.test(role)) return json({ error: 'invalid' }, 400);
  // aceita o segredo mesmo com espaço sobrando no nome ou no valor; se não achar, o log mostra os nomes que a função enxerga
  const envAll = Deno.env.toObject();
  const ykName = Object.keys(envAll).find(k => k.trim().toUpperCase() === 'YOUTUBE_API_KEY');
  let yk = ykName ? envAll[ykName].trim() || undefined : undefined;
  if (!yk) {   // plano B: a chave também pode ficar em app_config (key 'youtube_api_key'), que só a chave de serviço lê
    const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'youtube_api_key').maybeSingle();
    yk = String(cfg?.value ?? '').trim() || undefined;
  }
  if (!yk && (body.q != null || body.link != null)) console.warn('YOUTUBE_API_KEY vazia. Variáveis visíveis:', Object.keys(envAll).join(', '));
  const dbError = (error: { message: string }) => {
    const code = KNOWN.find(k => error.message === k || error.message.endsWith(': ' + k));
    if (!code) console.error('rpc', error);
    return json({ error: code || 'server' });
  };

  try {
    /* ---------- busca por nome (/music nome, /buscar nome) ---------- */
    const text = body.q != null ? String(body.q) : (body.link != null && !isLink(body.link) && !videoId(body.link) ? String(body.link) : null);
    if (text != null) {
      const q = norm(text);
      if (q.length < 2) return json({ error: 'invalid' });
      const begin = await admin.rpc('fm_search_begin', { p_auth: who.user.id, p_role: role, p_q: q });
      if (begin.error) return dbError(begin.error);
      let results: Item[] | null = begin.data?.cache ?? null;
      if (!results) {   // o banco já travou a sala; daqui para baixo, sempre solta (fm_search_save)
        let units = 0;
        try {
          if (!yk) throw 'semchave';
          units = SEARCH_COST;
          results = rank(await ytSearch(q, yk)).slice(0, 1 + ALTS).map(({ video, title, canal, dur }) => ({ video, title, canal, dur }));
          if (!results.length) { results = null; throw 'nada'; }
        } catch (e) {
          await admin.rpc('fm_search_save', { p_role: role, p_q: q, p_res: null, p_units: e === 'cota' ? SEARCH_COST : units });
          if (typeof e === 'string') return json({ error: e });
          throw e;
        }
        await admin.rpc('fm_search_save', { p_role: role, p_q: q, p_res: results, p_units: units });
      }
      if (body.mode === 'search') return json({ results });
      const [first, ...alts] = results!;
      const thumb = `https://i.ytimg.com/vi/${first.video}/hqdefault.jpg`;
      const { data, error } = await admin.rpc('fm_add', { p_auth: who.user.id, p_role: role, p_video: first.video, p_title: first.title.slice(0, 200) || 'Música sem título',
        p_thumb: thumb, p_dur: first.dur, p_extra: { q, alts: alts.slice(0, ALTS) } });
      if (error) return dbError(error);
      return json({ ...data, video: first.video, title: first.title, thumb, dur: first.dur, alts: alts.slice(0, ALTS) });
    }

    /* ---------- link ---------- */
    const id = videoId(body.link);
    if (!id) return json({ error: 'link' });
    // oEmbed: confirma que o vídeo existe e pode tocar fora do YouTube (sem chave, sem cota)
    const oe = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (oe.status === 401 || oe.status === 403) return json({ error: 'embed' });
    if (!oe.ok) return json({ error: 'notfound' });
    const o = await oe.json();
    const title = String(o.title || '').trim().slice(0, 200) || 'Música sem título';
    const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

    // duração (e lives) pela YouTube Data API, se houver chave: videos.list custa 1 unidade da cota
    let dur: number | null = null;
    if (yk) {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,status&id=${id}&key=${yk}`);
      if (r.ok) {
        const it = (await r.json()).items?.[0];
        if (!it) return json({ error: 'notfound' });
        if (it.snippet?.liveBroadcastContent && it.snippet.liveBroadcastContent !== 'none') return json({ error: 'live' });
        if (it.status?.embeddable === false) return json({ error: 'embed' });
        dur = isoDur(it.contentDetails?.duration);
        if (dur === 0) return json({ error: 'live' });
      }
    }
    const { data, error } = await admin.rpc('fm_add', { p_auth: who.user.id, p_role: role, p_video: id, p_title: title, p_thumb: thumb, p_dur: dur });
    if (error) return dbError(error);
    return json({ ...data, video: id, title, thumb, dur });
  } catch (e) {
    console.error('music-resolve', e);
    return json({ error: 'server' });
  }
});
