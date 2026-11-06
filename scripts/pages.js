#!/usr/bin/env node
/*
 * Monta dist-pages/ para o Cloudflare Pages: o app como index.html, mais os ícones de public/
 * e um _redirects para os links /r/<id>.
 *
 * Com SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY definidas (no ambiente do Pages ou no .env),
 * o app usa o Supabase como banco e sala ao vivo. Sem elas, cai no modo local (dados só no navegador).
 * A chave "publishable" é pública por desenho: quem protege os dados é o RLS de supabase/schema.sql.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist-pages');

try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (_) { /* sem .env */ }

const env = process.env;
const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
// servidores STUN/TURN do chat de voz (opcional). Ex.: [{"urls":"turn:turn.exemplo.com:3478","username":"u","credential":"s"}]
let ice;
try { ice = env.ICE_SERVERS_JSON ? JSON.parse(env.ICE_SERVERS_JSON) : undefined; } catch (_) { console.warn('[pages] ICE_SERVERS_JSON inválido, ignorando'); }

require('./build.js');
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, '_redirects'), '/r/* / 200\n');

let html = fs.readFileSync(path.join(env.ROLE_DIST ? path.resolve(env.ROLE_DIST) : path.join(ROOT, 'dist'), 'local.html'), 'utf8');
if (url && key) {
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'src', 'supabase', 'client.js')], outfile: path.join(OUT, 'role-supabase.js'),
    bundle: true, minify: true, format: 'iife', globalName: 'RoleSupabase', target: 'es2019', platform: 'browser', legalComments: 'none',
  });
  const cfg = JSON.stringify({ url, key, ice }).replace(/</g, '\u003c');
  const ver = require('crypto').createHash('md5').update(fs.readFileSync(path.join(OUT, 'role-supabase.js'))).digest('hex').slice(0, 10);   // muda a cada versão: o navegador e o Cloudflare não servem o arquivo velho
  html = html.replace('</head>', `<script>window.ROLE_SUPABASE=${cfg}</script><script src="/role-supabase.js?v=${ver}"></script></head>`);
  console.log('[pages] Supabase ligado em ' + url);
} else {
  console.log('[pages] sem SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY: modo local (dados só no navegador)');
}

// painel do dono (/admin): página à parte, com a própria senha (supabase/admin.sql). Fica fora do app: quem joga não baixa nada dele.
{
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'src', 'admin', 'admin.js')], outfile: path.join(OUT, 'admin.js'),
    bundle: true, minify: true, format: 'iife', target: 'es2019', platform: 'browser', legalComments: 'none',
  });
  const aver = require('crypto').createHash('md5').update(fs.readFileSync(path.join(OUT, 'admin.js'))).digest('hex').slice(0, 10);
  const acfg = url && key ? `<script>window.ADMIN_CFG=${JSON.stringify({ url, key }).replace(/</g, '\u003c')}</script>` : '';
  const ahtml = fs.readFileSync(path.join(ROOT, 'src', 'admin', 'admin.html'), 'utf8')
    .replace('<!--ADMIN_CFG-->', () => acfg).replace('<!--ADMIN_JS-->', () => `<script src="/admin.js?v=${aver}"></script>`);
  fs.writeFileSync(path.join(OUT, 'admin.html'), ahtml);
  const hdr = '  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n';
  fs.writeFileSync(path.join(OUT, '_headers'), '/admin\n' + hdr + '/admin.html\n' + hdr);
}
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('[pages] dist-pages/ pronto');
