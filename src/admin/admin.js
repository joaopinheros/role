/*
 * Painel do dono (/admin). Página à parte do app: não mexe no jogo e só carrega para quem abre este endereço.
 *   - os números vêm da função admin_painel (supabase/admin.sql), que só responde a navegadores liberados com a senha
 *   - quem está em cada sala agora vem da presença em tempo real: o painel só ESCUTA os canais, nunca entra como participante
 */
import { createClient } from '@supabase/supabase-js';

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CFG = window.ADMIN_CFG;
const DEMO = !CFG && /[?&]demo\b/.test(location.search);   // dados de mentira só para ver o desenho; o site publicado sempre leva a configuração
const MAX_CANAIS = 45;                                      // salas escutadas ao mesmo tempo (cada uma usa 2 canais)
const COR = { churrasco: '#ffe14d', festa: '#ff3d9a', pijama: '#7048ff', parque: '#4ee07a', boate: '#8a8a95', boteco: '#ff6a1a', piscina: '#4ee07a', vulcao: '#ff6a1a', templo: '#ff3d9a', praia: '#ffe14d', rooftop: '#7048ff' };

let sb = null, P = null, skew = 0, timer = 0, tick = 0, loading = false;
const canais = new Map();   // sala -> { sala: canal, voz: canal }
const pres = new Map();     // sala -> { gente: [], voz: [] }

const agora = () => Date.now() + skew;
function dur(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return h + 'h' + (r ? String(r).padStart(2, '0') : '');
}
const ha = ms => { const d = agora() - ms; return d < 45000 ? 'agora' : 'há ' + dur(d); };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
function toast(t) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, 3500); }

/* ---------- telas */
function ver(qual) {
  $('#login').hidden = qual !== 'login';
  $('#dash').hidden = qual !== 'dash';
  $('#top').hidden = qual !== 'dash';
  $('#semCfg').hidden = qual !== 'semcfg';
}

/* ---------- dados */
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw Object.assign(new Error(error.message), { code: /perm/.test(error.message) ? 'perm' : 'db' });
  return data;
}

async function carregar() {
  if (loading) return;
  loading = true;
  try {
    P = DEMO ? demoPainel() : await rpc('admin_painel');
    skew = P.agora - Date.now();
    sincronizarCanais();
    render();
    $('#dot').classList.remove('off');
  } catch (e) {
    if (e.code === 'perm') { parar(); ver('login'); $('#loginMsg').textContent = 'Sua entrada venceu. Digite a senha de novo.'; }
    else { $('#dot').classList.add('off'); $('#liveTxt').textContent = 'sem conexão com o banco, tentando de novo…'; }
  }
  loading = false;
}

/* ---------- presença em tempo real (só escuta) */
function ler(canal, voz) {
  const out = [];
  for (const [k, metas] of Object.entries(canal.presenceState())) {
    const m = metas[metas.length - 1] || {};
    if (voz) out.push({ k, u: m.u || '', mudo: !!m.m });
    else { const d = m.d || {}; out.push({ k, u: d.u || '', n: d.n || d.u || '?', j: d.j || 0 }); }
  }
  return out;
}
function escutar(nome, sala, voz) {
  const ch = sb.channel(nome, { config: { presence: { key: 'adm' + Math.random().toString(36).slice(2, 8) } } });
  ch.on('presence', { event: 'sync' }, () => {
    const p = pres.get(sala) || { gente: [], voz: [] };
    p[voz ? 'voz' : 'gente'] = ler(ch, voz);
    pres.set(sala, p);
    agendar();
  });
  ch.subscribe(() => agendar());
  return ch;
}
function sincronizarCanais() {
  if (DEMO) return;
  const ids = new Set(P.salas.slice(0, MAX_CANAIS).map(s => s.id));
  for (const [id, c] of [...canais]) if (!ids.has(id)) { sb.removeChannel(c.sala); sb.removeChannel(c.voz); canais.delete(id); pres.delete(id); }
  for (const id of ids) if (!canais.has(id)) canais.set(id, { sala: escutar('role-' + id, id, false), voz: escutar('voz:' + id, id, true) });
}
let rq = 0;
function agendar() { if (!rq) rq = setTimeout(() => { rq = 0; if (P) render(); }, 250); }

/* ---------- desenho */
function pessoas(id) { return (pres.get(id) || { gente: [] }).gente; }
function naVoz(id) { return (pres.get(id) || { voz: [] }).voz; }

function render() {
  const T = P.totais, salas = P.salas;
  const dentro = salas.reduce((n, s) => n + pessoas(s.id).length, 0);
  const comGente = salas.filter(s => pessoas(s.id).length).length;
  const naVozTotal = salas.reduce((n, s) => n + naVoz(s.id).length, 0);
  const subs = [...canais.values()].filter(c => c.sala.state === 'joined').length;
  const aovivo = DEMO || subs > 0 || !salas.length;
  $('#dot').classList.toggle('off', !aovivo);
  $('#liveTxt').textContent = (aovivo ? 'ao vivo' : 'conectando à presença…') + ' · dados de ' + new Date(P.agora).toLocaleTimeString('pt-BR');

  const tile = (k, n, s, cls = '') => `<div class="tile ${cls}"><div class="k">${k}</div><div class="n num">${n}</div><div class="s">${s}</div></div>`;
  $('#tiles').innerHTML =
    tile('Nas salas agora', dentro, `${comGente} ${comGente === 1 ? 'sala com gente' : 'salas com gente'} · ${naVozTotal} na voz`, 'main') +
    tile('Salas ativas', T.salas_ativas, `${T.salas_24h} criadas em 24 h · ${T.salas} no total`) +
    tile('No site (5 min)', T.vistos_5min, `${T.vistos_1h} na última hora`) +
    tile('Contas', T.contas, `+${T.contas_24h} em 24 h · ${T.visitantes} visitantes`) +
    tile('Músicas (24 h)', T.tocadas_24h, T.tocadas_24h ? `${pct(T.puladas_24h, T.tocadas_24h)}% puladas` : 'nenhuma ainda') +
    tile('Mensagens (24 h)', T.msgs_24h, 'só a contagem');

  /* salas: as mais cheias primeiro */
  const ord = [...salas].sort((a, b) => pessoas(b.id).length - pessoas(a.id).length || b.criada - a.criada);
  $('#roomsNote').textContent = salas.length > MAX_CANAIS ? `escutando as ${MAX_CANAIS} primeiras de ${salas.length}` : '';
  $('#rooms').innerHTML = ord.length ? ord.map(salaHtml).join('') : '<div class="box none">Nenhuma sala ativa agora.</div>';

  /* músicas */
  $('#top10').innerHTML = P.top.length
    ? `<table><tr><th>Música</th><th class="r">Vezes</th><th class="r">Até o fim</th></tr>${P.top.map(t => {
      const fim = 100 - pct(t.puladas, t.vezes);
      return `<tr><td class="t" title="${esc(t.titulo)}">${esc(t.titulo)}</td><td class="r num">${t.vezes}</td><td class="r num"><span class="pct">${fim}%</span><span class="mini"><i style="width:${fim}%"></i></span></td></tr>`;
    }).join('')}</table>`
    : '<div class="none">Ninguém tocou música nas últimas 24 horas.</div>';
  $('#feed').innerHTML = P.recentes.length
    ? P.recentes.map(r => `<li><span class="tick ${r.pulada ? 'skip' : ''}" title="${r.pulada ? 'pulada' : 'tocou'}">${r.pulada ? '✕' : '♪'}</span><span class="x" title="${esc(r.titulo)}">${esc(r.titulo)} <span class="w">· ${esc(r.sala)}</span></span><span class="w">${ha(r.em)}</span></li>`).join('')
    : '<li class="none">Sem histórico ainda.</li>';

  /* 7 dias */
  const serie = (nome, chave, cor) => {
    const max = Math.max(1, ...P.dias.map(d => d[chave]));
    return `<div class="box"><h3>${nome} <span class="num" style="color:var(--fg)">· ${P.dias.reduce((n, d) => n + d[chave], 0)} em 7 dias</span></h3><div class="spark" style="--c:${cor}">${
      P.dias.map(d => `<div title="${d.dia}: ${d[chave]}"><span class="num">${d[chave]}</span><i style="height:${Math.round((d[chave] / max) * 60)}px"></i><small>${d.dia.slice(0, 5)}</small></div>`).join('')}</div></div>`;
  };
  $('#days').innerHTML = serie('Contas novas', 'contas', 'var(--g)') + serie('Salas criadas', 'salas', 'var(--y)') + serie('Músicas tocadas', 'tocadas', 'var(--p)') + serie('Mensagens', 'msgs', 'var(--v)');

  $('#novas').innerHTML = P.contas_novas.length
    ? `<table><tr><th>Nome</th><th>Usuário</th><th>Tipo</th><th class="r">Entrou</th></tr>${P.contas_novas.map(c => `<tr><td>${esc(c.nome)}</td><td>@${esc(c.usuario)}</td><td>${c.visitante ? 'visitante' : 'conta'}</td><td class="r">${ha(c.em)}</td></tr>`).join('')}</table>`
    : '<div class="none">Ninguém entrou ainda.</div>';
  tique();
}

function salaHtml(s) {
  const gente = pessoas(s.id), voz = naVoz(s.id), max = s.max || 8;
  const vozSet = new Set(voz.map(v => v.u));
  const seats = Array.from({ length: max }, (_, i) => `<i class="${i < gente.length ? 'on' : ''}"></i>`).join('');
  const chips = gente.length
    ? [...gente].sort((a, b) => a.j - b.j).map(g => `<span class="chip ${vozSet.has(g.u) ? 'voz' : ''}" title="@${esc(g.u)}${vozSet.has(g.u) ? ' · na voz' : ''}"><span class="u">${esc(g.n)}</span>${g.j ? `<span class="t">${dur(agora() - g.j)}</span>` : ''}</span>`).join('')
    : `<span class="none">Ninguém dentro agora${s.membros > 1 ? ` (${s.membros} já entraram por convite)` : ''}.</span>`;
  const tp = s.tocando;
  let song = '<div class="song off">Sem música tocando</div>';
  if (tp) {
    const dr = (tp.dur || 0) * 1000, rodou = tp.status === 'pausado' ? (tp.pausa - tp.inicio) : (agora() - tp.inicio);
    const f = dr ? Math.min(100, Math.max(0, (rodou / dr) * 100)) : 0;
    song = `<div class="song"><div class="tt"><b title="${esc(tp.titulo)}">♪ ${esc(tp.titulo)}</b><span>${tp.status === 'pausado' ? 'pausada' : 'pedida por @' + esc(tp.por || '?')}</span></div><div class="bar"><i data-ini="${tp.inicio}" data-dur="${dr}" data-pausa="${tp.status === 'pausado' ? tp.pausa : 0}" style="width:${f}%"></i></div></div>`;
  }
  const ult = s.ultimas.length
    ? `<details><summary>Últimas músicas (${s.ultimas.length})</summary><ul>${s.ultimas.map(u => `<li><span class="tick ${u.pulada ? 'skip' : ''}">${u.pulada ? '✕' : '♪'}</span>${esc(u.titulo)} <span class="meta">${ha(u.em)}</span></li>`).join('')}</ul></details>`
    : '';
  return `<article class="room ${gente.length ? '' : 'empty'}" style="--cc:${COR[s.cena] || '#888'}">
    <div class="rh"><div style="min-width:0"><h3>${esc(s.nome)}</h3><div class="meta">${esc(s.cena)}${s.noite ? ' · noite' : ' · dia'}${s.privacidade === 'fechado' ? ' · fechada' : ''} · dono @${esc(s.dono)}</div></div>
      <div class="occ"><div class="big num">${gente.length}<small>/${max}</small></div><div class="seats">${seats}</div></div></div>
    <div class="chips">${chips}</div>
    ${song}
    <div class="stats"><span>aberta ${ha(s.criada)} · fecha em <b>${dur(s.expira - agora())}</b></span>${voz.length ? `<span><b>${voz.length}</b> na voz</span>` : ''}
      <span>fila <b class="num">${s.fila}</b></span><span>msgs 10 min <b class="num">${s.msgs_10min}</b></span>
      <span>tocadas <b class="num">${s.tocadas}</b>${s.tocadas ? ` · puladas <b class="num">${pct(s.puladas, s.tocadas)}%</b>` : ''}</span></div>
    ${ult}</article>`;
}

/* a barra da música anda sozinha, sem refazer a tela */
function tique() {
  document.querySelectorAll('.bar i[data-ini]').forEach(i => {
    const dr = +i.dataset.dur; if (!dr || +i.dataset.pausa) return;
    i.style.width = Math.min(100, Math.max(0, ((agora() - +i.dataset.ini) / dr) * 100)) + '%';
  });
}

/* ---------- entrada */
function parar() {
  clearInterval(timer); clearInterval(tick); timer = tick = 0;
  for (const c of canais.values()) { sb.removeChannel(c.sala); sb.removeChannel(c.voz); }
  canais.clear(); pres.clear(); P = null;
}
function iniciar() {
  ver('dash');
  carregar();
  timer = setInterval(() => { if (!document.hidden) { carregar(); } }, 10000);
  tick = setInterval(() => { if (P && !document.hidden) tique(); }, 1000);
}

$('#login').addEventListener('submit', async e => {
  e.preventDefault();
  const b = e.target.querySelector('button'), er = $('#loginErr');
  er.textContent = ''; b.disabled = true;
  try {
    const r = await rpc('admin_entrar', { p_senha: $('#pw').value });
    if (r && r.ok) { $('#pw').value = ''; iniciar(); }
    else er.textContent = { senha: 'Senha errada.', slow: 'Muitas tentativas erradas. Espere um pouco.', sem_senha: 'O painel ainda não tem senha. Defina uma no SQL Editor (veja supabase/admin.sql).', auth: 'Sem sessão no navegador. Recarregue a página.' }[r && r.err] || 'Não deu pra entrar.';
  } catch (x) { er.textContent = 'Não deu pra falar com o banco. Confira se rodou o supabase/admin.sql.'; }
  b.disabled = false;
});
$('#refresh').addEventListener('click', () => { carregar(); toast('Atualizado'); });
$('#out').addEventListener('click', async () => { parar(); try { await rpc('admin_sair'); } catch (_) {} $('#loginMsg').textContent = 'Você saiu do painel.'; ver('login'); });

(async function boot() {
  if (DEMO) { skew = 0; ver('dash'); P = demoPainel(); skew = P.agora - Date.now(); render(); $('#top').hidden = false; setInterval(() => { P = demoPainel(); render(); }, 5000); return; }
  if (!CFG) return ver('semcfg');
  sb = createClient(CFG.url, CFG.key);   // mesma chave de sessão do app: quem já abriu o site neste navegador continua com a mesma sessão
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { const r = await sb.auth.signInAnonymously(); if (r.error) throw r.error; }
    if (await rpc('admin_eu')) return iniciar();
  } catch (e) {
    ver('login'); $('#loginErr').textContent = 'Não deu pra falar com o banco. Confira se rodou o supabase/admin.sql.'; return;
  }
  ver('login');
})();

/* ---------- dados de mentira (só em ?demo, e só quando o site não tem Supabase) */
function demoPainel() {
  const t = Date.now(), min = 60000;
  const musicas = ['Tim Maia - Do Leme ao Pontal', 'Anitta - Envolver', 'Charlie Brown Jr. - Só os Loucos Sabem', 'Legião Urbana - Tempo Perdido', 'Matuê - Maria'];
  const salas = [['Churras do João', 'churrasco', 'joao', 5, 'Tim Maia - Do Leme ao Pontal'], ['Pijama das meninas', 'pijama', 'bia', 3, 'Anitta - Envolver'], ['Boate do Caio', 'boate', 'caio', 8, 'Matuê - Maria'], ['Praia de domingo', 'praia', 'ana', 0, null], ['Rooftop', 'rooftop', 'lu', 2, 'Legião Urbana - Tempo Perdido']];
  const nomes = ['João', 'Bia', 'Caio', 'Ana', 'Lu', 'Davi', 'Marina', 'Pedro'];
  const out = {
    agora: t, horas: 8,
    totais: { contas: 214, visitantes: 198, contas_24h: 37, vistos_5min: 21, vistos_1h: 46, salas: 63, salas_24h: 12, salas_ativas: salas.length, msgs_24h: 640, tocadas_24h: 88, puladas_24h: 19 },
    salas: salas.map((s, i) => ({
      id: 'demo' + i, nome: s[0], cena: s[1], noite: i % 2 === 0, max: 8, privacidade: i === 4 ? 'fechado' : 'link', dono: s[2], dono_nome: s[2], criada: t - (i + 1) * 47 * min, expira: t + (8 - (i + 1) * 0.8) * 60 * min,
      membros: s[3] + 1, msgs_10min: 3 * (i + 1), msgs_total: 40 * (i + 1),
      tocando: s[4] ? { status: i === 1 ? 'pausado' : 'tocando', titulo: s[4], dur: 210, inicio: t - (40 + i * 30) * 1000, pausa: i === 1 ? t - 10000 : 0, por: nomes[(i + 2) % 8].toLowerCase() } : null,
      fila: i, tocadas: 10 + i * 4, puladas: i * 2,
      ultimas: s[4] ? [{ titulo: musicas[(i + 1) % 5], em: t - 4 * min, pulada: false }, { titulo: musicas[(i + 2) % 5], em: t - 9 * min, pulada: true }] : [],
    })),
    top: musicas.map((m, i) => ({ titulo: m, vezes: 20 - i * 3, puladas: i * 2, salas: 5 - i })),
    recentes: musicas.map((m, i) => ({ titulo: m, em: t - (i + 1) * 3 * min, pulada: i === 2, sala: salas[i][0] })),
    dias: ['31/10', '01/11', '02/11', '03/11', '04/11', '05/11', '06/11'].map((d, i) => ({ dia: d, contas: 8 + i * 5 % 17, salas: 3 + i % 5, msgs: 90 + i * 37 % 120, tocadas: 20 + i * 11 % 40 })),
    contas_novas: nomes.slice(0, 6).map((n, i) => ({ nome: n, usuario: n.toLowerCase() + (i ? i * 7 : ''), visitante: i !== 3, em: t - (i + 1) * 6 * min })),
  };
  // presença de mentira
  salas.forEach((s, i) => { pres.set('demo' + i, { gente: Array.from({ length: s[3] }, (_, k) => ({ k: 'k' + k, u: nomes[k % 8].toLowerCase(), n: nomes[k % 8], j: t - (k + 1) * 7 * min })), voz: Array.from({ length: Math.min(2, s[3]) }, (_, k) => ({ k: 'v' + k, u: nomes[k % 8].toLowerCase(), mudo: false })) }); });
  return out;
}
