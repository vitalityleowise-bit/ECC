/* JOYAGRI — coque de l'application : démarrage, connexion, navigation, tableau de bord. */
(function (root) {
  'use strict';
  const J = root.J;
  const U = J.ui;
  const { h, icon } = U;
  const A = (J.app = { user: null, screens: {} });

  const NAV = [
    { id: 'accueil', label: 'Accueil', icon: 'home', grp: 'Ventes' },
    { id: 'vente', label: 'Nouvelle vente', icon: 'cart', grp: 'Ventes' },
    { id: 'fiches', label: 'Fiches de vente', icon: 'receipt', grp: 'Ventes' },
    { id: 'credits', label: 'Crédits clients', icon: 'clock', grp: 'Ventes' },
    { id: 'clients', label: 'Clients', icon: 'users', grp: 'Ventes' },
    { id: 'caisse', label: 'Caisse du jour', icon: 'cash', grp: 'Argent' },
    { id: 'depenses', label: 'Dépenses', icon: 'wallet', grp: 'Argent' },
    { id: 'catalogue', label: 'Catalogue', icon: 'icecream', grp: 'Gestion' },
    { id: 'stock', label: 'Stock', icon: 'box', grp: 'Gestion' },
    { id: 'achats', label: 'Achats & fournisseurs', icon: 'truck', grp: 'Gestion', owner: true },
    { id: 'rapports', label: 'Rapports', icon: 'chart', grp: 'Pilotage', owner: true },
    { id: 'compta', label: 'Comptabilité', icon: 'book', grp: 'Pilotage', owner: true },
    { id: 'parametres', label: 'Paramètres', icon: 'settings', grp: 'Système', owner: true },
    { id: 'utilisateurs', label: 'Utilisateurs', icon: 'user', grp: 'Système', owner: true },
    { id: 'sauvegarde', label: 'Sauvegarde', icon: 'save', grp: 'Système' },
  ];
  A.NAV = NAV;
  A.allowed = (id) => { const n = NAV.find((x) => x.id === id); return !n || !n.owner || J.isOwner(A.user); };

  /* ---------- Démarrage ---------- */
  A.start = async () => {
    await J.load();
    A.applyTheme(J.db.settings.theme);
    document.title = J.db.settings.name || 'JOYAGRI';
    try { const id = sessionStorage.getItem('joyagri:user'); if (id) A.user = J.db.users.find((u) => u.id === id && u.active) || null; } catch (e) { /* navigation privée */ }
    window.addEventListener('hashchange', A.render);
    root.addEventListener('beforeunload', () => J.saveNow());
    document.addEventListener('visibilitychange', () => { if (document.hidden) J.saveNow(); });
    A.render();
  };
  A.go = (route) => { if (location.hash === '#/' + route) A.render(); else location.hash = '#/' + route; };
  A.route = () => (location.hash.replace(/^#\/?/, '') || 'accueil').split('?')[0];
  A.param = (k) => new URLSearchParams(location.hash.split('?')[1] || '').get(k);

  const brandName = (n) => { const s = String(n || 'JOYAGRI'); return /GRI$/i.test(s) ? [s.slice(0, -3), h('span', null, s.slice(-3))] : s; };
  A.brandName = brandName;
  A.logo = () => J.db.settings.logo || J.LOGO;

  A.THEMES = [
    { id: 'ocean', name: 'Océan', desc: 'Bleu marine, menu sombre à gauche', sw: ['#0B1B33', '#1D4ED8', '#3B82F6', '#F4F7FB'], meta: '#0B1B33' },
    { id: 'azur', name: 'Azur', desc: 'Bleu ciel, tout en clair, arrondi', sw: ['#FFFFFF', '#0284C7', '#38BDF8', '#F0F9FF'], meta: '#FFFFFF' },
    { id: 'nuit', name: 'Nuit', desc: 'Bleu nuit, mode sombre', sw: ['#0A1224', '#101B33', '#3B82F6', '#60A5FA'], meta: '#0A1224' },
    { id: 'royal', name: 'Royal', desc: 'Bleu royal, menu en haut, style entreprise', sw: ['#172554', '#1E3A8A', '#4338CA', '#F5F6FA'], meta: '#172554' },
  ];
  /** Applique le modèle choisi (couleurs + disposition du menu). */
  A.applyTheme = (id) => {
    const t = A.THEMES.find((x) => x.id === id) || A.THEMES[0];
    document.documentElement.dataset.theme = t.id;
    document.documentElement.dataset.layout = t.id === 'royal' ? 'top' : 'side';
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t.meta);
  };

  A.render = () => {
    A.applyTheme(J.db.settings.theme);
    document.querySelectorAll('.overlay.sheet-ov').forEach((o) => o.remove());
    const app = document.getElementById('app');
    app.innerHTML = '';
    if (!J.db.users.length) { app.appendChild(A.setup()); return; }
    if (!A.user) { app.appendChild(A.login()); return; }
    let r = A.route();
    if (!A.allowed(r)) r = 'accueil';
    const s = J.db.settings;
    const top = h('header', { class: 'topbar' },
      h('div', { class: 'brand' }, h('img', { src: A.logo(), alt: '' }),
        h('div', { style: { minWidth: 0 } }, h('b', null, brandName(s.name)), h('small', null, s.slogan))),
      h('div', { class: 'who' }, h('span', { class: 'hide-sm' }, A.user.name), h('button', { onclick: A.logout, title: 'Se déconnecter' }, 'Sortir')));
    const side = h('nav', { class: 'side', 'aria-label': 'Menu' });
    let grp = '';
    NAV.filter((n) => A.allowed(n.id)).forEach((n) => {
      if (n.grp !== grp) { grp = n.grp; side.appendChild(h('div', { class: 'grp' }, grp)); }
      side.appendChild(h('a', { href: '#/' + n.id, class: r === n.id ? 'on' : '' }, icon(n.icon), n.label));
    });
    const main = h('main', { id: 'main' });
    const bn = (id, label, ic, cls) => h('a', { href: '#/' + id, class: (r === id ? 'on ' : '') + (cls || '') },
      cls === 'sell' ? h('span', { class: 'bubble' }, icon(ic)) : icon(ic), h('span', null, label));
    const bottom = h('nav', { class: 'bottomnav', 'aria-label': 'Navigation' },
      bn('accueil', 'Accueil', 'home'), bn('fiches', 'Fiches', 'receipt'), bn('vente', 'Vendre', 'cart', 'sell'), bn('clients', 'Clients', 'users'),
      h('button', { class: 'more', onclick: () => A.sheet(), 'aria-label': 'Plus de fonctions' }, icon('grid'), h('span', null, 'Plus')));
    app.append(top, h('div', { class: 'layout' }, side, main), bottom);
    const screen = A.screens[r] || A.screens.accueil;
    try { const out = screen(main); if (out) main.appendChild(out); } catch (e) { console.error(e); main.appendChild(h('div', { class: 'alert red' }, 'Erreur : ' + e.message)); }
    root.scrollTo(0, 0);
  };
  A.title = (t, ...right) => h('div', { class: 'page-title' }, h('h1', null, t), right.length ? h('div', { class: 'row' }, right) : null);

  /* ---------- Premier démarrage : aucun mot de passe par défaut ---------- */
  A.setup = () => {
    const s = J.db.settings;
    const f = {
      name: U.field("Nom commercial", 'text', s.name), slogan: U.field('Slogan', 'text', s.slogan),
      owner: U.field('Propriétaire', 'text', s.owner), phone: U.field('Téléphone', 'tel', s.phone),
      address: U.field('Adresse', 'text', s.address), nif: U.field('NIF', 'text', s.nif),
      ninu: U.field('NINU', 'text', s.ninu), rc: U.field("N° d'immatriculation (Registre du commerce)", 'text', s.rc),
      uname: U.field('Votre nom (compte propriétaire)', 'text', s.owner), login: U.field('Identifiant de connexion', 'text', 'patron'),
      pw: U.field('Mot de passe', 'password', ''), pw2: U.field('Confirmer le mot de passe', 'password', ''),
    };
    f.pw.input.autocomplete = 'new-password'; f.pw2.input.autocomplete = 'new-password';
    const go = U.safe(() => {
      if (f.pw.get() !== f.pw2.get()) throw new Error('Les deux mots de passe ne sont pas identiques.');
      ['name', 'slogan', 'owner', 'phone', 'address', 'nif', 'ninu', 'rc'].forEach((k) => { s[k] = f[k].get(); });
      if (!s.name) throw new Error('Le nom commercial est obligatoire.');
      const u = J.createUser(f.uname.get() || s.owner || 'Propriétaire', f.login.get(), 'owner', f.pw.get());
      J.audit(u, 'Installation', 'Compte propriétaire créé');
      J.saveNow();
      A.setUser(u);
      U.toast('Bienvenue ! Commencez par le bilan d’ouverture puis le catalogue.', 'ok');
      A.go('accueil');
    });
    const importBtn = h('button', { class: 'btn light block', onclick: () => A.importFile() }, icon('upload'), 'Restaurer une sauvegarde ou un profil');
    return h('div', { class: 'login' }, h('div', { class: 'box', style: { maxWidth: '560px' } },
      h('img', { class: 'logo', src: A.logo(), alt: 'Logo' }),
      h('h1', null, brandName(s.name)), h('div', { class: 'slogan' }, s.slogan),
      h('div', { class: 'card' }, h('h2', null, 'Installation — entreprise'),
        h('div', { class: 'grid g2 stack' }, f.name, f.slogan, f.owner, f.phone), f.address,
        h('div', { class: 'grid g3 stack' }, f.nif, f.ninu, f.rc)),
      h('div', { class: 'card' }, h('h2', null, 'Compte du propriétaire'),
        h('p', { class: 'muted small' }, 'Aucun mot de passe n’est fourni d’avance : choisissez le vôtre. Le propriétaire pourra ensuite créer les comptes des vendeurs.'),
        h('div', { class: 'grid g2 stack' }, f.uname, f.login, f.pw, f.pw2),
        h('button', { class: 'btn xl block', onclick: go }, icon('check'), 'Créer et commencer')),
      h('div', { style: { marginTop: '12px' } }, importBtn)));
  };

  /* ---------- Connexion ---------- */
  const tries = { n: 0, until: 0 };
  A.login = () => {
    const users = J.db.users.filter((u) => u.active);
    let sel = users.length === 1 ? users[0] : null;
    const pw = h('input', { type: 'password', class: 'inp', placeholder: 'Mot de passe', autocomplete: 'current-password' });
    const msg = h('div', { class: 'small red', style: { minHeight: '20px', margin: '6px 0' } });
    const grid = h('div', { class: 'users' });
    const draw = () => {
      grid.innerHTML = '';
      users.forEach((u) => grid.appendChild(h('button', { class: sel === u ? 'on' : '', onclick: () => { sel = u; draw(); pw.focus(); } },
        h('span', { class: 'avatar ' + (u.role === 'owner' ? 'gold' : '') }, U.initials(u.name)), u.name,
        h('span', { class: 'tag ' + (u.role === 'owner' ? 'gold' : '') }, u.role === 'owner' ? 'Propriétaire' : 'Vendeur'))));
    };
    draw();
    const go = () => {
      if (Date.now() < tries.until) { msg.textContent = `Trop d'essais. Patientez ${Math.ceil((tries.until - Date.now()) / 1000)} s.`; return; }
      if (!sel) { msg.textContent = 'Choisissez votre nom.'; return; }
      if (!J.checkPassword(sel, pw.value)) {
        tries.n++;
        // Pas d'essais en boucle : après 5 erreurs, attente obligatoire
        if (tries.n >= 5) { tries.until = Date.now() + 30000; tries.n = 0; }
        msg.textContent = 'Mot de passe incorrect.'; pw.value = ''; pw.focus(); return;
      }
      tries.n = 0;
      A.setUser(sel);
      J.audit(sel, 'Connexion');
      J.save();
      A.go(A.route() === 'menu' ? 'accueil' : A.route());
    };
    pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    const s = J.db.settings;
    setTimeout(() => sel && pw.focus(), 50);
    return h('div', { class: 'login' }, h('div', { class: 'box' },
      h('img', { class: 'logo', src: A.logo(), alt: 'Logo' }),
      h('h1', null, brandName(s.name)), h('div', { class: 'slogan' }, s.slogan),
      h('div', { class: 'card' }, h('h2', null, 'Qui êtes-vous ?'), grid, pw, msg,
        h('button', { class: 'btn xl block', onclick: go }, icon('lock'), 'Entrer')),
      h('p', { class: 'muted small', style: { textAlign: 'center' } }, 'Mot de passe oublié ? Le propriétaire peut en donner un nouveau dans « Utilisateurs ».')));
  };
  A.setUser = (u) => { A.user = u; try { sessionStorage.setItem('joyagri:user', u.id); } catch (e) { /* rien */ } };
  A.logout = () => { J.saveNow(); A.user = null; try { sessionStorage.removeItem('joyagri:user'); } catch (e) { /* rien */ } location.hash = '#/accueil'; A.render(); };

  /* ---------- Panneau « Plus » : toutes les fonctions en tuiles (téléphone) ---------- */
  const tiles = (onPick) => {
    const wrap = h('div');
    let grp = '';
    let grid = null;
    NAV.filter((n) => A.allowed(n.id) && n.id !== 'accueil').forEach((n) => {
      if (n.grp !== grp) { grp = n.grp; wrap.appendChild(h('h4', null, grp)); grid = h('div', { class: 'tiles' }); wrap.appendChild(grid); }
      grid.appendChild(h('a', { class: 'tile' + (A.route() === n.id ? ' on' : ''), href: '#/' + n.id, onclick: onPick }, h('span', { class: 'ic' }, icon(n.icon)), n.label));
    });
    return wrap;
  };
  A.sheet = () => {
    const close = () => ov.remove();
    const ov = h('div', { class: 'overlay sheet-ov', onclick: (e) => { if (e.target === ov) close(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Toutes les fonctions' }, h('div', { class: 'grab' }),
        h('div', { class: 'who' }, h('span', { class: 'avatar' }, U.initials(A.user.name)), h('div', { style: { flex: 1 } }, h('b', null, A.user.name), h('small', { class: 'muted' }, J.isOwner(A.user) ? 'Propriétaire' : 'Vendeur')),
          h('button', { class: 'btn sm light', onclick: () => { close(); A.logout(); } }, icon('logout'), 'Sortir')),
        tiles(close)));
    document.body.appendChild(ov);
  };
  A.screens.menu = () => h('div', null, A.title('Toutes les fonctions'), h('div', { class: 'card' }, tiles()),
    h('button', { class: 'btn light block', style: { marginTop: '14px' }, onclick: A.logout }, icon('logout'), 'Se déconnecter'));

  /* ---------- Tableau de bord ---------- */
  A.bars = (byDay, from, days) => {
    const keys = []; for (let i = 0; i < days; i++) keys.push(J.addDays(from, i));
    const max = Math.max(1, ...keys.map((k) => byDay[k] || 0));
    return h('div', { class: 'bars', role: 'img', 'aria-label': 'Ventes par jour' }, keys.map((k) => h('div', { class: 'b', title: `${J.fmtDate(k)} : ${J.fmt(byDay[k] || 0)}` },
      h('i', { style: { height: `${Math.round(((byDay[k] || 0) / max) * 100)}%` } }), h('span', null, k.slice(8) + '/' + k.slice(5, 7)))));
  };
  A.hbars = (rows, cls, fmtFn) => {
    const max = Math.max(1, ...rows.map((r) => r.amount));
    return h('div', null, rows.map((r) => h('div', { class: 'hbar' }, h('span', null, r.name), h('b', { class: 'num' }, (fmtFn || J.fmt)(r.amount)),
      h('div', { class: 'track' }, h('i', { class: cls || '', style: { width: `${Math.max(2, (r.amount / max) * 100)}%` } })))));
  };
  A.donut = (parts) => {
    const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
    let acc = 0;
    const R = 52; const C = 2 * Math.PI * R;
    const circles = parts.map((p) => { const len = (p.v / tot) * C; const c = `<circle r="${R}" cx="70" cy="70" fill="none" style="stroke:${p.c}" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"/>`; acc += len; return c; }).join('');
    const svg = h('div', { class: 'donut', html: `<svg viewBox="0 0 140 140" width="140" height="140"><circle r="${R}" cx="70" cy="70" fill="none" style="stroke:var(--p-soft)" stroke-width="22"/>${circles}</svg>` });
    return h('div', { class: 'row', style: { gap: '18px', flexWrap: 'nowrap' } }, svg, h('div', { class: 'legend' }, parts.map((p) => h('div', null, h('i', { style: { background: p.c } }), h('span', null, p.l), h('b', { class: 'num', style: { marginLeft: 'auto' } }, `${Math.round((p.v / tot) * 100)} %`)))));
  };
  A.COLORS = { S: 'var(--c1)', G: 'var(--c2)', D: 'var(--c3)' };

  A.screens.accueil = () => {
    const today = J.today();
    const r = J.salesReport(today, today);
    const owner = J.isOwner(A.user);
    const rec = J.receivables();
    const due = rec.reduce((a, x) => a + x.amount, 0);
    const cash = J.currentCash();
    const low = J.db.products.filter((p) => p.active !== false && p.lowStock && (p.stock || 0) <= p.lowStock);
    const sleeping = J.sleepingStock(10);
    const overdue = rec.filter((x) => x.overdue);
    const hour = Number(new Intl.DateTimeFormat('fr', { timeZone: J.TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
    const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const alerts = [];
    if (owner && !J.db.opening.done) alerts.push(h('a', { class: 'alert', href: '#/compta?tab=ouverture' }, icon('alert'), h('span', null, h('b', null, "Bilan d'ouverture à saisir. "), 'Entrez ce que l’entreprise possède déjà (solaire, congélateurs, stock, caisse, capital).')));
    if (!cash) alerts.push(h('a', { class: 'alert', href: '#/caisse' }, icon('cash'), h('span', null, h('b', null, 'Caisse non ouverte. '), 'Ouvrez la caisse avant les premières ventes en cash.')));
    if (low.length) alerts.push(h('a', { class: 'alert red', href: '#/stock' }, icon('box'), h('span', null, h('b', null, `Stock bas : `), low.map((p) => `${J.productLabel(p)} (${J.fmtQty(p.stock || 0)})`).join(', '))));
    if (sleeping.length) alerts.push(h('a', { class: 'alert', href: '#/stock' }, icon('snow'), h('span', null, h('b', null, 'Risque de fonte / qualité : '), sleeping.map((x) => `${J.productLabel(x.p)} (${x.since} j sans vente)`).join(', '))));
    if (overdue.length) alerts.push(h('a', { class: 'alert red', href: '#/credits' }, icon('clock'), h('span', null, h('b', null, `${overdue.length} crédit(s) en retard. `), 'Envoyez un rappel WhatsApp.')));
    const week0 = J.addDays(today, -6);
    const wk = J.salesReport(week0, today);
    return h('div', null,
      h('div', { class: 'page-title' }, h('div', null, h('h1', null, `${hello}, ${A.user.name.split(' ')[0]}`), h('div', { class: 'muted' }, new Intl.DateTimeFormat('fr-FR', { timeZone: J.TZ, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()))),
        h('a', { class: 'btn gold xl', href: '#/vente' }, icon('cart'), 'Nouvelle vente')),
      h('div', { class: 'grid g4' },
        U.kpi("Ventes aujourd'hui", J.fmt(r.total), `${r.count} fiche(s)`),
        U.kpi('Encaissé aujourd’hui', J.fmt(r.collected), 'ventes + crédits', 'blue'),
        U.kpi('Crédits à recevoir', J.fmt(due), `${rec.length} client(s)`, due ? 'red' : ''),
        U.kpi('Caisse', cash ? 'Ouverte' : 'Fermée', cash ? `depuis ${J.fmtTime(cash.openedAt)} — ${cash.openedBy}` : 'à ouvrir', 'gold')),
      alerts.length ? h('div', { class: 'list', style: { marginTop: '12px' } }, alerts) : null,
      h('div', { class: 'grid g2 stack', style: { marginTop: '12px' } },
        h('div', { class: 'card' }, h('h2', null, "Aujourd'hui par activité"),
          r.total ? A.donut([{ l: 'Services agricoles', v: r.act.S, c: A.COLORS.S }, { l: 'Glace — gros', v: r.act.G, c: A.COLORS.G }, { l: 'Glace — détail', v: r.act.D, c: A.COLORS.D }]) : h('p', { class: 'muted' }, 'Aucune vente pour le moment.'),
          h('div', { class: 'grid g3', style: { marginTop: '10px' } },
            h('div', null, h('div', { class: 'small muted' }, 'Services'), h('b', null, J.fmt(r.act.S))),
            h('div', null, h('div', { class: 'small muted' }, 'Gros'), h('b', null, J.fmt(r.act.G))),
            h('div', null, h('div', { class: 'small muted' }, 'Détail'), h('b', null, J.fmt(r.act.D))))),
        h('div', { class: 'card' }, h('h2', null, '7 derniers jours', h('span', { class: 'tag' }, J.fmt(wk.total))), A.bars(wk.byDay, week0, 7))),
      h('div', { class: 'grid g4', style: { marginTop: '12px' } },
        h('a', { class: 'btn light', href: '#/credits' }, icon('clock'), 'Encaisser un crédit'),
        h('a', { class: 'btn light', href: '#/depenses' }, icon('wallet'), 'Dépense'),
        h('a', { class: 'btn light', href: '#/caisse' }, icon('cash'), 'Caisse'),
        h('a', { class: 'btn light', href: '#/clients' }, icon('users'), 'Clients')));
  };

  /* ---------- Sauvegarde / restauration ---------- */
  A.exportBackup = () => {
    J.saveNow();
    const stamp = J.today() + '_' + J.fmtTime(J.nowISO()).replace(':', 'h');
    U.download(`${(J.db.settings.name || 'joyagri').toLowerCase()}-sauvegarde-${stamp}.json`, JSON.stringify(J.db), 'application/json');
    J.db.lastExport = J.nowISO(); J.save();
  };
  A.importFile = () => {
    const inp = h('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = U.safe(async () => {
        const data = JSON.parse(r.result);
        if (data.profile && data.settings && !data.sales) { // profil d'entreprise seul
          Object.assign(J.db.settings, data.settings);
          await J.saveNow(); U.toast('Profil de l’entreprise importé.', 'ok'); A.render(); return;
        }
        const ok = await U.confirm('Restaurer la sauvegarde ?', `Les données actuelles seront remplacées par celles du fichier « ${f.name} » (${(data.sales || []).length} fiches). Faites d’abord une sauvegarde si vous avez un doute.`, 'Restaurer', 'danger');
        if (!ok) return;
        await J.replaceDB(data);
        A.user = null;
        U.toast('Sauvegarde restaurée. Reconnectez-vous.', 'ok');
        A.render();
      });
      r.readAsText(f);
    };
    inp.click();
  };

  document.addEventListener('DOMContentLoaded', A.start);
})(window);
