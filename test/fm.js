#!/usr/bin/env node
/*
 * Rolê FM de ponta a ponta, com o servidor Node real (FM_FAKE=1: sem rede) e o player do YouTube simulado
 * (window.YT de mentira, que anda no tempo). As capas vêm de uma imagem local.
 * Uso: node test/fm.js   (SHOTS=pasta para salvar capturas; ROLE_DIST=pasta do build, se não for dist/)
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const PORT = 3195, BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || '';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'role-fm-'));
const tag = Math.random().toString(36).slice(2, 6);
const rnd = n => String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failed++; return c; };
const shot = (p, n) => SHOTS && p.screenshot({ path: path.join(SHOTS, n + '.png') });
const waitFor = async (fn, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (_) { /* página mudando */ } await sleep(150); } return null; };
const errs = [];
const DESK = { width: 1280, height: 800 }, PHONE = { width: 390, height: 844 };
const THUMB = fs.readFileSync(path.join(__dirname, '..', 'public', 'og.png'));

/* o player do YouTube de mentira: mesma interface que o app usa */
const YT_STUB = `(() => {
  class Player {
    constructor(el, o) {
      const box = typeof el === 'string' ? document.getElementById(el) : el, d = document.createElement('div');
      d.id = box.id; d.className = 'yt-stub'; d.style.cssText = 'width:200px;height:200px;background:linear-gradient(135deg,#c4302b,#282828);color:#fff;font:700 12px sans-serif;display:flex;align-items:center;justify-content:center';
      box.replaceWith(d); this.d = d; this.o = o; this.vid = o.videoId; this.t = (o.playerVars && o.playerVars.start) || 0; this.at = 0; this.state = -1; this.muted = false; this.vol = 100;
      window.__ytPlayers = (window.__ytPlayers || 0) + 1;
      setTimeout(() => { o.events.onReady && o.events.onReady({ target: this }); if (o.playerVars && o.playerVars.autoplay) this.playVideo(); }, 50);
      this.timer = setInterval(() => this.d.textContent = 'YT ' + this.vid + ' ' + this.getCurrentTime().toFixed(0) + 's', 250);
    }
    getCurrentTime() { return this.state === 1 ? this.t + (Date.now() - this.at) / 1000 : this.t; }
    playVideo() { if (this.state !== 1) { this.at = Date.now(); this.state = 1; this.ev(1); } }
    pauseVideo() { if (this.state === 1) { this.t = this.getCurrentTime(); this.state = 2; this.ev(2); } }
    stopVideo() { this.t = 0; this.state = 5; }
    seekTo(s) { this.t = s; this.at = Date.now(); }
    loadVideoById(a) { this.vid = a.videoId; this.t = a.startSeconds || 0; this.at = Date.now(); this.state = 1; this.ev(1); }
    getDuration() { return 25; }
    getPlayerState() { return this.state; }
    mute() { this.muted = true; } unMute() { this.muted = false; } isMuted() { return this.muted; }
    setVolume(v) { this.vol = v; }
    destroy() { clearInterval(this.timer); this.d.remove(); }
    ev(s) { this.o.events.onStateChange && this.o.events.onStateChange({ data: s, target: this }); }
  }
  window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
  window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();
})();`;

async function newPage(browser, name, view) {
  const ctx = await browser.newContext({ viewport: view || DESK, hasTouch: view === PHONE, isMobile: view === PHONE });
  await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: YT_STUB }));
  await ctx.route('https://i.ytimg.com/**', r => r.fulfill({ contentType: 'image/png', body: THUMB, headers: { 'access-control-allow-origin': '*' } }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name + ' ' + e.message));
  return p;
}
async function signup(page, nome, user) {
  await page.fill('#suNome', nome); await page.fill('#suUser', user);
  await page.fill('#suEmail', user + '@exemplo.com'); await page.fill('#suTel', '119' + rnd(8));
  await sleep(120);   // dá tempo de os campos formatarem o que foi preenchido antes de enviar
  await page.click('#fSignup button[type=submit]');
  await page.waitForSelector('#smsText:not(:empty)');
  await page.fill('#vCode', (await page.textContent('#smsText')).match(/\d{4}/)[0]);
}
const inRoom = p => p.waitForFunction(() => !document.querySelector('#roomUI').hidden, null, { timeout: 20000 });
const fm = p => p.evaluate(() => window.__role.fm());
const say = async (p, t) => { await p.fill('#msg', t); await p.press('#msg', 'Enter'); };
const logHas = (p, re) => p.evaluate(src => [...document.querySelectorAll('#log > div')].some(d => new RegExp(src).test(d.textContent)), re.source);
const V = n => 'video' + String(n).padStart(6, '0');   // 11 caracteres
const link = n => 'https://youtu.be/' + V(n);

async function room(browser, sceneNth, who, viewB) {
  const a = await newPage(browser, 'A');
  await a.goto(BASE + '/');
  await signup(a, 'Ana ' + tag, who + 'a' + tag);
  await a.waitForSelector('#scrHome:not([hidden])');
  await a.click('#newRole'); await a.fill('#cNome', 'FM ' + tag); await a.click('#c1 button[type=submit]');
  await a.click(`.scn:nth-child(${sceneNth})`); await a.click('#c2Next');
  await a.waitForFunction(() => document.querySelector('#c3Link').value);
  const url = await a.inputValue('#c3Link');
  await a.click('#c3Enter'); await inRoom(a);
  const join = async (name, nome, user, view) => {
    const p = await newPage(browser, name, view);
    await p.goto(url);
    await p.waitForFunction(() => document.querySelector('#invName').textContent.trim() !== '…');
    await p.click('#invAccept'); await signup(p, nome, user); await inRoom(p);
    return p;
  };
  const b = await join('B', 'Bia ' + tag, who + 'b' + tag, viewB);
  await waitFor(async () => (await fm(a)).ok && (await fm(b)).ok, 8000);
  return { a, b, join, ua: who + 'a' + tag, ub: who + 'b' + tag };
}

async function principal(browser) {
  console.log('\nRolê FM (festa em casa)');
  const { a, b, join, ub } = await room(browser, 2, 'f');
  ok((await fm(a)).papel === 'dono' && (await fm(b)).papel === 'membro', 'A é a dona, B é convidado');
  ok(await a.isVisible('#rFm'), 'o botão "Ouvir junto" aparece');

  // o convidado põe música: toca na hora, e os dois veem o bot
  await say(b, '/music ' + link(1));
  ok(!!await waitFor(async () => (await fm(a)).video === V(1) && (await fm(b)).status === 'tocando', 8000), 'o convidado põe uma música e ela toca na hora para os dois');
  ok(!!await waitFor(() => logHas(a, /colocou/), 5000) && !!await waitFor(() => logHas(b, /Tocando agora/), 5000), 'os dois veem as mensagens do bot ("colocou" e "Tocando agora")');
  await say(b, '/skip');
  ok(!!await waitFor(() => logHas(b, /Só o dono ou os DJs/), 3000), 'o convidado tenta /skip e recebe a recusa');
  ok((await fm(a)).video === V(1), 'e a música continua');
  for (const n of [2, 3, 4]) { await say(b, '/music ' + link(n)); await sleep(500); }
  ok(!!await waitFor(async () => (await fm(a)).fila.length === 3, 5000), 'três músicas do convidado esperando na fila');
  await say(b, '/music ' + link(5));
  ok(!!await waitFor(() => logHas(b, /já tem 3 músicas na fila/), 4000), 'a 4ª esperando: aviso de limite');
  ok((await fm(a)).fila.length === 3, 'e ela não entrou');
  await say(a, '/music ' + 'https://youtu.be/bloq0000001');
  ok(!!await waitFor(() => logHas(a, /não deixa tocar fora do YouTube/), 4000), 'vídeo que não deixa incorporar é recusado');

  // a dona dá DJ e agora o /skip funciona
  await say(a, '/dj @' + ub);
  ok(!!await waitFor(async () => (await fm(b)).papel === 'dj', 5000), 'a dona faz o convidado DJ');
  const v0 = (await fm(a)).version;
  await say(b, '/skip');
  ok(!!await waitFor(async () => (await fm(a)).video === V(2), 5000), 'agora o /skip do convidado funciona');
  ok(!!await waitFor(() => logHas(a, /pulou a música/), 4000), 'o bot avisa quem pulou');

  // computador: o dirigível no céu, com a capa; "Ouvir junto" toca no player e pausa o house
  ok(!!await waitFor(async () => (await fm(a)).visual.ceu, 45000), 'o dirigível aparece no céu (computador)');
  ok(!!await waitFor(async () => (await fm(a)).capa, 5000), 'a capa da música foi carregada');
  await a.click('#rSom');
  ok((await fm(a)).house, 'a dona liga o house da sala');
  await a.click('#rFm');
  ok(!!await waitFor(async () => { const f = await fm(a); return f.ytReady && f.yt && f.yt.vid === f.video; }, 8000), '"Ouvir junto": o player carrega a música da sala');
  ok(!(await fm(a)).house, 'o house pausa sozinho enquanto ouve');
  const box = await a.locator('#fmBox').boundingBox();
  ok(box && box.width >= 200 && (await a.locator('#fmYT').boundingBox()).height >= 200, 'o player fica visível com pelo menos 200x200');
  await waitFor(async () => (await fm(a)).visual.ceu, 45000);
  await shot(a, 'fm_dirigivel_noite');

  // compare-and-swap: dois /skip juntos avançam uma música só
  let f = await fm(a);
  const ver = f.version, fila = f.fila.length;
  await Promise.all([say(a, '/skip'), say(b, '/skip')]);
  await sleep(1500);
  f = await fm(a);
  ok(f.version === ver + 1 && f.fila.length === fila - 1, `dois /skip juntos: avança só uma (versão ${ver} → ${f.version}, fila ${fila} → ${f.fila.length})`);
  ok(!!await waitFor(async () => (await fm(b)).version === f.version, 4000), 'e os dois concordam na versão');

  // quem entra no meio começa na posição certa
  await sleep(4000);
  const c = await join('C', 'Caio ' + tag, 'fc' + tag);
  await waitFor(async () => (await fm(c)).ok, 6000);
  await c.click('#rFm');
  const fc = await waitFor(async () => { const x = await fm(c); return x.ytReady && x.yt && x.yt.state === 1 && x; }, 8000);
  const fa = await fm(a);
  ok(fc && Math.abs(fc.yt.t - fa.pos) <= 2, `quem entra no meio começa no mesmo ponto (C ${fc && fc.yt.t}s, sala ${fa.pos}s)`);

  // pausa e volta para todo mundo
  await say(b, '/pause');
  ok(!!await waitFor(async () => (await fm(a)).status === 'pausado' && (await fm(c)).yt.state === 2, 5000), '/pause pausa para todo mundo (inclusive o player de quem ouve)');
  const p1 = (await fm(a)).pos; await sleep(1500);
  ok(Math.abs((await fm(a)).pos - p1) < .2, 'pausada, a posição não anda');
  await say(b, '/play');
  ok(!!await waitFor(async () => (await fm(c)).yt.state === 1, 5000), '/play solta de novo');

  // /fila, /tocando, /tirar e autocompletar
  await say(c, '/tocando');
  ok(!!await waitFor(() => logHas(c, /Tocando: /), 3000), '/tocando mostra o que toca e o tempo (só para quem pediu)');
  ok(!(await logHas(a, /Tocando: /)), 'e os outros não veem');
  await c.fill('#msg', '/');
  ok(await c.isVisible('#fmHint') && !(await c.textContent('#fmHint')).includes('/skip'), 'digitar "/" mostra os comandos que a pessoa pode usar (convidado não vê /skip)');
  await c.fill('#msg', '');

  // a música acaba sozinha e a próxima entra
  const vNow = (await fm(a)).video;
  ok(!!await waitFor(async () => (await fm(a)).video !== vNow, 40000), 'a música acaba e a próxima entra sozinha');

  // fila vazia: o house volta
  await say(a, '/limpar');
  await sleep(800);
  await say(a, '/skip');
  ok(!!await waitFor(async () => (await fm(a)).status === 'parado', 5000), 'fila vazia: para de tocar');
  ok(!!await waitFor(() => logHas(b, /Fila vazia/), 4000), 'o bot avisa que o som da sala voltou');
  ok(!!await waitFor(async () => (await fm(a)).house, 4000), 'e o house volta para quem estava ouvindo');
  ok(!(await a.isVisible('#fmBox')), 'sem música, o player some');
  await Promise.all([a, b, c].map(p => p.context().close()));
}

/* busca por nome: /music nome, "Não era essa?", cache, /buscar, cota */
async function busca(browser) {
  console.log('\nRolê FM: busca por nome');
  const { a, b, ub } = await room(browser, 2, 'b');
  const cards = p => p.evaluate(() => [...document.querySelectorAll('#log .fmcard')].map(c => c.textContent));
  const stats = p => p.evaluate(() => window.__role.fmStats());

  await say(b, '/music Ai, Se Eu Te Pego!');
  ok(!!await waitFor(async () => { const f = await fm(b); return f.status === 'tocando' && /resultado 1/.test(f.title || ''); }, 8000), '"/music ai se eu te pego" toca o primeiro resultado');
  const cs = await waitFor(async () => { const l = await cards(b); return l.length ? l : null; }, 5000);
  ok(cs && cs.length === 3 && cs.some(t => /Clipe Oficial/.test(t)), 'aparecem 3 alternativas em "Não era essa?" (sem a live e sem o vídeo de 1 hora): ' + (cs && cs.length));
  ok(!(await cards(a)).length, 'e só quem pediu vê as alternativas');
  ok((await b.textContent('#log')).includes('Não era essa?'), 'com o título "Não era essa?"');
  await shot(b, 'fm_busca_alternativas');
  const antes = (await stats(b)).api;
  ok(antes === 2, 'a busca gastou 2 chamadas ao YouTube (search.list + videos.list): ' + antes);

  // trocar pela alternativa: o clipe oficial
  const v1 = (await fm(a)).version;
  await b.locator('#log .fmcard', { hasText: 'Clipe Oficial' }).click();
  ok(!!await waitFor(async () => { const f = await fm(a); return /Clipe Oficial/.test(f.title || '') && f.version === v1 + 1; }, 6000), 'tocar numa alternativa troca a música para todo mundo');
  ok((await cards(b)).length === 0, 'e os cartões somem');
  ok(!!await waitFor(() => logHas(a, /trocou por/), 4000), 'o bot avisa a troca');

  // a mesma busca de novo (por outra pessoa, escrita diferente): cache, sem chamar o YouTube
  await say(a, '/music  ai se eu te PEGO');
  ok(!!await waitFor(async () => (await fm(a)).fila.length === 1, 6000), 'a mesma busca, escrita de outro jeito, entra na fila');
  ok((await stats(a)).api === antes, 'e não chamou o YouTube de novo (cache)');

  // /buscar: só para quem pediu, sem tocar
  const fila0 = (await fm(a)).fila.length;
  await say(b, '/buscar pagode da sexta');
  const rs = await waitFor(async () => { const l = await cards(b); return l.length ? l : null; }, 6000);
  ok(rs && rs.length === 4 && rs.every(t => /Pôr na fila/.test(t)), '/buscar mostra os resultados com "Pôr na fila": ' + (rs && rs.length));
  ok(!(await a.textContent('#log')).includes('Resultados (só você vê)') && (await fm(a)).fila.length === fila0, 'só para quem pediu, e nada entrou na fila');
  await shot(b, 'fm_buscar');
  await b.locator('#log .fmcard').first().click();
  ok(!!await waitFor(async () => (await fm(a)).fila.length === fila0 + 1, 5000), '"Pôr na fila" põe o resultado na fila');

  // cota: com 90% usados, a busca por nome pausa e o link continua valendo
  await b.evaluate(() => window.__role.fmFake(0.95));
  await say(a, '/music uma musica totalmente nova');
  ok(!!await waitFor(() => logHas(a, /limite de hoje\. Cola o link/), 5000), 'com a cota em 90%: "A busca por nome está no limite de hoje. Cola o link que funciona."');
  await say(a, '/music ' + link(33));
  ok(!!await waitFor(async () => (await fm(a)).fila.some(v => v === V(33)), 5000), 'mas o link continua funcionando');
  await say(a, '/music ai se eu te pego');
  ok(!!await waitFor(async () => (await fm(a)).fila.length >= fila0 + 3, 5000), 'e o que já está no cache também (sem gastar cota)');
  await b.evaluate(() => window.__role.fmFake(0));
  await Promise.all([a, b].map(p => p.context().close()));
}

/* celular: o palco com telão e paredão de caixas; capturas de dia e de noite em dois cenários */
async function visual(browser, sceneNth, nome) {
  console.log(`\nvisual (${nome})`);
  const { a, b } = await room(browser, sceneNth, 'v' + sceneNth, PHONE);
  await say(a, '/music ' + link(7));
  ok(!!await waitFor(async () => (await fm(b)).status === 'tocando', 8000), 'música tocando');
  ok((await fm(b)).mobile, 'o celular usa o visual de celular');
  ok(!!await waitFor(async () => { await b.evaluate(() => window.__role.lookStage && window.__role.lookStage()); return (await fm(b)).visual.palco; }, 8000), 'o palco aparece no cenário');
  ok(!!await waitFor(async () => (await fm(b)).capa, 5000), 'com a capa no telão');
  await sleep(600); await shot(b, `fm_palco_${nome}_noite`);
  ok(!!await waitFor(async () => (await fm(a)).visual.ceu, 45000), 'no computador, o dirigível');
  await shot(a, `fm_dirigivel_${nome}_noite`);
  await a.click('#rDay');   // a dona muda para dia
  await sleep(1500);
  await b.evaluate(() => window.__role.lookStage && window.__role.lookStage()); await sleep(400);
  await shot(b, `fm_palco_${nome}_dia`);
  await waitFor(async () => (await fm(a)).visual.ceu, 45000); await sleep(200);
  await shot(a, `fm_dirigivel_${nome}_dia`);
  // custo: o trabalho total do navegador (TaskDuration) por quadro, com o Rolê FM ligado e desligado, na mesma página,
  // numa CPU 4x mais lenta. A diferença é o custo do Rolê FM (medir por dentro das funções engana: o canvas adia os desenhos).
  const cdp = await b.context().newCDPSession(b);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Performance.enable');
  const frames = () => b.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
  const task = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'TaskDuration').value;
  const medir = async hide => { await b.evaluate(h => window.__role.fmHide(h), hide); await sleep(500); const t0 = await task(), n = await frames(), t1 = await task(); return (t1 - t0) * 1000 / n; };
  const on = [], off = [];
  for (let i = 0; i < 3; i++) { on.push(await medir(false)); off.push(await medir(true)); }
  const med = l => l.sort((x, y) => x - y)[1];
  const custo = med(on) - med(off);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await b.evaluate(() => window.__role.fmHide(false));
  ok(custo < 2.5, `Rolê FM custa ${custo.toFixed(2)} ms por quadro no celular com a CPU 4x mais lenta (ligado ${med(on).toFixed(2)} ms, desligado ${med(off).toFixed(2)} ms; meta: menos de 2,5 ms nessa CPU lenta, uns 0,5 ms numa máquina normal)`);
  await Promise.all([a, b].map(p => p.context().close()));
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_FILE: path.join(tmp, 'db.json'), SMS_DEV: '1', SMS_WEBHOOK_URL: '', AUTH_LIMIT: '500', FM_FAKE: '1', FM_FAKE_DUR: '25' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /no ar/.test(d) && res()); setTimeout(() => rej(new Error('servidor não subiu')), 15000); });
  const browser = await chromium.launch();
  try {
    const which = process.argv[2] || 'todos';
    if (which === 'todos' || which === 'principal') await principal(browser);
    if (which === 'todos' || which === 'busca') await busca(browser);
    if (which === 'todos' || which === 'visual') { await visual(browser, 2, 'festa'); await visual(browser, 10, 'praia'); }
    ok(!errs.length, 'sem erros de JS' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  } catch (e) { console.error('\n' + e.stack); failed++; }
  finally {
    await browser.close(); srv.kill('SIGTERM'); await new Promise(r => srv.once('exit', r));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} falha(s)` : '\ntudo certo');
  process.exit(failed ? 1 : 0);
})();
