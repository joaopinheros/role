#!/usr/bin/env node
/* Desenvolvimento: remonta a página quando algo em src/ muda e reinicia o servidor quando server/ muda.
 * Se o próprio scripts/build.js mudar (por exemplo, um arquivo novo entrou na lista), o "watch" é reiniciado:
 * senão ele continuaria montando a página com a lista antiga, sem os arquivos novos. */
const { spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

let build = null, srv = null, t = null, tb = null;
function startBuild() {
  if (build) build.kill();
  build = fork(path.join(__dirname, 'build.js'), ['--watch', '--no-minify']);
}
function start() {
  if (srv) srv.kill();
  srv = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } });
}
startBuild();
fs.watch(path.join(ROOT, 'server'), () => { clearTimeout(t); t = setTimeout(start, 200); });
fs.watch(__dirname, (ev, f) => { if (f === 'build.js') { clearTimeout(tb); tb = setTimeout(() => { console.log('[dev] build.js mudou: reiniciando o watch'); startBuild(); }, 300); } });
setTimeout(start, 400);
console.log('[dev] abra http://localhost:' + (process.env.PORT || 3000) + '  (o navegador precisa recarregar depois de cada mudança)');
const stop = () => { if (build) build.kill(); if (srv) srv.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
