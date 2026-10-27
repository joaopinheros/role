#!/usr/bin/env node
/* Desenvolvimento: remonta a página quando algo em src/ muda e reinicia o servidor quando server/ muda. */
const { spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

const build = fork(path.join(__dirname, 'build.js'), ['--watch', '--no-minify']);
let srv = null, t = null;
function start() {
  if (srv) srv.kill();
  srv = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } });
}
fs.watch(path.join(ROOT, 'server'), () => { clearTimeout(t); t = setTimeout(start, 200); });
setTimeout(start, 400);
console.log('[dev] abra http://localhost:' + (process.env.PORT || 3000) + '  (o navegador precisa recarregar depois de cada mudança)');
const stop = () => { build.kill(); if (srv) srv.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
