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

// Données réelles des membres : fichier privé, jamais versionné (voir .gitignore)
const seedPath = path.join(src, 'private', 'seed.json');
function readPrivate(name) { const f = path.join(src, 'private', name); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
const privateSeed = fs.existsSync(seedPath) ? JSON.parse(fs.readFileSync(seedPath, 'utf8')) : null;
if (!privateSeed) console.warn('Attention : src/private/seed.json absent — build sans données de membres.');

const js = ['/* UNIE-MUSO — application autonome hors ligne */', 'const EMBEDDED_LOGO = ' + JSON.stringify(logo) + ';',
  'const PRIVATE_SEED = ' + JSON.stringify(privateSeed) + ';',
  // Règles et paramètres de la mutuelle repris de la dernière sauvegarde du trésorier (fichiers privés)
  'const PRIVATE_RULES = ' + JSON.stringify(readPrivate('rules.json')) + ';',
  'const PRIVATE_SETTINGS = ' + JSON.stringify(readPrivate('settings.json')) + ';',
  // Configuration du projet Firebase (fichier privé) : active la version en ligne
  'const PRIVATE_FIREBASE = ' + JSON.stringify(readPrivate('firebase.json')) + ';']
  .concat(jsFiles.map((f) => '/* ---- ' + f + ' ---- */\n' + fs.readFileSync(path.join(src, 'js', f), 'utf8')))
  .join('\n');
// Le JS est enveloppé pour isoler la portée tout en gardant les fonctions globales utilisées par les attributs onclick
// Police Plus Jakarta Sans (licence OFL) embarquée en base64
const fontDir = path.join(root, 'assets', 'fonts');
const fonts = [400, 600, 700, 800].map((w) => {
  const f = path.join(fontDir, 'plus-jakarta-sans-latin-' + w + '-normal.woff2');
  return fs.existsSync(f) ? "@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:" + w + ";font-display:swap;src:url(data:font/woff2;base64," + fs.readFileSync(f).toString('base64') + ") format('woff2');}" : '';
}).join('\n');
// Kit Firebase (Apache-2.0) embarqué : l'application démarre même sans Internet
const vendorDir = path.join(root, 'vendor', 'firebase');
const vendor = readPrivate('firebase.json') ? ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']
  .map((f) => '<script>' + fs.readFileSync(path.join(vendorDir, f), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/\/\/# sourceMappingURL=.*$/gm, '') + '</script>').join('\n') : '';
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8')
  .split('__VENDOR__').join(vendor)
  .split('__FONTS__').join(fonts)
  .split('__CSS__').join(css)
  .split('__LOGO__').join(logo)
  .split('__JS__').join(js.replace(/<\/script/gi, '<\\/script'));

const file = path.join(out, 'UNIE-MUSO.html');
fs.writeFileSync(file, html);
console.log('UNIE-MUSO.html : ' + Math.round(html.length / 1024) + ' Ko (' + jsFiles.length + ' modules)');
