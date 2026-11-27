/* =========================================================================
   Sauvegarde : export / import, dossier de données natif, auto-import
   Pont natif optionnel window.UnieNative (APK Android et application Windows) :
     saveData(json) · loadData() · saveFile(name, text) → chemin · shareFile(name, text)
     dataFolder() · getPendingImport() · notify(t, b) · scheduleAlarms(json) · platform
   ========================================================================= */
const SAVED_AT_KEY = 'uniemuso-saved-at';
function hasNative() { return !!(window.UnieNative && typeof UnieNative.saveData === 'function'); }
function nativePlatform() { try { return hasNative() ? String(UnieNative.platform || (UnieNative.getPlatform && UnieNative.getPlatform()) || '') : ''; } catch (_e) { return ''; } }
function dataFolderLabel() {
  if (!hasNative()) return '';
  try { return UnieNative.dataFolder(); } catch (_e) { return 'Documents/UNIE-MUSO'; }
}

function buildBackup(kind) {
  const settings = clone(SETTINGS); delete settings.notif_asked;
  const b = {
    app: 'UNIE-MUSO', format: 2, version: APP_VERSION, kind: kind || 'complet', exported_at: new Date().toISOString(),
    data: DB, rules: RULES, grille: GRILLE, settings, docs: DOCS,
  };
  if (b.kind === 'complet') b.users = USERS;
  return b;
}
function backupName(ext, kind) {
  return 'uniemuso-' + (kind === 'membres' ? 'membres-' : 'backup-') + toISO(today()) + '.' + (ext || 'json');
}

/* Enregistrement : localStorage + dossier natif (fichier courant + copie du jour) */
let persistTimer = null;
function markSaved() { store.rawSet(SAVED_AT_KEY, new Date().toISOString()); schedulePersist(); if (typeof schedulePush === 'function' && SESSION) schedulePush(); }
function schedulePersist() {
  if (!hasNative()) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNative, 400);
}
function persistNative() {
  if (!hasNative()) return;
  try {
    const json = JSON.stringify(buildBackup('complet'));
    UnieNative.saveData(json);
    const dayKey = 'uniemuso-daily-' + toISO(today());
    if (!store.raw(dayKey)) { UnieNative.saveFile('sauvegardes/' + backupName('unimiso'), json); store.rawSet(dayKey, '1'); }
  } catch (e) { console.error('[UNIE-MUSO] écriture du dossier impossible', e); }
}
/* Les fonctions save* d'origine sont enveloppées pour suivre la date de modification */
['saveDB', 'saveUsers', 'saveRules', 'saveGrille', 'saveSettings', 'saveDocs'].forEach((fn) => {
  const orig = window[fn];
  window[fn] = function () { const r = orig.apply(this, arguments); markSaved(); return r; };
});

/* Au démarrage : récupère le dossier natif s'il est plus récent que le navigateur */
function restoreFromNative() {
  if (!hasNative()) return false;
  try {
    const txt = UnieNative.loadData();
    if (!txt) { persistNative(); return false; }
    const obj = JSON.parse(txt);
    const local = store.raw(SAVED_AT_KEY);
    const hasLocal = !!store.raw(KEYS.db);
    if (!hasLocal || !local || (obj.exported_at && obj.exported_at > local)) {
      applyBackup(obj, { keepUsers: false, silent: true });
      return true;
    }
  } catch (e) { console.error('[UNIE-MUSO] lecture du dossier impossible', e); }
  return false;
}

/* ---------- Import ---------- */
function parseBackupText(text) {
  let obj;
  try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (_e) { throw new Error('Le fichier n’est pas une sauvegarde UNIE-MUSO valide (JSON illisible).'); }
  const data = obj.data || obj.DB || obj.db || (Array.isArray(obj.members) ? obj : null);
  if (!data || !Array.isArray(data.members)) throw new Error('Aucune liste de membres trouvée dans ce fichier.');
  return {
    obj, data,
    users: obj.users || obj.USERS || null, rules: obj.rules || obj.RULES || null, grille: obj.grille || obj.GRILLE || null,
    settings: obj.settings || null, docs: obj.docs || null, kind: obj.kind || (obj.users || obj.USERS ? 'complet' : 'membres'),
    exported_at: obj.exported_at || '',
  };
}
function applyBackup(objOrParsed, opts) {
  opts = opts || {};
  const p = objOrParsed.data && objOrParsed.obj ? objOrParsed : parseBackupText(JSON.stringify(objOrParsed));
  DB = normalizeDB(clone(p.data));
  if (p.users && p.kind === 'complet' && !opts.keepUsers) USERS = p.users;
  if (p.rules) RULES = migrateRules(p.rules);
  if (p.grille) GRILLE = migrateGrille(p.grille);
  if (p.settings) {
    const keepLang = SETTINGS.lang;
    SETTINGS = Object.assign(clone(DEFAULT_SETTINGS), SETTINGS, p.settings);
    SETTINGS.lang = keepLang || SETTINGS.lang;
  }
  if (p.docs) DOCS = p.docs;
  store.set(KEYS.db, DB); store.set(KEYS.users, USERS); store.set(KEYS.rules, RULES);
  store.set(KEYS.grille, GRILLE); store.set(KEYS.settings, SETTINGS); store.set(KEYS.docs, DOCS);
  store.rawSet(SAVED_AT_KEY, p.exported_at || new Date().toISOString());
  if (!opts.silent) schedulePersist();
  return p;
}
function describeBackup(p) {
  return p.data.members.length + ' membres, ' + (p.data.cotisations || []).length + ' cotisations, ' + (p.data.prets || []).length + ' prêts' +
    (p.exported_at ? ' — exportée le ' + fmtDT(p.exported_at).replace(' ', ' à ') : '');
}
/* Point d'entrée commun : fichier choisi, fichier ouvert depuis WhatsApp, lien ?import= */
function importBackupText(text, source) {
  let p;
  try { p = parseBackupText(text); } catch (e) { toast(e.message, 'err'); return false; }
  const local = store.raw(SAVED_AT_KEY);
  const doIt = () => {
    applyBackup(p, { keepUsers: p.kind !== 'complet' });
    if (SESSION && SESSION.type === 'member' && !getMember(SESSION.code)) SESSION = null;
    toast('Sauvegarde importée : ' + describeBackup(p), 'ok');
    render();
  };
  if (local && p.exported_at && p.exported_at < local && store.raw(KEYS.db)) {
    openModal({
      title: 'Sauvegarde plus ancienne',
      body: '<p style="margin-top:0">Le fichier reçu' + (source ? ' (' + esc(source) + ')' : '') + ' est <b>plus ancien</b> que les données de cet appareil.</p>' +
        '<p>Fichier : ' + esc(describeBackup(p)) + '<br>Cet appareil : modifié le ' + esc(fmtDT(local).replace(' ', ' à ')) + '</p>' +
        '<p class="muted">Importer remplacera les données de cet appareil.</p>',
      submit: 'Importer quand même', onSubmit: doIt,
    });
    return true;
  }
  doIt();
  return true;
}
function importBackupFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => importBackupText(r.result, file.name);
  r.onerror = () => toast('Lecture du fichier impossible.', 'err');
  r.readAsText(file, 'utf-8');
}
ACTIONS.importPick = () => pickFile('.json,.unimiso,application/json,application/octet-stream,text/plain', importBackupFile);

/* ---------- Export ---------- */
function exportBackup(ext, kind, share) {
  const json = JSON.stringify(buildBackup(kind), null, kind === 'complet' && ext === 'json' ? 1 : 0);
  const name = backupName(ext, kind);
  if (hasNative()) {
    try {
      if (share && UnieNative.shareFile) { UnieNative.shareFile(name, json); return; }
      const path = UnieNative.saveFile(name, json);
      toast('Fichier enregistré : ' + (path || name), 'ok');
      return;
    } catch (e) { toast('Enregistrement impossible : ' + e.message, 'err'); return; }
  }
  if (share && navigator.canShare) {
    try {
      const f = new File([json], name, { type: 'application/octet-stream' });
      if (navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: 'Sauvegarde UNIE-MUSO' }).catch(() => {}); return; }
    } catch (_e) { /* repli sur le téléchargement */ }
  }
  download(name, json, 'application/octet-stream');
  toast('Fichier téléchargé : ' + name, 'ok');
}
ACTIONS.exportJson = () => exportBackup('json', 'complet');
ACTIONS.exportUnimiso = () => exportBackup('unimiso', 'complet');
ACTIONS.shareMembers = () => exportBackup('unimiso', 'membres', true);
ACTIONS.saveMembers = () => exportBackup('unimiso', 'membres');
ACTIONS.openFolder = () => { try { UnieNative.openFolder && UnieNative.openFolder(); } catch (_e) { /* */ } };

/* ---------- Auto-import au chargement ---------- */
function b64ToText(b64) {
  const s = atob(String(b64).replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, ''));
  const bytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
function checkPendingImports() {
  let pending = window.UNIE_PENDING_IMPORT;
  if (!pending && hasNative() && UnieNative.getPendingImport) { try { pending = UnieNative.getPendingImport(); } catch (_e) { /* */ } }
  if (pending) {
    window.UNIE_PENDING_IMPORT = null;
    importBackupText(typeof pending === 'string' ? pending : JSON.stringify(pending), 'fichier ouvert');
  }
  try {
    const url = new URL(window.location.href);
    const fromHash = (url.hash.match(/import=([^&]+)/) || [])[1];
    const param = url.searchParams.get('import') || fromHash;
    if (param) {
      importBackupText(b64ToText(decodeURIComponent(param)), 'lien');
      url.searchParams.delete('import'); url.hash = '';
      try { history.replaceState(null, '', url.pathname + url.search); } catch (_e) { /* file:// */ }
    }
  } catch (e) { toast('Lien d’import invalide : ' + e.message, 'err'); }
}
/* Appelé par l'application native quand un fichier .unimiso est ouvert pendant que l'app tourne */
window.onUnieImport = function (text) { importBackupText(text, 'fichier ouvert'); };
