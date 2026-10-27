#!/usr/bin/env node
/* Gera os PNGs de ícone e a imagem de prévia (og.png) a partir do build. Requer playwright. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const PUB = path.join(__dirname, '..', 'public');
const DIST = path.join(__dirname, '..', 'dist');
(async () => {
  const b = await chromium.launch();
  const svg = fs.readFileSync(path.join(PUB, 'icon.svg'), 'utf8');
  for (const [n, s] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180], ['favicon-32.png', 32]]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<style>html,body{margin:0}svg{width:${s}px;height:${s}px;display:block}</style>${svg}`);
    await p.screenshot({ path: path.join(PUB, n) });
    await p.close();
  }
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto('file://' + path.join(DIST, 'local.html'));
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.__role.show('churrasco', false, .5));
  await p.waitForTimeout(1500);
  await p.addStyleTag({ content: `.og{position:fixed;left:56px;bottom:56px;z-index:99;font-family:Anybody;color:#ff3d8b;font-stretch:150%;font-weight:900;font-size:120px;line-height:.8;text-shadow:6px 6px 0 #000;-webkit-text-stroke:3px #000}
    .og small{display:block;margin-top:22px;font:800 34px 'Atkinson Hyperlegible Next';color:#000;background:#ffd23f;border:4px solid #000;box-shadow:6px 6px 0 #000;padding:10px 18px;-webkit-text-stroke:0;text-shadow:none;width:max-content;border-radius:12px}` });
  await p.evaluate(() => { const d = document.createElement('div'); d.className = 'og'; d.innerHTML = 'Rolê<small>O convite vira uma sala</small>'; document.body.append(d); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(PUB, 'og.png') });
  await b.close();
  console.log('[assets] ícones e og.png gerados em public/');
})();
