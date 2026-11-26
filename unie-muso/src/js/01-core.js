'use strict';
/* =========================================================================
   UNIE-MUSO — noyau : stockage, données de départ, utilitaires
   ========================================================================= */
const APP_VERSION = '3.0.0';
const KEYS = {
  db: 'uniemuso-data-v2',
  users: 'uniemuso-users-v1',
  rules: 'uniemuso-rules-v1',
  grille: 'uniemuso-grille-v1',
  settings: 'uniemuso-settings-v1',
  docs: 'uniemuso-docs-v1',
  session: 'uniemuso-session-v1',
};

/* ---------- Données de départ (uniquement les informations connues) ---------- */
function seedMember(code, nom, prenom, extra) {
  return Object.assign({
    code, nom, prenom, nif: '', date_adhesion: '', telephone: '', adresse: '', email: '',
    statut: 'Actif', photo: '', portal_password: code.toLowerCase(), can_see_documents: true,
    is_comite: false, comite_poste: '', comite_see_demandes: true, comite_see_compta: true,
    comite_see_reports: true, date_naissance: '', profession: '',
  }, extra || {});
}
/* Données de départ. Les vraies données des membres (noms, cotisations, amendes, prêts) ne sont PAS dans
   le code source public : build.js les injecte depuis src/private/seed.json (exclu de Git) sous PRIVATE_SEED. */
const GENERIC_SEED = {
  members: Array.from({ length: 19 }, (_, i) => seedMember('M' + String(i + 1).padStart(3, '0'), '', '')),
  cotisations: [], amendes_paid: [], depenses: [], prets: [], absences: [], demandes_pret: [], transferts: [],
};
const SEED_DATA = (typeof PRIVATE_SEED !== 'undefined' && PRIVATE_SEED) ? PRIVATE_SEED : GENERIC_SEED;
const DEFAULT_USERS = {
  admin: { pwd: 'admin', role: 'admin', fullname: 'PATRICE MICHELET R. LEONARDO', position: 'Trésorier', member_code: 'M011' },
  caissier: { pwd: 'caissier', role: 'caissier', fullname: 'Caissier', position: 'Caissier' },
};
/* Montants des amendes : Règlement interne UNIE-MUSO (modifiables par le trésorier dans Paramètres)
   Absence non motivée 50 HTG · retard non motivé 25 HTG (chap. IV art. 4 et résolutions)
   Cotisation mensuelle en retard 50 HTG (chap. II art. 5) · frais de recherche 250 HTG (chap. II art. 4)
   Carnet perdu 500 HTG / abîmé 250 HTG (résolutions) · pénalité prêt 2 % du capital en arriéré par mois (chap. VI art. 41) */
const DEFAULT_RULES = {
  cot_verte: 2000, cot_rouge: 50, frais_inscription: 1000,
  amende_absence: 50, amende_retard_reunion: 25, amende_cot_retard: 50,
  frais_recherche: 250, carnet_perdu: 500, carnet_abime: 250,
  penalite_pret_pct: 2,
  mutuelle_start: '2026-04-01', nb_cotisations_attendues: 7, fiscal_start: '2026-10-01',
  // anciens paramètres en pourcentage, conservés pour compatibilité des sauvegardes
  amende_absence_pct: 10, amende_retard_pct: 5,
};
const AMENDE_TYPES = [
  { v: 'absence', l: 'Absence non motivée', key: 'amende_absence' },
  { v: 'retard_reunion', l: 'Retard à la réunion', key: 'amende_retard_reunion' },
  { v: 'cotisation', l: 'Cotisation en retard', key: 'amende_cot_retard' },
  { v: 'recherche', l: 'Frais de recherche (dépôt non prouvé)', key: 'frais_recherche' },
  { v: 'carnet_perdu', l: 'Carnet perdu', key: 'carnet_perdu' },
  { v: 'carnet_abime', l: 'Carnet sale ou déchiré', key: 'carnet_abime' },
  { v: 'autre', l: 'Autre', key: null },
];
/* Anciennes règles en pourcentage → montants fixes du règlement interne */
function migrateRules(r) {
  const out = Object.assign(clone(DEFAULT_RULES), r || {});
  if (r && r.amende_absence === undefined) out.penalite_pret_pct = DEFAULT_RULES.penalite_pret_pct;
  return out;
}
/* Grille d'évaluation de demande de crédit UNIE-MUSO (document officiel) :
   1. Régularité aux 5 dernières rencontres ......... 20 pts (représenté −0,5 · retard −1 · absence −2)
   2. Régularité des cotisations, 5 derniers mois ... 30 pts (−3 par mois en retard)
   3. Historique des 3 derniers prêts (5 derniers mois) 3 × 10 pts (−2 par mois en retard)
   4. Appréciation du comité ....................... 20 pts (moyenne des notes des membres du comité) */
const DEFAULT_GRILLE = {
  seuils: [
    { min: 0, max: 50, eligible: false, mult: 1, label: 'Refusé', regle: 'Équivalent des cotisations mensuelles du membre' },
    { min: 51, max: 60, eligible: true, mult: 1.5, label: 'Passable', regle: '1,5 fois les cotisations mensuelles à jour' },
    { min: 61, max: 70, eligible: true, mult: 2, label: 'Assez bien', regle: '2 fois les cotisations mensuelles à jour' },
    { min: 71, max: 89, eligible: true, mult: 2.5, label: 'Bien', regle: '2,5 fois les cotisations mensuelles à jour' },
    { min: 90, max: 100, eligible: true, mult: 3, label: 'Excellent', regle: '3 fois les cotisations mensuelles à jour' },
  ],
  pts_presence: 20, pts_cotisation: 30, pts_credit: 10, pts_comite: 20,
  nb_reunions: 5, nb_mois_cot: 5, nb_mois_credit: 5, nb_credits: 3,
  ded_represente: 0.5, ded_retard: 1, ded_absence: 2, ded_cot_mois: 3, ded_credit_mois: 2,
};
const DEFAULT_SETTINGS = {
  lang: 'fr',
  logo: '',
  alarmes: [
    { min: 270, on: true, label: '4h30 avant' },
    { min: 120, on: true, label: '2h avant' },
    { min: 0, on: true, label: 'À l’heure' },
  ],
  meeting_hour: '17:00',
  sign_presidente: 'Mme VALLON Rose Abigail',
  sign_tresorier: 'PATRICE MICHELET RICHEMOND LEONARDO',
  notif_asked: false,
};

/* ---------- Stockage ---------- */
const store = {
  get(k, fallback) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : clone(fallback); } catch (_e) { return clone(fallback); }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_e) {
      toast('Espace de stockage plein : réduisez la taille des photos ou exportez une sauvegarde.', 'err');
      return false;
    }
  },
  raw(k) { try { return localStorage.getItem(k); } catch (_e) { return null; } },
  rawSet(k, v) { try { localStorage.setItem(k, v); } catch (_e) { /* ignoré */ } },
};
function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

let DB, USERS, RULES, GRILLE, SETTINGS, DOCS;
function normalizeDB(d) {
  d = d || {};
  ['members', 'cotisations', 'amendes_paid', 'depenses', 'prets', 'absences', 'demandes_pret', 'transferts']
    .forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
  d.members.forEach((m) => {
    ['can_see_documents', 'comite_see_demandes', 'comite_see_compta', 'comite_see_reports'].forEach((k) => {
      if (typeof m[k] !== 'boolean') m[k] = k === 'can_see_documents' ? true : !!m.is_comite;
    });
    if (!m.statut) m.statut = 'Actif';
  });
  d.prets.forEach((p) => { if (!Array.isArray(p.payments)) p.payments = []; });
  return d;
}
function loadAll() {
  DB = normalizeDB(store.get(KEYS.db, SEED_DATA));
  USERS = store.get(KEYS.users, DEFAULT_USERS);
  // Anciennes sauvegardes : relie le compte admin du trésorier à sa fiche membre (conflit d'intérêts sur ses propres crédits)
  if (USERS.admin && USERS.admin.member_code === undefined && /PATRICE/i.test(USERS.admin.fullname || '')) USERS.admin.member_code = 'M011';
  RULES = migrateRules(store.get(KEYS.rules, null));
  GRILLE = migrateGrille(store.get(KEYS.grille, DEFAULT_GRILLE));
  SETTINGS = Object.assign(clone(DEFAULT_SETTINGS), store.get(KEYS.settings, DEFAULT_SETTINGS));
  DOCS = store.get(KEYS.docs, DEFAULT_DOCS);
}
/* Une ancienne grille (pondérations 40/30/20/10) est remplacée par la grille officielle */
function migrateGrille(g) {
  if (!g || typeof g.pts_presence !== 'number') return clone(DEFAULT_GRILLE);
  return Object.assign(clone(DEFAULT_GRILLE), g);
}
function saveDB() { return store.set(KEYS.db, DB); }
function saveUsers() { store.set(KEYS.users, USERS); }
function saveRules() { store.set(KEYS.rules, RULES); }
function saveGrille() { store.set(KEYS.grille, GRILLE); }
function saveSettings() { store.set(KEYS.settings, SETTINGS); }
function saveDocs() { store.set(KEYS.docs, DOCS); }

/* ---------- Utilitaires ---------- */
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function num(v) { const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
function round2(n) { return Math.round(n * 100) / 100; }
function fmt(n) {
  n = round2(num(n));
  const neg = n < 0; n = Math.abs(n);
  const int = Math.floor(n); const dec = Math.round((n - int) * 100);
  const s = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '−' : '') + s + (dec ? ',' + String(dec).padStart(2, '0') : '');
}
function money(n) { return fmt(n) + ' HTG'; }
function pad(n) { return String(n).padStart(2, '0'); }
/* Dates : stockées « JJ/MM/AAAA » */
function parseD(s) {
  if (!s) return null;
  if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  let m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
function fmtD(d) { d = parseD(d); return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : ''; }
function toISO(d) { d = parseD(d); return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : ''; }
function today() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }
function monthKey(d) { d = parseD(d); return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) : ''; }
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MWA = ['janvye', 'fevriye', 'mas', 'avril', 'me', 'jen', 'jiyè', 'out', 'septanm', 'oktòb', 'novanm', 'desanm'];
function monthLabel(key, short) {
  const [y, m] = key.split('-').map(Number);
  const names = SETTINGS && SETTINGS.lang === 'kr' ? MWA : MOIS;
  const n = names[m - 1];
  return short ? n.slice(0, 3) + '. ' + String(y).slice(2) : n.charAt(0).toUpperCase() + n.slice(1) + ' ' + y;
}
function longDate(d) {
  d = parseD(d); if (!d) return '';
  const jours = SETTINGS.lang === 'kr' ? ['dimanch', 'lendi', 'madi', 'mèkredi', 'jedi', 'vandredi', 'samdi'] : ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const names = SETTINGS.lang === 'kr' ? MWA : MOIS;
  return jours[d.getDay()] + ' ' + d.getDate() + ' ' + names[d.getMonth()] + ' ' + d.getFullYear();
}
function addMonths(d, n) { d = parseD(d); return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function lastThursday(y, m) {
  const d = new Date(y, m + 1, 0);
  while (d.getDay() !== 4) d.setDate(d.getDate() - 1);
  return d;
}
function lastThursdayOf(d) { d = parseD(d); return lastThursday(d.getFullYear(), d.getMonth()); }
function meetingHour() { const p = String(SETTINGS.meeting_hour || '17:00').split(':'); return { h: +p[0] || 17, m: +p[1] || 0 }; }
/* Prochaine réunion : dernier jeudi du mois (aujourd'hui inclus tant que la réunion n'est pas finie, 19h) */
function nextMeeting(from) {
  const now = from ? new Date(from) : new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let d = lastThursday(now.getFullYear(), now.getMonth());
  const endOfMeeting = new Date(d.getFullYear(), d.getMonth(), d.getDate(), meetingHour().h + 2, meetingHour().m);
  if (d < t0 || (d.getTime() === t0.getTime() && now > endOfMeeting)) d = lastThursday(now.getFullYear(), now.getMonth() + 1);
  return d;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function sum(arr, f) { return arr.reduce((s, x) => s + num(f ? f(x) : x), 0); }
function memberName(m) {
  if (!m) return '';
  const n = [m.nom, m.prenom].filter(Boolean).join(' ').trim();
  return n || 'Nom à compléter';
}
function getMember(code) { return DB.members.find((m) => m.code === code); }
function nameOf(code) { const m = getMember(code); return m ? memberName(m) : code; }
function initials(m) {
  const n = memberName(m);
  if (n === 'Nom à compléter') return m.code.slice(1);
  return n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function avatar(m, sm) {
  return '<span class="avatar' + (sm ? ' sm' : '') + '">' + (m && m.photo ? '<img alt="" src="' + esc(m.photo) + '">' : esc(m ? initials(m) : '')) + '</span>';
}
function sortByCode(a, b) { return String(a.code).localeCompare(String(b.code)); }
function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
/* Compresse une image en JPEG pour limiter l'espace localStorage */
function readImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('Aucun fichier')); return; }
    if (file.size > 8 * 1024 * 1024) { reject(new Error('Image trop lourde (max 8 Mo)')); return; }
    const r = new FileReader();
    r.onerror = () => reject(new Error('Lecture impossible'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format d’image non reconnu'));
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality || 0.82));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
/* Déclenche un <input type=file> positionné hors écran (jamais display:none) */
function pickFile(accept, cb) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = accept || ''; inp.className = 'offscreen-input';
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) cb(f); });
  document.body.appendChild(inp);
  inp.click();
  setTimeout(() => { if (document.body.contains(inp) && !inp.files.length) { /* laissé pour iOS */ } }, 60000);
}
