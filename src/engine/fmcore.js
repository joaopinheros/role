/*
 * Rolê FM: as regras puras (sem tela, sem rede), usadas pelo app, pelo servidor Node e pelos testes.
 * - fmVideoId(texto): o id de 11 caracteres de um link do YouTube (ou null)
 * - fmParse(texto): o comando do chat ({ cmd, arg }) ou null se não for comando
 * - fmPos(tocando, agoraServidor): em que segundo a música está (congelada na pausa)
 * - fmCan(papel, ação, sala): quem pode o quê (dono, dj, membro)
 * - fmOffset(medidas): diferença entre o relógio daqui e o do servidor
 * Os números ajustáveis ficam em FM_CFG (o servidor usa os mesmos).
 */
const FM_CFG = {
  maxDurS: 15 * 60,     // vídeo de até 15 min
  maxQueue: 30,         // itens na fila da sala
  perUser: 3,           // músicas esperando por pessoa (dono e DJs não têm limite)
  perMinute: 5,         // /music por minuto por pessoa
  driftEveryMs: 30000,  // de quanto em quanto tempo confere se o player desviou
  driftMaxS: 2,         // desvio que faz pular para a posição certa
  endSlackS: 3,         // folga para aceitar "acabou" (relógios e carregamento)
  searchPerHour: 10,    // buscas por nome no YouTube por pessoa por hora (as que já estão no cache não contam)
  quotaDay: 10000,      // cota diária gratuita da YouTube Data API (unidades; zera à meia-noite do Pacífico)
  quotaWarnPct: 90,     // a partir daqui a busca por nome é pausada e só links valem
  searchCost: 101,      // search.list (100) + videos.list (1)
  cacheDays: 30,        // quanto tempo uma busca fica no cache
  altCount: 4,          // alternativas mostradas em "Não era essa?"
  swapS: 60,            // tempo para trocar a música recém-pedida por uma alternativa
};

const FM_ID = /^[A-Za-z0-9_-]{11}$/;

/* aceita youtube.com/watch?v=, m.youtube.com, music.youtube.com, youtu.be/, /shorts/, /embed/, /live/; com ou sem https:// */
function fmVideoId(s) {
  s = String(s || '').trim();
  if (!s || s.length > 300) return null;
  if (!/^[a-z]+:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch (_) { return null; }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else { const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname); if (m) id = m[2]; }
  }
  return id && FM_ID.test(id) ? id : null;
}
const fmIsLink = s => /^(https?:\/\/)?([a-z0-9-]+\.)*(youtube\.com|youtu\.be)(\/|$)/i.test(String(s || '').trim());

const FM_CMDS = {
  music: 'music', m: 'music', skip: 'skip', pular: 'skip', pause: 'pause', pausar: 'pause', play: 'play',
  fila: 'fila', tocando: 'tocando', limpar: 'limpar', tirar: 'tirar',
  fm: 'ajuda', ajuda: 'ajuda',
};
/* lista para o autocompletar: [comando, uso, quem pode] */
const FM_HELP = [
  ['music', '/music <link ou nome>', 'add'], ['fila', '/fila', 'ver'], ['tocando', '/tocando', 'ver'],
  ['tirar', '/tirar', 'ver'], ['skip', '/skip', 'dj'], ['pause', '/pause', 'dj'], ['play', '/play', 'dj'], ['limpar', '/limpar', 'dj'],
];

/* "/music https://…" → { cmd: 'music', arg: 'https://…' }; texto comum → null; "/xyz" → { cmd: '?', name: 'xyz' } */
function fmParse(t) {
  const m = /^\/([a-zA-ZÀ-ú]+)(?:\s+([\s\S]*))?$/.exec(String(t || '').trim());
  if (!m) return null;
  const name = m[1].toLowerCase(), cmd = FM_CMDS[name], arg = (m[2] || '').trim();
  if (!cmd) return { cmd: '?', name, arg };
  if (cmd === 'tirar') return { cmd, arg: arg ? Math.max(0, parseInt(arg, 10) || 0) : 0 };
  return { cmd, arg };
}

/* segundos desde o começo da música; np = { status, started (ms), paused (ms|null) } */
function fmPos(np, serverNow) {
  if (!np || np.status === 'parado' || !np.started) return 0;
  const end = np.status === 'pausado' && np.paused ? np.paused : serverNow;
  return Math.max(0, (end - np.started) / 1000);
}

/* papel: 'dono' | 'dj' | 'membro'; sala: { quem: 'todos' | 'djs', priv: 'link' | 'fechado' | outra } */
const fmPrivate = sala => !sala || sala.priv === 'link' || sala.priv === 'fechado';
function fmCan(papel, acao, sala) {
  if (!papel || !fmPrivate(sala)) return false;
  const chefe = papel === 'dono' || papel === 'dj';
  switch (acao) {
    case 'add': return chefe || !sala || sala.quem !== 'djs';
    case 'ver': case 'tirarMinha': return true;
    case 'skip': case 'pause': case 'play': case 'limpar': case 'tirarQualquer': case 'duracao': return chefe;
    case 'dj': case 'undj': return papel === 'dono';
    default: return false;
  }
}
/* quantas músicas a pessoa ainda pode pôr na fila */
function fmRoomFor(queue, user, papel) {
  if (papel === 'dono' || papel === 'dj') return Infinity;
  return Math.max(0, FM_CFG.perUser - queue.filter(q => q.by === user).length);
}

/* medidas: [{ t0, t1, server }] (t0/t1 = relógio local antes e depois da pergunta). Média descontando metade da ida e volta. */
function fmOffset(ms) {
  const ok = ms.filter(x => x && isFinite(x.server) && x.t1 >= x.t0);
  if (!ok.length) return 0;
  return ok.reduce((s, x) => s + (x.server - (x.t0 + x.t1) / 2), 0) / ok.length;
}

/* consulta normalizada (chave do cache): minúsculas, sem acento, sem pontuação, espaços únicos */
const fmNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 100);

/* resultados da busca: tira o que passa de maxDurS e as transmissões ao vivo; em ranking apertado, "official", "clipe"
 * ou "áudio" no título sobe uma posição. Cada item: { video, title, canal, dur, live } na ordem do YouTube. */
const FM_OFFICIAL = /official|oficial|clipe|[aá]udio|lyric/i;
function fmRank(items) {
  return (items || []).filter(x => x && x.video && !x.live && !(x.dur > FM_CFG.maxDurS) && x.dur !== 0)
    .map((x, i) => ({ x, k: i - (FM_OFFICIAL.test(x.title || '') ? 1.5 : 0) }))
    .sort((a, b) => a.k - b.k).map(o => o.x);
}
/* o "dia" da cota do Google: o calendário do fuso do Pacífico */
const fmQuotaDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const fmThumb = id => 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';

const fmClock = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* "PT1H2M3S" → 3723 */
function fmIsoDur(s) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(s || ''));
  if (!m) return null;
  return ((+m[1] || 0) * 86400) + ((+m[2] || 0) * 3600) + ((+m[3] || 0) * 60) + (+m[4] || 0);
}

if (typeof module !== 'undefined') module.exports = { FM_CFG, FM_HELP, fmVideoId, fmIsLink, fmParse, fmPos, fmPrivate, fmCan, fmRoomFor, fmOffset, fmClock, fmIsoDur, fmNorm, fmRank, fmThumb, fmQuotaDay };
