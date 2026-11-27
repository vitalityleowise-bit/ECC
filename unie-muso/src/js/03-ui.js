/* =========================================================================
   Interface : langue, toasts, modales, session, navigation, pont natif
   ========================================================================= */
const I18N = {
  fr: {
    g_gestion: 'Gestion', g_compte: 'Mon compte', g_comm: 'Communication', mesannonces: 'Annonces du comité', monresume: 'Résumé du rapport mensuel', meligibilite: 'Éligibilité au prêt', monpret: 'Prêt en cours', mesdemandes: 'Mes demandes de prêt', mescotisations: 'Historique des cotisations', reunions: 'Réunions et quorum', messages: 'Messages et suggestions', dons: 'Dons et subventions', plancomptable: 'Plan comptable', g_treso: 'Trésorerie', g_compta: 'Comptabilité', g_rapports: 'Rapports', g_docs: 'Documents', g_outils: 'Outils',
    dashboard: 'Tableau de bord', membres: 'Membres', cotisations: 'Cotisations', previsions: 'Prévisions', prets: 'Prêts & remboursements',
    demandes: 'Demandes de prêt', grille: 'Grille de crédit', depenses: 'Dépenses', stats: 'Statistiques', moncompte: 'Mon profil',
    caisse: 'Caisse', banque: 'Banque', journal: 'Journal', balance: 'Balance', bilan: 'Bilan', resultats: 'État résultats',
    rapport: 'Rapport mensuel', statuts: 'Statuts', reglement: 'Règlement interne', sauvegarde: 'Sauvegarde', parametres: 'Paramètres',
    login_title: 'Connexion', login_id: 'Identifiant', login_pwd: 'Mot de passe', login_btn: 'Se connecter', show: 'Voir', hide: 'Masquer',
    login_err: 'Identifiant ou mot de passe incorrect.', logout: 'Déconnexion', save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier',
    del: 'Supprimer', add: 'Ajouter', close: 'Fermer', print: 'Imprimer', member: 'Membre', date: 'Date', amount: 'Montant',
    next_meeting: 'Prochaine réunion', today_meeting: 'Réunion aujourd’hui', tomorrow_meeting: 'Réunion demain', in_days: 'Réunion dans {n} jours',
    to_pay: 'À verser', import_banner: 'Vous avez reçu une sauvegarde ? Importez-la pour mettre les données à jour.', import_btn: 'Importer un fichier',
    tagline: 'Mutuelle de solidarité — épargne, crédit et entraide entre membres.',
  },
  kr: {
    g_gestion: 'Jesyon', g_compte: 'Kont mwen', g_comm: 'Kominikasyon', mesannonces: 'Anons komite a', monresume: 'Rezime rapò mansyèl la', meligibilite: 'Kalifikasyon pou prè', monpret: 'Prè an kou', mesdemandes: 'Demann prè mwen yo', mescotisations: 'Istorik kotizasyon', reunions: 'Reyinyon ak kowòm', messages: 'Mesaj ak sijesyon', dons: 'Don ak sibvansyon', plancomptable: 'Plan kontab', g_treso: 'Trezori', g_compta: 'Kontablite', g_rapports: 'Rapò', g_docs: 'Dokiman', g_outils: 'Zouti',
    dashboard: 'Tablo jeneral', membres: 'Manm yo', cotisations: 'Kotizasyon', previsions: 'Previzyon', prets: 'Prè ak ranbousman',
    demandes: 'Demann prè', grille: 'Grid kredi', depenses: 'Depans', stats: 'Estatistik', moncompte: 'Pwofil mwen',
    caisse: 'Kès', banque: 'Bank', journal: 'Jounal', balance: 'Balans', bilan: 'Bilan', resultats: 'Rezilta',
    rapport: 'Rapò chak mwa', statuts: 'Estati', reglement: 'Règleman entèn', sauvegarde: 'Sovgad', parametres: 'Paramèt',
    login_title: 'Konekte', login_id: 'Idantifyan', login_pwd: 'Modpas', login_btn: 'Antre', show: 'Wè', hide: 'Kache',
    login_err: 'Idantifyan oswa modpas la pa bon.', logout: 'Dekonekte', save: 'Anrejistre', cancel: 'Anile', edit: 'Modifye',
    del: 'Efase', add: 'Ajoute', close: 'Fèmen', print: 'Enprime', member: 'Manm', date: 'Dat', amount: 'Montan',
    next_meeting: 'Pwochen reyinyon', today_meeting: 'Reyinyon jodi a', tomorrow_meeting: 'Reyinyon demen', in_days: 'Reyinyon nan {n} jou',
    to_pay: 'Pou peye', import_banner: 'Ou resevwa yon sovgad ? Enpòte l pou mete done yo ajou.', import_btn: 'Enpòte yon fichye',
    tagline: 'Mityèl solidarite — epay, kredi ak antrèd ant manm yo.',
  },
};
function t(k, vars) {
  const dict = I18N[currentLang() === 'kr' ? 'kr' : 'fr'];
  let s = dict[k] || I18N.fr[k] || k;
  if (vars) Object.keys(vars).forEach((v) => { s = s.replace('{' + v + '}', vars[v]); });
  return s;
}

/* ---------- Toasts ---------- */
function toast(msg, kind) {
  let box = document.querySelector('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || ''); el.textContent = msg; el.setAttribute('role', 'status');
  box.appendChild(el);
  setTimeout(() => el.remove(), kind === 'err' ? 6000 : 3500);
}

/* ---------- Modales ---------- */
function openModal(opts) {
  closeModal();
  const back = document.createElement('div');
  back.className = 'modal-back'; back.id = 'modal';
  back.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
    '<div class="modal-head"><h3>' + esc(opts.title) + '</h3><button class="x" data-close aria-label="Fermer">×</button></div>' +
    '<form class="modal-form" novalidate><div class="modal-body">' + opts.body + '</div>' +
    '<div class="modal-foot">' + (opts.footLeft || '') + '<span style="flex:1"></span>' +
    (opts.noCancel ? '' : '<button type="button" class="btn" data-close>' + t(opts.submit ? 'cancel' : 'close') + '</button>') +
    (opts.submit ? '<button type="submit" class="btn btn-primary">' + esc(opts.submit) + '</button>' : '') + '</div></form></div>';
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) closeModal(); });
  const form = back.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!opts.onSubmit) { closeModal(); return; }
    const data = formData(form);
    const res = opts.onSubmit(data, form);
    if (res !== false) closeModal();
  });
  if (opts.onOpen) opts.onOpen(back);
  const first = back.querySelector('input:not([type=hidden]):not([readonly]), select, textarea');
  if (first && !opts.noFocus) setTimeout(() => first.focus(), 30);
  return back;
}
function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }
function formData(form) {
  const o = {};
  form.querySelectorAll('[name]').forEach((el) => {
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else o[el.name] = el.value;
  });
  return o;
}
function field(label, inner, cls, hint) {
  return '<div class="field ' + (cls || '') + '"><label>' + esc(label) + '</label>' + inner + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
}
function input(name, value, attrs) { return '<input name="' + name + '" value="' + esc(value === undefined || value === null ? '' : value) + '" ' + (attrs || '') + '>'; }
function select(name, options, value, attrs) {
  return '<select name="' + name + '" ' + (attrs || '') + '>' + options.map((o) => {
    const v = typeof o === 'object' ? o.v : o; const l = typeof o === 'object' ? o.l : o;
    return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>';
  }).join('') + '</select>';
}
function memberOptions(activeOnly) {
  return DB.members.slice().sort(sortByCode).filter((m) => !activeOnly || m.statut !== 'Inactif')
    .map((m) => ({ v: m.code, l: m.code + ' — ' + memberName(m) }));
}
function confirmBox(title, text, onYes, yesLabel) {
  openModal({ title, body: '<p style="margin:0">' + text + '</p>', submit: yesLabel || 'Confirmer', onSubmit: () => { onYes(); } });
}

/* ---------- Session et rôles ---------- */
let SESSION = null; // { type:'user', id } | { type:'member', code }
let STATE = { page: 'dashboard', param: null };
function currentRole() {
  if (!SESSION) return null;
  if (SESSION.type === 'user') { const u = USERS[SESSION.id]; return u ? u.role : null; }
  const m = getMember(SESSION.code);
  if (m && SETTINGS.editor_code && m.code === SETTINGS.editor_code) return 'editeur';
  return m && m.is_comite ? 'comite' : 'membre';
}
function currentMember() { return SESSION && SESSION.type === 'member' ? getMember(SESSION.code) : null; }
function currentName() {
  if (!SESSION) return '';
  if (SESSION.type === 'user') { const u = USERS[SESSION.id]; return u ? u.fullname : SESSION.id; }
  return memberName(currentMember());
}
function onLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const id = (document.getElementById('lg-id').value || '').trim();
  const pwd = document.getElementById('lg-pwd').value || '';
  const err = document.getElementById('lg-err');
  const key = Object.keys(USERS).find((k) => k.toLowerCase() === id.toLowerCase());
  if (key && USERS[key].pwd === pwd) { SESSION = { type: 'user', id: key }; afterLogin(); return; }
  if (memberLogin(id, pwd)) { afterLogin(); return; }
  err.textContent = t('login_err');
}
function memberLogin(id, pwd) {
  const m = DB.members.find((x) => x.code.toLowerCase() === id.toLowerCase());
  if (!m || !m.portal_password || m.portal_password !== pwd) return false;
  if (m.statut === 'Inactif') return false;
  SESSION = { type: 'member', code: m.code };
  return true;
}
function afterLogin() {
  store.rawSet(KEYS.session, JSON.stringify(SESSION));
  const role = currentRole();
  STATE.page = role === 'membre' || role === 'comite' ? 'moncompte' : 'dashboard';
  showWelcome();
  render();
  tryShowNotifications(true);
}
function logout() { SESSION = null; STATE = { page: 'dashboard', param: null }; try { localStorage.removeItem(KEYS.session); } catch (_e) { /* */ } renderLogin(); }

/* Pages : groupe, droits d'accès */
const PAGE_DEFS = [
  { id: 'dashboard', g: 'g_gestion', roles: ['admin', 'editeur'] },
  { id: 'membres', g: 'g_gestion', roles: ['admin', 'editeur'] },
  { id: 'cotisations', g: 'g_gestion', roles: ['admin', 'editeur'] },
  { id: 'previsions', g: 'g_gestion', roles: ['admin', 'editeur'] },
  { id: 'reunions', g: 'g_gestion', roles: ['admin', 'editeur', 'comite'] },
  { id: 'prets', g: 'g_gestion', roles: ['admin', 'editeur'] },
  { id: 'demandes', g: 'g_gestion', roles: ['admin', 'editeur', 'comite:demandes'] },
  { id: 'grille', g: 'g_gestion', roles: ['admin', 'editeur'] },
  { id: 'depenses', g: 'g_gestion', roles: ['admin', 'editeur'] },
  { id: 'dons', g: 'g_gestion', roles: ['admin', 'editeur'] },
  { id: 'stats', g: 'g_gestion', roles: ['admin', 'editeur'] },
  { id: 'moncompte', g: 'g_compte', roles: ['membre', 'comite', 'editeur'] },
  { id: 'mesannonces', g: 'g_compte', roles: ['membre', 'comite', 'editeur'] },
  { id: 'monresume', g: 'g_compte', roles: ['membre', 'comite', 'editeur'] },
  { id: 'meligibilite', g: 'g_compte', roles: ['membre', 'comite', 'editeur'] },
  { id: 'monpret', g: 'g_compte', roles: ['membre', 'comite', 'editeur'] },
  { id: 'mesdemandes', g: 'g_compte', roles: ['membre', 'comite', 'editeur'] },
  { id: 'mescotisations', g: 'g_compte', roles: ['membre', 'comite', 'editeur'] },
  { id: 'messages', g: 'g_comm', roles: ['admin', 'editeur', 'comite'] },
  { id: 'caisse', g: 'g_treso', roles: ['admin', 'editeur'] },
  { id: 'banque', g: 'g_treso', roles: ['admin', 'editeur'] },
  { id: 'plancomptable', g: 'g_compta', roles: ['admin', 'editeur', 'comite:compta'] },
  { id: 'journal', g: 'g_compta', roles: ['admin', 'editeur', 'comite:compta'] },
  { id: 'balance', g: 'g_compta', roles: ['admin', 'editeur', 'comite:compta'] },
  { id: 'bilan', g: 'g_compta', roles: ['admin', 'editeur', 'comite:compta'] },
  { id: 'resultats', g: 'g_compta', roles: ['admin', 'editeur', 'comite:compta'] },
  // Rapport complet : comité et personnes autorisées ; les autres membres voient le résumé dans « Mon compte »
  { id: 'rapport', g: 'g_rapports', roles: ['admin', 'editeur', 'comite'] },
  { id: 'statuts', g: 'g_docs', roles: ['admin', 'editeur', 'docs'] },
  { id: 'reglement', g: 'g_docs', roles: ['admin', 'editeur', 'docs'] },
  { id: 'sauvegarde', g: 'g_outils', roles: ['admin', 'editeur'] },
  { id: 'parametres', g: 'g_outils', roles: ['admin'] },
];
function canSee(pageId) {
  const def = PAGE_DEFS.find((p) => p.id === pageId); if (!def) return false;
  const role = currentRole(); const m = currentMember();
  return def.roles.some((r) => {
    if (r === role) return true;
    if (r === 'docs') return !!(m && m.can_see_documents);
    if (r.startsWith('comite:') && role === 'comite') {
      const k = r.split(':')[1];
      return !!(m && m['comite_see_' + k]);
    }
    return false;
  });
}
function go(page, param) {
  if (!canSee(page)) { toast('Accès non autorisé.', 'err'); return; }
  STATE.page = page; STATE.param = param === undefined ? null : param;
  const def = PAGE_DEFS.find((p) => p.id === page); if (def) setGroupOpen(def.g, true);
  STATE.menuOpen = false;
  document.querySelector('.app') && document.querySelector('.app').classList.remove('menu-open');
  render(); window.scrollTo(0, 0);
}
function canEdit() { const r = currentRole(); return r === 'admin' || r === 'editeur'; }
function isAdmin() { return currentRole() === 'admin'; }

/* ---------- Rendu global ---------- */
function logoImg(cls) {
  const src = SETTINGS.logo || (typeof EMBEDDED_LOGO !== 'undefined' ? EMBEDDED_LOGO : '');
  return src ? '<img class="' + (cls || '') + '" alt="Logo UNIE-MUSO" src="' + src + '">' : '';
}
function renderLogin() {
  document.getElementById('root').innerHTML =
    '<div class="login-wrap">' +
      '<div class="login-side"><div>' + logoImg('brand-logo') +
        '<h1>UNIE-MUSO</h1><p>' + esc(t('tagline')) + '</p></div>' +
        '<div class="place">Petit-Goâve · Haïti</div></div>' +
      '<div class="login-form-wrap"><form class="login-form" id="lg-form" autocomplete="on">' +
        '<div class="lang-switch" style="float:right">' + ['fr', 'kr'].map((l) => '<button type="button" class="' + (currentLang() === l ? 'on' : '') + '" data-act="setLang" data-id="' + l + '">' + l.toUpperCase() + '</button>').join('') + '</div>' +
        '<h2>' + t('login_title') + '</h2>' +
        '<label for="lg-id">' + t('login_id') + '</label>' +
        '<input id="lg-id" name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false">' +
        '<label for="lg-pwd">' + t('login_pwd') + '</label>' +
        '<div class="pwd-row"><input id="lg-pwd" type="password" name="password" autocomplete="current-password" autocapitalize="off" autocorrect="off">' +
        '<button type="button" class="btn" id="lg-show">' + t('show') + '</button></div>' +
        '<button type="submit" class="btn btn-primary" id="lg-btn">' + t('login_btn') + '</button>' +
        '<div class="login-error" id="lg-err" role="alert"></div>' +
      '</form></div></div>';
  let handled = false;
  const form = document.getElementById('lg-form');
  form.addEventListener('submit', (e) => { handled = true; onLogin(e); setTimeout(() => { handled = false; }, 50); });
  document.getElementById('lg-btn').addEventListener('click', () => {
    setTimeout(() => { if (!handled && document.getElementById('lg-form')) onLogin(); }, 30);
  });
  document.getElementById('lg-show').addEventListener('click', (e) => {
    const p = document.getElementById('lg-pwd');
    p.type = p.type === 'password' ? 'text' : 'password';
    e.target.textContent = p.type === 'password' ? t('show') : t('hide');
  });
}
function sidebarHTML() {
  const groups = [];
  PAGE_DEFS.forEach((p) => {
    if (!canSee(p.id)) return;
    let g = groups.find((x) => x.g === p.g);
    if (!g) { g = { g: p.g, items: [] }; groups.push(g); }
    g.items.push(p);
  });
  const pending = DB.demandes_pret.filter((d) => d.statut === 'En attente').length;
  const me = SESSION && SESSION.type === 'member' ? SESSION.code : null;
  const counts = { demandes: pending, messages: commPending(), moncompte: memberUnread(me, 'replies'), mesannonces: memberUnread(me, 'annonces') };
  STATE.navTotal = PAGE_DEFS.filter((p) => canSee(p.id)).reduce((s2, p) => s2 + (counts[p.id] || 0), 0);
  const roleLabel = { admin: 'Administrateur', editeur: 'Autorisé à modifier', membre: 'Membre', comite: 'Membre du comité' }[currentRole()];
  const u = SESSION.type === 'user' ? USERS[SESSION.id] : null; const m = currentMember();
  return '<aside class="sidebar" aria-label="Navigation">' +
    '<div class="sb-brand">' + logoImg() + '<div><div class="t">UNIE-MUSO</div><div class="s">Petit-Goâve</div></div></div>' +
    groups.map((g) => {
      const link = (p, sub) => '<button class="sb-link' + (sub ? ' sb-sub' : '') + (STATE.page === p.id ? ' active' : '') + '" data-go="' + p.id + '">' + t(p.id) +
        (counts[p.id] ? '<span class="count">' + counts[p.id] + '</span>' : '') + '</button>';
      // Groupe d'une seule page : lien direct, sans titre
      if (g.items.length === 1) return '<div class="sb-group">' + link(g.items[0]) + '</div>';
      // Chaque groupe est un bouton qui se déroule ; celui de la page affichée reste ouvert
      const open = groupOpen(g.g, g.items.some((p) => p.id === STATE.page));
      const hidden = open ? 0 : sum(g.items, (p) => counts[p.id] || 0);
      return '<div class="sb-group"><button class="sb-link sb-toggle' + (open ? ' open' : '') + '" data-act="toggleGroup" data-id="' + g.g + '" aria-expanded="' + open + '">' + t(g.g) +
        (hidden ? '<span class="count">' + hidden + '</span>' : '') + '<span class="chev">' + (open ? '▾' : '▸') + '</span></button>' + (open ? g.items.map((p) => link(p, true)).join('') : '') + '</div>';
    }).join('') +
    '<div class="sb-foot"><div class="who">' + esc(currentName()) + '</div><div class="role">' +
      esc((u && u.position) || (m && m.comite_poste) || roleLabel) + (m ? ' · ' + m.code : '') + '</div>' +
      '<button data-logout>' + t('logout') + '</button></div></aside><div class="sb-overlay" data-menu-close></div>';
}
let CHARTS_AFTER = [];
function render() {
  resetCalc();
  if (!SESSION) { renderLogin(); return; }
  if (!canSee(STATE.page)) STATE.page = PAGE_DEFS.find((p) => canSee(p.id)).id;
  const page = PAGES[STATE.page];
  let html;
  try { html = page(); } catch (err) {
    console.error(err);
    html = '<div class="panel"><div class="panel-body">Erreur d’affichage : ' + esc(err.message) + '</div></div>';
  }
  const crumbGroup = t(PAGE_DEFS.find((p) => p.id === STATE.page).g);
  document.getElementById('root').innerHTML =
    '<div class="app">' + sidebarHTML() +
      '<div class="main"><header class="topbar">' +
        '<button class="mobile-topbar-btn" data-menu aria-label="Menu">☰' + (STATE.navTotal ? '<span class="badge-count">' + STATE.navTotal + '</span>' : '') + '</button>' +
        '<div class="crumb">' + esc(crumbGroup) + ' / <b>' + esc(t(STATE.page)) + '</b></div><div class="spacer"></div>' +
        '<div class="lang-switch" role="group" aria-label="Langue">' + ['fr', 'kr'].map((l) => '<button class="' + (currentLang() === l ? 'on' : '') + '" data-act="setLang" data-id="' + l + '">' + l.toUpperCase() + '</button>').join('') + '</div>' +
        '<div class="today">' + esc(longDate(today())) + '</div></header>' +
        '<main class="content" id="content">' + html + '</main></div></div>';
  bindGlobal();
  tryShowNotifications(false);
}
function bindGlobal() {
  const root = document.getElementById('root');
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go, b.dataset.param)));
  const lo = root.querySelector('[data-logout]'); if (lo) lo.addEventListener('click', logout);
  // Menu sur téléphone : son état survit au réaffichage (dérouler un groupe ne le ferme pas)
  const app = root.querySelector('.app');
  if (app && STATE.menuOpen) app.classList.add('menu-open');
  const mb = root.querySelector('[data-menu]'); if (mb) mb.addEventListener('click', () => { STATE.menuOpen = !app.classList.contains('menu-open'); app.classList.toggle('menu-open', STATE.menuOpen); });
  const mc = root.querySelector('[data-menu-close]'); if (mc) mc.addEventListener('click', () => { STATE.menuOpen = false; app.classList.remove('menu-open'); });
  const sb = root.querySelector('.sidebar'); if (sb && STATE.sbScroll) sb.scrollTop = STATE.sbScroll;
  if (sb) sb.addEventListener('scroll', () => { STATE.sbScroll = sb.scrollTop; }, { passive: true });
}
/* Choix de la langue pour soi seul : enregistré sur sa fiche (membre) ou son compte (gestion) */
function setMyLang(l) {
  store.rawSet(LANG_KEY, l);
  if (SESSION && SESSION.type === 'member') { const m = getMember(SESSION.code); if (m) { m.lang = l; saveDB(); } }
  else if (SESSION && USERS[SESSION.id]) { USERS[SESSION.id].lang = l; saveUsers(); }
}
/* Délégation d'événements : data-act="nom" data-id="..." */
const ACTIONS = {};
/* Groupes du menu ouverts / fermés, mémorisés sur l'appareil (Gestion ouvert la première fois) */
const MENU_KEY = 'uniemuso-menu-open';
/* État gardé en mémoire (fonctionne même si l'appareil bloque le stockage), copié sur l'appareil si possible */
let MENU_MEM = null;
function menuState() {
  if (!MENU_MEM) { try { MENU_MEM = JSON.parse(store.raw(MENU_KEY) || '{"g_gestion":true}'); } catch (_e) { MENU_MEM = { g_gestion: true }; } }
  return MENU_MEM;
}
function groupOpen(g, active) { const st = menuState(); return st[g] === undefined ? !!active : !!st[g]; }
function setGroupOpen(g, v) { menuState()[g] = v; store.rawSet(MENU_KEY, JSON.stringify(MENU_MEM)); }
ACTIONS.toggleGroup = (g) => {
  const active = PAGE_DEFS.some((p) => p.g === g && p.id === STATE.page);
  setGroupOpen(g, !groupOpen(g, active)); render();
};
ACTIONS.setLang = (l) => { setMyLang(l); SESSION ? render() : renderLogin(); };
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset.id, el); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.change];
  if (fn) fn(el.dataset.id, el);
});

/* Petits composants */
function pageHead(eyebrow, title, sub, actions) {
  return '<div class="page-head"><div><div class="eyebrow">' + esc(eyebrow) + '</div><h1>' + esc(title) + '</h1>' +
    (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' + (actions ? '<div class="actions">' + actions + '</div>' : '') + '</div>';
}
function kpi(label, value, hint, color, cls) {
  return '<div class="kpi ' + (color || '') + '"><div class="l">' + esc(label) + '</div><div class="v ' + (cls || '') + '">' + value + '</div>' +
    (hint ? '<div class="h">' + hint + '</div>' : '') + '</div>';
}
function panel(title, body, opts) {
  opts = opts || {};
  return '<section class="panel"' + (opts.id ? ' id="' + opts.id + '"' : '') + '><div class="panel-head"><h2>' + esc(title) + '</h2>' +
    (opts.meta ? '<span class="meta">' + opts.meta + '</span>' : '') + (opts.right ? '<div class="right">' + opts.right + '</div>' : '') +
    '</div><div class="panel-body' + (opts.flush ? ' flush' : '') + '">' + body + '</div>' + (opts.note ? '<div class="section-note">' + opts.note + '</div>' : '') + '</section>';
}
function table(headers, rows, foot) {
  if (!rows.length) return '<div class="empty">Aucune donnée pour le moment.</div>';
  return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + headers.map((h) => {
    const [l, c] = Array.isArray(h) ? h : [h, '']; return '<th class="' + c + '">' + esc(l) + '</th>';
  }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>';
}
function statusBadge(s) {
  if (s === 'À jour' || s === 'Remboursé' || s === 'Approuvée' || s === 'Actif') return '<span class="badge b-green">' + esc(s) + '</span>';
  if (s === 'Partiel' || s === 'En attente' || s === 'en cours') return '<span class="badge b-orange">' + esc(s === 'en cours' ? 'En cours' : s) + '</span>';
  if (String(s).startsWith('En retard') || s === 'Rejetée') return '<span class="badge b-red">' + esc(s) + '</span>';
  return '<span class="badge b-grey">' + esc(s) + '</span>';
}

/* ---------- Bannières réunion / prêt ---------- */
function meetingBanner() {
  const d = nextMeeting(); const n = daysBetween(today(), d);
  if (n > 7) return '<div class="banner soft"><span class="bt">' + t('next_meeting') + '</span><span>' + esc(longDate(d)) + ' · ' + esc(SETTINGS.meeting_hour) + '–19h</span></div>';
  let cls = 'navy', txt = t('in_days', { n });
  if (n === 0) { cls = 'red'; txt = t('today_meeting'); } else if (n === 1) { cls = 'orange'; txt = t('tomorrow_meeting'); } else if (n <= 3) cls = 'orange';
  return '<div class="banner ' + cls + '"><span class="bt">' + esc(txt) + '</span><span>' + esc(longDate(d)) + ' · ' + esc(SETTINGS.meeting_hour) + '–19h00</span></div>';
}
function loanBanner(code) {
  const p = activeLoan(code); if (!p) return '';
  const r = nextInstallment(p); if (!r) return '';
  const n = daysBetween(today(), r.due);
  if (n > 7) return '';
  const cls = n < 0 ? 'red' : 'orange';
  const txt = n < 0 ? 'Échéance de prêt dépassée de ' + (-n) + ' jour(s)' : n === 0 ? 'Échéance de prêt aujourd’hui' : 'Échéance de prêt dans ' + n + ' jour(s)';
  return '<div class="banner ' + cls + '"><span class="bt">' + txt + '</span><span>Mensualité n° ' + r.n + ' · ' + money(r.du) + ' · ' + fmtD(r.due) + '</span></div>';
}
function importBanner() {
  return '<div class="banner import no-print"><span>📥</span><span>' + esc(t('import_banner')) + '</span>' +
    '<div class="right"><button class="btn btn-sm" data-act="importPick">' + esc(t('import_btn')) + '</button></div></div>';
}

/* ---------- Notifications et alarmes ---------- */
function canNotify() { return typeof Notification !== 'undefined'; }
function notify(title, body) {
  if (window.UnieNative && UnieNative.notify) { try { UnieNative.notify(title, body); return; } catch (_e) { /* */ } }
  if (canNotify() && Notification.permission === 'granted') { try { new Notification(title, { body }); } catch (_e) { toast(title + ' — ' + body, 'warn'); } } else toast(title + ' — ' + body, 'warn');
}
function tryShowNotifications(atLogin) {
  if (!SESSION) return;
  if (atLogin && canNotify() && Notification.permission === 'default' && !SETTINGS.notif_asked) {
    SETTINGS.notif_asked = true; saveSettings();
    try { Notification.requestPermission(); } catch (_e) { /* */ }
  }
  const d = nextMeeting(); const n = daysBetween(today(), d);
  const kM = 'notif-meeting-' + fmtD(d);
  if (n === 1 && !store.raw(kM)) { store.rawSet(kM, '1'); notify('UNIE-MUSO — réunion demain', longDate(d) + ' à ' + SETTINGS.meeting_hour); }
  const m = currentMember();
  const dow = today().getDay();
  if (m && activeLoan(m.code) && [1, 3, 5].includes(dow)) {
    const kL = 'notif-loan-' + fmtD(today());
    if (!store.raw(kL)) {
      store.rawSet(kL, '1');
      const r = nextInstallment(activeLoan(m.code));
      if (r) notify('UNIE-MUSO — remboursement de prêt', 'Mensualité n° ' + r.n + ' : ' + money(r.du) + ' pour le ' + fmtD(r.due));
    }
  }
  scheduleNativeAlarms();
}
/* Alarmes réunion configurables (vérifiées toutes les 30 s pendant que l'app est ouverte) */
function meetingAlarmTimes() {
  const d = nextMeeting(); const h = meetingHour();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h.h, h.m);
  return (SETTINGS.alarmes || []).filter((a) => a.on).map((a) => ({ at: new Date(start.getTime() - a.min * 60000), a, start }));
}
function checkAlarms() {
  const now = Date.now();
  meetingAlarmTimes().forEach((x) => {
    const key = 'notif-alarm-' + fmtD(x.start) + '-' + x.a.min;
    if (now >= x.at.getTime() && now < x.at.getTime() + 10 * 60000 && !store.raw(key)) {
      store.rawSet(key, '1');
      notify('UNIE-MUSO — réunion', x.a.min ? 'La réunion commence dans ' + (x.a.min >= 60 ? Math.floor(x.a.min / 60) + 'h' + (x.a.min % 60 ? pad(x.a.min % 60) : '') : x.a.min + ' min') + ' (' + SETTINGS.meeting_hour + ').' : 'La réunion commence maintenant.');
    }
  });
}
function scheduleNativeAlarms() {
  if (!(window.UnieNative && UnieNative.scheduleAlarms)) return;
  try {
    const list = meetingAlarmTimes().filter((x) => x.at.getTime() > Date.now()).map((x) => ({
      at: x.at.getTime(), title: 'UNIE-MUSO — réunion', body: x.a.min ? 'Réunion à ' + SETTINGS.meeting_hour + ' (' + x.a.label + ')' : 'La réunion commence maintenant.',
    }));
    UnieNative.scheduleAlarms(JSON.stringify(list));
  } catch (_e) { /* */ }
}

/* ---------- Impression (navigateur, Windows, Android) ---------- */
function printHTML(title, html) {
  const doc = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + document.getElementById('app-css').textContent + 'body{padding:20px;background:#fff}</style></head><body>' + html + '</body></html>';
  if (window.UnieNative && UnieNative.printHtml) { try { UnieNative.printHtml(title, doc); return; } catch (_e) { /* repli */ } }
  const w = window.open('', '_blank');
  if (!w) { toast('Impression : autorisez les fenêtres pour cette application.', 'warn'); return; }
  w.document.write(doc); w.document.close(); setTimeout(() => w.print(), 350);
}
/* Sur Android, window.print() n'existe pas dans la WebView : on passe par le service d'impression du téléphone */
if (window.UnieNative && UnieNative.print) { window.print = function () { UnieNative.print(); }; }
