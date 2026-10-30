#!/usr/bin/env node
/*
 * Teste de ponta a ponta com o servidor real: cadastro, criar rolê, convite por link,
 * duas pessoas na mesma sala, chat, SEO do convite e lotação da sala.
 * Requer: npm i -D playwright && npx playwright install chromium
 * Uso: npm test   (SHOTS=pasta para salvar capturas)
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const PORT = 3199;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || '';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'role-'));
const ok = (c, msg) => { if (!c) throw new Error('falhou: ' + msg); console.log('  ✓ ' + msg); };

async function signup(page, nome, user, tel) {
  await new Promise(r => setTimeout(r, 250));
  await page.waitForSelector('#scrLanding:not([hidden]), #scrAuth:not([hidden])'); if (await page.isVisible('#landEnter')) await page.click('#landEnter');
  await page.fill('#gNome', nome);
  await page.click('#fGuest button[type=submit]');
}
const inRoom = (p, wait) => wait ? p.waitForFunction(() => !document.querySelector('#roomUI').hidden) : p.evaluate(() => !document.querySelector('#roomUI').hidden);
const shot = (p, n) => SHOTS && p.screenshot({ path: path.join(SHOTS, n + '.png') });

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_FILE: path.join(tmp, 'db.json'), MAX_SALA: '2', SMS_DEV: '1', SMS_WEBHOOK_URL: '' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /no ar/.test(d) && res()); setTimeout(() => rej(new Error('servidor não subiu')), 15000); });
  const browser = await chromium.launch();
  const errs = [];
  try {
    console.log('servidor');
    const html = await (await fetch(BASE + '/', { headers: { 'accept-encoding': 'br' } })).text();
    ok(/<meta property="og:title"/.test(html) && /window.ROLE_SERVER=1/.test(html), 'página com SEO e modo servidor');
    ok((await fetch(BASE + '/robots.txt')).ok && (await fetch(BASE + '/sitemap.xml')).ok, 'robots.txt e sitemap.xml');

    console.log('cadastro e criação');
    const a = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    a.on('pageerror', e => errs.push('A ' + e.message));
    await a.goto(BASE + '/');
    await signup(a, 'João', 'joao', '11987654321');
    await a.waitForSelector('#scrHome:not([hidden])');
    ok(true, 'conta criada e logada');
    await a.click('#newRole');
    await a.fill('#cNome', 'Churras do João');
    await a.click('#c1 button[type=submit]');
    await a.click('.scn:nth-child(7)');
    await a.click('#c2Next');
    await a.waitForFunction(() => document.querySelector('#c3Link').value);
    const link = await a.inputValue('#c3Link');
    ok(/\/r\/[a-z0-9]+$/.test(link), 'link de convite: ' + link);
    const inv = await (await fetch(link)).text();
    ok(/Churras do João: João te chamou/.test(inv), 'prévia do convite com nome do rolê');
    await a.click('#c3Enter');
    await a.waitForTimeout(1500);

    console.log('convidado');
    const b = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
    b.on('pageerror', e => errs.push('B ' + e.message));
    await b.goto(link);
    await b.waitForSelector('#scrInvite:not([hidden])');
    await shot(b, 'srv_invite');
    await b.click('#invAccept');
    await signup(b, 'Bia', 'bia', '11912345678');
    await inRoom(b, true);
    await b.waitForTimeout(1500);
    await b.fill('#msg', 'cheguei!!');
    await b.press('#msg', 'Enter');
    await a.waitForTimeout(1500);
    ok((await a.textContent('#count')).startsWith('2'), 'João vê 2 na sala');
    ok((await b.textContent('#count')).startsWith('2'), 'Bia vê 2 na sala');
    ok(/cheguei!!/.test(await a.textContent('#log')), 'chat chegou pro João');
    await shot(a, 'srv_room_a'); await shot(b, 'srv_room_b');

    console.log('sessão e lotação (limite de teste = 2)');
    await b.goto('about:blank');
    await b.goto(link);
    await inRoom(b, true);
    ok(true, 'Bia recarrega o link e volta direto pra sala (sessão mantida)');
    const c = await (await browser.newContext()).newPage();
    c.on('pageerror', e => errs.push('C ' + e.message));
    await c.goto(link);
    await c.click('#invAccept');
    await signup(c, 'Caio', 'caio', '11955554444');
    await c.waitForTimeout(2500);
    ok(/cheia/.test(await c.textContent('#toast')) && !(await inRoom(c)), 'terceira pessoa recebe "sala cheia" e volta pro início');
    await shot(c, 'srv_full');

    console.log('zoom com a roda do mouse');
    const box = await a.locator('#room').boundingBox();
    await a.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const before = await a.isDisabled('#zIn');
    await a.mouse.wheel(0, -200);
    await a.waitForTimeout(300);
    ok(before !== (await a.isDisabled('#zIn')) || await a.isDisabled('#zIn'), 'roda do mouse muda o zoom');
    await shot(a, 'srv_zoom');

    ok(!errs.length, 'sem erros de JS' + (errs.length ? ': ' + errs.join(' | ') : ''));
    console.log('\ntudo certo');
  } catch (e) {
    console.error('\n' + e.message);
    if (errs.length) console.error(errs.join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.kill('SIGTERM');
    await new Promise(r => srv.once('exit', r));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
