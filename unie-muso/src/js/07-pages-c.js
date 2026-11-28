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
  const r = fiscalRange(today());
  STATE.period = { from: toISO(r.from), to: toISO(r.to) }; render();
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
  // Comptes classés par classe, sans sous-total (format de la feuille BALANCE_VERIFICATION) : totaux en bas seulement
  const rows = [];
  CLASS_ORDER.forEach((cl) => {
    // Tous les comptes du plan sont listés, même à zéro (comme la feuille BALANCE_VERIFICATION)
    const list = [...new Set(Object.keys(ACCOUNTS).map(Number).filter((a) => accClass(a) === cl && a !== 5040).concat(accs.filter((a) => accClass(a) === cl)))].sort((x, y) => x - y);
    list.forEach((a) => { if (!B[a]) B[a] = { acc: a, d: 0, c: 0, pd: 0, pc: 0 }; });
    if (!list.length) return;
    rows.push('<tr><td colspan="6" style="background:var(--navy-050);font-weight:700;color:var(--navy)">' + esc(ACCOUNT_CLASSES[cl]) + '</td></tr>');
    let c1 = 0, c2 = 0, c3 = 0, c4 = 0;
    list.forEach((a) => {
      const b = B[a]; const s = b.d - b.c;
      c1 += b.pd; c2 += b.pc; c3 += s > 0 ? s : 0; c4 += s < 0 ? -s : 0;
      rows.push('<tr><td class="code">' + a + '</td><td>' + esc(accLabel(a)) + '</td><td class="n">' + fmt(b.pd) + '</td><td class="n">' + fmt(b.pc) + '</td><td class="n">' + (s > 0 ? fmt(s) : '') + '</td><td class="n">' + (s < 0 ? fmt(-s) : '') + '</td></tr>');
    });
    t1 += c1; t2 += c2; t3 += c3; t4 += c4;
  });
  return pageHead('Comptabilité', 'Balance de vérification', 'Mouvements de la période et soldes cumulés · ' + esc(periodText()), '<button class="btn" onclick="window.print()">' + t('print') + '</button>') +
    '<section class="panel">' + periodBar() + table(['Compte', 'Intitulé', ['Débit période', 'n'], ['Crédit période', 'n'], ['Solde débiteur cumulé', 'n'], ['Solde créditeur cumulé', 'n']], rows,
      '<tr><td colspan="2">TOTAUX ' + (Math.abs(t3 - t4) < 0.01 ? '— ✅ BALANCE ÉQUILIBRÉE' : '— ❌ ÉCART') + '</td><td class="n">' + fmt(t1) + '</td><td class="n">' + fmt(t2) + '</td><td class="n">' + fmt(t3) + '</td><td class="n">' + fmt(t4) + '</td></tr>') + '</section>';
};
/* Bilan au format du classeur du trésorier : Actif | Passif + capitaux propres */
const SEC = (t2) => '<tr><td colspan="3" style="background:var(--navy-050);font-weight:700;color:var(--navy);font-size:11.5px;letter-spacing:.04em;text-transform:uppercase">' + esc(t2) + '</td></tr>';
function bilanHTML(to) {
  const F = financials(null, to);
  const line = (x) => '<tr><td class="code">' + x.acc + '</td><td>' + esc(accLabel(x.acc)) + '</td><td class="n">' + fmt(x.v) + '</td></tr>';
  const ok = Math.abs(F.totActif - F.totPassif) < 0.01;
  return '<div class="grid-2">' +
    panel('Actif', table(['Compte', 'Désignation', ['Montant', 'n']],
      [SEC('Actif — trésorerie')].concat(F.actif.filter((x) => accClass(x.acc) === 1).map(line)).concat([SEC('Actif — créances')]).concat(F.actif.filter((x) => accClass(x.acc) === 2).map(line)),
      '<tr><td colspan="2">TOTAL ACTIF</td><td class="n">' + fmt(F.totActif) + '</td></tr>'), { flush: true }) +
    panel('Passif + capitaux propres', table(['Compte', 'Désignation', ['Montant', 'n']],
      [SEC('Passif')].concat(F.passif.map(line)).concat([SEC('Capitaux propres')]).concat(F.capitaux.map(line)),
      '<tr><td colspan="2">TOTAL PASSIF + CAPITAUX</td><td class="n">' + fmt(F.totPassif) + '</td></tr>'), { flush: true }) +
    '</div><div class="banner ' + (ok ? 'soft' : 'import') + '"><span>' + (ok ? '✅ BILAN ÉQUILIBRÉ — ACTIF = PASSIF + CAPITAUX PROPRES' : '❌ ÉCART : ' + money(F.totActif - F.totPassif)) + '</span></div>';
}
PAGES.bilan = function () {
  const p = STATE.period || {};
  return pageHead('Comptabilité', 'Bilan', 'Situation au ' + esc(p.to ? fmtD(p.to) : fmtD(today())), '<button class="btn" onclick="window.print()">' + t('print') + '</button>') +
    '<section class="panel">' + periodBar('Le bilan utilise la date de fin') + '</section>' + bilanHTML(p.to);
};
/* État des résultats au format du classeur du trésorier */
function resultatsHTML(from, to) {
  const F = financials(from, to);
  const row = (x) => '<tr><td>' + esc(x.l) + '</td><td class="code">' + x.acc + '</td><td class="n">' + fmt(x.v) + '</td></tr>';
  return panel('État des résultats', table(['Désignation', 'Compte', ['Montant', 'n']],
      [SEC('Produits')].concat(F.lignesProduits.map(row)).concat(['<tr style="font-weight:700"><td colspan="2">TOTAL PRODUITS</td><td class="n">' + fmt(F.totP) + '</td></tr>'])
        .concat([SEC('Charges')]).concat(F.lignesCharges.map(row)).concat(['<tr style="font-weight:700"><td colspan="2">TOTAL CHARGES</td><td class="n">' + fmt(F.totC) + '</td></tr>']),
      '<tr><td colspan="2">SURPLUS / DÉFICIT DE L’EXERCICE</td><td class="n" style="color:' + (F.resultat >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmt(F.resultat) + '</td></tr>'), { flush: true });
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
  const RR = reportRange(key); const from = RR.from, to = RR.to;
  const monthSel = '<select data-change="rmonth">' + months.slice().reverse().map((k) => '<option value="' + k + '"' + (k === key ? ' selected' : '') + '>' + monthLabel(k) + '</option>').join('') + '</select>';
  if (RR.invalid) {
    const held = heldMeetingDates().some((d) => d.getTime() === RR.meet.getTime());
    const q = held ? quorumInfo(RR.meet) : null;
    const nextK = monthKey(new Date(y, m, 1));
    const msg = held ? 'La réunion du ' + longDate(RR.meet) + ' n’a pas eu le quorum (' + q.pres + ' présents sur ' + q.N + ', ' + q.req + ' requis). Elle ne compte pas : les opérations de ' + monthLabel(key).toLowerCase() + ' sont présentées dans le rapport de ' + monthLabel(nextK).toLowerCase() + '.'
      : 'Aucune réunion valide n’est enregistrée pour ' + monthLabel(key).toLowerCase() + ' (réunion prévue le ' + longDate(RR.meet) + '). Les opérations du mois seront présentées dans le rapport du mois suivant.';
    window.__rapportResume = { key, invalid: true, msg };
    return pageHead('Rapports', t('rapport'), '', monthSel) + '<div class="banner import"><span>' + esc(msg) + '</span>' +
      (canEdit() ? '<div class="right"><button class="btn btn-sm" data-go="reunions">Réunions et quorum</button></div>' : '') + '</div>';
  }
  const inM = (x) => { const d = parseD(x.date); return d >= from && d <= to; };
  const T = treasury(to); const F = financials(from, to);
  const cots = DB.cotisations.filter(inM);
  const meet = lastThursday(y, m - 1);
  const actifs = DB.members.filter((x) => x.statut !== 'Inactif').sort(sortByCode);
  const att = actifs.map((x) => ({ m: x, type: attendanceType(x.code, meet) }));
  const heldMeeting = heldMeetingDates().some((d) => d.getTime() === meet.getTime());
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

  // Résumé rédigé du rapport (texte de présentation en réunion)
  const enCours = DB.prets.filter((x) => x.status !== 'Remboursé' && parseD(x.date) <= to);
  const dues = []; enCours.forEach((x) => loanSchedule(x).forEach((r) => { if (r.due >= from && r.due <= to) dues.push(r); }));
  const prevKey = monthKey(new Date(y, m - 2, 1));
  const prevCot = sum(DB.cotisations.filter((c) => monthKey(c.date) === prevKey), (c) => num(c.verte) + num(c.rouge));
  window.__rapportResume = { key, ctx: { carried: RR.carried, from, to, meet, heldMeeting, att, absents, retards, actifs, cots, totCot, am, rmb, pretsM, demM, enCours, dues, situ, enRetard, lateLoans, T, F, reco, prevKey, prevCot } };
  const sec = (n, title, body) => '<h2>' + n + '. ' + esc(title) + '</h2>' + body;
  return '<div class="no-print">' + pageHead('Rapports', t('rapport'), 'Modèle en 9 sections, prêt à imprimer ou enregistrer en PDF' + (RR.carried.length ? ' · inclut les opérations de ' + RR.carried.map((k) => monthLabel(k).toLowerCase()).join(', ') + ' (sans réunion valide)' : ''),
    monthSel +
    '<button class="btn btn-accent" data-act="rapportResume">Résumé du rapport</button><button class="btn btn-primary" onclick="window.print()">' + t('print') + ' / PDF</button>') + '</div>' +
    '<article class="report">' +
      '<div class="report-head">' + logoImg() + '<div><div class="t1">UNIE-MUSO</div><div class="t2">Unie Mutuelle Solidarité · Petit-Goâve, Haïti</div></div>' +
        '<div class="t3"><b>RAPPORT MENSUEL</b><br>' + esc(monthLabel(key)) + '<br><span class="muted">établi le ' + fmtD(today()) + '</span></div></div>' +
      sec(1, 'Résumé', '<div class="kpis">' + kpi('Membres actifs', actifs.length, '', 'navy') + kpi('Cotisations du mois', fmt(totCot), cots.length + ' versements', 'green') +
        kpi('Actif total', fmt(T.actif), 'fin de mois', 'navy') + kpi('Résultat du mois', fmt(F.resultat), '', F.resultat >= 0 ? 'green' : 'red') + '</div>' +
        '<p>Au ' + fmtD(to) + ', la mutuelle dispose de ' + money(T.banque) + ' à la banque CAP-AIDER' + (T.caisse ? ' et ' + money(T.caisse) + ' en caisse' : '') + ', et de ' + money(T.prets) + ' de prêts en cours auprès des membres. La Caisse Verte s’élève à ' + money(T.verteFonds) + ' et la Caisse Rouge à ' + money(T.rougeFonds) + '.</p>' +
        '<div style="margin-top:12px">' + resumeBody(window.__rapportResume, false) + '</div>') +
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
/* ---------- Résumé rédigé du rapport mensuel ----------
   Texte de présentation généré à partir des comptes (actif, passif, produits, charges), modifiable par le trésorier. */
function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
function accLine(x) { return accLabel(x.acc) + ' (' + x.acc + ') : ' + money(x.v); }
function joinList(arr) { return arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1]; }
function resumeBlocks(r) {
  const c = r.ctx; const T = c.T; const F = c.F; const mois = monthLabel(r.key).toLowerCase();
  const fin = fmtD(c.to); const B = [];
  const actif = F.actif.filter((x) => x.v); const prod = F.lignesProduits.filter((x) => x.v); const chg = F.lignesCharges.filter((x) => x.v);
  B.push({ h: '1. Situation générale' });
  if (c.carried && c.carried.length) B.push({ p: 'Ce rapport présente aussi les opérations de ' + joinList(c.carried.map((k) => monthLabel(k).toLowerCase())) + ', mois sans réunion valide (pas de réunion ou pas de quorum), reportées conformément au règlement.' });
  B.push({ p: 'Au ' + fin + ', UNIE-MUSO compte ' + c.actifs.length + ' membres actifs sur ' + DB.members.length + ' inscrits. ' +
    (c.heldMeeting ? 'La réunion mensuelle du ' + longDate(c.meet) + ' a réuni ' + (c.att.length - c.absents.length) + ' membres sur ' + c.att.length + ', soit un taux de présence de ' + pct(c.att.length - c.absents.length, c.att.length) + ' %' +
      (c.absents.length ? ' ; ' + c.absents.length + ' membre(s) étaient absents (' + joinList(c.absents.map((x) => memberName(x.m))) + ')' : ' ; aucun membre n’était absent') +
      (c.retards.length ? ' et ' + c.retards.length + ' sont arrivés en retard' : '') + '.'
      : 'Aucune réunion n’a été enregistrée pour le mois de ' + mois + ' (réunion prévue le ' + longDate(c.meet) + ').') });
  B.push({ h: '2. Situation patrimoniale (bilan au ' + fin + ')' });
  B.push({ p: 'Le total de l’actif s’élève à ' + money(F.totActif) + '. Il se compose de : ' + joinList(actif.map(accLine)) + '. ' +
    (T.caisse ? 'Une liquidité de ' + money(T.caisse) + ' reste en caisse et devra être déposée à CAP-AIDER. ' : 'Toute la trésorerie de la mutuelle est déposée à la banque CAP-AIDER. ') +
    'Les prêts aux membres représentent ' + pct(T.prets, F.totActif) + ' % de l’actif.' });
  const pv = (a2) => ((F.passif.concat(F.capitaux)).find((x) => x.acc === a2) || { v: 0 }).v;
  B.push({ p: 'Au passif figure l’épargne des membres en Caisse Verte (compte 3010) pour ' + money(pv(3010)) + (pv(3020) ? ', ainsi que des fonds extérieurs reçus (compte 3020) pour ' + money(pv(3020)) : '') + '. ' +
    'Les capitaux propres s’élèvent à ' + money(sum(F.capitaux, (x) => x.v)) + ' : Caisse Rouge, capital de solidarité (compte 5020), ' + money(pv(5020)) +
    (pv(5010) ? ' ; capital social (5010), ' + money(pv(5010)) : '') + (pv(5030) ? ' ; réserves (5030), ' + money(pv(5030)) : '') + ' ; surplus de l’exercice (compte 5040), ' + money(pv(5040)) + '. ' +
    (Math.abs(F.totActif - F.totPassif) < 0.01 ? 'Le bilan est équilibré (' + money(F.totActif) + ' à l’actif comme au passif).' : 'Attention : le bilan présente un écart de ' + money(F.totActif - F.totPassif) + '.') });
  B.push({ table: 'bilan' });
  B.push({ h: '3. Résultat du mois (' + mois + ')' });
  B.push({ p: 'Les produits du mois s’élèvent à ' + money(F.totP) + (prod.length ? ' : ' + joinList(prod.map((x) => x.l + ' (' + x.acc + ') : ' + money(x.v))) : '') + '. ' +
    'Les charges s’élèvent à ' + money(F.totC) + (chg.length ? ' : ' + joinList(chg.map((x) => x.l + ' (' + x.acc + ') : ' + money(x.v))) : ' (aucune dépense ce mois-ci)') + '. ' +
    'Le mois se solde par ' + (F.resultat >= 0 ? 'un excédent' : 'un déficit') + ' de ' + money(Math.abs(F.resultat)) + '. Depuis le début de l’activité, le résultat cumulé est de ' + money(F.resultatCum) + '.' });
  B.push({ table: 'resultat' });
  B.push({ h: '4. Cotisations' });
  const attendu = c.actifs.length * COT();
  B.push({ p: money(c.totCot) + ' ont été collectés en ' + c.cots.length + ' versements (Caisse Verte ' + money(sum(c.cots, (x) => x.verte)) + ', Caisse Rouge ' + money(sum(c.cots, (x) => x.rouge)) + '), soit ' + pct(c.totCot, attendu) + ' % de la cotisation mensuelle attendue (' + money(attendu) + ' pour ' + c.actifs.length + ' membres actifs). ' +
    (c.prevCot ? 'Par rapport à ' + monthLabel(c.prevKey).toLowerCase() + ' (' + money(c.prevCot) + '), la collecte ' + (c.totCot >= c.prevCot ? 'progresse de ' : 'recule de ') + pct(Math.abs(c.totCot - c.prevCot), c.prevCot) + ' %. ' : '') +
    'Les amendes encaissées ce mois s’élèvent à ' + money(sum(c.am, (x) => x.montant)) + ' (' + c.am.length + ').' });
  B.push({ h: '5. Crédit' });
  B.push({ p: (c.pretsM.length ? c.pretsM.length + ' prêt(s) ont été octroyés ce mois pour ' + money(sum(c.pretsM, (x) => x.capital)) + ' (' + joinList(c.pretsM.map((x) => nameOf(x.code_membre))) + '). ' : 'Aucun nouveau prêt n’a été octroyé ce mois. ') +
    'À la fin du mois, ' + c.enCours.length + ' prêt(s) sont en cours, avec ' + money(T.prets) + ' de capital restant dû (compte 2010) et ' + money(sum(c.enCours, (x) => loanTotals(x).reste)) + ' restant à rembourser, intérêts compris. ' +
    (c.dues.length ? c.dues.filter((x) => x.payment).length + ' mensualité(s) sur ' + c.dues.length + ' arrivées à échéance ce mois ont été payées. ' : '') +
    'Les remboursements reçus s’élèvent à ' + money(sum(c.rmb, (x) => x.montant)) + ', dont ' + money(sum(c.rmb, (x) => x.int)) + ' d’intérêts. ' +
    (c.lateLoans.length ? c.lateLoans.length + ' prêt(s) présentent des mensualités en retard. ' : 'Aucun prêt ne présente de retard. ') +
    (c.demM.length ? c.demM.length + ' demande(s) de prêt ont été déposées ce mois (' + c.demM.filter((d) => d.statut === 'Approuvée').length + ' approuvée(s), ' + c.demM.filter((d) => d.statut === 'En attente').length + ' en attente).' : '') });
  B.push({ h: '6. Fonds de la mutuelle' });
  B.push({ p: 'La Caisse Verte s’élève à ' + money(T.verteFonds) + ', dont ' + money(T.prets) + ' prêtés aux membres ; ' + money(T.verteDispo) + ' restent disponibles pour de nouveaux crédits. ' +
    'La Caisse Rouge (solidarité) s’élève à ' + money(T.rougeFonds) + ' ; selon le règlement, une aide de solidarité ne peut dépasser 15 % de cette caisse, soit ' + money(T.rougeFonds * 0.15) + ' actuellement.' });
  B.push({ h: '7. Points d’attention' });
  B.push({ p: (c.enRetard.length ? c.enRetard.length + ' membre(s) ne sont pas à jour de leurs cotisations pour un total de ' + money(sum(c.enRetard, (x) => x.reste)) + ' : ' + joinList(c.enRetard.map((x) => memberName(x.member) + ' (' + money(x.reste) + ')')) + '. ' : 'Tous les membres actifs sont à jour de leurs cotisations. ') +
    (sum(c.situ, (x) => x.amendesDues) ? 'Les amendes restant à percevoir totalisent ' + money(sum(c.situ, (x) => x.amendesDues)) + '.' : 'Aucune amende ne reste à percevoir.') });
  B.push({ h: '8. Conclusion et recommandations' });
  c.reco.forEach((x, i) => B.push({ p: (i + 1) + '. ' + x }));
  return B;
}
function resumeTables(kind, r) {
  const F = r.ctx.F; const line = (x) => '<tr><td class="code">' + x.acc + '</td><td>' + esc(accLabel(x.acc)) + '</td><td class="n">' + fmt(x.v) + '</td></tr>';
  if (kind === 'bilan') {
    return '<div class="grid-2" style="margin:6px 0 12px">' +
      table(['Compte', 'Actif', ['HTG', 'n']], F.actif.map(line), '<tr><td colspan="2">Total actif</td><td class="n">' + fmt(F.totActif) + '</td></tr>') +
      table(['Compte', 'Passif et capitaux propres', ['HTG', 'n']], F.passif.concat(F.capitaux).map(line), '<tr><td colspan="2">Total passif</td><td class="n">' + fmt(F.totPassif) + '</td></tr>') + '</div>';
  }
  const row = (x) => '<tr><td>' + esc(x.l) + '</td><td class="code">' + x.acc + '</td><td class="n">' + fmt(x.v) + '</td></tr>';
  return '<div class="grid-2" style="margin:6px 0 12px">' +
    table(['Produits du mois', 'Compte', ['HTG', 'n']], F.lignesProduits.filter((x) => x.v).map(row).concat(F.lignesProduits.some((x) => x.v) ? [] : ['<tr><td colspan="3" class="muted">Aucun produit</td></tr>']), '<tr><td colspan="2">TOTAL PRODUITS</td><td class="n">' + fmt(F.totP) + '</td></tr>') +
    table(['Charges du mois', 'Compte', ['HTG', 'n']], F.lignesCharges.filter((x) => x.v).map(row).concat(F.lignesCharges.some((x) => x.v) ? [] : ['<tr><td colspan="3" class="muted">Aucune charge</td></tr>']), '<tr><td colspan="2">SURPLUS / DÉFICIT</td><td class="n">' + fmt(F.resultat) + '</td></tr>') + '</div>';
}
/* Texte personnalisé du trésorier (par mois) : « ## » = titre, ligne vide = nouveau paragraphe */
function customResume(key) { return (SETTINGS.resume_text || {})[key] || ''; }
function blocksToText(B) { return B.filter((b) => !b.table).map((b) => (b.h ? '## ' + b.h : b.p)).join('\n\n'); }
function textToBlocks(txt) {
  const out = [];
  txt.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).forEach((para) => {
    if (para.startsWith('## ')) {
      const h = para.split('\n')[0].slice(3); out.push({ h });
      // Les tableaux des comptes s'affichent à la fin des parties 2 (bilan) et 3 (résultat)
      if (/^2\./.test(h)) out.push({ table: 'bilan' });
      if (/^3\./.test(h)) out.push({ table: 'resultat' });
      const rest = para.split('\n').slice(1).join(' ').trim(); if (rest) out.push({ p: rest });
    } else out.push({ p: para.replace(/\n/g, ' ') });
  });
  return out;
}
function currentBlocks(r) { const c = customResume(r.key); return c ? textToBlocks(c) : resumeBlocks(r); }
function resumeBody(r, withHead) {
  if (!r) return '';
  if (r.invalid) return '<div class="banner import" style="margin:0"><span>' + esc(r.msg) + '</span></div>';
  const B = currentBlocks(r);
  // Les tableaux suivent le paragraphe de leur section
  const html = []; let pendingTable = null;
  B.forEach((b) => {
    if (b.table) { pendingTable = b.table; return; }
    if (b.h && pendingTable) { html.push(resumeTables(pendingTable, r)); pendingTable = null; }
    html.push(b.h ? '<h4 style="margin:16px 0 6px;color:var(--navy);font-size:13.5px">' + esc(b.h) + '</h4>' : '<p style="margin:0 0 8px;line-height:1.65;text-align:justify">' + esc(b.p) + '</p>');
  });
  if (pendingTable) html.push(resumeTables(pendingTable, r));
  return (withHead ? '<div class="report-head" style="margin-bottom:10px">' + logoImg() + '<div><div class="t1">UNIE-MUSO</div><div class="t2">Résumé du rapport mensuel — ' + esc(monthLabel(r.key)) + '</div></div>' +
    '<div class="t3">Présenté par<br><b>' + esc(SETTINGS.sign_tresorier) + '</b><br>Trésorier</div></div>' : '') +
    html.join('') +
    (withHead ? '<div class="sig"><div>' + esc(SETTINGS.sign_presidente) + '<br>Présidente</div><div>' + esc(SETTINGS.sign_tresorier) + '<br>Trésorier</div></div>' : '');
}
function resumeText(r) {
  if (r.invalid) return 'UNIE-MUSO — ' + monthLabel(r.key) + '\n\n' + r.msg;
  return 'UNIE-MUSO — Résumé du rapport mensuel, ' + monthLabel(r.key) + '\n\n' +
    currentBlocks(r).filter((b) => !b.table).map((b) => (b.h ? '*' + b.h + '*' : b.p)).join('\n\n') + '\n\n' + SETTINGS.sign_tresorier + ', Trésorier';
}
ACTIONS.rapportResume = () => {
  const r = window.__rapportResume; if (!r) return;
  if (r.invalid) { openModal({ title: 'Résumé du rapport — ' + monthLabel(r.key), body: resumeBody(r) }); return; }
  openModal({
    title: 'Résumé du rapport — ' + monthLabel(r.key), wide: true,
    body: '<div class="report" style="padding:20px 24px;border:0">' + resumeBody(r, true) + '</div>' +
      (customResume(r.key) ? '<div class="muted" style="margin-top:6px">Texte modifié par le trésorier.</div>' : ''),
    footLeft: '<button type="button" class="btn btn-accent" data-act="resumeCopy">Copier pour WhatsApp</button><button type="button" class="btn" data-act="resumePrint">' + t('print') + ' / PDF</button>' +
      (canEdit() ? '<button type="button" class="btn" data-act="resumeEdit">Modifier le texte</button>' : ''),
  });
};
ACTIONS.resumeEdit = () => {
  const r = window.__rapportResume;
  openModal({
    title: 'Modifier le résumé — ' + monthLabel(r.key), wide: true, submit: t('save'),
    body: field('Texte du résumé', '<textarea name="txt" style="min-height:60vh;font-size:12.5px;line-height:1.55">' + esc(customResume(r.key) || blocksToText(resumeBlocks(r))) + '</textarea>', '',
      '« ## » en début de ligne = titre de partie ; laissez une ligne vide entre deux paragraphes. Les tableaux des comptes restent ajoutés automatiquement aux parties 2 et 3.'),
    footLeft: customResume(r.key) ? '<button type="button" class="btn btn-danger" data-act="resumeReset">Revenir au texte automatique</button>' : '',
    onSubmit: (v) => {
      SETTINGS.resume_text = Object.assign({}, SETTINGS.resume_text, { [r.key]: v.txt.trim() === blocksToText(resumeBlocks(r)).trim() ? '' : v.txt.trim() });
      saveSettings(); toast('Résumé enregistré.', 'ok'); render(); setTimeout(() => ACTIONS.rapportResume(), 0);
    },
  });
};
ACTIONS.resumeReset = () => {
  const r = window.__rapportResume;
  SETTINGS.resume_text = Object.assign({}, SETTINGS.resume_text, { [r.key]: '' }); saveSettings();
  closeModal(); render(); ACTIONS.rapportResume(); toast('Texte automatique rétabli.', 'ok');
};
ACTIONS.resumeCopy = () => {
  const txt = resumeText(window.__rapportResume);
  const done = () => toast('Résumé copié : collez-le dans WhatsApp.', 'ok');
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done)); } else fallbackCopy(txt, done);
};
function fallbackCopy(txt, done) {
  const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (_e) { toast('Copie impossible : sélectionnez le texte manuellement.', 'err'); }
  ta.remove();
}
ACTIONS.resumePrint = () => printHTML('Résumé — ' + monthLabel(window.__rapportResume.key), '<div class="report">' + resumeBody(window.__rapportResume, true) + '</div>');
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
/* Résumé du rapport mensuel visible par tous les membres, directement dans « Mon compte » */
function lastReportMonth() {
  const withData = activityMonths().filter((k) => DB.cotisations.some((c) => monthKey(c.date) === k));
  return withData.length ? withData[withData.length - 1] : monthKey(today());
}
function memberResumePanel() {
  const key = STATE.mrmonth || lastReportMonth();
  const keep = { rmonth: STATE.rmonth, r: window.__rapportResume };
  STATE.rmonth = key;
  try { PAGES.rapport(); } catch (_e) { /* le rapport complet reste disponible */ }
  const r = window.__rapportResume;
  STATE.rmonth = keep.rmonth;
  const months = activityMonths().filter((k) => k <= monthKey(today())).reverse();
  return '<section class="panel"><div class="panel-head"><h2>Résumé du rapport mensuel</h2>' +
    '<div class="right"><select data-change="mrmonth" style="padding:4px 6px;border:1px solid var(--line);border-radius:5px">' + months.map((k) => '<option value="' + k + '"' + (k === key ? ' selected' : '') + '>' + monthLabel(k) + '</option>').join('') + '</select>' +
    '<button class="btn btn-sm" data-act="mrOpen">Plein écran</button>' + (canSee('rapport') ? '<button class="btn btn-sm btn-primary" data-act="mrFull">Rapport complet</button>' : '') + '</div></div>' +
    '<div class="panel-body" style="max-height:420px;overflow-y:auto">' + resumeBody(r, false) + '</div></section>';
}
ACTIONS.mrmonth = (_i, el) => { STATE.mrmonth = el.value; render(); };
ACTIONS.mrOpen = () => { STATE.rmonth = STATE.mrmonth || lastReportMonth(); PAGES.rapport(); ACTIONS.rapportResume(); };
ACTIONS.mrFull = () => { STATE.rmonth = STATE.mrmonth || lastReportMonth(); go('rapport'); };
/* ---------- Espace du membre : une page par rubrique (menu « Mon compte ») ---------- */
function myMember() { return currentMember(); }
function infoRow(label, val) { return '<dt>' + esc(label) + '</dt><dd>' + (val ? esc(val) : '<span class="muted">—</span>') + '</dd>'; }
function monthsSince(d) { d = parseD(d); if (!d) return 0; const t0 = today(); return Math.max(0, (t0.getFullYear() - d.getFullYear()) * 12 + t0.getMonth() - d.getMonth()); }
/* ---------- Présentation du haut de « Mon profil » (choisie dans Paramètres) ---------- */
const PROFILE_STYLES = { classique: 'Classique', carte: 'Carte de membre', banniere: 'Bannière', essentiel: 'Essentiel' };
function profileInfos(m, anc) {
  return [['Téléphone', m.telephone], ['E-mail', m.email], ['Adresse', m.adresse], ['NIF', m.nif], ['Date de naissance', m.date_naissance], ['Profession', m.profession],
    ['Membre depuis', m.date_adhesion ? m.date_adhesion + (anc ? ' (' + anc + ' mois)' : '') : ''], ['Poste au comité', m.is_comite ? m.comite_poste || 'Membre du comité' : '']];
}
function profilePhoto(m, cls) { return '<div class="' + cls + '">' + (m.photo ? '<img alt="Photo de ' + esc(memberName(m)) + '" src="' + esc(m.photo) + '">' : '<span>' + esc(initials(m)) + '</span>') + '</div>'; }
const PROFILE_FIX = '<p class="pv-fix">Une information manque ou est fausse ? Écrivez au comité plus bas : le trésorier mettra votre fiche à jour.</p>';
function profileTop(m, s, anc) {
  const st = SETTINGS.profile_style || 'carte';
  const meet = esc(longDate(nextMeeting())) + ' · ' + esc(SETTINGS.meeting_hour);
  const infos = profileInfos(m, anc);
  const rows = (list) => list.map((x) => '<div class="pv-row"><span>' + esc(x[0]) + '</span><b>' + (x[1] ? esc(x[1]) : '<i>—</i>') + '</b></div>').join('');
  const pct = s.attendu ? Math.min(100, Math.round(s.total / s.attendu * 100)) : 100;
  if (st === 'carte') {
    // Carte verte si le membre est à jour (cotisations, amendes, prêt), rouge sinon, avec la raison
    const loan = activeLoan(m.code); const nx = loan ? nextInstallment(loan) : null;
    const pretRetard = !!(nx && daysBetween(today(), nx.due) < 0);
    const why = [];
    if (s.reste > 0) why.push('Kotizasyon an reta: ' + money(s.reste));
    if (s.amendesDues > 0) why.push('Amand pou peye: ' + money(s.amendesDues));
    if (pretRetard) why.push('Mansyalite prè an reta');
    const ok = !why.length;
    return '<section class="pv-card-wrap"><div class="pv-card ' + (ok ? 'is-ok' : 'is-late') + '">' +
        '<div class="pv-card-top"><span class="pv-brand">UNIE-MUSO</span><span class="pv-kind">Kat manm</span></div>' +
        '<div class="pv-card-main">' + profilePhoto(m, 'pv-ph') +
          '<div class="pv-card-id"><div class="pv-nm">' + esc(memberName(m)) + '</div>' +
          '<div class="pv-code">' + m.code + '</div>' +
          '<div class="pv-tags"><span class="pv-tag ' + (m.statut === 'Actif' ? 'ok' : '') + '">' + esc(m.statut) + '</span>' + (m.is_comite ? '<span class="pv-tag gold">' + esc(m.comite_poste || 'Comité') + '</span>' : '') + '</div></div></div>' +
        '<div class="pv-state">' + (ok ? '✓ A jou' : '! Pa a jou') + '<small>' + (ok ? 'Kotizasyon, amand ak prè: tout peye' : esc(why.join(' · '))) + '</small></div>' +
        '<div class="pv-card-foot"><span>Manm depi ' + esc(m.date_adhesion || '—') + '</span><span>Petit-Goâve · Haïti</span></div>' +
      '</div>' +
      '<div class="pv-tiles"><div class="pv-tile pay"><span>' + t('to_pay') + '</span><b class="num">' + money(s.totalAVerser) + '</b><small>pwochen reyinyon</small></div>' +
        '<div class="pv-tile"><span>' + t('next_meeting') + '</span><b>' + meet + '</b><small>' + (s.reste ? 'Reta: ' + money(s.reste) : 'Kotizasyon a jou') + '</small></div></div>' +
      '<details class="panel pv-more pv-info"><summary>Mes informations personnelles</summary><div class="pv-rows">' + rows(infos) + '</div>' + PROFILE_FIX + '</details></section>';
  }
  if (st === 'banniere') {
    return '<section class="panel pv-ban"><div class="pv-cover"></div>' + profilePhoto(m, 'pv-ph') +
      '<div class="pv-ban-id"><div class="pv-nm">' + esc(memberName(m)) + '</div>' +
        '<div class="pv-tags"><span class="pv-tag line">' + m.code + '</span><span class="pv-tag ' + (m.statut === 'Actif' ? 'ok' : '') + '">' + esc(m.statut) + '</span>' + (m.is_comite ? '<span class="pv-tag gold">' + esc(m.comite_poste || 'Comité') + '</span>' : '') + '</div></div>' +
      '<div class="pv-stats"><div><b class="num">' + fmt(s.verte) + '</b><span>Epay (Kès Vèt)</span></div><div><b class="num">' + fmt(s.total) + '</b><span>Total vèse</span></div><div class="pay"><b class="num">' + fmt(s.totalAVerser) + '</b><span>' + t('to_pay') + '</span></div></div>' +
      '<div class="pv-meet">' + t('next_meeting') + ' : <b>' + meet + '</b></div>' +
      '<div class="pv-grid">' + infos.map((x) => '<div class="pv-cell"><span>' + esc(x[0]) + '</span><b>' + (x[1] ? esc(x[1]) : '<i>—</i>') + '</b></div>').join('') + '</div>' + PROFILE_FIX + '</section>';
  }
  if (st === 'essentiel') {
    const prenom = (m.prenom || memberName(m)).split(' ')[0];
    return '<section class="pv-ess"><div class="pv-hello">' + profilePhoto(m, 'pv-ph') + '<div><div class="pv-hi">Bonjou, ' + esc(prenom) + '</div><div class="pv-sub">' + m.code + ' · ' + esc(m.statut) + (m.is_comite ? ' · ' + esc(m.comite_poste || 'Comité') : '') + '</div></div></div>' +
      '<div class="pv-due"><div class="pv-due-l"><span>Pou pote nan pwochen reyinyon an</span><b class="num">' + money(s.totalAVerser) + '</b><small>' + meet + '</small></div>' +
        '<div class="pv-due-r"><div><span>Kotizasyon</span><b class="num">' + money(s.cotMois) + '</b></div>' + (s.loanDue ? '<div><span>Mansyalite prè</span><b class="num">' + money(s.loanDue.du) + '</b></div>' : '') + (s.reste ? '<div><span>Reta</span><b class="num">' + money(s.reste) + '</b></div>' : '') + (s.amendesDues ? '<div><span>Amand</span><b class="num">' + money(s.amendesDues) + '</b></div>' : '') + '</div></div>' +
      '<div class="pv-prog"><div class="pv-prog-h"><span>Kotizasyon ane a</span><b class="num">' + money(s.total) + ' / ' + money(s.attendu) + '</b></div><div class="pv-bar"><i style="width:' + pct + '%"></i></div></div>' +
      '<details class="panel pv-more"><summary>Mes informations personnelles</summary><div class="pv-rows">' + rows(infos) + '</div>' + PROFILE_FIX + '</details></section>';
  }
  return '<section class="panel profile" data-style="classique"><div class="profile-head">' +
      '<div class="profile-photo">' + (m.photo ? '<img alt="Photo de ' + esc(memberName(m)) + '" src="' + esc(m.photo) + '">' : '<span>' + esc(initials(m)) + '</span>') + '</div>' +
      '<div class="profile-id"><div class="nm">' + esc(memberName(m)) + '</div>' +
        '<div class="muted" style="margin:4px 0 10px"><span class="code">' + m.code + '</span> · ' + statusBadge(m.statut) + (m.is_comite ? ' <span class="badge b-navy">' + esc(m.comite_poste || 'Comité') + '</span>' : '') + '</div>' +
        '<div class="profile-due"><div><div class="lbl">' + t('next_meeting') + '</div><b>' + esc(longDate(nextMeeting())) + '</b> · ' + esc(SETTINGS.meeting_hour) + '</div>' +
        '<div><div class="lbl">' + t('to_pay') + '</div><span class="num" style="font-size:22px;font-weight:800;color:var(--orange)">' + money(s.totalAVerser) + '</span></div></div></div></div>' +
      '<div class="panel-body" style="border-top:1px solid var(--line-soft)"><dl class="dl profile-dl">' +
        infoRow('Téléphone', m.telephone) + infoRow('E-mail', m.email) + infoRow('Adresse', m.adresse) + infoRow('NIF', m.nif) +
        infoRow('Date de naissance', m.date_naissance) + infoRow('Profession', m.profession) +
        infoRow('Membre depuis', m.date_adhesion ? m.date_adhesion + (anc ? ' (' + anc + ' mois)' : '') : '') + infoRow('Poste au comité', m.is_comite ? m.comite_poste || 'Membre du comité' : '') +
      '</dl><div class="muted" style="font-size:11.5px;margin-top:8px">Une information manque ou est fausse ? Écrivez au comité ci-dessous : le trésorier mettra votre fiche à jour.</div></div></section>';
}
/* Mon profil : grande photo, informations personnelles, situation, présences, réunions, messages au comité */
PAGES.moncompte = function () {
  const m = myMember(); if (!m) return '';
  const s = memberStats(m.code);
  const aNoter = m.is_comite ? DB.demandes_pret.filter((d) => d.statut === 'En attente' && d.code_membre !== m.code) : [];
  const anc = monthsSince(m.date_adhesion);
  return meetingBanner() + loanBanner(m.code) + profileTop(m, s, anc) +
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
        '<dt>Amendes dues</dt><dd class="num">' + money(s.amendesDues) + cotLateDetail(s) + '</dd><dt>Cotisation du mois</dt><dd class="num">' + money(s.cotMois) + '</dd>' +
        (s.loanDue ? '<dt>Mensualité de prêt</dt><dd class="num">' + money(s.loanDue.du) + '</dd>' : '') +
        '<dt><b>Total à verser</b></dt><dd class="num"><b style="color:var(--orange)">' + money(s.totalAVerser) + '</b></dd></dl>', { meta: 'prochaine réunion' }) +
      panel('Présences aux réunions', attendanceSummary(s)) +
    '</div><div>' + memberMeetingsPanel(m) + memberCommPanel(m) + '</div></div>';
};
PAGES.mesannonces = function () {
  const m = myMember(); if (!m) return '';
  const ann = (DB.annonces || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const html = pageHead(t('g_compte'), t('mesannonces'), ann.length + ' annonce(s) du comité', canPostAnnonce() ? '<button class="btn btn-primary" data-act="annNew">Publier une annonce</button>' : '') +
    (ann.length ? ann.map((a) => '<div class="panel" style="border-left:3px solid var(--orange)"><div class="panel-head"><h2>' + (!(a.seen || []).includes(m.code) ? '<span class="badge b-red">Nouveau</span> ' : '') + esc(a.titre) + '</h2>' +
      '<span class="meta">' + esc(a.by_name) + ' · ' + esc(fmtDT(a.date)) + '</span></div><div class="panel-body" style="white-space:pre-wrap">' + esc(a.texte) + '</div></div>').join('')
      : '<div class="panel"><div class="empty">Aucune annonce pour le moment.</div></div>');
  markMemberRead(m.code, 'annonces');
  return html;
};
PAGES.monresume = function () { return pageHead(t('g_compte'), t('monresume'), 'Présenté par le trésorier, signé par la présidente') + memberResumePanel(); };
PAGES.meligibilite = function () {
  const m = myMember(); if (!m) return '';
  const s = memberStats(m.code); const sc = creditScore(m.code);
  return pageHead(t('g_compte'), t('meligibilite'), 'Grille d’évaluation de crédit UNIE-MUSO') +
    '<div class="kpis">' + kpi('Sous-total automatique', fmt(sc.auto) + ' <small>/ ' + sc.autoMax + '</small>', '+ appréciation du comité / ' + GRILLE.pts_comite, 'navy') +
      kpi('Montant possible', sc.bestSeuil.eligible ? fmt(sc.bestMax) + ' <small>HTG</small>' : '—', sc.bestSeuil.eligible ? 'au mieux : ' + sc.bestSeuil.label : 'note de 50 ou moins : non éligible', sc.bestSeuil.eligible ? 'green' : 'red') + '</div>' +
    panel('Détail de ma note', '<dl class="dl"><dt>1. Rencontres (5 dernières)</dt><dd class="num">' + fmt(sc.pres.pts) + ' / ' + sc.pres.max + '</dd>' +
      '<dt>2. Cotisations (5 derniers mois)</dt><dd class="num">' + fmt(sc.cot.pts) + ' / ' + sc.cot.max + '</dd>' +
      '<dt>3. Prêts précédents</dt><dd class="num">' + fmt(sc.cred.pts) + ' / ' + sc.cred.max + '</dd>' +
      '<dt>4. Appréciation du comité</dt><dd>/ ' + GRILLE.pts_comite + ', donnée lors de l’étude de la demande</dd>' +
      '<dt>Cotisations Caisse Verte à jour</dt><dd class="num">' + money(s.verte) + '</dd></dl>' +
      (s.loan ? '<div class="banner import" style="margin:12px 0 0"><span>Vous avez un prêt en cours : nouvelle demande possible après le remboursement complet.</span></div>' : '') +
      '<div class="muted" style="margin-top:10px">La décision finale revient au comité.</div>') +
    panel('Barème de décision', table(['Note finale', 'Observation', 'Somme approuvée'], GRILLE.seuils.map((x) => '<tr><td class="num">' + x.min + ' – ' + x.max + '</td><td>' + esc(x.label) + '</td><td>' + esc(x.regle || '') + '</td></tr>')), { flush: true });
};
PAGES.monpret = function () {
  const m = myMember(); if (!m) return '';
  const s = memberStats(m.code); const lt = s.loan ? loanTotals(s.loan) : null;
  return loanBanner(m.code) + pageHead(t('g_compte'), t('monpret'), s.loan ? 'Prêt #' + s.loan.id + ' du ' + s.loan.date : '') +
    (s.loan ? '<div class="kpis">' + kpi('Capital', fmt(s.loan.capital) + ' <small>HTG</small>', s.loan.duree + ' mois · ' + s.loan.taux + ' %', 'navy') + kpi('Remboursé', fmt(lt.rembourse) + ' <small>HTG</small>', lt.nbPaid + ' / ' + lt.nb + ' mensualités', 'green') +
      kpi('Reste à rembourser', fmt(lt.reste) + ' <small>HTG</small>', lt.retard ? lt.retard + ' en retard' : 'aucun retard', lt.retard ? 'red' : 'orange') + '</div>' + panel('Échéancier', scheduleTable(s.loan, false), { flush: true })
      : '<div class="panel"><div class="empty">Aucun prêt en cours.</div></div>');
};
PAGES.mesdemandes = function () {
  const m = myMember(); if (!m) return '';
  const s = memberStats(m.code);
  const mesDem = DB.demandes_pret.filter((d) => d.code_membre === m.code).sort((a, b) => b.id - a.id);
  return pageHead(t('g_compte'), t('mesdemandes'), mesDem.length + ' demande(s)', s.loan ? '' : '<button class="btn btn-primary" data-act="demNew" data-id="self">Faire une nouvelle demande</button>') +
    (s.loan ? '<div class="banner import"><span>Vous avez un prêt en cours : nouvelle demande possible après le remboursement complet.</span></div>' : '') +
    '<section class="panel">' + table(['N°', 'Date', ['Montant', 'n'], 'Motif', 'Statut'], mesDem.map((d) => '<tr><td class="code">#' + d.id + '</td><td class="num">' + esc(d.date_demande) + '</td><td class="n">' + fmt(d.montant_demande) + '</td><td>' + esc(d.motif || '') + '</td><td>' + statusBadge(d.statut) +
      (d.statut === 'Approuvée' ? ' <span class="muted num">' + fmt(d.montant_approuve) + ' · ' + d.duree_approuvee + ' mois</span>' : '') + (d.commentaire_comite ? '<div class="muted" style="font-size:11px">' + esc(d.commentaire_comite) + '</div>' : '') + '</td></tr>')) + '</section>';
};
PAGES.mescotisations = function () {
  const m = myMember(); if (!m) return '';
  const s = memberStats(m.code);
  return pageHead(t('g_compte'), t('mescotisations'), s.cots.length + ' versement(s) · ' + money(s.total)) +
    '<div class="kpis">' + kpi('Caisse Verte', fmt(s.verte) + ' <small>HTG</small>', 'mon épargne', 'green') + kpi('Caisse Rouge', fmt(s.rouge) + ' <small>HTG</small>', 'solidarité', 'red') +
      kpi('Reste dû', fmt(s.reste) + ' <small>HTG</small>', s.statut, s.reste ? 'orange' : 'green') + '</div>' +
    '<section class="panel">' + table(['Date', ['Verte', 'n'], ['Rouge', 'n'], ['Total', 'n'], 'Mode'], s.cots.slice().sort((a, b) => parseD(b.date) - parseD(a.date)).map((c) =>
      '<tr><td class="num">' + esc(c.date) + '</td><td class="n">' + fmt(c.verte) + '</td><td class="n">' + fmt(c.rouge) + '</td><td class="n">' + fmt(num(c.verte) + num(c.rouge)) + '</td><td>' + esc(c.mode) + '</td></tr>'),
      '<tr><td>Total</td><td class="n">' + fmt(s.verte) + '</td><td class="n">' + fmt(s.rouge) + '</td><td class="n">' + fmt(s.total) + '</td><td></td></tr>') + cotLateDetail(s).replace('margin-top:4px', 'padding:10px 16px') + '</section>';
};

/* ---------- Sauvegarde ---------- */
PAGES.sauvegarde = function () {
  const native = hasNative(); const folder = dataFolderLabel();
  const saved = store.raw(SAVED_AT_KEY);
  let size = 0; try { size = (store.raw(KEYS.db) || '').length; } catch (_e) { /* */ }
  return pageHead('Outils', t('sauvegarde'), saved ? 'Dernière modification : ' + fmtDT(saved).replace(' ', ' à ') : '') +
    (native ? '<div class="banner soft"><span class="bt">Dossier des données</span><span class="num">' + esc(folder) + '</span><span class="muted">— enregistrement automatique à chaque modification + copie quotidienne dans « sauvegardes »</span>' +
      (UnieNative.openFolder ? '<div class="right"><button class="btn btn-sm" data-act="openFolder">Ouvrir le dossier</button></div>' : '') + '</div>'
      : '<div class="banner import"><span>Version navigateur : les données restent dans ce navigateur. Exportez régulièrement une sauvegarde, ou utilisez l’application Android / Windows qui enregistre automatiquement dans un dossier.</span></div>') +
    '<div class="grid-2">' +
      panel('Partager avec les membres', '<p style="margin-top:0">Fichier <b>.unimiso</b> à envoyer sur WhatsApp. Le membre touche le fichier : l’application UNIE-MUSO s’ouvre et importe les données.</p>' +
        '<p class="muted">Ce fichier ne contient <b>pas</b> le compte administrateur.</p>' +
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
  const tabs = [['general', 'Général'], ['regles', 'Règles et amendes'], ['portail', 'Accès portail des membres'], ['comptes', 'Comptes de gestion'], ['alarmes', 'Alarmes'], ['enligne', 'En ligne']];
  let body = '';
  if (tab === 'general') {
    body = '<form data-form="general" class="panel"><div class="panel-body"><div class="form-grid">' +
      field('Langue par défaut / Lang pa defo', select('lang', [{ v: 'fr', l: 'Français' }, { v: 'kr', l: 'Kreyòl' }], SETTINGS.lang), '', 'Chaque personne choisit ensuite sa langue (FR / KR en haut de l’écran).') +
      field('Début de l’exercice comptable', input('fiscal_start', RULES.fiscal_start, 'type="date"'), '', 'Exercice actuel : ' + esc(fiscalLabel()) + '. Exercice de la mutuelle : 1er avril → 31 mars (indépendant de l’exercice fiscal haïtien).') +
      field('Démarrage de la mutuelle', input('mutuelle_start', RULES.mutuelle_start, 'type="date"')) +
      field('Heure de la réunion', input('meeting_hour', SETTINGS.meeting_hour, 'type="time"'), '', 'Dernier jeudi du mois.') +
      field('Présentation de « Mon profil »', '<select name="profile_style">' + Object.keys(PROFILE_STYLES).map((k) => '<option value="' + k + '"' + ((SETTINGS.profile_style || 'classique') === k ? ' selected' : '') + '>' + PROFILE_STYLES[k] + '</option>').join('') + '</select>', '', 'La même présentation pour tous les membres.') +
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
  } else if (tab === 'enligne') {
    body = onlineSettingsHTML();
  } else if (tab === 'comptes') {
    body = '<section class="panel"><div class="toolbar"><button class="btn btn-sm btn-primary" data-act="userEdit">Ajouter un compte</button></div>' +
      table(['Identifiant', 'Nom complet', 'Fonction', 'Rôle', ''], Object.keys(USERS).map((k) => '<tr><td class="code">' + esc(k) + '</td><td>' + esc(USERS[k].fullname) + '</td><td>' + esc(USERS[k].position || '') + '</td><td>' + esc(USERS[k].role) + '</td>' +
        '<td class="act"><button class="btn btn-sm" data-act="userEdit" data-id="' + esc(k) + '">' + t('edit') + '</button>' + (k !== SESSION.id ? '<button class="btn btn-sm btn-danger" data-act="userDel" data-id="' + esc(k) + '">' + t('del') + '</button>' : '') + '</td></tr>')) +
      '<div class="section-note">Changez le mot de passe « admin » par défaut. Ce compte n’est jamais inclus dans le fichier partagé avec les membres.</div></section>' +
      '<form class="panel"><div class="panel-head"><h2>Deuxième personne autorisée à modifier</h2></div><div class="panel-body">' +
      '<p style="margin-top:0">Seules deux personnes peuvent modifier les données : le trésorier (compte admin) et le membre du comité choisi ici. Il se connecte avec son code membre et son mot de passe du portail.</p>' +
      field('Membre du comité', select('editor_code', [{ v: '', l: 'Personne (trésorier seul)' }].concat(DB.members.filter((m) => m.is_comite).sort(sortByCode).map((m) => ({ v: m.code, l: m.code + ' — ' + memberName(m) + (m.comite_poste ? ' (' + m.comite_poste + ')' : '') }))), SETTINGS.editor_code || '')) +
      '</div><div class="modal-foot"><button class="btn btn-primary" data-act="saveEditor">' + t('save') + '</button></div></form>';
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
  SETTINGS.lang = v.lang; SETTINGS.meeting_hour = v.meeting_hour || '17:00'; if (v.profile_style) SETTINGS.profile_style = v.profile_style; SETTINGS.sign_presidente = v.sign_presidente; SETTINGS.sign_tresorier = v.sign_tresorier;
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
  saveDB(); render(); if (typeof syncRolesOnly === 'function') syncRolesOnly();
};
ACTIONS.poste = (code, el) => { getMember(code).comite_poste = el.value.trim(); saveDB(); toast('Poste enregistré.', 'ok'); };
ACTIONS.setPwd = (code) => openModal({
  title: 'Mot de passe — ' + code + ' ' + nameOf(code), submit: t('save'),
  body: field('Nouveau mot de passe', input('pwd', getMember(code).portal_password || '', 'autocapitalize="off" autocorrect="off"'), '', 'Laisser vide pour bloquer l’accès au portail.'),
  onSubmit: (v) => {
    const m = getMember(code); const old = m.portal_password; m.portal_password = v.pwd; saveDB(); toast('Mot de passe enregistré.', 'ok'); render();
    // Même changement sur le compte en ligne du membre
    if (old !== v.pwd && typeof memberPasswordChanged === 'function') memberPasswordChanged(code, old, v.pwd);
  },
});
ACTIONS.defaultPwds = () => {
  let n = 0; DB.members.forEach((m) => { if (!m.portal_password) { m.portal_password = m.code.toLowerCase(); n++; } });
  saveDB(); toast(n + ' mot(s) de passe généré(s).', 'ok'); render();
};
ACTIONS.userEdit = (id) => {
  const u = id ? USERS[id] : { role: 'admin', fullname: '', position: '', pwd: '' };
  openModal({
    title: id ? 'Compte ' + id : 'Nouveau compte', submit: t('save'),
    body: '<div class="form-grid">' + field('Identifiant', input('id', id || '', id ? 'readonly' : 'required autocapitalize="off"')) + field('Rôle', select('role', [{ v: 'admin', l: 'Administrateur' }], 'admin')) +
      field('Nom complet', input('fullname', u.fullname)) + field('Fonction', input('position', u.position)) +
      field('Membre correspondant', select('member_code', [{ v: '', l: 'Aucun' }].concat(memberOptions()), u.member_code || ''), '', 'Empêche cette personne de noter ou décider sa propre demande de crédit.') +
      field('Mot de passe', input('pwd', u.pwd, 'required autocapitalize="off"')) + '</div>',
    onSubmit: (v) => {
      const k = (id || v.id || '').trim().toLowerCase();
      if (!k || !v.pwd) { toast('Identifiant et mot de passe obligatoires.', 'err'); return false; }
      if (!id && (USERS[k] || getMember(k.toUpperCase()))) { toast('Cet identifiant existe déjà.', 'err'); return false; }
      if (id === SESSION.id && v.role !== 'admin' && Object.keys(USERS).filter((x) => USERS[x].role === 'admin').length <= 1) { toast('Il faut garder au moins un administrateur.', 'err'); return false; }
      const oldPwd = USERS[k] && USERS[k].pwd;
      USERS[k] = { pwd: v.pwd, role: v.role, fullname: v.fullname, position: v.position, member_code: v.member_code }; saveUsers();
      if (k === 'admin' && oldPwd !== v.pwd && typeof changeAdminOnlinePassword === 'function' && ONLINE.who) {
        changeAdminOnlinePassword(v.pwd).then((ok) => toast(ok ? 'Mot de passe aussi changé en ligne.' : 'Mot de passe en ligne non changé : reconnectez-vous puis recommencez.', ok ? 'ok' : 'warn'));
      } toast('Compte enregistré.', 'ok'); render();
    },
  });
};
ACTIONS.saveEditor = (_i, el) => {
  const v = formOf(el); SETTINGS.editor_code = v.editor_code; saveSettings(); if (typeof syncRolesOnly === 'function') syncRolesOnly();
  toast(v.editor_code ? nameOf(v.editor_code) + ' peut maintenant modifier les données.' : 'Seul le trésorier peut modifier les données.', 'ok'); render();
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
