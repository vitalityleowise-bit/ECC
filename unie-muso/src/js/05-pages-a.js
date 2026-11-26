/* =========================================================================
   Pages : graphiques, tableau de bord, membres, cotisations, prévisions
   ========================================================================= */
const PAGES = {};
const C = { navy: '#1A3A6B', orange: '#E8650A', green: '#2E7D32', red: '#C62828', grey: '#9AA4B2' };

/* ---------- Graphiques SVG (sans dépendance) ---------- */
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
function shortNum(v) { return v >= 1e6 ? round2(v / 1e6) + ' M' : v >= 1000 ? Math.round(v / 1000) + ' k' : String(Math.round(v)); }
/* series: [{label,color,values[]}] ; stacked ou groupé */
function barChart(labels, series, opts) {
  opts = opts || {};
  const W = 720, H = opts.h || 240, L = 46, R = 10, T = 12, B = 30;
  const n = labels.length; if (!n) return '<div class="empty">Aucune donnée.</div>';
  const totals = labels.map((_, i) => opts.stacked ? sum(series, (s) => s.values[i]) : Math.max(...series.map((s) => num(s.values[i]))));
  const max = niceMax(Math.max(1, ...totals));
  const iw = W - L - R, ih = H - T - B, slot = iw / n;
  const bw = opts.stacked ? Math.min(46, slot * 0.6) : Math.min(22, (slot * 0.75) / series.length);
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const y = T + ih - (ih * k) / 4;
    g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + shortNum((max * k) / 4) + '</text>';
  }
  labels.forEach((lab, i) => {
    const cx = L + slot * i + slot / 2;
    if (opts.stacked) {
      let acc = 0;
      series.forEach((s) => {
        const v = num(s.values[i]); if (!v) return;
        const h = (v / max) * ih; const y = T + ih - acc - h; acc += h;
        g += '<rect x="' + (cx - bw / 2) + '" y="' + y + '" width="' + bw + '" height="' + Math.max(0.5, h) + '" fill="' + s.color + '"><title>' + esc(lab + ' — ' + s.label + ' : ' + money(v)) + '</title></rect>';
      });
    } else {
      series.forEach((s, j) => {
        const v = num(s.values[i]); const h = (v / max) * ih;
        const x = cx - (bw * series.length) / 2 + j * bw;
        g += '<rect x="' + x + '" y="' + (T + ih - h) + '" width="' + (bw - 2) + '" height="' + Math.max(v ? 0.5 : 0, h) + '" fill="' + s.color + '"><title>' + esc(lab + ' — ' + s.label + ' : ' + money(v)) + '</title></rect>';
      });
    }
    g += '<text x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(lab) + '</text>';
  });
  g += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + ih) + '" y2="' + (T + ih) + '"/>';
  const legend = '<div class="legend">' + series.map((s) => '<span><i style="background:' + s.color + '"></i>' + esc(s.label) + '</span>').join('') + '</div>';
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.title || 'Graphique') + '">' + g + '</svg>' + legend;
}
function lineChart(labels, values, opts) {
  opts = opts || {};
  const W = 720, H = opts.h || 200, L = 52, R = 14, T = 14, B = 28;
  if (!labels.length) return '<div class="empty">Aucune donnée.</div>';
  const lo = Math.min(0, ...values), hi = niceMax(Math.max(1, ...values));
  const iw = W - L - R, ih = H - T - B;
  const x = (i) => L + (labels.length === 1 ? iw / 2 : (iw * i) / (labels.length - 1));
  const y = (v) => T + ih - ((v - lo) / (hi - lo)) * ih;
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4; g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + shortNum(v) + '</text>'; }
  const pts = values.map((v, i) => x(i) + ',' + y(v)).join(' ');
  g += '<polygon points="' + x(0) + ',' + y(Math.max(lo, 0)) + ' ' + pts + ' ' + x(values.length - 1) + ',' + y(Math.max(lo, 0)) + '" fill="' + C.navy + '" opacity=".08"/>';
  g += '<polyline points="' + pts + '" fill="none" stroke="' + C.navy + '" stroke-width="2"/>';
  values.forEach((v, i) => { g += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3" fill="#fff" stroke="' + C.navy + '" stroke-width="1.5"><title>' + esc(labels[i] + ' : ' + money(v)) + '</title></circle>'; });
  const step = Math.ceil(labels.length / 12);
  labels.forEach((l, i) => { if (i % step === 0 || i === labels.length - 1) g += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(l) + '</text>'; });
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.title || 'Évolution') + '">' + g + '</svg>';
}

/* ---------- Tableau de bord ---------- */
PAGES.dashboard = function () {
  const T = treasury();
  const actifs = DB.members.filter((m) => m.statut !== 'Inactif').length;
  const enCours = DB.prets.filter((p) => p.status !== 'Remboursé');
  const resteP = sum(enCours, (p) => loanTotals(p).reste);
  const dep = sum(DB.depenses, (d) => d.montant);
  const months = activityMonths();
  const evo = months.map((k) => treasury(endOfMonth(k)).actif);
  const recent = buildJournal().slice(-10).reverse();
  const late = DB.members.filter((m) => m.statut !== 'Inactif').map((m) => memberStats(m.code)).filter((s) => s.reste > 0);
  const pending = DB.demandes_pret.filter((d) => d.statut === 'En attente');
  const unnamed = DB.members.filter((m) => !m.nom).length;
  return importBanner() + meetingBanner() +
    (unnamed ? '<div class="banner soft"><span class="bt">' + unnamed + ' membre(s) sans nom.</span><span>Importez votre sauvegarde ou complétez les fiches dans « Membres ».</span><div class="right"><button class="btn btn-sm" data-go="membres">Ouvrir Membres</button></div></div>' : '') +
    pageHead('Gestion', t('dashboard'), 'Situation au ' + esc(fmtD(today())) + ' · exercice ' + esc(fiscalLabel())) +
    '<div class="kpis">' +
      kpi('Membres actifs', actifs + ' <small>/ ' + DB.members.length + '</small>', '', 'navy') +
      kpi('Caisse Verte', fmt(T.verteFonds) + ' <small>HTG</small>', 'dont prêtée : ' + fmt(T.prets), 'green') +
      kpi('Caisse Rouge', fmt(T.rougeFonds) + ' <small>HTG</small>', 'solidarité', 'red') +
      kpi('Banque CAP-AIDER', fmt(T.banque) + ' <small>HTG</small>', T.caisse ? 'liquidité : ' + fmt(T.caisse) : 'aucune liquidité en main', 'navy', T.banque < 0 ? 'neg' : '') +
      kpi('Prêts en cours', enCours.length + ' <small>· ' + fmt(resteP) + ' HTG</small>', 'reste à rembourser', 'orange') +
      kpi('Dépenses', fmt(dep) + ' <small>HTG</small>', DB.depenses.length + ' pièce(s)', '') +
    '</div>' +
    '<div class="grid-2-1">' +
      panel('Évolution de l’actif', lineChart(months.map((k) => monthLabel(k, true)), evo, { title: 'Actif total par mois' }), { meta: 'encaisse + banque + prêts, fin de mois' }) +
      '<div>' +
        panel('À suivre', table(['Point', ['Nb', 'n']], [
          '<tr class="clickable" data-go="previsions"><td>Membres en retard de cotisation</td><td class="n">' + late.length + '</td></tr>',
          '<tr class="clickable" data-go="demandes"><td>Demandes de prêt en attente</td><td class="n">' + pending.length + '</td></tr>',
          '<tr class="clickable" data-go="prets"><td>Mensualités de prêt en retard</td><td class="n">' + sum(enCours, (p) => loanTotals(p).retard) + '</td></tr>',
        ]), { flush: true }) +
        panel('Fonds (statuts art. 25)', '<dl class="dl">' +
          '<dt>Caisse Verte</dt><dd class="num">' + money(T.verteFonds) + '</dd>' +
          '<dt>— prêtée</dt><dd class="num">' + money(T.prets) + '</dd>' +
          '<dt>— disponible</dt><dd class="num">' + money(T.verteDispo) + '</dd>' +
          '<dt>Caisse Rouge</dt><dd class="num">' + money(T.rougeFonds) + '</dd></dl>') +
      '</div>' +
    '</div>' +
    panel('Activité récente', table(['Date', 'Pièce', 'Libellé', ['Montant', 'n']], recent.map((e) =>
      '<tr><td class="num">' + fmtD(e.date) + '</td><td class="code">' + esc(e.piece) + '</td><td>' + esc(e.lib) + '</td><td class="n">' + fmt(sum(e.lines, (l) => l.d)) + '</td></tr>')), { flush: true });
};
function fiscalLabel() {
  const s = parseD(RULES.fiscal_start) || new Date(2026, 9, 1);
  return MOIS[s.getMonth()].slice(0, 3) + '. ' + s.getFullYear() + ' → ' + MOIS[(s.getMonth() + 11) % 12].slice(0, 4) + '. ' + (s.getFullYear() + 1);
}

/* ---------- Membres ---------- */
PAGES.membres = function () {
  if (STATE.param) return memberSheet(STATE.param);
  const q = (STATE.q || '').toLowerCase();
  const list = DB.members.slice().sort(sortByCode).filter((m) => !q || (m.code + ' ' + memberName(m) + ' ' + m.telephone).toLowerCase().includes(q));
  const rows = list.map((m) => {
    const s = memberStats(m.code);
    return '<tr class="clickable" data-act="openMember" data-id="' + m.code + '"><td class="code">' + m.code + '</td><td><div class="who-cell">' + avatar(m, true) +
      '<span>' + (m.nom ? esc(memberName(m)) : '<span class="muted">Nom à compléter</span>') + '</span></div></td>' +
      '<td>' + esc(m.telephone || '') + '</td><td class="num">' + esc(m.date_adhesion || '—') + '</td>' +
      '<td class="n">' + fmt(s.total) + '</td><td>' + statusBadge(s.statut) + '</td>' +
      '<td>' + (m.is_comite ? '<span class="badge b-navy">' + esc(m.comite_poste || 'Comité') + '</span>' : '') + '</td>' +
      '<td>' + statusBadge(m.statut) + '</td></tr>';
  });
  return pageHead('Gestion', t('membres'), DB.members.length + ' membres · triés par code',
    canEdit() ? '<button class="btn btn-primary" data-act="newMember">Nouveau membre</button>' : '') +
    '<section class="panel"><div class="toolbar"><input type="search" placeholder="Rechercher un membre…" value="' + esc(STATE.q || '') + '" data-change="searchMember" style="min-width:220px"></div>' +
    table(['Code', 'Nom', 'Téléphone', 'Adhésion', ['Versé', 'n'], 'Cotisation', 'Comité', 'Statut'], rows) + '</section>';
};
ACTIONS.searchMember = (_id, el) => { STATE.q = el.value; render(); };
ACTIONS.openMember = (code) => { STATE.page = 'membres'; STATE.param = code; render(); window.scrollTo(0, 0); };
function memberSheet(code) {
  const m = getMember(code); if (!m) return '<div class="empty">Membre introuvable.</div>';
  const s = memberStats(code); const sc = creditScore(code);
  const loan = s.loan; const lt = loan ? loanTotals(loan) : null;
  return pageHead('Membres', memberName(m), '<span class="code">' + m.code + '</span> · adhésion ' + esc(m.date_adhesion || '—'),
    '<button class="btn" data-go="membres">← Liste</button>' + (canEdit() ? '<button class="btn btn-primary" data-act="editMember" data-id="' + code + '">' + t('edit') + '</button>' : '')) +
    '<div class="grid-2-1"><div>' +
      '<section class="panel"><div class="member-head">' + avatar(m) + '<div><div class="nm">' + esc(memberName(m)) + '</div>' +
        '<div class="muted">' + statusBadge(m.statut) + ' ' + (m.is_comite ? '<span class="badge b-navy">' + esc(m.comite_poste || 'Comité') + '</span>' : '') + '</div></div></div>' +
        '<div class="panel-body" style="border-top:1px solid var(--line-soft)"><dl class="dl">' +
          '<dt>Téléphone</dt><dd>' + esc(m.telephone || '—') + '</dd><dt>Email</dt><dd>' + esc(m.email || '—') + '</dd>' +
          '<dt>Adresse</dt><dd>' + esc(m.adresse || '—') + '</dd><dt>NIF</dt><dd class="num">' + esc(m.nif || '—') + '</dd>' +
          '<dt>Date de naissance</dt><dd>' + esc(m.date_naissance || '—') + '</dd><dt>Profession</dt><dd>' + esc(m.profession || '—') + '</dd>' +
          '<dt>Portail membre</dt><dd>' + (m.portal_password ? 'mot de passe défini' : '<span class="muted">aucun mot de passe</span>') + '</dd></dl></div></section>' +
      panel('Historique des cotisations', table(['Date', ['Verte', 'n'], ['Rouge', 'n'], ['Total', 'n'], 'Mode'], s.cots.slice().sort((a, b) => parseD(b.date) - parseD(a.date)).map((c) =>
        '<tr><td class="num">' + esc(c.date) + '</td><td class="n">' + fmt(c.verte) + '</td><td class="n">' + fmt(c.rouge) + '</td><td class="n">' + fmt(num(c.verte) + num(c.rouge)) + '</td><td>' + esc(c.mode) + '</td></tr>'),
        '<tr><td>Total</td><td class="n">' + fmt(s.verte) + '</td><td class="n">' + fmt(s.rouge) + '</td><td class="n">' + fmt(s.total) + '</td><td></td></tr>'), { flush: true }) +
    '</div><div>' +
      '<div class="kpis" style="grid-template-columns:1fr 1fr">' + kpi('Versé', fmt(s.total), 'attendu ' + fmt(s.attendu), 'green') + kpi('Reste dû', fmt(s.reste), s.statut, s.reste ? 'red' : 'green') +
        kpi('Amendes dues', fmt(s.amendesDues), 'payées ' + fmt(s.amendesPaid), 'orange') + kpi('Grille (auto)', fmt(sc.auto) + ' <small>/' + sc.autoMax + '</small>', '+ appréciation du comité /' + GRILLE.pts_comite, 'navy') + '</div>' +
      panel('Présences', attendanceSummary(s)) +
      panel('Prêt en cours', loan ? '<dl class="dl"><dt>Capital</dt><dd class="num">' + money(loan.capital) + '</dd><dt>Remboursé</dt><dd class="num">' + money(lt.rembourse) + '</dd>' +
        '<dt>Reste</dt><dd class="num">' + money(lt.reste) + '</dd><dt>Mensualités</dt><dd class="num">' + lt.nbPaid + ' / ' + lt.nb + '</dd></dl>' +
        '<div style="margin-top:10px"><button class="btn btn-sm" data-act="openLoan" data-id="' + loan.id + '">Voir l’échéancier</button></div>' : '<span class="muted">Aucun prêt en cours.</span>') +
    '</div></div>';
}
function attendanceSummary(s) {
  const lbl = { present: 'Présent', retard: 'Retard', represente: 'Représenté', absence: 'Absent' };
  const cls = { present: 'b-green', retard: 'b-orange', represente: 'b-navy', absence: 'b-red' };
  return '<div class="num" style="font-size:16px;font-weight:600">' + s.presents + ' / ' + s.meetings.length + ' réunions</div>' +
    '<div class="muted" style="margin:4px 0 8px">' + s.absentDates.length + ' absence(s) · ' + s.retards + ' retard(s)</div>' +
    (s.attendance.length ? '<div style="display:flex;flex-wrap:wrap;gap:4px">' + s.attendance.slice().reverse().map((a) =>
      '<span class="badge ' + cls[a.type] + '" title="' + lbl[a.type] + '">' + fmtD(a.date).slice(0, 5) + ' · ' + lbl[a.type] + '</span>').join('') + '</div>' : '<span class="muted">Aucune réunion enregistrée.</span>');
}
function memberForm(m) {
  const isNew = !m; m = m || { code: nextMemberCode(), statut: 'Actif', can_see_documents: true };
  return '<div class="form-grid">' +
    '<div class="full" style="display:flex;gap:12px;align-items:center"><span id="ph-prev">' + avatar(m) + '</span>' +
      '<div><button type="button" class="btn btn-sm" data-act="pickPhoto">Choisir une photo</button> ' +
      (m.photo ? '<button type="button" class="btn btn-sm btn-danger" data-act="clearPhoto">Retirer</button>' : '') +
      '<div class="hint muted" style="font-size:11px;margin-top:4px">JPG ou PNG, 2 Mo max — réduite automatiquement.</div></div>' +
      '<input type="hidden" name="photo" value="' + esc(m.photo || '') + '"></div>' +
    field('Code', input('code', m.code, isNew ? 'required' : 'readonly')) +
    field('Statut', select('statut', ['Actif', 'Inactif'], m.statut)) +
    field('Nom', input('nom', m.nom, 'required')) + field('Prénom', input('prenom', m.prenom)) +
    field('Téléphone', input('telephone', m.telephone, 'type="tel"')) + field('Email', input('email', m.email, 'type="email"')) +
    field('Adresse', input('adresse', m.adresse), 'full') +
    field('NIF', input('nif', m.nif)) + field('Date d’adhésion', input('date_adhesion', toISO(m.date_adhesion), 'type="date"')) +
    field('Date de naissance', input('date_naissance', toISO(m.date_naissance), 'type="date"')) + field('Profession', input('profession', m.profession)) +
    field('Mot de passe du portail', input('portal_password', m.portal_password || '', 'autocapitalize="off" autocorrect="off"'), '', 'Le membre se connecte avec son code (' + esc(m.code) + ') et ce mot de passe.') +
    field('Documents', '<label class="check"><input type="checkbox" name="can_see_documents"' + (m.can_see_documents ? ' checked' : '') + '> Peut voir Statuts et Règlement</label>') +
    '</div>';
}
function nextMemberCode() { const n = DB.members.reduce((mx, m) => Math.max(mx, parseInt(String(m.code).replace(/\D/g, ''), 10) || 0), 0) + 1; return 'M' + String(n).padStart(3, '0'); }
function openMemberEdit(code) {
  const m = code ? getMember(code) : null;
  openModal({
    title: m ? 'Modifier — ' + m.code : 'Nouveau membre', body: memberForm(m), submit: t('save'), wide: true,
    onSubmit: (d) => {
      if (!d.nom.trim()) { toast('Le nom est obligatoire.', 'err'); return false; }
      const code2 = (d.code || '').trim().toUpperCase();
      if (!m && getMember(code2)) { toast('Ce code existe déjà.', 'err'); return false; }
      const target = m || Object.assign(clone(seedMember(code2, '', '')), { portal_password: '' });
      Object.assign(target, {
        nom: d.nom.trim().toUpperCase(), prenom: d.prenom.trim(), statut: d.statut, telephone: d.telephone.trim(), email: d.email.trim(),
        adresse: d.adresse.trim(), nif: d.nif.trim(), date_adhesion: fmtD(d.date_adhesion), date_naissance: fmtD(d.date_naissance),
        profession: d.profession.trim(), portal_password: d.portal_password, can_see_documents: d.can_see_documents, photo: d.photo,
      });
      if (!m) DB.members.push(target);
      if (saveDB()) toast('Fiche enregistrée.', 'ok');
      DB.prets.forEach((p) => { if (p.code_membre === target.code) p.nom_membre = memberName(target); });
      render();
    },
  });
}
ACTIONS.editMember = (code) => openMemberEdit(code);
ACTIONS.newMember = () => openMemberEdit(null);
ACTIONS.pickPhoto = () => pickFile('image/*', (f) => {
  if (f.size > 2 * 1024 * 1024) { toast('Photo trop lourde (2 Mo maximum).', 'err'); return; }
  readImage(f, 360, 0.82).then((data) => {
    const form = document.querySelector('#modal form'); if (!form) return;
    form.querySelector('[name=photo]').value = data;
    document.getElementById('ph-prev').innerHTML = '<span class="avatar"><img alt="" src="' + data + '"></span>';
  }).catch((e) => toast(e.message, 'err'));
});
ACTIONS.clearPhoto = (_i, el) => { const form = el.closest('form'); form.querySelector('[name=photo]').value = ''; document.getElementById('ph-prev').innerHTML = '<span class="avatar">—</span>'; el.remove(); };

/* ---------- Cotisations ---------- */
PAGES.cotisations = function () {
  const f = STATE.filt || {};
  let list = DB.cotisations.map((c, i) => Object.assign({ i }, c));
  if (f.code) list = list.filter((c) => c.code === f.code);
  if (f.month) list = list.filter((c) => monthKey(c.date) === f.month);
  list.sort((a, b) => (parseD(b.date) - parseD(a.date)) || a.code.localeCompare(b.code));
  const months = [...new Set(DB.cotisations.map((c) => monthKey(c.date)))].sort().reverse();
  const sel = selSet('cot');
  const rows = list.map((c) => '<tr' + (sel.has(c.i) ? ' class="row-sel"' : '') + '>' + (canEdit() ? '<td class="c"><input type="checkbox" aria-label="Sélectionner" data-change="selToggle" data-id="cot:' + c.i + '"' + (sel.has(c.i) ? ' checked' : '') + '></td>' : '') + '<td class="num">' + esc(c.date) + '</td><td><span class="code">' + c.code + '</span> ' + esc(nameOf(c.code)) + '</td>' +
    '<td class="n">' + fmt(c.verte) + '</td><td class="n">' + fmt(c.rouge) + '</td><td class="n">' + fmt(num(c.verte) + num(c.rouge)) + '</td><td>' + esc(c.mode) + '</td>' +
    '<td class="act"><button class="btn btn-sm" data-act="cotReceipt" data-id="' + c.i + '">Reçu</button>' +
    (canEdit() ? '<button class="btn btn-sm" data-act="cotEdit" data-id="' + c.i + '">' + t('edit') + '</button><button class="btn btn-sm btn-danger" data-act="cotDel" data-id="' + c.i + '">' + t('del') + '</button>' : '') + '</td></tr>');
  return pageHead('Gestion', t('cotisations'), list.length + ' cotisation(s) · ' + money(sum(list, (c) => num(c.verte) + num(c.rouge))),
    canEdit() ? '<button class="btn" data-act="amendeNew">Encaisser une amende</button><button class="btn btn-primary" data-act="cotNew">Nouvelle cotisation</button>' : '') +
    '<section class="panel"><div class="toolbar">' +
      '<select data-change="cotFilterCode"><option value="">Tous les membres</option>' + memberOptions().map((o) => '<option value="' + o.v + '"' + (f.code === o.v ? ' selected' : '') + '>' + esc(o.l) + '</option>').join('') + '</select>' +
      '<select data-change="cotFilterMonth"><option value="">Tous les mois</option>' + months.map((k) => '<option value="' + k + '"' + (f.month === k ? ' selected' : '') + '>' + monthLabel(k) + '</option>').join('') + '</select>' +
      modeSummary(list) + '</div>' + (canEdit() ? bulkBar('cot', list.map((c) => c.i)) : '') +
      table((canEdit() ? [['', 'c']] : []).concat(['Date', 'Membre', ['Verte', 'n'], ['Rouge', 'n'], ['Total', 'n'], 'Mode', '']), rows,
      '<tr>' + (canEdit() ? '<td></td>' : '') + '<td colspan="2">Total</td><td class="n">' + fmt(sum(list, (c) => c.verte)) + '</td><td class="n">' + fmt(sum(list, (c) => c.rouge)) + '</td><td class="n">' + fmt(sum(list, (c) => num(c.verte) + num(c.rouge))) + '</td><td colspan="2"></td></tr>') + '</section>' +
    amendesPanel();
};
ACTIONS.cotFilterCode = (_i, el) => { STATE.filt = Object.assign({}, STATE.filt, { code: el.value }); render(); };
ACTIONS.cotFilterMonth = (_i, el) => { STATE.filt = Object.assign({}, STATE.filt, { month: el.value }); render(); };
function cotForm(c) {
  c = c || { date: fmtD(nextMeetingOrToday()), verte: RULES.cot_verte, rouge: RULES.cot_rouge, mode: BANK };
  return '<div class="form-grid">' + field(t('member'), select('code', memberOptions(true), c.code), 'full') +
    field(t('date'), input('date', toISO(c.date), 'type="date" required')) + field('Mode', select('mode', [BANK, CASH], c.mode)) +
    field('Caisse Verte (HTG)', input('verte', c.verte, 'type="number" min="0" step="any" inputmode="decimal"')) +
    field('Caisse Rouge (HTG)', input('rouge', c.rouge, 'type="number" min="0" step="any" inputmode="decimal"')) + '</div>';
}
function nextMeetingOrToday() { const d = lastThursdayOf(today()); return d <= today() && daysBetween(d, today()) < 7 ? d : today(); }
function saveCot(d, idx) {
  if (!d.code || !d.date) { toast('Membre et date obligatoires.', 'err'); return false; }
  if (num(d.verte) + num(d.rouge) <= 0) { toast('Le montant doit être supérieur à zéro.', 'err'); return false; }
  const rec = { date: fmtD(d.date), code: d.code, verte: num(d.verte), rouge: num(d.rouge), mode: d.mode };
  if (idx === undefined) DB.cotisations.push(rec); else DB.cotisations[idx] = rec;
  if (saveDB()) toast('Cotisation enregistrée.', 'ok');
  render();
}
ACTIONS.cotNew = () => openModal({ title: 'Nouvelle cotisation', body: cotForm(), submit: t('save'), onSubmit: (d) => saveCot(d) });
ACTIONS.cotEdit = (i) => openModal({ title: 'Modifier la cotisation', body: cotForm(DB.cotisations[+i]), submit: t('save'), onSubmit: (d) => saveCot(d, +i) });
ACTIONS.cotDel = (i) => { const c = DB.cotisations[+i]; confirmBox('Supprimer la cotisation', 'Supprimer la cotisation de <b>' + esc(nameOf(c.code)) + '</b> du ' + esc(c.date) + ' (' + money(num(c.verte) + num(c.rouge)) + ') ?', () => { DB.cotisations.splice(+i, 1); selSet('cot').clear(); saveDB(); toast('Cotisation supprimée.', 'ok'); render(); }, t('del')); };
ACTIONS.cotReceipt = (i) => {
  const c = DB.cotisations[+i];
  openModal({
    title: 'Reçu de cotisation', footLeft: '<button type="button" class="btn" onclick="printReceipt()">' + t('print') + '</button>',
    body: '<div id="receipt" class="report" style="padding:18px"><div class="report-head">' + logoImg() + '<div><div class="t1">UNIE-MUSO</div><div class="t2">Reçu de cotisation · Petit-Goâve</div></div>' +
      '<div class="t3"><div class="num">N° COT-' + (+i + 1) + '</div><div>' + esc(c.date) + '</div></div></div>' +
      '<dl class="dl" style="margin-top:12px"><dt>Membre</dt><dd><span class="code">' + c.code + '</span> ' + esc(nameOf(c.code)) + '</dd>' +
      '<dt>Caisse Verte</dt><dd class="num">' + money(c.verte) + '</dd><dt>Caisse Rouge</dt><dd class="num">' + money(c.rouge) + '</dd>' +
      '<dt>Total</dt><dd class="num"><b>' + money(num(c.verte) + num(c.rouge)) + '</b></dd><dt>Mode</dt><dd>' + esc(c.mode) + '</dd></dl>' +
      '<div class="sig"><div>Le membre</div><div>Le trésorier</div></div></div>',
  });
};
window.printReceipt = function () { printHTML('Reçu UNIE-MUSO', document.getElementById('receipt').outerHTML); };
ACTIONS.amendeNew = (code) => openModal({
  title: 'Encaisser une amende', submit: t('save'),
  body: '<div class="form-grid">' + field(t('member'), select('code', memberOptions(true), code), 'full') +
    field('Motif', select('motif', AMENDE_TYPES.map((a) => ({ v: a.v, l: a.l + (a.key ? ' — ' + fmt(RULES[a.key]) + ' HTG' : '') })), 'absence')) +
    field(t('date'), input('date', toISO(today()), 'type="date"')) +
    field(t('amount') + ' (HTG)', input('montant', RULES.amende_absence, 'type="number" min="0" step="any"')) +
    field('Mode', select('mode', [BANK, CASH], BANK)) + '</div>',
  onOpen: (el) => {
    const f = el.querySelector('form');
    f.motif.addEventListener('change', () => { const a = AMENDE_TYPES.find((x) => x.v === f.motif.value); if (a && a.key) f.montant.value = RULES[a.key]; });
  },
  onSubmit: (d) => {
    if (num(d.montant) <= 0) { toast('Montant invalide.', 'err'); return false; }
    DB.amendes_paid.push({ date: fmtD(d.date), code: d.code, montant: num(d.montant), motif: d.motif, mode: d.mode });
    saveDB(); toast('Amende enregistrée.', 'ok'); render();
  },
});
/* Feuille de présence d'une réunion : présent / retard / représenté / absent */
ACTIONS.attendanceSheet = () => {
  const d = lastThursdayOf(today()) <= today() ? lastThursdayOf(today()) : lastThursday(today().getFullYear(), today().getMonth() - 1);
  const bodyFor = (date) => '<div class="field" style="max-width:220px;margin-bottom:12px"><label>Date de la réunion</label><input type="date" name="date" value="' + toISO(date) + '"></div>' +
    table(['Code', 'Membre', 'Pointage', 'Motif'], DB.members.filter((m) => m.statut !== 'Inactif').sort(sortByCode).map((m) => {
      const rec = attendanceRecord(m.code, date); const type = attendanceType(m.code, date);
      return '<tr><td class="code">' + m.code + '</td><td>' + esc(memberName(m)) + '</td><td>' + select('att_' + m.code, ATT_TYPES, type) + '</td><td>' + input('reason_' + m.code, rec ? rec.reason || '' : '', 'placeholder="facultatif"') + '</td></tr>';
    }));
  openModal({
    title: 'Feuille de présence', wide: true, submit: t('save'), body: '<div id="att-body">' + bodyFor(d) + '</div>' +
      '<div class="muted" style="margin-top:8px">Sans pointage, un membre qui a cotisé le jour de la réunion est compté présent, sinon absent. Amendes : absence ' + money(RULES.amende_absence) + ', retard ' + money(RULES.amende_retard_reunion) + ', représenté : aucune.</div>',
    onOpen: (el) => {
      const rebind = () => el.querySelector('[name=date]').addEventListener('change', (e) => { const nd = parseD(e.target.value); if (nd) { el.querySelector('#att-body').innerHTML = bodyFor(nd); rebind(); } });
      rebind();
    },
    onSubmit: (v) => {
      const date = fmtD(v.date); if (!date) { toast('Date invalide.', 'err'); return false; }
      DB.absences = DB.absences.filter((a) => fmtD(a.date) !== date);
      DB.members.filter((m) => m.statut !== 'Inactif').forEach((m) => {
        const type = v['att_' + m.code];
        const paid = DB.cotisations.some((c) => c.code === m.code && fmtD(c.date) === date);
        // On n'enregistre que ce qui diffère du calcul automatique, ou une réunion sans aucune cotisation
        if (type !== (paid ? 'present' : 'absence') || v['reason_' + m.code] || !DB.cotisations.some((c) => fmtD(c.date) === date)) {
          DB.absences.push({ code: m.code, date, reason: (v['reason_' + m.code] || '').trim(), type });
        }
      });
      saveDB(); toast('Feuille de présence du ' + date + ' enregistrée.', 'ok'); render();
    },
  });
};
ACTIONS.amendeDel = (i) => confirmBox('Supprimer l’amende', 'Supprimer cette amende ?', () => { DB.amendes_paid.splice(+i, 1); selSet('am').clear(); saveDB(); render(); }, t('del'));

/* ---------- Prévisions (prochaine réunion) ---------- */
PAGES.previsions = function () {
  const d = nextMeeting();
  const rows = []; const tot = { verse: 0, reste: 0, ar: 0, ab: 0, pret: 0, cot: 0, all: 0 };
  DB.members.filter((m) => m.statut !== 'Inactif').sort(sortByCode).forEach((m) => {
    const s = memberStats(m.code);
    const pret = s.loanDue ? s.loanDue.du : 0;
    // Les amendes déjà payées sont déduites d'abord des amendes de retard, puis des absences
    const paidLeft = s.amendesPaid; const ar = Math.max(0, s.amendeRetard - paidLeft); const ab = Math.max(0, s.amendeAbs - Math.max(0, paidLeft - s.amendeRetard));
    tot.verse += s.total; tot.reste += s.reste; tot.ar += ar; tot.ab += ab; tot.pret += pret; tot.cot += s.cotMois; tot.all += s.totalAVerser;
    rows.push('<tr class="clickable" data-act="openMember" data-id="' + m.code + '"><td class="code">' + m.code + '</td><td>' + esc(memberName(m)) + '</td>' +
      '<td class="n">' + fmt(s.total) + '</td><td class="n">' + fmt(s.reste) + '</td><td>' + statusBadge(s.statut) + '</td>' +
      '<td class="n">' + fmt(ar) + '</td><td class="n">' + fmt(ab) + ' <span class="muted">(' + s.absentDates.length + ')</span></td><td class="n">' + fmt(pret) + '</td>' +
      '<td class="n">' + fmt(s.cotMois) + '</td><td class="n"><b>' + fmt(s.totalAVerser) + '</b></td></tr>');
  });
  return meetingBanner() + pageHead('Gestion', t('previsions'), 'Réunion du ' + esc(longDate(d)) + ' · attendu à jour : ' + RULES.nb_cotisations_attendues + ' × ' + fmt(COT()) + ' = ' + money(RULES.nb_cotisations_attendues * COT()),
    (canEdit() ? '<button class="btn" data-act="attendanceSheet">Feuille de présence</button><button class="btn" data-act="adjustMonths" data-id="-1">− 1 mois</button><button class="btn btn-accent" data-act="adjustMonths" data-id="1">Ajuster nb mois (+1)</button>' : '') + '<button class="btn" onclick="window.print()">' + t('print') + '</button>') +
    '<section class="panel">' + table(['Code', 'Membre', ['Versé', 'n'], ['Reste dû', 'n'], 'Statut', ['Amende retard cot.', 'n'], ['Amende absences', 'n'], ['Remb. prêt', 'n'], ['Cotisation du mois', 'n'], ['Total à verser', 'n']], rows,
      '<tr><td colspan="2">Totaux</td><td class="n">' + fmt(tot.verse) + '</td><td class="n">' + fmt(tot.reste) + '</td><td></td><td class="n">' + fmt(tot.ar) + '</td><td class="n">' + fmt(tot.ab) + '</td><td class="n">' + fmt(tot.pret) + '</td><td class="n">' + fmt(tot.cot) + '</td><td class="n">' + fmt(tot.all) + '</td></tr>') +
    '<div class="section-note">Règlement interne : ' + money(RULES.amende_cot_retard) + ' par cotisation mensuelle versée en retard · ' + money(RULES.amende_absence) + ' par absence non motivée · ' + money(RULES.amende_retard_reunion) + ' par retard à la réunion (montants modifiables dans Paramètres). Les amendes déjà encaissées sont déduites. Après chaque réunion, faites la feuille de présence puis cliquez « Ajuster nb mois (+1) ».</div></section>';
};
ACTIONS.adjustMonths = (delta) => {
  const n = Math.max(0, num(RULES.nb_cotisations_attendues) + num(delta));
  confirmBox('Nombre de cotisations attendues', 'Passer de <b>' + RULES.nb_cotisations_attendues + '</b> à <b>' + n + '</b> cotisations attendues (attendu à jour : ' + money(n * COT()) + ') ?', () => {
    RULES.nb_cotisations_attendues = n; saveRules(); toast('Nombre de mois ajusté : ' + n, 'ok'); render();
  });
};

/* ---------- Correction du mode de paiement (Banque CAP-AIDER / Liquidité) ---------- */
/* Sélection par liste : 'cot' (cotisations) ou 'am' (amendes) ; indices dans DB */
function selSet(kind) { STATE.sel = STATE.sel || {}; STATE.sel[kind] = STATE.sel[kind] || new Set(); return STATE.sel[kind]; }
function selArray(kind) { return kind === 'cot' ? DB.cotisations : DB.amendes_paid; }
function modeSummary(list) {
  const bank = list.filter((x) => isBank(x.mode || BANK)).length;
  return '<span class="muted" style="margin-left:auto">' + bank + ' en banque · ' + (list.length - bank) + ' en liquidité</span>';
}
function bulkBar(kind, visible) {
  const sel = selSet(kind); const n = sel.size;
  return '<div class="toolbar no-print" style="background:' + (n ? 'var(--orange-050)' : '#FAFBFC') + '">' +
    '<button class="btn btn-sm" data-act="selAll" data-id="' + kind + ':' + visible.join(',') + '">Tout cocher (' + visible.length + ')</button>' +
    '<button class="btn btn-sm" data-act="selNone" data-id="' + kind + '"' + (n ? '' : ' disabled') + '>Tout décocher</button>' +
    '<span class="muted">' + (n ? '<b style="color:var(--ink)">' + n + ' sélectionnée(s)</b> — changer le mode :' : 'Cochez des lignes pour changer leur mode de paiement en une fois.') + '</span>' +
    (n ? '<button class="btn btn-sm btn-primary" data-act="selMode" data-id="' + kind + ':' + BANK + '">Banque CAP-AIDER</button>' +
      '<button class="btn btn-sm btn-accent" data-act="selMode" data-id="' + kind + ':' + CASH + '">Liquidité</button>' : '') + '</div>';
}
ACTIONS.selToggle = (key, el) => {
  const [kind, i] = key.split(':'); const s = selSet(kind);
  if (el.checked) s.add(+i); else s.delete(+i);
  render();
};
ACTIONS.selAll = (key) => { const [kind, ids] = key.split(':'); const s = selSet(kind); (ids ? ids.split(',') : []).forEach((i) => s.add(+i)); render(); };
ACTIONS.selNone = (kind) => { selSet(kind).clear(); render(); };
ACTIONS.selMode = (key) => {
  const kind = key.slice(0, key.indexOf(':')); const mode = key.slice(key.indexOf(':') + 1);
  const s = selSet(kind); const arr = selArray(kind);
  const items = [...s].map((i) => arr[i]).filter(Boolean);
  const total = sum(items, (x) => kind === 'cot' ? num(x.verte) + num(x.rouge) : x.montant);
  confirmBox('Changer le mode de paiement', items.length + ' ' + (kind === 'cot' ? 'cotisation(s)' : 'amende(s)') + ' pour <b class="num">' + money(total) + '</b> passeront en <b>' + esc(mode) + '</b>.<br><span class="muted">Le journal, la caisse et la banque seront recalculés.</span>', () => {
    items.forEach((x) => { x.mode = mode; });
    s.clear(); saveDB(); toast(items.length + ' ligne(s) passée(s) en ' + mode + '.', 'ok'); render();
  });
};
function amendesPanel() {
  const sel = selSet('am');
  const list = DB.amendes_paid.map((a, i) => Object.assign({ i }, a)).sort((a, b) => parseD(b.date) - parseD(a.date));
  const motif = (v) => (AMENDE_TYPES.find((x) => x.v === v) || { l: '—' }).l;
  const rows = list.map((a) => '<tr' + (sel.has(a.i) ? ' class="row-sel"' : '') + '>' + (canEdit() ? '<td class="c"><input type="checkbox" aria-label="Sélectionner" data-change="selToggle" data-id="am:' + a.i + '"' + (sel.has(a.i) ? ' checked' : '') + '></td>' : '') +
    '<td class="num">' + esc(a.date) + '</td><td><span class="code">' + a.code + '</span> ' + esc(nameOf(a.code)) + '</td><td>' + esc(motif(a.motif)) + '</td>' +
    '<td class="n">' + fmt(a.montant) + '</td><td>' + esc(a.mode || BANK) + (a.mode ? '' : ' <span class="muted">(par défaut)</span>') + '</td><td class="act">' +
    (canEdit() ? '<button class="btn btn-sm" data-act="amendeEdit" data-id="' + a.i + '">' + t('edit') + '</button><button class="btn btn-sm btn-danger" data-act="amendeDel" data-id="' + a.i + '">' + t('del') + '</button>' : '') + '</td></tr>');
  return '<section class="panel"><div class="panel-head"><h2>Amendes encaissées</h2><span class="meta">' + list.length + ' · ' + money(sum(list, (a) => a.montant)) + '</span>' + modeSummary(list) + '</div>' +
    (canEdit() ? bulkBar('am', list.map((a) => a.i)) : '') +
    table((canEdit() ? [['', 'c']] : []).concat(['Date', 'Membre', 'Motif', ['Montant', 'n'], 'Mode', '']), rows,
      '<tr>' + (canEdit() ? '<td></td>' : '') + '<td colspan="3">Total</td><td class="n">' + fmt(sum(list, (a) => a.montant)) + '</td><td colspan="2"></td></tr>') + '</section>';
}
ACTIONS.amendeEdit = (i) => {
  const a = DB.amendes_paid[+i];
  openModal({
    title: 'Modifier l’amende', submit: t('save'),
    body: '<div class="form-grid">' + field(t('member'), select('code', memberOptions(), a.code), 'full') +
      field('Motif', select('motif', AMENDE_TYPES.map((x) => ({ v: x.v, l: x.l })), a.motif || 'autre')) + field(t('date'), input('date', toISO(a.date), 'type="date"')) +
      field(t('amount') + ' (HTG)', input('montant', a.montant, 'type="number" min="0" step="any"')) + field('Mode', select('mode', [BANK, CASH], a.mode || BANK)) + '</div>',
    onSubmit: (d) => {
      if (num(d.montant) <= 0) { toast('Montant invalide.', 'err'); return false; }
      Object.assign(a, { code: d.code, motif: d.motif, date: fmtD(d.date), montant: num(d.montant), mode: d.mode });
      saveDB(); toast('Amende modifiée.', 'ok'); render();
    },
  });
};
