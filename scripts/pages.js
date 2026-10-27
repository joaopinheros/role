#!/usr/bin/env node
/*
 * Monta dist-pages/ para o Cloudflare Pages: o app em modo local (sem servidor)
 * como index.html, mais os ícones de public/ e um _redirects para os links /r/<id>.
 * Só serve para demonstrar o visual: os dados ficam no navegador de cada pessoa.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist-pages');

require('./build.js');
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'dist', 'local.html'), path.join(OUT, 'index.html'));
fs.writeFileSync(path.join(OUT, '_redirects'), '/r/* /index.html 200\n');
console.log('[pages] dist-pages/ pronto');
