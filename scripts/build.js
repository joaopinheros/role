#!/usr/bin/env node
/*
 * Monta o Rolê a partir de src/ em três saídas:
 *   dist/index.html     página completa para o servidor próprio (SEO, PWA, JS minificado)
 *   dist/artifact.html  versão de arquivo único para publicar como artifact no claude.ai
 *   dist/local.html     versão que abre direto do disco (file://), dados só no navegador
 * Uso: node scripts/build.js [--watch] [--no-minify]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = process.env.ROLE_DIST ? path.resolve(process.env.ROLE_DIST) : path.join(ROOT, 'dist');   // ROLE_DIST: outra pasta de saída (os testes usam)

const ENGINE = ['core.js', 'body.js', 'hair.js', 'items.js', 'render.js', 'poolsim.js', 'truco.js', 'damas.js', 'domino.js', 'fmcore.js'];
const APP = ['adapter.js', 'icons.js', 'music.js', 'scenes.js', 'props2.js', 'catalog.js', 'pets.js', 'games.js', 'pool.js', 'chess.js', 'cards.js', 'truco.js', 'damas.js', 'domino.js', 'memoria.js', 'pesca.js', 'volei.js', 'lava.js', 'telescopio.js', 'npcs.js', 'props3.js', 'backdrops.js', 'fm.js', 'fmvisual.js', 'net.js', 'app.js'];

const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const MINIFY = !args.includes('--no-minify');

let esbuild = null;
try { esbuild = require('esbuild'); } catch (_) { /* sem esbuild: sai sem minificar */ }

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

/* chess.js (regras do xadrez) embutido: vira globalThis.__Chess. Sem esbuild, o xadrez só não aparece. */
function chessBundle() {
  if (!esbuild) return '';
  return esbuild.buildSync({
    stdin: { contents: "import { Chess } from 'chess.js'; globalThis.__Chess = Chess;", resolveDir: ROOT, loader: 'js' },
    bundle: true, write: false, minify: true, format: 'iife', target: 'es2020', legalComments: 'none',
  }).outputFiles[0].text;
}

/* Todos os arquivos dividem um escopo só: uma função com o mesmo nome em dois arquivos sobrescreve a outra sem erro
 * (foi assim que as bolas da sinuca ficaram brancas). Aqui só avisa; a contagem de chaves é simples e pode errar. */
function warnDuplicates(files) {
  const seen = new Map();
  for (const [name, src] of files) {
    let depth = 0;
    for (const ln of src.split('\n')) {
      if (depth === 0) {
        for (const m of ln.matchAll(/(?:^|[;}\s])function\s+([A-Za-z_$][\w$]*)\s*\(/g)) seen.set(m[1], [...(seen.get(m[1]) || []), name]);
        const d = /^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/.exec(ln);
        if (d) seen.set(d[1], [...(seen.get(d[1]) || []), name]);
      }
      for (const ch of ln) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    }
  }
  for (const [n, l] of seen) if (l.length > 1) console.warn(`[build] atenção: "${n}" aparece em ${l.join(' e ')} (o último vence)`);
}

function bundleScript() {
  const files = [...ENGINE.map(f => ['engine/' + f, read(SRC, 'engine', f).replace(/if\(typeof module[^\n]*\n?/g, '')]), ...APP.map(f => ['app/' + f, read(SRC, 'app', f)])];
  warnDuplicates(files);
  const engine = files.filter(([n]) => n.startsWith('engine/')).map(([, s]) => s).join('\n');
  const app = files.filter(([n]) => n.startsWith('app/')).map(([, s]) => s).join('\n');
  return '\n' + chessBundle() + "\n(function(){\nconst $=s=>document.querySelector(s);\nconst RM=matchMedia('(prefers-reduced-motion: reduce)').matches;\n" +
    engine + '\n' + app + '\n})();\n';
}

/* src/index.html = <title> + meta + <!--FONTS--> + <style> + marcação + <script> */
function splitPage(html) {
  const styleStart = html.indexOf('<style>');
  const styleEnd = html.indexOf('</style>') + '</style>'.length;
  const scriptAt = html.lastIndexOf('<script>');
  return {
    style: html.slice(styleStart, styleEnd),
    markup: html.slice(styleEnd, scriptAt).trim(),
  };
}

function minify(js) {
  if (!MINIFY || !esbuild) return js;
  return esbuild.transformSync(js, { minify: true, target: 'es2020', legalComments: 'none' }).code;
}

const NOSCRIPT = '<noscript><div style="padding:24px;font:16px system-ui;color:#fff"><h1>Rolê</h1>' +
  '<p>Crie o rolê, escolha o lugar e mande o link. Cada convite vira uma sala em pixel art com avatar, chat, pets e som.</p>' +
  '<p>Ative o JavaScript para entrar.</p></div></noscript>';

function build() {
  const t0 = Date.now();
  const page = read(SRC, 'index.html');
  const fonts = '<style>' + read(SRC, 'fonts.css') + '</style>';
  const script = bundleScript();
  fs.mkdirSync(DIST, { recursive: true });

  // 1) artifact do claude.ai (mesmo formato de sempre: o claude.ai envolve no documento)
  const artifact = page.replace('<!--FONTS-->', fonts) + script + '</script>\n';
  fs.writeFileSync(path.join(DIST, 'artifact.html'), artifact);

  // 2) arquivo local (file://): documento completo, sem servidor
  fs.writeFileSync(path.join(DIST, 'local.html'),
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' +
    artifact + '</body></html>');

  // 3) web: head com SEO/PWA, JS minificado, servidor preenche <!--SEO-->
  const { style, markup } = splitPage(page);
  const web = [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<!--SEO-->',
    '<meta name="theme-color" content="#241452">',
    '<meta name="color-scheme" content="light dark">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="Rolê">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="format-detection" content="telephone=no">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="icon" href="/icon.svg" type="image/svg+xml">',
    '<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<script>window.ROLE_SERVER=1</script>',
    fonts,
    style,
    '</head>',
    '<body>',
    markup,
    NOSCRIPT,
    '<script>' + minify(script) + '</script>',
    '</body>',
    '</html>',
  ].join('\n');
  fs.writeFileSync(path.join(DIST, 'index.html'), web);

  // checagem de sintaxe barata
  new Function(script); // eslint-disable-line no-new-func
  const kb = n => (n / 1024).toFixed(0) + ' KB';
  console.log(`[build] ok em ${Date.now() - t0}ms · index.html ${kb(web.length)} · artifact.html ${kb(artifact.length)}${MINIFY && !esbuild ? ' · (sem esbuild: JS não minificado)' : ''}`);
}

function safeBuild() {
  try { build(); } catch (e) { console.error('[build] falhou:', e.message); if (!WATCH) process.exit(1); }
}

safeBuild();

if (WATCH) {
  let t = null;
  const again = () => { clearTimeout(t); t = setTimeout(safeBuild, 120); };
  const watchDir = dir => {
    fs.watch(dir, again);
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) if (d.isDirectory()) watchDir(path.join(dir, d.name));
  };
  watchDir(SRC);
  console.log('[build] observando src/ …');
}

module.exports = { build };
