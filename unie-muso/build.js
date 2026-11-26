'use strict';
/* Assemble UNIE-MUSO.html : un seul fichier autonome (CSS + JS + logo embarqués). */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const src = path.join(root, 'src');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });

const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const jsFiles = fs.readdirSync(path.join(src, 'js')).filter((f) => f.endsWith('.js')).sort();
const logoPath = path.join(root, 'assets', 'logo.jpg');
const logo = fs.existsSync(logoPath) ? 'data:image/jpeg;base64,' + fs.readFileSync(logoPath).toString('base64') : '';

const js = ['/* UNIE-MUSO — application autonome hors ligne */', 'const EMBEDDED_LOGO = ' + JSON.stringify(logo) + ';']
  .concat(jsFiles.map((f) => '/* ---- ' + f + ' ---- */\n' + fs.readFileSync(path.join(src, 'js', f), 'utf8')))
  .join('\n');
// Le JS est enveloppé pour isoler la portée tout en gardant les fonctions globales utilisées par les attributs onclick
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8')
  .split('__CSS__').join(css)
  .split('__LOGO__').join(logo)
  .split('__JS__').join(js.replace(/<\/script/gi, '<\\/script'));

const file = path.join(out, 'UNIE-MUSO.html');
fs.writeFileSync(file, html);
console.log('UNIE-MUSO.html : ' + Math.round(html.length / 1024) + ' Ko (' + jsFiles.length + ' modules)');
