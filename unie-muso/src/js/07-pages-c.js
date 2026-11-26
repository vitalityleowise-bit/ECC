/* =========================================================================
   Pages : comptabilité, rapport mensuel, documents, portail membre,
   sauvegarde, paramètres
   ========================================================================= */
function accLabel(a) { return ACCOUNTS[a] || 'Compte ' + a; }
function periodBar(id) {
  const p = STATE.period || {};
  return '<div class="toolbar no-print"><label class="muted">Du</label><input type="date" data-change="periodFrom" value="' + esc(p.from || '') + '">' +
    '<label class="muted">au</label><input type="date" data-change="periodTo" value="' + esc(p.to || '') + '">' +
    '<button class="btn btn-sm" data-act="periodFiscal">Exercice en cours</button><button class="btn btn-sm" data-act="periodAll">Tout</button>' +
    '<span class="muted" style="margin-left:auto">' + esc(id || '') + '</span></div>';
}
ACTIONS.periodFrom = (_i, el) => { STATE.period = Object.assign({}, STATE.period, { from: el.value }); render(); };
ACTIONS.periodTo = (_i, el) => { STATE.period = Object.assign({}, STATE.period, { to: el.value }); render(); };
ACTIONS.periodAll = () => { STATE.period = {}; render(); };
ACTIONS.periodFiscal = () => {
  const s = parseD(RULES.fiscal_start); const e = new Date(s.getFullYear() + 1, s.getMonth(), 0);
  STATE.period = { from: toISO(s), to: toISO(e) }; render();
};
function periodText() {
  const p = STATE.period || {};
  if (!p.from && !p.to) return 'depuis le début, au ' + fmtD(today());
  return 'du ' + (p.from ? fmtD(p.from) : 'début') + ' au ' + (p.to ? fmtD(p.to) : fmtD(today()));
}

PAGES.journal = function () {
  const p = STATE.period || {}; const f = p.from ? parseD(p.from) : null; const to = p.to ? parseD(p.to) : null;
  const J = buildJournal().filter((e) => (!f || e.date >= f) && (!to || e.date <= to));
  let td = 0, tc = 0;
  const rows = [];
  J.forEach((e) => e.lines.forEach((l, i) => {
    td += num(l.d); tc += num(l.c);
    rows.push('<tr' + (i === 0 ? ' style="border-top:1px solid var(--line)"' : '') + '><td class="num">' + (i === 0 ? fmtD(e.date) : '') + '</td><td class="code">' + (i === 0 ? esc(e.piece) : '') + '</td>' +
      '<td class="code">' + l.acc + '</td><td' + (l.c ? ' style="padding-left:28px"' : '') + '>' + esc(accLabel(l.acc)) + (i === 0 ? '<div class="muted" style="font-size:11px">' + esc(e.lib) + '</div>' : '') + '</td>' +
      '<td class="n">' + (l.d ? fmt(l.d) : '') + '</td><td class="n">' + (l.c ? fmt(l.c) : '') + '</td></tr>');
  }));
  return pageHead('Comptabilité', 'Journal général', 'Écritures en partie double générées automatiquement · ' + esc(periodText()), '<button class="btn" onclick="window.print()">' + t('print') + '</button>') +
    '<section class="panel">' + periodBar(J.length + ' écriture(s)') + table(['Date', 'Pièce', 'Compte', 'Intitulé', ['Débit', 'n'], ['Crédit', 'n']], rows,
      '<tr><td colspan="4">Totaux ' + (Math.abs(td - tc) < 0.01 ? '— équilibré' : '— ÉCART ' + fmt(td - tc)) + '</td><td class="n">' + fmt(td) + '</td><td class="n">' + fmt(tc) + '</td></tr>') + '</section>';
};
PAGES.balance = function () {
  const p = STATE.period || {};
  const B = balances(buildJournal(), p.from, p.to);
  const accs = Object.keys(B).map(Number).sort((a, b) => a - b);
  let t1 = 0, t2 = 0, t3 = 0, t4 = 0;
  const rows = accs.map((a) => {
    const b = B[a]; const s = b.d - b.c;
    t1 += b.pd; t2 += b.pc; t3 += s > 0 ? s : 0; t4 += s < 0 ? -s : 0;
    return '<tr><td class="code">' + a + '</td><td>' + esc(accLabel(a)) + '</td><td class="n">' + fmt(b.pd) + '</td><td class="n">' + fmt(b.pc) + '</td><td class="n">' + (s > 0 ? fmt(s) : '') + '</td><td class="n">' + (s < 0 ? fmt(-s) : '') + '</td></tr>';
  });
  return pageHead('Comptabilité', 'Balance de vérification', 'Mouvements de la période et soldes cumulés · ' + esc(periodText()), '<button class="btn" onclick="window.print()">' + t('print') + '</button>') +
    '<section class="panel">' + periodBar() + table(['Compte', 'Intitulé', ['Débit période', 'n'], ['Crédit période', 'n'], ['Solde débiteur cumulé', 'n'], ['Solde créditeur cumulé', 'n']], rows,
      '<tr><td colspan="2">Totaux ' + (Math.abs(t3 - t4) < 0.01 ? '— équilibrée' : '— ÉCART') + '</td><td class="n">' + fmt(t1) + '</td><td class="n">' + fmt(t2) + '</td><td class="n">' + fmt(t3) + '</td><td class="n">' + fmt(t4) + '</td></tr>') + '</section>';
};
function bilanHTML(to) {
  const F = financials(null, to);
  const line = (x) => '<tr><td class="code">' + x.acc + '</td><td>' + esc(accLabel(x.acc)) + '</td><td class="n">' + fmt(x.v) + '</td></tr>';
  const passifRows = F.passif.map(line).concat(F.capitaux.map(line));
  return '<div class="grid-2">' +
    panel('Actif', table(['Compte', 'Intitulé', ['Montant', 'n']], F.actif.map(line), '<tr><td colspan="2">Total actif</td><td class="n">' + fmt(F.totActif) + '</td></tr>'), { flush: true }) +
    panel('Passif et capitaux propres', table(['Compte', 'Intitulé', ['Montant', 'n']], passifRows.length ? passifRows : ['<tr><td colspan="3" class="muted">Aucun passif</td></tr>'], '<tr><td colspan="2">Total passif + capitaux</td><td class="n">' + fmt(F.totPassif) + '</td></tr>'), { flush: true }) +
    '</div><div class="banner ' + (Math.abs(F.totActif - F.totPassif) < 0.01 ? 'soft' : 'import') + '"><span>' + (Math.abs(F.totActif - F.totPassif) < 0.01 ? 'Bilan équilibré.' : 'Écart de ' + money(F.totActif - F.totPassif)) + '</span></div>';
}
PAGES.bilan = function () {
  const p = STATE.period || {};
  return pageHead('Comptabilité', 'Bilan', 'Situation au ' + esc(p.to ? fmtD(p.to) : fmtD(today())), '<button class="btn" onclick="window.print()">' + t('print') + '</button>') +
    '<section class="panel">' + periodBar('Le bilan utilise la date de fin') + '</section>' + bilanHTML(p.to);
};
function resultatsHTML(from, to) {
  const F = financials(from, to);
  const line = (x) => '<tr><td class="code">' + x.acc + '</td><td>' + esc(accLabel(x.acc)) + '</td><td class="n">' + fmt(x.v) + '</td></tr>';
  return '<div class="grid-2">' +
    panel('Produits', table(['Compte', 'Intitulé', ['Montant', 'n']], F.produits.map(line), '<tr><td colspan="2">Total produits</td><td class="n">' + fmt(F.totP) + '</td></tr>'), { flush: true }) +
    panel('Charges', table(['Compte', 'Intitulé', ['Montant', 'n']], F.charges.map(line), '<tr><td colspan="2">Total charges</td><td class="n">' + fmt(F.totC) + '</td></tr>'), { flush: true }) +
    '</div><div class="kpis">' + kpi('Résultat de la période', fmt(F.resultat) + ' <small>HTG</small>', F.resultat >= 0 ? 'excédent' : 'déficit', F.resultat >= 0 ? 'green' : 'red', F.resultat >= 0 ? 'pos' : 'neg') + '</div>';
}
PAGES.resultats = function () {
  const p = STATE.period || {};
  return pageHead('Comptabilité', 'État des résultats', 'Produits − charges = résultat · ' + esc(periodText()), '<button class="btn" onclick="window.print()">' + t('print') + '</button>') +
    '<section class="panel">' + periodBar() + '</section>' + resultatsHTML(p.from, p.to);
};

/* ---------- Rapport mensuel (9 sections) ---------- */
PAGES.rapport = function () {
  const months = activityMonths();
  const key = STATE.rmonth || monthKey(today());
  const [y, m] = key.split('-').map(Number);
  const from = new Date(y, m - 1, 1), to = new Date(y, m, 0);
  const inM = (x) => { const d = parseD(x.date); return d >= from && d <= to; };
  const T = treasury(to); const F = financials(from, to);
  const cots = DB.cotisations.filter(inM);
  const meet = lastThursday(y, m - 1);
  const actifs = DB.members.filter((x) => x.statut !== 'Inactif').sort(sortByCode);
  const att = actifs.map((x) => ({ m: x, type: attendanceType(x.code, meet) }));
  const heldMeeting = meetingDates().some((d) => d.getTime() === meet.getTime());
  const absents = heldMeeting ? att.filter((a) => a.type === 'absence') : [];
  const retards = heldMeeting ? att.filter((a) => a.type === 'retard') : [];
  const am = DB.amendes_paid.filter(inM);
  const pretsM = DB.prets.filter(inM);
  const demM = DB.demandes_pret.filter((d) => { const x = parseD(d.date_demande); return x >= from && x <= to; });
  const rmb = []; DB.prets.forEach((p) => (p.payments || []).forEach((x) => { if (inM(x)) rmb.push(Object.assign({ p }, x)); }));
  const situ = actifs.map((x) => memberStats(x.code, to));
  const enRetard = situ.filter((s) => s.reste > 0);
  const totCot = sum(cots, (c) => num(c.verte) + num(c.rouge));
  const lateLoans = DB.prets.filter((p) => p.status !== 'Remboursé' && loanTotals(p).retard > 0);
  const reco = [];
  if (enRetard.length) reco.push(enRetard.length + ' membre(s) ne sont pas à jour de leurs cotisations (total ' + money(sum(enRetard, (s) => s.reste)) + ') : rappel individuel avant la prochaine réunion.');
  if (absents.length) reco.push(absents.length + ' absence(s) non motivée(s) à la réunion du ' + fmtD(meet) + ' : amendes de ' + money(RULES.amende_absence) + ' à percevoir.');
  if (lateLoans.length) reco.push(lateLoans.length + ' prêt(s) avec mensualités en retard : appliquer la pénalité de ' + RULES.penalite_pret_pct + ' % et suivre avec le comité de crédit.');
  if (T.caisse > 0) reco.push('Déposer la liquidité en caisse (' + money(T.caisse) + ') sur le compte CAP-AIDER.');
  if (DB.demandes_pret.some((d) => d.statut === 'En attente')) reco.push('Des demandes de prêt attendent l’évaluation du comité.');
  if (!reco.length) reco.push('Situation saine : continuer le suivi régulier des cotisations et des remboursements.');

  const sec = (n, title, body) => '<h2>' + n + '. ' + esc(title) + '</h2>' + body;
  return '<div class="no-print">' + pageHead('Rapports', t('rapport'), 'Modèle en 9 sections, prêt à imprimer ou enregistrer en PDF',
    '<select data-change="rmonth">' + months.slice().reverse().map((k) => '<option value="' + k + '"' + (k === key ? ' selected' : '') + '>' + monthLabel(k) + '</option>').join('') + '</select>' +
    '<button class="btn btn-primary" onclick="window.print()">' + t('print') + ' / PDF</button>') + '</div>' +
    '<article class="report">' +
      '<div class="report-head">' + logoImg() + '<div><div class="t1">UNIE-MUSO</div><div class="t2">Unie Mutuelle Solidarité · Petit-Goâve, Haïti</div></div>' +
        '<div class="t3"><b>RAPPORT MENSUEL</b><br>' + esc(monthLabel(key)) + '<br><span class="muted">établi le ' + fmtD(today()) + '</span></div></div>' +
      sec(1, 'Résumé', '<div class="kpis">' + kpi('Membres actifs', actifs.length, '', 'navy') + kpi('Cotisations du mois', fmt(totCot), cots.length + ' versements', 'green') +
        kpi('Actif total', fmt(T.actif), 'fin de mois', 'navy') + kpi('Résultat du mois', fmt(F.resultat), '', F.resultat >= 0 ? 'green' : 'red') + '</div>' +
        '<p>Au ' + fmtD(to) + ', la mutuelle dispose de ' + money(T.banque) + ' à la banque CAP-AIDER' + (T.caisse ? ' et ' + money(T.caisse) + ' en caisse' : '') + ', et de ' + money(T.prets) + ' de prêts en cours auprès des membres. La Caisse Verte s’élève à ' + money(T.verteFonds) + ' et la Caisse Rouge à ' + money(T.rougeFonds) + '.</p>') +
      sec(2, 'Bilan au ' + fmtD(to), bilanHTML(to)) +
      sec(3, 'État des résultats du mois', resultatsHTML(from, to)) +
      sec(4, 'Cotisations collectées', table(['Date', 'Membre', ['Verte', 'n'], ['Rouge', 'n'], ['Total', 'n'], 'Mode'], cots.sort(sortByCode).map((c) =>
        '<tr><td class="num">' + esc(c.date) + '</td><td>' + c.code + ' — ' + esc(nameOf(c.code)) + '</td><td class="n">' + fmt(c.verte) + '</td><td class="n">' + fmt(c.rouge) + '</td><td class="n">' + fmt(num(c.verte) + num(c.rouge)) + '</td><td>' + esc(c.mode) + '</td></tr>'),
        '<tr><td colspan="2">Total</td><td class="n">' + fmt(sum(cots, (c) => c.verte)) + '</td><td class="n">' + fmt(sum(cots, (c) => c.rouge)) + '</td><td class="n">' + fmt(totCot) + '</td><td></td></tr>')) +
      sec(5, 'Présences et absences', heldMeeting
        ? '<p>Réunion du ' + esc(longDate(meet)) + ' : ' + (att.length - absents.length) + ' présent(s) sur ' + att.length + (retards.length ? ', dont ' + retards.length + ' en retard' : '') + '.</p>' +
          (absents.length ? table(['Code', 'Membre absent', 'Motif'], absents.map((a) => { const r = attendanceRecord(a.m.code, meet); return '<tr><td class="code">' + a.m.code + '</td><td>' + esc(memberName(a.m)) + '</td><td>' + esc(r && r.reason ? r.reason : 'non motivée') + '</td></tr>'; })) : '<p class="muted">Aucun absent.</p>')
        : '<p class="muted">Aucune réunion enregistrée pour ce mois (prévue le ' + esc(longDate(meet)) + ').</p>') +
      sec(6, 'Amendes et pénalités', table(['Date', 'Membre', 'Motif', ['Montant', 'n']], am.map((a) => '<tr><td class="num">' + esc(a.date) + '</td><td>' + a.code + ' — ' + esc(nameOf(a.code)) + '</td><td>' + esc((AMENDE_TYPES.find((x) => x.v === a.motif) || { l: '—' }).l) + '</td><td class="n">' + fmt(a.montant) + '</td></tr>')
        .concat(rmb.filter((x) => num(x.pen) > 0).map((x) => '<tr><td class="num">' + esc(x.date) + '</td><td>' + x.p.code_membre + ' — ' + esc(nameOf(x.p.code_membre)) + '</td><td>Pénalité de retard, prêt #' + x.p.id + '</td><td class="n">' + fmt(x.pen) + '</td></tr>')),
        '<tr><td colspan="3">Total</td><td class="n">' + fmt(sum(am, (a) => a.montant) + sum(rmb, (x) => x.pen)) + '</td></tr>')) +
      sec(7, 'Crédit', '<p>Prêts octroyés ce mois : ' + pretsM.length + ' (' + money(sum(pretsM, (p) => p.capital)) + ') · remboursements reçus : ' + money(sum(rmb, (x) => x.montant)) + ' dont ' + money(sum(rmb, (x) => x.int)) + ' d’intérêts.</p>' +
        table(['N°', 'Membre', 'Date', ['Capital', 'n'], ['Remboursé', 'n'], ['Reste', 'n'], 'Statut'], DB.prets.filter((p) => parseD(p.date) <= to).map((p) => { const lt = loanTotals(p); return '<tr><td class="code">#' + p.id + '</td><td>' + esc(nameOf(p.code_membre)) + '</td><td class="num">' + esc(p.date) + '</td><td class="n">' + fmt(p.capital) + '</td><td class="n">' + fmt(lt.rembourse) + '</td><td class="n">' + fmt(lt.reste) + '</td><td>' + statusBadge(p.status) + '</td></tr>'; })) +
        (demM.length ? '<p style="margin-top:10px"><b>Demandes du mois :</b></p>' + table(['N°', 'Membre', ['Demandé', 'n'], 'Note', 'Statut'], demM.map((d) => { const ev = evaluateDemande(d); return '<tr><td class="code">#' + d.id + '</td><td>' + esc(nameOf(d.code_membre)) + '</td><td class="n">' + fmt(d.montant_demande) + '</td><td>' + (ev.complete ? fmt(ev.total) + '/100 — ' + esc(ev.seuil.label) : 'en évaluation') + '</td><td>' + statusBadge(d.statut) + '</td></tr>'; })) : '')) +
      sec(8, 'Situation par membre', table(['Code', 'Membre', ['Versé', 'n'], ['Reste dû', 'n'], 'Statut', ['Amendes dues', 'n'], ['Prêt (reste)', 'n']], situ.map((s) =>
        '<tr><td class="code">' + s.member.code + '</td><td>' + esc(memberName(s.member)) + '</td><td class="n">' + fmt(s.total) + '</td><td class="n">' + fmt(s.reste) + '</td><td>' + statusBadge(s.statut) + '</td><td class="n">' + fmt(s.amendesDues) + '</td><td class="n">' + (s.loan ? fmt(loanTotals(s.loan).reste) : '') + '</td></tr>'),
        '<tr><td colspan="2">Total</td><td class="n">' + fmt(sum(situ, (s) => s.total)) + '</td><td class="n">' + fmt(sum(situ, (s) => s.reste)) + '</td><td></td><td class="n">' + fmt(sum(situ, (s) => s.amendesDues)) + '</td><td class="n">' + fmt(sum(situ, (s) => s.loan ? loanTotals(s.loan).reste : 0)) + '</td></tr>')) +
      sec(9, 'Conclusion et recommandations', '<ol>' + reco.map((r) => '<li style="margin-bottom:6px">' + esc(r) + '</li>').join('') + '</ol>' +
        '<div class="field no-print" style="margin-top:10px"><label>Remarques du trésorier (imprimées sous les recommandations)</label><textarea data-change="rnote" data-id="' + key + '">' + esc((SETTINGS.report_notes || {})[key] || '') + '</textarea></div>' +
        ((SETTINGS.report_notes || {})[key] ? '<p class="only-print" style="white-space:pre-wrap">' + esc(SETTINGS.report_notes[key]) + '</p>' : '')) +
      '<div class="sig"><div>' + esc(SETTINGS.sign_presidente) + '<br>Présidente</div><div>' + esc(SETTINGS.sign_tresorier) + '<br>Trésorier</div></div>' +
    '</article>';
};
ACTIONS.rmonth = (_i, el) => { STATE.rmonth = el.value; render(); };
ACTIONS.rnote = (key, el) => { SETTINGS.report_notes = Object.assign({}, SETTINGS.report_notes, { [key]: el.value }); saveSettings(); toast('Remarques enregistrées.', 'ok'); render(); };

/* ---------- Documents ---------- */
function docHTML(id) {
  const d = DOCS[id]; if (!d) return '<div class="empty">Document indisponible.</div>';
  return '<article class="doc">' + (d.note ? '<p class="muted">' + esc(d.note) + '</p>' : '') + d.blocks.map((b) => {
    if (b.t === 'chap') return '<h2 class="chap">' + esc(b.x) + '</h2>';
    if (b.t === 'sub') return '<p class="muted" style="margin-top:-4px">' + esc(b.x) + '</p>';
    if (b.t === 'art') return '<p class="art">' + esc(b.x) + '</p>';
    if (b.t === 'li') return '<p style="padding-left:18px;text-indent:-10px">– ' + esc(b.x) + '</p>';
    return '<p>' + esc(b.x) + '</p>';
  }).join('') + '</article>';
}
function docPage(id) {
  const d = DOCS[id];
  return pageHead('Documents', d ? d.title : '', 'Version de travail — sera remplacée par la version définitive',
    '<button class="btn" onclick="window.print()">' + t('print') + '</button>' + (isAdmin() ? '<button class="btn" data-act="docEdit" data-id="' + id + '">' + t('edit') + '</button>' : '')) +
    '<section class="panel"><div class="panel-body">' + docHTML(id) + '</div></section>';
}
PAGES.statuts = () => docPage('statuts');
PAGES.reglement = () => docPage('reglement');
ACTIONS.docEdit = (id) => {
  const d = DOCS[id];
  const txt = d.blocks.map((b) => (b.t === 'chap' ? '# ' : b.t === 'art' ? '## ' : b.t === 'li' ? '- ' : b.t === 'sub' ? '> ' : '') + b.x).join('\n');
  openModal({
    title: 'Modifier — ' + d.title, wide: true, submit: t('save'),
    body: field('Titre', input('title', d.title), '') + field('Mention', input('note', d.note || '')) +
      field('Texte', '<textarea name="txt" style="min-height:50vh;font-family:var(--f-num);font-size:12px">' + esc(txt) + '</textarea>', '', '« # » chapitre · « ## » article · « - » élément de liste · « > » sous-titre. Collez ici la version définitive.'),
    onSubmit: (v) => {
      DOCS[id] = { title: v.title, note: v.note, blocks: v.txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        if (l.startsWith('## ')) return { t: 'art', x: l.slice(3) };
        if (l.startsWith('# ')) return { t: 'chap', x: l.slice(2) };
        if (l.startsWith('- ')) return { t: 'li', x: l.slice(2) };
        if (l.startsWith('> ')) return { t: 'sub', x: l.slice(2) };
        return { t: 'p', x: l };
      }) };
      saveDocs(); toast('Document enregistré.', 'ok'); render();
    },
  });
};

/* ---------- Portail membre ---------- */
PAGES.moncompte = function () {
  const m = currentMember(); if (!m) return '';
  const s = memberStats(m.code); const sc = creditScore(m.code);
  const lt = s.loan ? loanTotals(s.loan) : null;
  const mesDem = DB.demandes_pret.filter((d) => d.code_membre === m.code).sort((a, b) => b.id - a.id);
  const aNoter = m.is_comite ? DB.demandes_pret.filter((d) => d.statut === 'En attente' && d.code_membre !== m.code) : [];
  return importBanner() + meetingBanner() + loanBanner(m.code) +
    '<section class="panel"><div class="member-head">' + avatar(m) + '<div><div class="nm">' + esc(memberName(m)) + '</div>' +
      '<div class="muted"><span class="code">' + m.code + '</span> · ' + statusBadge(m.statut) + (m.is_comite ? ' <span class="badge b-navy">' + esc(m.comite_poste || 'Comité') + '</span>' : '') + '</div></div>' +
      '<div style="margin-left:auto;text-align:right"><div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em">' + t('next_meeting') + '</div><div><b>' + esc(longDate(nextMeeting())) + '</b></div>' +
      '<div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-top:6px">' + t('to_pay') + '</div><div class="num" style="font-size:18px;font-weight:700;color:var(--orange)">' + money(s.totalAVerser) + '</div></div></div></section>' +
    (aNoter.length ? panel('Demandes à évaluer (comité)', table(['N°', 'Membre', ['Demandé', 'n'], 'Ma note', ''], aNoter.map((d) => {
      const n = d.evaluation && d.evaluation.notes_comite ? d.evaluation.notes_comite[m.code] : undefined;
      return '<tr><td class="code">#' + d.id + '</td><td>' + esc(nameOf(d.code_membre)) + '</td><td class="n">' + fmt(d.montant_demande) + '</td><td>' + (n === undefined ? '<span class="badge b-orange">à donner</span>' : '<b class="num">' + fmt(n) + '/' + GRILLE.pts_comite + '</b>') + '</td>' +
        '<td class="act"><button class="btn btn-sm btn-accent" data-act="demEval" data-id="' + d.id + '">' + (n === undefined ? 'Donner ma note' : 'Voir / modifier') + '</button></td></tr>';
    })), { flush: true }) : '') +
    '<div class="kpis">' + kpi('Caisse Verte', fmt(s.verte) + ' <small>HTG</small>', 'mon épargne', 'green') + kpi('Caisse Rouge', fmt(s.rouge) + ' <small>HTG</small>', 'solidarité', 'red') +
      kpi('Total versé', fmt(s.total) + ' <small>HTG</small>', '', 'navy') + kpi('Reste dû', fmt(s.reste) + ' <small>HTG</small>', s.statut, s.reste ? 'orange' : 'green') + '</div>' +
    '<div class="grid-2"><div>' +
      panel('Situation à ce jour', '<dl class="dl">' +
        '<dt>Mois dus</dt><dd class="num">' + RULES.nb_cotisations_attendues + ' × ' + fmt(COT()) + '</dd><dt>Attendu</dt><dd class="num">' + money(s.attendu) + '</dd>' +
        '<dt>Versé</dt><dd class="num">' + money(s.total) + '</dd><dt>Retard</dt><dd class="num">' + money(s.reste) + '</dd>' +
        '<dt>Amendes dues</dt><dd class="num">' + money(s.amendesDues) + '</dd><dt>Cotisation du mois</dt><dd class="num">' + money(s.cotMois) + '</dd>' +
        (s.loanDue ? '<dt>Mensualité de prêt</dt><dd class="num">' + money(s.loanDue.du) + '</dd>' : '') +
        '<dt><b>Total à verser</b></dt><dd class="num"><b style="color:var(--orange)">' + money(s.totalAVerser) + '</b></dd></dl>', { meta: 'prochaine réunion' }) +
      panel('Présences aux réunions', attendanceSummary(s)) +
      panel('Éligibilité au prêt', '<dl class="dl"><dt>Rencontres</dt><dd class="num">' + fmt(sc.pres.pts) + ' / ' + sc.pres.max + '</dd><dt>Cotisations</dt><dd class="num">' + fmt(sc.cot.pts) + ' / ' + sc.cot.max + '</dd>' +
        '<dt>Prêts précédents</dt><dd class="num">' + fmt(sc.cred.pts) + ' / ' + sc.cred.max + '</dd><dt>Sous-total</dt><dd class="num"><b>' + fmt(sc.auto) + ' / ' + sc.autoMax + '</b></dd>' +
        '<dt>Appréciation comité</dt><dd>/ ' + GRILLE.pts_comite + ', donnée lors de l’étude de la demande</dd><dt>Montant possible</dt><dd class="num">jusqu’à ' + money(sc.bestMax) + '</dd></dl>' +
        '<div class="muted" style="margin-top:8px">La décision finale revient au comité.</div>') +
    '</div><div>' +
      panel('Mes demandes de prêt', table(['N°', 'Date', ['Montant', 'n'], 'Statut'], mesDem.map((d) => '<tr><td class="code">#' + d.id + '</td><td class="num">' + esc(d.date_demande) + '</td><td class="n">' + fmt(d.montant_demande) + '</td><td>' + statusBadge(d.statut) +
        (d.statut === 'Approuvée' ? ' <span class="muted num">' + fmt(d.montant_approuve) + '</span>' : '') + (d.commentaire_comite ? '<div class="muted" style="font-size:11px">' + esc(d.commentaire_comite) + '</div>' : '') + '</td></tr>')),
        { flush: true, right: '<button class="btn btn-sm btn-primary" data-act="demNew" data-id="self">Faire une nouvelle demande</button>' }) +
      panel('Prêt en cours', s.loan ? '<dl class="dl" style="margin-bottom:10px"><dt>Capital</dt><dd class="num">' + money(s.loan.capital) + '</dd><dt>Remboursé</dt><dd class="num">' + money(lt.rembourse) + '</dd><dt>Reste</dt><dd class="num">' + money(lt.reste) + '</dd></dl>' + scheduleTable(s.loan, false) : '<span class="muted">Aucun prêt en cours.</span>') +
      panel('Historique des cotisations', table(['Date', ['Verte', 'n'], ['Rouge', 'n'], 'Mode'], s.cots.slice().sort((a, b) => parseD(b.date) - parseD(a.date)).map((c) =>
        '<tr><td class="num">' + esc(c.date) + '</td><td class="n">' + fmt(c.verte) + '</td><td class="n">' + fmt(c.rouge) + '</td><td>' + esc(c.mode) + '</td></tr>')), { flush: true }) +
    '</div></div>';
};

/* ---------- Sauvegarde ---------- */
PAGES.sauvegarde = function () {
  const native = hasNative(); const folder = dataFolderLabel();
  const saved = store.raw(SAVED_AT_KEY);
  let size = 0; try { size = (store.raw(KEYS.db) || '').length; } catch (_e) { /* */ }
  return pageHead('Outils', t('sauvegarde'), saved ? 'Dernière modification : ' + fmtD(saved.slice(0, 10)) + ' à ' + saved.slice(11, 16) : '') +
    (native ? '<div class="banner soft"><span class="bt">Dossier des données</span><span class="num">' + esc(folder) + '</span><span class="muted">— enregistrement automatique à chaque modification + copie quotidienne dans « sauvegardes »</span>' +
      (UnieNative.openFolder ? '<div class="right"><button class="btn btn-sm" data-act="openFolder">Ouvrir le dossier</button></div>' : '') + '</div>'
      : '<div class="banner import"><span>Version navigateur : les données restent dans ce navigateur. Exportez régulièrement une sauvegarde, ou utilisez l’application Android / Windows qui enregistre automatiquement dans un dossier.</span></div>') +
    '<div class="grid-2">' +
      panel('Partager avec les membres', '<p style="margin-top:0">Fichier <b>.unimiso</b> à envoyer sur WhatsApp. Le membre touche le fichier : l’application UNIE-MUSO s’ouvre et importe les données.</p>' +
        '<p class="muted">Ce fichier ne contient <b>pas</b> les comptes administrateur et caissier.</p>' +
        '<button class="btn btn-accent" data-act="shareMembers">Partager (WhatsApp…)</button> <button class="btn" data-act="saveMembers">Enregistrer le fichier</button>') +
      panel('Sauvegarde complète', '<p style="margin-top:0">Toutes les données, y compris les comptes de gestion. À garder pour vous (clé USB, Google Drive, e-mail).</p>' +
        '<button class="btn btn-primary" data-act="exportJson">Exporter en JSON</button> <button class="btn" data-act="exportUnimiso">Exporter en .unimiso</button>') +
      panel('Importer', '<p style="margin-top:0">Fichier .json ou .unimiso reçu. Les données de cet appareil seront remplacées ; un fichier plus ancien demande confirmation.</p>' +
        '<button class="btn" data-act="importPick">Importer un fichier</button>') +
      panel('Réinitialiser', '<p style="margin-top:0">Remet la base aux données de départ (19 membres, 3 prêts). Exportez d’abord une sauvegarde.</p>' +
        (isAdmin() ? '<button class="btn btn-danger" data-act="resetDB">Réinitialiser la base</button>' : '<span class="muted">Réservé à l’administrateur.</span>')) +
    '</div>' +
    panel('Contenu', table(['Élément', ['Nombre', 'n']], [['Membres', DB.members.length], ['Cotisations', DB.cotisations.length], ['Amendes', DB.amendes_paid.length], ['Dépenses', DB.depenses.length], ['Prêts', DB.prets.length], ['Demandes', DB.demandes_pret.length], ['Pointages de présence', DB.absences.length]]
      .map((r) => '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>'), '<tr><td>Taille des données</td><td class="n">' + Math.round(size / 1024) + ' Ko</td></tr>'), { flush: true });
};
ACTIONS.resetDB = () => confirmBox('Réinitialiser la base', 'Toutes les cotisations, prêts, dépenses et demandes de cet appareil seront effacés et remplacés par les données de départ. Continuer ?', () => {
  DB = normalizeDB(clone(SEED_DATA)); saveDB(); toast('Base réinitialisée.', 'ok'); render();
}, 'Réinitialiser');

/* ---------- Paramètres ---------- */
PAGES.parametres = function () {
  const tab = STATE.ptab || 'general';
  const tabs = [['general', 'Général'], ['regles', 'Règles et amendes'], ['portail', 'Accès portail des membres'], ['comptes', 'Comptes de gestion'], ['alarmes', 'Alarmes']];
  let body = '';
  if (tab === 'general') {
    body = '<form data-form="general" class="panel"><div class="panel-body"><div class="form-grid">' +
      field('Langue / Lang', select('lang', [{ v: 'fr', l: 'Français' }, { v: 'kr', l: 'Kreyòl' }], SETTINGS.lang)) +
      field('Début de l’exercice comptable', input('fiscal_start', RULES.fiscal_start, 'type="date"'), '', 'Exercice actuel : ' + esc(fiscalLabel()) + ' (règlement chap. IX art. 46 : 1er octobre → 30 septembre).') +
      field('Démarrage de la mutuelle', input('mutuelle_start', RULES.mutuelle_start, 'type="date"')) +
      field('Heure de la réunion', input('meeting_hour', SETTINGS.meeting_hour, 'type="time"'), '', 'Dernier jeudi du mois.') +
      field('Signature — Présidente', input('sign_presidente', SETTINGS.sign_presidente)) + field('Signature — Trésorier', input('sign_tresorier', SETTINGS.sign_tresorier)) +
      '<div class="full" style="display:flex;gap:12px;align-items:center">' + (logoImg() ? '<span style="width:56px;height:56px;display:inline-block">' + logoImg().replace('<img', '<img style="width:56px;height:56px;object-fit:contain"') + '</span>' : '') +
        '<button type="button" class="btn btn-sm" data-act="pickLogo">Changer le logo</button>' + (SETTINGS.logo ? '<button type="button" class="btn btn-sm" data-act="resetLogo">Logo d’origine</button>' : '') + '</div>' +
      '</div></div><div class="modal-foot"><button class="btn btn-primary" data-act="saveGeneral">' + t('save') + '</button></div></form>';
  } else if (tab === 'regles') {
    const f = (k, l, h) => field(l, input(k, RULES[k], 'type="number" min="0" step="any"'), '', h);
    body = '<form class="panel"><div class="panel-head"><h2>Cotisations</h2></div><div class="panel-body"><div class="form-grid">' +
      f('cot_verte', 'Caisse Verte (HTG / mois)', 'Règlement chap. II art. 1 : 2 000 HTG') + f('cot_rouge', 'Caisse Rouge (HTG / mois)', 'Règlement chap. II art. 2 : 50 HTG') +
      f('frais_inscription', 'Frais d’inscription (HTG)', 'Non remboursable') + f('nb_cotisations_attendues', 'Nombre de cotisations attendues', 'Avril → octobre 2026 = 7 ; +1 après chaque réunion') +
      '</div></div><div class="panel-head"><h2>Amendes (règlement interne)</h2></div><div class="panel-body"><div class="form-grid">' +
      f('amende_absence', 'Absence non motivée (HTG)', 'Chap. IV art. 4 : 50 HTG') + f('amende_retard_reunion', 'Retard non motivé à la réunion (HTG)', 'Chap. IV art. 4 : 25 HTG') +
      f('amende_cot_retard', 'Cotisation mensuelle en retard (HTG)', 'Chap. II art. 5 : 50 HTG par cotisation') + f('frais_recherche', 'Frais de recherche — dépôt non prouvé (HTG)', 'Chap. II art. 4 : 250 HTG') +
      f('carnet_perdu', 'Carnet perdu (HTG)', 'Résolution : 500 HTG') + f('carnet_abime', 'Carnet sale ou déchiré (HTG)', 'Résolution : 250 HTG') +
      f('penalite_pret_pct', 'Pénalité prêt (% du capital en retard / mois)', 'Chap. VI art. 41 : 2 %') +
      '</div></div><div class="modal-foot"><button class="btn btn-primary" data-act="saveRegles">' + t('save') + '</button></div></form>';
  } else if (tab === 'portail') {
    const rows = DB.members.slice().sort(sortByCode).map((m) => '<tr><td class="code">' + m.code + '</td><td>' + esc(memberName(m)) + '</td>' +
      '<td>' + (m.portal_password ? '<span class="badge b-green">défini</span>' : '<span class="badge b-grey">aucun</span>') + ' <button class="btn btn-sm" data-act="setPwd" data-id="' + m.code + '">Définir</button></td>' +
      '<td class="c"><input type="checkbox" data-change="perm" data-id="' + m.code + ':can_see_documents"' + (m.can_see_documents ? ' checked' : '') + '></td>' +
      '<td class="c"><input type="checkbox" data-change="perm" data-id="' + m.code + ':is_comite"' + (m.is_comite ? ' checked' : '') + '></td>' +
      '<td>' + (m.is_comite ? '<input value="' + esc(m.comite_poste || '') + '" data-change="poste" data-id="' + m.code + '" list="postes" style="width:130px;padding:3px 6px;border:1px solid var(--line);border-radius:4px">' : '') + '</td>' +
      ['comite_see_demandes', 'comite_see_compta', 'comite_see_reports'].map((k) => '<td class="c">' + (m.is_comite ? '<input type="checkbox" data-change="perm" data-id="' + m.code + ':' + k + '"' + (m[k] ? ' checked' : '') + '>' : '') + '</td>').join('') + '</tr>');
    body = '<section class="panel"><div class="toolbar"><button class="btn btn-sm" data-act="defaultPwds">Générer des mots de passe par défaut</button><span class="muted">Code en minuscules (ex. m001) pour les membres sans mot de passe.</span></div>' +
      '<datalist id="postes">' + ['Présidente', 'Président', 'Vice-président(e)', 'Secrétaire', 'Secrétaire adjoint(e)', 'Trésorier', 'Contrôleur', 'Responsable crédit', 'Responsable cotisation'].map((p) => '<option value="' + p + '">').join('') + '</datalist>' +
      table(['Code', 'Membre', 'Mot de passe', ['Docs', 'c'], ['Comité', 'c'], 'Poste', ['Demandes', 'c'], ['Compta.', 'c'], ['Rapport', 'c']], rows) +
      '<div class="section-note">Tous les membres du comité peuvent noter les demandes de prêt depuis « Mon compte ». Les cases Demandes / Compta. / Rapport ouvrent les pages correspondantes.</div></section>';
  } else if (tab === 'comptes') {
    body = '<section class="panel"><div class="toolbar"><button class="btn btn-sm btn-primary" data-act="userEdit">Ajouter un compte</button></div>' +
      table(['Identifiant', 'Nom complet', 'Fonction', 'Rôle', ''], Object.keys(USERS).map((k) => '<tr><td class="code">' + esc(k) + '</td><td>' + esc(USERS[k].fullname) + '</td><td>' + esc(USERS[k].position || '') + '</td><td>' + esc(USERS[k].role) + '</td>' +
        '<td class="act"><button class="btn btn-sm" data-act="userEdit" data-id="' + esc(k) + '">' + t('edit') + '</button>' + (k !== SESSION.id ? '<button class="btn btn-sm btn-danger" data-act="userDel" data-id="' + esc(k) + '">' + t('del') + '</button>' : '') + '</td></tr>')) +
      '<div class="section-note">Changez les mots de passe « admin » et « caissier » par défaut. Ces comptes ne sont jamais inclus dans le fichier partagé avec les membres.</div></section>';
  } else {
    body = '<form class="panel"><div class="panel-body"><p style="margin-top:0">Rappels le jour de la réunion (dernier jeudi du mois, ' + esc(SETTINGS.meeting_hour) + '). Sur Android et Windows, les rappels s’affichent même si l’application est fermée' + (hasNative() ? '' : ' ; dans un navigateur, seulement si la page est ouverte') + '.</p>' +
      SETTINGS.alarmes.map((a, i) => '<div class="form-grid" style="grid-template-columns:120px 160px 1fr;margin-bottom:8px;align-items:end">' +
        field('Active', '<label class="check"><input type="checkbox" name="on' + i + '"' + (a.on ? ' checked' : '') + '> oui</label>') +
        field('Minutes avant', input('min' + i, a.min, 'type="number" min="0" step="5"')) + field('Libellé', input('label' + i, a.label)) + '</div>').join('') +
      '<div style="margin-top:8px"><button type="button" class="btn btn-sm" data-act="alarmAdd">Ajouter une alarme</button> <button type="button" class="btn btn-sm" data-act="alarmTest">Tester une notification</button></div>' +
      '</div><div class="modal-foot"><button class="btn btn-primary" data-act="saveAlarmes">' + t('save') + '</button></div></form>';
  }
  return pageHead('Outils', t('parametres'), 'Version ' + APP_VERSION) +
    '<div class="tabs no-print">' + tabs.map((x) => '<button class="' + (x[0] === tab ? 'on' : '') + '" data-act="ptab" data-id="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' + body;
};
function formOf(el) { return formData(el.closest('form')); }
ACTIONS.ptab = (id) => { STATE.ptab = id; render(); };
ACTIONS.saveGeneral = (_i, el) => {
  const v = formOf(el);
  SETTINGS.lang = v.lang; SETTINGS.meeting_hour = v.meeting_hour || '17:00'; SETTINGS.sign_presidente = v.sign_presidente; SETTINGS.sign_tresorier = v.sign_tresorier;
  RULES.fiscal_start = v.fiscal_start || RULES.fiscal_start; RULES.mutuelle_start = v.mutuelle_start || RULES.mutuelle_start;
  saveSettings(); saveRules(); toast('Paramètres enregistrés.', 'ok'); render();
};
ACTIONS.saveRegles = (_i, el) => {
  const v = formOf(el);
  Object.keys(v).forEach((k) => { RULES[k] = num(v[k]); });
  saveRules(); toast('Règles enregistrées.', 'ok'); render();
};
ACTIONS.pickLogo = () => pickFile('image/*', (f) => readImage(f, 512, 0.9).then((d) => { SETTINGS.logo = d; saveSettings(); render(); }).catch((e) => toast(e.message, 'err')));
ACTIONS.resetLogo = () => { SETTINGS.logo = ''; saveSettings(); render(); };
ACTIONS.perm = (key, el) => {
  const [code, k] = key.split(':'); const m = getMember(code);
  m[k] = el.checked;
  if (k === 'is_comite' && el.checked) { m.comite_see_demandes = true; m.comite_see_compta = true; m.comite_see_reports = true; }
  saveDB(); render();
};
ACTIONS.poste = (code, el) => { getMember(code).comite_poste = el.value.trim(); saveDB(); toast('Poste enregistré.', 'ok'); };
ACTIONS.setPwd = (code) => openModal({
  title: 'Mot de passe — ' + code + ' ' + nameOf(code), submit: t('save'),
  body: field('Nouveau mot de passe', input('pwd', getMember(code).portal_password || '', 'autocapitalize="off" autocorrect="off"'), '', 'Laisser vide pour bloquer l’accès au portail.'),
  onSubmit: (v) => { getMember(code).portal_password = v.pwd; saveDB(); toast('Mot de passe enregistré.', 'ok'); render(); },
});
ACTIONS.defaultPwds = () => {
  let n = 0; DB.members.forEach((m) => { if (!m.portal_password) { m.portal_password = m.code.toLowerCase(); n++; } });
  saveDB(); toast(n + ' mot(s) de passe généré(s).', 'ok'); render();
};
ACTIONS.userEdit = (id) => {
  const u = id ? USERS[id] : { role: 'caissier', fullname: '', position: '', pwd: '' };
  openModal({
    title: id ? 'Compte ' + id : 'Nouveau compte', submit: t('save'),
    body: '<div class="form-grid">' + field('Identifiant', input('id', id || '', id ? 'readonly' : 'required autocapitalize="off"')) + field('Rôle', select('role', [{ v: 'admin', l: 'Administrateur' }, { v: 'caissier', l: 'Caissier' }], u.role)) +
      field('Nom complet', input('fullname', u.fullname)) + field('Fonction', input('position', u.position)) + field('Mot de passe', input('pwd', u.pwd, 'required autocapitalize="off"'), 'full') + '</div>',
    onSubmit: (v) => {
      const k = (id || v.id || '').trim().toLowerCase();
      if (!k || !v.pwd) { toast('Identifiant et mot de passe obligatoires.', 'err'); return false; }
      if (!id && (USERS[k] || getMember(k.toUpperCase()))) { toast('Cet identifiant existe déjà.', 'err'); return false; }
      if (id === SESSION.id && v.role !== 'admin' && Object.keys(USERS).filter((x) => USERS[x].role === 'admin').length <= 1) { toast('Il faut garder au moins un administrateur.', 'err'); return false; }
      USERS[k] = { pwd: v.pwd, role: v.role, fullname: v.fullname, position: v.position }; saveUsers(); toast('Compte enregistré.', 'ok'); render();
    },
  });
};
ACTIONS.userDel = (id) => confirmBox('Supprimer le compte', 'Supprimer le compte « ' + esc(id) + ' » ?', () => { delete USERS[id]; saveUsers(); render(); }, t('del'));
function readAlarmForm(el) {
  const v = formOf(el);
  return SETTINGS.alarmes.map((a, i) => ({ on: !!v['on' + i], min: Math.max(0, num(v['min' + i])), label: v['label' + i] || a.label }));
}
ACTIONS.saveAlarmes = (_i, el) => { SETTINGS.alarmes = readAlarmForm(el); saveSettings(); scheduleNativeAlarms(); toast('Alarmes enregistrées.', 'ok'); render(); };
ACTIONS.alarmAdd = (_i, el) => { SETTINGS.alarmes = readAlarmForm(el).concat([{ on: true, min: 60, label: '1h avant' }]); saveSettings(); render(); };
ACTIONS.alarmTest = () => {
  if (canNotify() && Notification.permission === 'default') { try { Notification.requestPermission().then(() => notify('UNIE-MUSO', 'Les notifications fonctionnent.')); return; } catch (_e) { /* */ } }
  notify('UNIE-MUSO', 'Les notifications fonctionnent.');
};
