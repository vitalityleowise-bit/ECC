/* =========================================================================
   Version en ligne (Firebase) : synchronisation automatique dès qu'Internet est là.
   - L'application reste 100 % utilisable hors ligne (copie locale) ;
   - les données de gestion (membres, cotisations, prêts…) sont envoyées par les deux
     personnes autorisées (trésorier + éditeur) et reçues par tous ;
   - messages, suggestions, annonces et demandes de prêt sont enregistrés un par un,
     pour que plusieurs personnes puissent écrire en même temps sans rien perdre.
   ========================================================================= */
const FB_CONF = typeof PRIVATE_FIREBASE !== 'undefined' && PRIVATE_FIREBASE ? PRIVATE_FIREBASE : null;
const ONLINE = { app: null, auth: null, fs: null, status: 'off', detail: '', unsub: [], lastSync: null, pushing: false, retry: null, who: '' };
const SYNC_KEY = 'uniemuso-sync-v1';
const SHARED_ARRAYS = ['members', 'cotisations', 'amendes_paid', 'depenses', 'prets', 'absences', 'transferts', 'reunions', 'dons', 'inscriptions'];
const SHARED_CFG = ['cfg_rules', 'cfg_grille', 'cfg_settings', 'cfg_docs'];
const COLLAB = {
  messages: { col: 'messages', own: 'from_code' },
  suggestions: { col: 'suggestions', own: 'from_code' },
  annonces: { col: 'annonces', own: null },
  demandes_pret: { col: 'demandes', own: 'code_membre' },
};
const PART_SIZE = 300000; // caractères par morceau (un document Firestore ne dépasse pas 1 Mo)

/* ---------- Utilitaires ---------- */
function fbEmail(id) { return String(id).toLowerCase().replace(/[^a-z0-9]/g, '') + '@uniemuso.app'; }
/* Membres : un compte en ligne PAR mot de passe (m005-<empreinte>@uniemuso.app).
   Firebase n'accepte de changer un mot de passe qu'avec l'ANCIEN : ici on n'en a jamais besoin.
   Nouveau mot de passe = nouveau compte ; l'ancien perd son rôle, donc tout accès aux données. */
async function pwdTag(code, pwd) {
  const txt = 'UNIE-MUSO|' + String(code).toUpperCase() + '|' + pwd;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return Array.from(new Uint8Array(buf)).slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_e) { return hashStr(txt).replace(/[^a-z0-9]/g, ''); }
}
async function memberEmail(code, pwd) { return String(code).toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + (await pwdTag(code, pwd)) + '@uniemuso.app'; }
function isUserId(id) { return Object.keys(USERS).some((k) => k.toLowerCase() === String(id).toLowerCase()); }
async function loginEmail(id, pwd) { return isUserId(id) ? fbEmail(id) : memberEmail(id, pwd); }
function fbPwd(p) { return 'UM#' + String(p) + '#2026'; }
function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '.' + s.length; }
function plain(o) { return JSON.parse(JSON.stringify(o === undefined ? null : o)); }
function syncState() {
  if (!ONLINE.state) { try { ONLINE.state = JSON.parse(store.raw(SYNC_KEY) || 'null'); } catch (_e) { ONLINE.state = null; } }
  if (!ONLINE.state) ONLINE.state = { arrays: {}, parts: {}, changedAt: {}, recs: {} };
  return ONLINE.state;
}
function saveSyncState() { store.rawSet(SYNC_KEY, JSON.stringify(syncState())); }
function onlineAvailable() { return !!(FB_CONF && !window.UNIE_NO_ONLINE && window.firebase && typeof firebase.initializeApp === 'function'); }
function isOnlineEditor() { const r = currentRole(); return r === 'admin' || r === 'editeur'; }
function isOnlineComite() { const r = currentRole(); return r === 'admin' || r === 'editeur' || r === 'comite'; }
function setOnlineStatus(st, detail) {
  ONLINE.status = st; ONLINE.detail = detail || '';
  const el = document.getElementById('net-status'); if (el) el.outerHTML = netStatusHTML();
}
function netStatusHTML() {
  if (!onlineAvailable()) return '<span id="net-status"></span>';
  const S = { off: ['○', 'Hors ligne', 'b-grey'], connecting: ['⟳', 'Connexion…', 'b-orange'], sync: ['⟳', 'Synchronisation…', 'b-orange'], ok: ['●', 'En ligne', 'b-green'], err: ['!', 'Problème en ligne', 'b-red'] }[ONLINE.status] || ['○', 'Hors ligne', 'b-grey'];
  return '<button id="net-status" class="badge ' + S[2] + ' net-status" data-act="netInfo" title="' + esc(ONLINE.detail || S[1]) + '">' + S[0] + ' ' + S[1] + '</button>';
}
/* Mot de passe refusé en ligne (changé par le trésorier) : on demande le nouveau, une seule fois */
function maybeAskPwd() {
  clearTimeout(ONLINE.askTimer);
  if (!ONLINE.badPwd || !SESSION) return;
  if (document.getElementById('modal') || document.querySelector('.welcome')) { ONLINE.askTimer = setTimeout(maybeAskPwd, 2500); return; }
  askNewPassword();
}
function askNewPassword() {
  if (!SESSION) return;
  const id = SESSION.type === 'member' ? SESSION.code : SESSION.id;
  let tries = 0;
  openModal({
    title: 'Mot de passe', submit: 'Valider',
    body: '<p style="margin:0 0 12px">Entrez le mot de passe que le trésorier vous a donné pour continuer en ligne. Vos données restent sur ce téléphone.</p>' +
      field('Mot de passe', '<div style="display:flex;gap:6px"><input name="np" id="np" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" required style="flex:1;min-width:0">' +
        '<button type="button" class="btn" onclick="var i=document.getElementById(\'np\');i.type=i.type===\'password\'?\'text\':\'password\';this.textContent=i.type===\'password\'?\'Voir\':\'Cacher\'">Voir</button></div>') +
      '<div id="np-msg" class="muted" style="font-size:12.5px;margin-top:6px"></div>',
    onSubmit: (v) => {
      const pwd = (v.np || '').trim(); const msg = document.getElementById('np-msg');
      if (!pwd) { msg.textContent = 'Entrez le mot de passe.'; return false; }
      msg.textContent = 'Vérification…'; initOnline();
      loginEmail(id, pwd).then((em) => ONLINE.auth.signInWithEmailAndPassword(em, fbPwd(pwd))).then(() => {
        if (SESSION.type === 'member') { const m = getMember(SESSION.code); if (m) { m.portal_password = pwd; store.set(KEYS.db, DB); } }
        else if (USERS[SESSION.id]) { USERS[SESSION.id].pwd = pwd; saveUsers(); }
        ONLINE.badPwd = false; closeModal(); toast('Mot de passe mis à jour. Connexion en ligne…', 'ok'); goOnline(true);
      }).catch((e) => {
        const c = (e && e.code) || '';
        if (/too-many-requests/.test(c)) { ONLINE.blockedUntil = Date.now() + 30 * 60000; closeModal(); setOnlineStatus('err', errText(e)); return; }
        if (/network|unavailable/.test(c)) { msg.textContent = 'Pas d’Internet pour le moment. Réessayez quand la connexion revient.'; return; }
        tries++;
        if (tries >= 3) { closeModal(); toast('Mot de passe toujours refusé. Demandez le bon mot de passe au trésorier, puis touchez « ! Problème en ligne » en haut de l’écran.', 'err'); return; }
        msg.textContent = 'Mot de passe incorrect (' + tries + ' / 3). Vérifiez avec le trésorier.';
      });
      return false;
    },
  });
}
ACTIONS.netInfo = () => {
  if (ONLINE.badPwd && SESSION) { askNewPassword(); return; }
  const last = ONLINE.lastSync ? ' Dernière synchronisation : ' + fmtDT(new Date(ONLINE.lastSync).toISOString()) + '.' : '';
  toast((ONLINE.detail || { off: 'Hors ligne : vos changements sont gardés et seront envoyés au retour d’Internet.', ok: 'En ligne : tout est synchronisé.' }[ONLINE.status] || '') + last, ONLINE.status === 'err' ? 'err' : 'ok');
  if (isAdmin()) { STATE.ptab = 'enligne'; go('parametres'); }
};

/* ---------- Connexion ---------- */
function initOnline() {
  if (!onlineAvailable() || ONLINE.app) return !!ONLINE.app;
  const conf = Object.assign({}, FB_CONF, window.UNIE_EMULATOR ? { projectId: window.UNIE_EMULATOR.projectId || FB_CONF.projectId } : {});
  ONLINE.app = firebase.initializeApp(conf);
  ONLINE.auth = firebase.auth();
  ONLINE.fs = firebase.firestore();
  if (window.UNIE_EMULATOR) {
    ONLINE.auth.useEmulator(window.UNIE_EMULATOR.auth);
    ONLINE.fs.useEmulator(window.UNIE_EMULATOR.host, window.UNIE_EMULATOR.port);
  }
  // Pas de session Firebase persistante : l'application se reconnecte avec le compte déjà ouvert
  ONLINE.auth.setPersistence(firebase.auth.Auth.Persistence.NONE).catch(() => {});
  return true;
}
async function sessionCredentials() {
  if (!SESSION) return null;
  if (SESSION.type === 'user') { const u = USERS[SESSION.id]; return u ? { email: fbEmail(SESSION.id), pwd: u.pwd } : null; }
  const m = getMember(SESSION.code); return m && m.portal_password ? { email: await memberEmail(m.code, m.portal_password), pwd: m.portal_password } : null;
}
function errText(e) {
  const c = (e && e.code) || '';
  if (/permission-denied/.test(c)) return 'Accès refusé par le serveur (règles de sécurité non installées, ou compte en ligne pas encore créé par le trésorier).';
  if (/invalid-credential|wrong-password|invalid-login|user-not-found/.test(c)) {
    if (SESSION && SESSION.type === 'member') return 'Mot de passe refusé en ligne : touchez « ! Problème en ligne » en haut de l’écran et entrez le mot de passe donné par le trésorier.';
    return 'Compte en ligne introuvable ou mot de passe différent.';
  }
  if (/too-many-requests/.test(c)) return 'Firebase bloque cet appareil pour un moment : trop d’essais avec un mauvais mot de passe. N’essayez plus pendant 30 minutes ; l’application réessaiera seule. Ensuite, touchez « ! Problème en ligne » et entrez le NOUVEAU mot de passe.';
  if (/network|unavailable|deadline/.test(c)) return 'Connexion Internet instable : nouvel essai automatique dans 20 secondes (' + c + ').';
  return ((e && e.message) || String(e)) + (c ? ' (' + c + ')' : '');
}
/* Membre connecté mais sans accès (son mot de passe a été changé ou effacé par le trésorier) :
   on lui demande le mot de passe actuel, comme pour un mot de passe refusé */
function accessRemoved(e) {
  if (!SESSION || SESSION.type !== 'member' || !/permission-denied/.test((e && e.code) || '')) return false;
  stopListeners(); ONLINE.who = '';
  if (ONLINE.auth) ONLINE.auth.signOut().catch(() => {});
  ONLINE.badPwd = true;
  setOnlineStatus('err', 'Votre mot de passe a été changé par le trésorier : touchez « ! Problème en ligne » et entrez le nouveau.');
  maybeAskPwd();
  return true;
}
async function goOnline(manual) {
  clearTimeout(ONLINE.retry);
  if (manual !== true && ONLINE.blockedUntil && Date.now() < ONLINE.blockedUntil) return;
  if (manual !== true && ONLINE.badPwd) return; // mot de passe refusé : on attend une nouvelle connexion de la personne
  if (!SESSION || !onlineAvailable()) { setOnlineStatus('off'); return; }
  if (!navigator.onLine) { setOnlineStatus('off', 'Hors ligne : vos changements sont gardés et seront envoyés au retour d’Internet.'); return; }
  initOnline();
  const cred = await sessionCredentials();
  if (!cred) { setOnlineStatus('err', 'Pas de mot de passe pour ce compte.'); return; }
  // Sécurité : jamais en ligne avec le mot de passe admin par défaut
  if (SESSION.type === 'user' && SESSION.id === 'admin' && USERS.admin.pwd === 'admin') {
    setOnlineStatus('err', 'Changez d’abord le mot de passe « admin » (Paramètres > Comptes de gestion) : il est trop facile à deviner pour aller en ligne.'); return;
  }
  const key = cred.email;
  setOnlineStatus('connecting');
  try {
    const cur = ONLINE.auth.currentUser;
    if (!cur || cur.email !== cred.email) {
      try { await ONLINE.auth.signInWithEmailAndPassword(cred.email, fbPwd(cred.pwd)); } catch (e) {
        // Première connexion du trésorier : son compte en ligne est créé automatiquement
        if (SESSION.type === 'user' && SESSION.id === 'admin' && /user-not-found|invalid-credential|invalid-login/.test(e.code || '')) {
          await ONLINE.auth.createUserWithEmailAndPassword(cred.email, fbPwd(cred.pwd));
        } else throw e;
      }
    }
    if (ONLINE.who !== key) { stopListeners(); ONLINE.who = key; startListeners(); }
    await pushAll();
    ONLINE.lastSync = Date.now();
    setOnlineStatus('ok', 'En ligne : tout est synchronisé.');
    touchSeen(true);
    processPendingPwds(false);
  } catch (e) {
    if (accessRemoved(e)) return;
    setOnlineStatus('err', errText(e));
    // Nouvel essai automatique SEULEMENT pour un problème de réseau. Un mauvais mot de passe essayé
    // encore et encore fait bloquer l'appareil (et toute la connexion partagée) par Firebase.
    const c = (e && e.code) || '';
    if (/too-many-requests/.test(c)) { ONLINE.blockedUntil = Date.now() + 30 * 60000; ONLINE.retry = setTimeout(goOnline, 30 * 60000); }
    else if (/invalid-credential|wrong-password|invalid-login|user-not-found|user-disabled/.test(c)) { ONLINE.badPwd = true; maybeAskPwd(); }
    else ONLINE.retry = setTimeout(goOnline, 20000);
  }
}
function goOffline() { stopListeners(); ONLINE.who = ''; if (ONLINE.auth) ONLINE.auth.signOut().catch(() => {}); setOnlineStatus('off'); }
window.addEventListener('online', () => { if (SESSION) goOnline(); });
// Retour dans l'application (téléphone sorti de veille, autre appli fermée) : nouvel essai immédiat
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { ONLINE.hiddenAt = Date.now(); return; }
  if (!SESSION) return;
  if (ONLINE.status === 'err') { goOnline(); return; }
  touchSeen(false);
  // Après un passage en arrière-plan (téléphone en veille, autre appli), Android ralentit la connexion :
  // on la rouvre tout de suite pour recevoir annonces et messages sans attendre
  if (ONLINE.who && ONLINE.fs && ONLINE.hiddenAt && Date.now() - ONLINE.hiddenAt > 20000) {
    ONLINE.hiddenAt = 0;
    ONLINE.fs.disableNetwork().then(() => ONLINE.fs.enableNetwork()).catch(() => {});
  }
});
window.addEventListener('offline', () => setOnlineStatus('off', 'Hors ligne : vos changements sont gardés et seront envoyés au retour d’Internet.'));

/* ---------- Envoi (local → serveur) ---------- */
function sharedValue(name) {
  if (name === 'cfg_rules') return RULES;
  if (name === 'cfg_grille') return GRILLE;
  if (name === 'cfg_docs') return DOCS;
  if (name === 'cfg_settings') { const s = clone(SETTINGS); delete s.notif_asked; delete s.lang; return s; }
  return DB[name] || [];
}
function applySharedValue(name, v) {
  if (name === 'cfg_rules') { RULES = migrateRules(v); store.set(KEYS.rules, RULES); return; }
  if (name === 'cfg_grille') { GRILLE = migrateGrille(v); store.set(KEYS.grille, GRILLE); return; }
  if (name === 'cfg_docs') { DOCS = v; store.set(KEYS.docs, DOCS); return; }
  if (name === 'cfg_settings') { SETTINGS = Object.assign(clone(DEFAULT_SETTINGS), v, { lang: SETTINGS.lang, notif_asked: SETTINGS.notif_asked }); store.set(KEYS.settings, SETTINGS); return; }
  DB[name] = Array.isArray(v) ? v : []; store.set(KEYS.db, DB);
}
/* Marque les données modifiées localement (appelé à chaque enregistrement) */
function noteLocalChanges() {
  const st = syncState(); const now = Date.now();
  SHARED_ARRAYS.concat(SHARED_CFG).forEach((n) => { if (hashStr(JSON.stringify(sharedValue(n))) !== st.arrays[n] && !st.changedAt[n]) st.changedAt[n] = now; });
  saveSyncState();
}
function schedulePush() {
  noteLocalChanges();
  clearTimeout(ONLINE.pushTimer);
  ONLINE.pushTimer = setTimeout(() => { if (ONLINE.who && navigator.onLine) pushAll().then(() => { ONLINE.lastSync = Date.now(); setOnlineStatus('ok', 'En ligne : tout est synchronisé.'); }).catch((e) => setOnlineStatus('err', errText(e))); }, 800);
}
async function pushShared() {
  if (!isOnlineEditor()) return;
  const st = syncState(); const fs = ONLINE.fs; const author = mySelfCode() || SESSION.id;
  for (const name of SHARED_ARRAYS.concat(SHARED_CFG)) {
    const json = JSON.stringify(sharedValue(name)); const h = hashStr(json);
    if (h === st.arrays[name]) { delete st.changedAt[name]; continue; }
    const parts = []; for (let i = 0; i < json.length; i += PART_SIZE) parts.push(json.slice(i, i + PART_SIZE));
    if (!parts.length) parts.push('');
    const batch = fs.batch();
    parts.forEach((p, i) => batch.set(fs.collection('db').doc(name + '__' + i), { data: p }));
    for (let i = parts.length; i < (st.parts[name] || 0); i++) batch.delete(fs.collection('db').doc(name + '__' + i));
    batch.set(fs.collection('db').doc(name), { parts: parts.length, hash: h, updated_at: Date.now(), by: author });
    await batch.commit();
    st.arrays[name] = h; st.parts[name] = parts.length; delete st.changedAt[name]; saveSyncState();
  }
}
function recKey(arr, item) {
  if (arr === 'demandes_pret') { if (!item.key) item.key = 'd' + item.id + '-' + item.code_membre; return item.key; }
  return item.id;
}
async function pushCollab() {
  const st = syncState(); const fs = ONLINE.fs; const me = mySelfCode(); const comite = isOnlineComite();
  for (const arr of Object.keys(COLLAB)) {
    const conf = COLLAB[arr]; const rec = st.recs[conf.col] = st.recs[conf.col] || {};
    const list = DB[arr] || [];
    for (const item of list) {
      const k = recKey(arr, item); if (!k) continue;
      const h = hashStr(JSON.stringify(item));
      if (rec[k] === h) continue;
      const mine = conf.own ? item[conf.own] === me : false;
      if (arr === 'annonces' && !comite) {
        // Un membre ne peut que marquer l'annonce comme lue
        if (me && (item.seen || []).includes(me)) await fs.collection('annonces').doc(k).update({ seen: firebase.firestore.FieldValue.arrayUnion(me) }).catch(() => {});
        rec[k] = h; continue;
      }
      if (!comite && !mine) { rec[k] = h; continue; }
      await fs.collection(conf.col).doc(String(k)).set(plain(item));
      rec[k] = h; saveSyncState();
    }
    // Suppressions faites sur cet appareil
    if (isOnlineEditor() || (arr === 'annonces' && comite)) {
      const keys = new Set(list.map((it) => String(recKey(arr, it))));
      for (const k of Object.keys(rec)) if (!keys.has(String(k))) { await fs.collection(conf.col).doc(String(k)).delete().catch(() => {}); delete rec[k]; }
    }
    saveSyncState();
  }
}
async function pushAll() {
  if (!ONLINE.who) return;
  // Un envoi est déjà en cours : on le refait juste après (avant, la modification attendait la suivante)
  if (ONLINE.pushing) { ONLINE.pushAgain = true; return; }
  ONLINE.pushing = true; setOnlineStatus('sync');
  // Messages, annonces, suggestions, demandes d'abord (petits, attendus tout de suite),
  // puis les grandes listes partagées (membres avec photos, cotisations, réunions…)
  try { await pushCollab(); await pushShared(); } finally { ONLINE.pushing = false; }
  if (ONLINE.pushAgain) { ONLINE.pushAgain = false; await pushAll(); }
}

/* ---------- Réception (serveur → local) ---------- */
function stopListeners() { ONLINE.unsub.forEach((u) => { try { u(); } catch (_e) { /* */ } }); ONLINE.unsub = []; }
function afterRemoteChange() {
  resetCalc();
  if (document.getElementById('modal') || document.querySelector('.welcome')) { ONLINE.pendingRender = true; return; }
  render();
}
function onRemoteDb(snap) {
  const docs = {}; snap.forEach((d) => { docs[d.id] = d.data(); });
  const st = syncState(); let changed = false;
  for (const name of SHARED_ARRAYS.concat(SHARED_CFG)) {
    const meta = docs[name]; if (!meta || meta.hash === st.arrays[name]) continue;
    let s = ''; let ok = true;
    for (let i = 0; i < meta.parts; i++) { const p = docs[name + '__' + i]; if (!p) { ok = false; break; } s += p.data; }
    if (!ok || hashStr(s) !== meta.hash) continue; // morceaux incomplets : on attend la suite
    const localChanged = hashStr(JSON.stringify(sharedValue(name))) !== st.arrays[name];
    // Conflit entre les deux personnes autorisées : la modification la plus récente gagne.
    // Pour les autres membres, le serveur a toujours raison.
    if (isOnlineEditor() && localChanged && (st.changedAt[name] || 0) > (meta.updated_at || 0)) continue;
    try { applySharedValue(name, JSON.parse(s)); } catch (_e) { continue; }
    st.arrays[name] = meta.hash; st.parts[name] = meta.parts; delete st.changedAt[name]; changed = true;
  }
  saveSyncState();
  ONLINE.lastSync = Date.now();
  if (changed) {
    // La langue choisie par le membre (préférence en ligne) reste la sienne
    const me = mySelfCode(); if (me && ONLINE.prefLang && getMember(me)) getMember(me).lang = ONLINE.prefLang;
    store.rawSet(SAVED_AT_KEY, new Date().toISOString()); afterRemoteChange();
  }
}
function onRemoteCollab(arr, snap, scoped) {
  const conf = COLLAB[arr]; const st = syncState(); const rec = st.recs[conf.col] = st.recs[conf.col] || {};
  st.got = st.got || {}; const firstSeen = !!st.got[conf.col]; st.got[conf.col] = true; // liste déjà reçue au moins une fois sur cet appareil
  const remote = {}; snap.forEach((d) => { remote[d.id] = d.data(); });
  const local = DB[arr] || [];
  const out = []; const seen = new Set();
  Object.keys(remote).forEach((k) => { out.push(remote[k]); seen.add(String(k)); rec[k] = hashStr(JSON.stringify(remote[k])); });
  local.forEach((it) => {
    const k = String(recKey(arr, it));
    if (seen.has(k)) return;
    if (rec[k] === undefined) out.push(it);           // créé ici, pas encore envoyé
    else if (scoped) { /* hors du périmètre de cet utilisateur : rien */ } else delete rec[k]; // supprimé ailleurs
  });
  if (arr === 'demandes_pret') fixDemandeIds(out);
  const changed = JSON.stringify(out) !== JSON.stringify(local);
  saveSyncState();
  if (changed) {
    // Premier chargement sur un appareil neuf : pas de notification pour tout l'historique
    if (firstSeen) notifyRemoteChanges(arr, local, out);
    DB[arr] = out; store.set(KEYS.db, DB); afterRemoteChange();
  }
}
/* ---------- Notifications système (téléphone, PC) pour ce qui arrive du serveur ---------- */
function shortTxt(x, n) { x = String(x || '').replace(/\s+/g, ' ').trim(); return x.length > (n || 90) ? x.slice(0, (n || 90) - 1) + '…' : x; }
function notifyRemoteChanges(arr, before, after) {
  if (!SESSION || SETTINGS.notif_online === false) return;
  const me = mySelfCode(); const comite = isOnlineComite();
  const idOf = (it) => String(recKey(arr, it));
  const old = {}; before.forEach((it) => { old[idOf(it)] = it; });
  const list = [];
  after.forEach((it) => {
    const prev = old[idOf(it)];
    if (arr === 'annonces' && !prev && it.by_code !== me) list.push(['UNIE-MUSO — Annonce du comité', (it.titre ? it.titre + ' : ' : '') + shortTxt(it.texte)]);
    if (arr === 'messages') {
      if (!prev && comite && it.from_code !== me) list.push(['UNIE-MUSO — Message de ' + (it.from_name || it.from_code), (it.sujet ? it.sujet + ' : ' : '') + shortTxt(it.texte)]);
      const r0 = prev ? (prev.replies || []).length : 0; const r = it.replies || [];
      if (prev && r.length > r0) {
        const last = r[r.length - 1];
        if (last && last.by_code !== me && (it.from_code === me || comite)) list.push(['UNIE-MUSO — Réponse de ' + (last.by_name || 'du comité'), (it.sujet ? it.sujet + ' : ' : '') + shortTxt(last.texte)]);
      }
    }
    if (arr === 'suggestions') {
      if (!prev && comite && it.from_code !== me) list.push(['UNIE-MUSO — Nouvelle suggestion', shortTxt(it.texte)]);
      if (prev && !prev.reponse && it.reponse && it.from_code === me) list.push(['UNIE-MUSO — Réponse à votre suggestion', shortTxt(it.reponse)]);
    }
    if (arr === 'demandes_pret') {
      if (!prev && comite && it.code_membre !== me) list.push(['UNIE-MUSO — Nouvelle demande de prêt', (it.nom_membre || nameOf(it.code_membre)) + (it.montant_demande ? ' : ' + money(it.montant_demande) : '')]);
      if (prev && prev.statut !== it.statut && it.code_membre === me && it.statut !== 'En attente') list.push(['UNIE-MUSO — Votre demande de prêt', it.statut + (it.statut === 'Approuvée' && it.montant_approuve ? ' : ' + money(it.montant_approuve) : '')]);
    }
  });
  if (list.length > 3) notify('UNIE-MUSO', list.length + ' nouveautés : ' + list.slice(0, 3).map((x) => x[0].replace('UNIE-MUSO — ', '')).join(', ') + '…');
  else list.forEach((x) => notify(x[0], x[1]));
}
/* Deux demandes créées hors ligne peuvent avoir le même numéro : la plus récente est renumérotée */
function fixDemandeIds(list) {
  const byId = {};
  list.sort((a, b) => (+a.id - +b.id) || String(a.key).localeCompare(String(b.key)));
  let max = list.reduce((m, d) => Math.max(m, +d.id || 0), 0);
  list.forEach((d) => { if (byId[d.id] && byId[d.id] !== d.key) { d.id = ++max; } byId[d.id] = d.key; });
}
function startListeners() {
  const fs = ONLINE.fs; const me = mySelfCode(); const comite = isOnlineComite();
  const fail = (e) => { if (!accessRemoved(e)) setOnlineStatus('err', errText(e)); };
  ONLINE.unsub.push(fs.collection('db').onSnapshot(onRemoteDb, fail));
  Object.keys(COLLAB).forEach((arr) => {
    const conf = COLLAB[arr];
    let q = fs.collection(conf.col); let scoped = false;
    if (!comite && conf.own && me) { q = q.where(conf.own, '==', me); scoped = true; }
    ONLINE.unsub.push(q.onSnapshot((s) => onRemoteCollab(arr, s, scoped), fail));
  });
  if (me) ONLINE.unsub.push(fs.collection('prefs').doc(me).onSnapshot((d) => {
    const p = d.exists ? d.data() : null; const m = getMember(me);
    if (p && p.lang) ONLINE.prefLang = p.lang;
    if (p && p.lang && m && m.lang !== p.lang) { m.lang = p.lang; store.set(KEYS.db, DB); afterRemoteChange(); }
  }, () => {}));
}
/* Dernière connexion (vue par le trésorier) : au plus une écriture toutes les 10 minutes */
function touchSeen(force) {
  const me = mySelfCode(); if (!ONLINE.who || !me || (SESSION.type === 'user' && SESSION.id === 'admin')) return;
  if (!force && ONLINE.seenAt && Date.now() - ONLINE.seenAt < 600000) return;
  ONLINE.seenAt = Date.now();
  const plat = (typeof nativePlatform === 'function' && nativePlatform()) || (/iPhone|iPad/.test(navigator.userAgent) ? 'iphone' : /Android/.test(navigator.userAgent) ? 'android' : 'navigateur');
  ONLINE.fs.collection('prefs').doc(me).set({ last_seen: Date.now(), app: plat }, { merge: true }).catch(() => {});
}
function pushPref(lang) {
  const me = mySelfCode(); if (!ONLINE.who || !me) return;
  ONLINE.fs.collection('prefs').doc(me).set({ lang }, { merge: true }).catch(() => {});
}

/* ---------- Comptes en ligne (trésorier) ---------- */
function onlineRoleFor(m) {
  if (m.code === SETTINGS.editor_code) return 'editeur';
  return m.is_comite ? 'comite' : 'membre';
}
/* Compte en ligne d'un membre pour son mot de passe ACTUEL : créé s'il n'existe pas, rôle posé,
   ancien compte (ancien mot de passe) privé de rôle donc de tout accès */
async function ensureMemberAccount(auth2, m) {
  const email = await memberEmail(m.code, m.portal_password); let uid; let created = false;
  try { const c = await auth2.createUserWithEmailAndPassword(email, fbPwd(m.portal_password)); uid = c.user.uid; created = true; }
  catch (e) {
    if (!/email-already-in-use/.test(e.code || '')) throw e;
    const c = await auth2.signInWithEmailAndPassword(email, fbPwd(m.portal_password)); uid = c.user.uid; // même mot de passe : toujours accepté
  }
  await auth2.signOut().catch(() => {});
  await ONLINE.fs.collection('roles').doc(uid).set({ code: m.code, role: onlineRoleFor(m), nom: memberName(m) });
  if (m.uid && m.uid !== uid) await ONLINE.fs.collection('roles').doc(m.uid).delete().catch(() => {});
  m.uid = uid;
  return created;
}
async function removeMemberAccess(m) {
  if (m.uid) await ONLINE.fs.collection('roles').doc(m.uid).delete().catch(() => {});
  m.uid = '';
}
/* Tous les membres : compte pour le mot de passe actuel ; sans mot de passe ou inactif = aucun accès */
async function syncMemberAccounts(onProgress) {
  if (!isAdmin() || !ONLINE.who) throw new Error('Connectez-vous en ligne avec le compte admin.');
  const auth2 = secondaryAuth();
  await auth2.setPersistence(firebase.auth.Auth.Persistence.NONE).catch(() => {});
  const res = { crees: 0, maj: 0, erreurs: [] };
  for (const m of DB.members.slice().sort(sortByCode)) {
    if (onProgress) onProgress(m.code);
    try {
      if (m.statut === 'Inactif' || !m.portal_password) { await removeMemberAccess(m); continue; }
      if (await ensureMemberAccount(auth2, m)) res.crees++; else res.maj++;
      const st2 = pwdMemory(); if (st2.pendingPwd) delete st2.pendingPwd[m.code];
    } catch (e) {
      await auth2.signOut().catch(() => {});
      if (/too-many-requests/.test(e.code || '')) { res.erreurs.push('Firebase demande d’attendre un peu. Recliquez dans 30 minutes : les comptes déjà faits ne sont pas refaits.'); break; }
      res.erreurs.push(m.code + ' : ' + errText(e));
    }
  }
  saveSyncState(); saveDB(); schedulePush();
  return res;
}
/* Mise à jour des rôles seulement (après un changement de comité ou d'éditeur) */
async function syncRolesOnly() {
  if (!isAdmin() || !ONLINE.who) return;
  for (const m of DB.members) {
    if (!m.uid) continue;
    if (m.statut === 'Inactif') await ONLINE.fs.collection('roles').doc(m.uid).delete().catch(() => {});
    else await ONLINE.fs.collection('roles').doc(m.uid).set({ code: m.code, role: onlineRoleFor(m), nom: memberName(m) }).catch(() => {});
  }
}
/* ---------- Mots de passe des membres : appliqués en ligne automatiquement ---------- */
function pwdMemory() { const st = syncState(); st.pendingPwd = st.pendingPwd || {}; return st; }
function secondaryAuth() {
  const sec = firebase.apps.find((a) => a.name === 'comptes') || firebase.initializeApp(Object.assign({}, FB_CONF, window.UNIE_EMULATOR ? { projectId: window.UNIE_EMULATOR.projectId } : {}), 'comptes');
  const auth2 = sec.auth(); if (window.UNIE_EMULATOR && !auth2._unieEmu) { auth2.useEmulator(window.UNIE_EMULATOR.auth); auth2._unieEmu = true; }
  return auth2;
}
/* Le trésorier donne, change ou efface le mot de passe d'un membre : le compte en ligne suit tout seul */
function memberPasswordChanged(code, _oldPwd, _newPwd) {
  if (!isAdmin()) return;
  const st = pwdMemory(); st.pendingPwd[code] = true; saveSyncState();
  if (!ONLINE.who) { toast('Mot de passe enregistré. Le compte en ligne de ' + code + ' sera prêt tout seul dès le retour d’Internet.', 'ok'); return; }
  processPendingPwds(true);
}
async function processPendingPwds(verbose) {
  if (!isAdmin() || !ONLINE.who || ONLINE.pwdBusy) return;
  const st = pwdMemory(); const codes = Object.keys(st.pendingPwd);
  if (!codes.length) return;
  ONLINE.pwdBusy = true; const auth2 = secondaryAuth(); const done = []; const removed = []; let problem = '';
  try {
    for (const code of codes) {
      const m = getMember(code);
      try {
        if (!m) { delete st.pendingPwd[code]; continue; }
        if (m.statut === 'Inactif' || !m.portal_password) { await removeMemberAccess(m); removed.push(code); }
        else { await ensureMemberAccount(auth2, m); done.push(code); }
        delete st.pendingPwd[code];
      } catch (e) {
        await auth2.signOut().catch(() => {});
        const c = e.code || '';
        if (/network|unavailable/.test(c)) break; // au prochain retour en ligne
        if (/too-many-requests/.test(c)) { problem = 'Firebase demande d’attendre un peu : les comptes restants seront faits automatiquement plus tard.'; break; }
        problem = code + ' : ' + errText(e);
      }
    }
  } finally { ONLINE.pwdBusy = false; saveSyncState(); }
  if (done.length || removed.length) saveDB();
  if (done.length) toast('Compte(s) en ligne prêt(s) : ' + done.join(', ') + '.', 'ok');
  else if (removed.length && verbose) toast('Accès en ligne retiré : ' + (removed.length > 3 ? removed.length + ' membres' : removed.join(', ')) + '.', 'ok');
  if (problem) toast(problem, 'err');
}

/* ---------- Connexion sur un appareil sans données (lien en ligne, iPhone) ---------- */
async function onlineFirstLogin(id, pwd) {
  if (!onlineAvailable() || !navigator.onLine) return false;
  initOnline();
  try { await ONLINE.auth.signInWithEmailAndPassword(await loginEmail(id, pwd), fbPwd(pwd)); } catch (_e) { return false; }
  // Télécharge les données puis ouvre la session locale
  const snap = await ONLINE.fs.collection('db').get();
  onRemoteDb(snap);
  return true;
}

/* ---------- Paramètres > En ligne ---------- */
function weakPasswords() { return DB.members.filter((m) => m.statut !== 'Inactif' && m.portal_password && (m.portal_password.toLowerCase() === m.code.toLowerCase() || m.portal_password.length < 4)); }
/* Mot de passe admin changé : aussi sur son compte en ligne */
async function changeAdminOnlinePassword(newPwd) {
  if (!ONLINE.who || !ONLINE.auth.currentUser || SESSION.id !== 'admin') return false;
  try { await ONLINE.auth.currentUser.updatePassword(fbPwd(newPwd)); return true; } catch (_e) { return false; }
}
function onlineSettingsHTML() {
  if (!FB_CONF) return '<section class="panel"><div class="panel-body">Version en ligne non configurée dans ce fichier.</div></section>';
  const weak = weakPasswords();
  const warn = (USERS.admin && USERS.admin.pwd === 'admin' ? '<div class="banner import"><span><b>Mot de passe admin par défaut.</b> Changez-le dans « Comptes de gestion » avant d’aller en ligne.</span></div>' : '') +
    (weak.length ? '<div class="banner import"><span><b>' + weak.length + ' membre(s) avec un mot de passe facile à deviner</b> (leur code) : ' + esc(weak.map((m) => m.code).join(', ')) + '. Donnez à chacun un mot de passe personnel (onglet « Accès portail des membres »), puis cliquez « Créer / mettre à jour les comptes ».</span></div>' : '');
  const st = syncState();
  const withUid = DB.members.filter((m) => m.uid).length; const actifs = DB.members.filter((m) => m.statut !== 'Inactif' && m.portal_password).length;
  const pending = SHARED_ARRAYS.concat(SHARED_CFG).filter((n) => hashStr(JSON.stringify(sharedValue(n))) !== st.arrays[n]).length;
  return warn + '<section class="panel"><div class="panel-head"><h2>Version en ligne</h2><div class="right">' + netStatusHTML().replace('id="net-status"', '') + '</div></div><div class="panel-body">' +
    '<dl class="dl"><dt>Projet</dt><dd class="num">' + esc(FB_CONF.projectId) + '</dd>' +
    '<dt>Dernière synchronisation</dt><dd>' + (ONLINE.lastSync ? esc(fmtDT(new Date(ONLINE.lastSync).toISOString())) : '—') + '</dd>' +
    '<dt>À envoyer</dt><dd>' + (pending ? pending + ' partie(s) modifiée(s) sur cet appareil' : 'rien') + '</dd>' +
    '<dt>Comptes en ligne</dt><dd>' + withUid + ' / ' + actifs + ' membres actifs</dd></dl>' +
    (ONLINE.detail && ONLINE.status === 'err' ? '<div class="banner import" style="margin:12px 0 0"><span>' + esc(ONLINE.detail) + '</span></div>' : '') +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
      '<button class="btn btn-primary" data-act="onlineNow">Synchroniser maintenant</button>' +
      '<button class="btn btn-accent" data-act="onlineAccounts">Créer / mettre à jour les comptes des membres</button>' +
      '<button class="btn" data-act="onlineSeen">Dernière connexion des membres</button></div>' +
    '<div class="muted" style="margin-top:12px;font-size:12px">Chaque membre se connecte avec son code (ex. M004) et le mot de passe du portail. Après avoir changé un mot de passe, un poste au comité ou la personne autorisée à modifier, cliquez « Créer / mettre à jour les comptes ».</div>' +
    '</div></section>';
}
ACTIONS.onlineSeen = () => {
  if (!ONLINE.who) { toast('Connectez-vous d’abord en ligne (Internet + compte admin).', 'err'); return; }
  ONLINE.fs.collection('prefs').get().then((snap) => {
    const seen = {}; snap.forEach((d) => { seen[d.id] = d.data(); });
    const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 2 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'il y a ' + Math.round(m / 1440) + ' jour(s)'; };
    const app = { android: 'Téléphone Android', windows: 'PC Windows', iphone: 'iPhone', navigateur: 'Navigateur' };
    const list = DB.members.filter((m) => m.statut !== 'Inactif').map((m) => ({ m, s: seen[m.code] && seen[m.code].last_seen ? seen[m.code] : null }))
      .sort((a, b) => ((b.s && b.s.last_seen) || 0) - ((a.s && a.s.last_seen) || 0) || sortByCode(a.m, b.m));
    const n24 = list.filter((x) => x.s && Date.now() - x.s.last_seen < 86400000).length; const never = list.filter((x) => !x.s).length;
    openModal({ title: 'Dernière connexion des membres', wide: true, submit: null,
      body: '<div class="muted" style="margin-bottom:10px">' + n24 + ' membre(s) connecté(s) ces dernières 24 h · ' + never + ' jamais connecté(s) en ligne. Mis à jour à chaque ouverture de l’application avec Internet.</div>' +
        table(['Code', 'Membre', 'Dernière connexion', 'Appareil'], list.map((x) => '<tr><td class="code">' + x.m.code + '</td><td>' + esc(memberName(x.m)) + '</td><td>' +
          (x.s ? esc(fmtDT(new Date(x.s.last_seen).toISOString())) + ' <span class="muted">(' + ago(x.s.last_seen) + ')</span>' : '<span class="badge b-grey">jamais</span>') + '</td><td>' + (x.s ? esc(app[x.s.app] || x.s.app || '') : '') + '</td></tr>')) });
  }).catch((e) => toast(errText(e), 'err'));
};
ACTIONS.onlineNow = () => { ONLINE.badPwd = false; goOnline(true).then(() => render()); };
ACTIONS.onlineAccounts = () => {
  if (!ONLINE.who) { toast('Connectez-vous d’abord en ligne (Internet + compte admin).', 'err'); goOnline(); return; }
  toast('Création des comptes en ligne… gardez l’application ouverte.', 'warn');
  syncMemberAccounts((c) => setOnlineStatus('sync', 'Comptes : ' + c)).then((r) => {
    setOnlineStatus('ok', 'En ligne : tout est synchronisé.');
    toast(r.crees + ' compte(s) créé(s), ' + r.maj + ' mis à jour' + (r.erreurs.length ? ' — ' + r.erreurs.length + ' erreur(s) : ' + r.erreurs.join(' ; ') : '.'), r.erreurs.length ? 'err' : 'ok');
    render();
  }).catch((e) => toast(errText(e), 'err'));
};
