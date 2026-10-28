// Rolê FM: confere um link do YouTube e põe a música na fila da sala.
//
// Publicar (escolha um):
//   * Painel: Supabase > Edge Functions > Deploy a new function > Via Editor, nome "music-resolve", cole este arquivo.
//     Depois, em Details da função, desligue "Verify JWT with legacy secret" (o login é conferido aqui dentro).
//   * Terminal: supabase functions deploy music-resolve --no-verify-jwt
// Segredos (Edge Functions > Secrets):
//   YOUTUBE_API_KEY   opcional. Com ela vem a duração, e lives e vídeos bloqueados são recusados antes.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem em toda Edge Function.
//
// Pedido:  POST { role: "<id da sala>", link: "<link do YouTube>" }   (com o login do app no Authorization)
// Resposta: { ok, tocando, pos, title, video, thumb, dur }  ou  { error: "<código>" }
//   códigos: auth, invalid, link, embed, notfound, live, longo, perm, privada, closed, djs, fila_cheia, limite, rapido, server
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json' } });
const KNOWN = ['auth', 'perm', 'privada', 'closed', 'djs', 'fila_cheia', 'limite', 'rapido', 'longo', 'invalid'];

/* mesmas regras de src/engine/fmcore.js (fmVideoId e fmIsoDur) */
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
function isoDur(s: unknown): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(s ?? ''));
  return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : null;
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

  let body: { role?: string; link?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid' }, 400); }
  const role = String(body.role || '');
  if (!/^[a-z0-9]{6,16}$/.test(role)) return json({ error: 'invalid' }, 400);
  const id = videoId(body.link);
  if (!id) return json({ error: 'link' });

  try {
    // oEmbed: confirma que o vídeo existe e pode tocar fora do YouTube (sem chave, sem cota)
    const oe = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (oe.status === 401 || oe.status === 403) return json({ error: 'embed' });
    if (!oe.ok) return json({ error: 'notfound' });
    const o = await oe.json();
    const title = String(o.title || '').trim().slice(0, 200) || 'Música sem título';
    const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

    // duração (e lives) pela YouTube Data API, se houver chave: videos.list custa 1 unidade da cota
    let dur: number | null = null;
    const yk = Deno.env.get('YOUTUBE_API_KEY');
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
    if (error) {
      const code = KNOWN.find(k => error.message === k || error.message.endsWith(': ' + k));
      if (!code) console.error('fm_add', error);
      return json({ error: code || 'server' });
    }
    return json({ ...data, video: id, title, thumb, dur });
  } catch (e) {
    console.error('music-resolve', e);
    return json({ error: 'server' });
  }
});
