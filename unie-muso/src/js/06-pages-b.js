/* =========================================================================
   Pages : prêts, demandes, grille, dépenses, statistiques, caisse, banque
   ========================================================================= */

/* ---------- Prêts ---------- */
PAGES.prets = function () {
  if (STATE.param) return loanSheet(+STATE.param);
  const list = DB.prets.slice().sort((a, b) => (a.status === 'Remboursé') - (b.status === 'Remboursé') || b.id - a.id);
  const tots = list.map((p) => ({ p, t: loanTotals(p) }));
  const enCours = tots.filter((x) => x.p.status !== 'Remboursé');
  const rows = tots.map(({ p, t: lt }) => '<tr class="clickable" data-act="openLoan" data-id="' + p.id + '"><td class="code">#' + p.id + '</td><td><span class="code">' + p.code_membre + '</span> ' + esc(nameOf(p.code_membre)) + '</td>' +
    '<td class="num">' + esc(p.date) + '</td><td class="n">' + fmt(p.capital) + '</td><td class="n">' + p.duree + (p.grace ? ' + 1' : '') + ' mois</td><td class="n">' + fmt(lt.interets) + '</td>' +
    '<td class="n">' + fmt(lt.rembourse) + '</td><td class="n">' + fmt(lt.reste) + '</td><td class="c num">' + lt.nbPaid + '/' + lt.nb + '</td>' +
    '<td>' + statusBadge(p.status) + (lt.retard ? ' <span class="badge b-red">' + lt.retard + ' en retard</span>' : '') + '</td></tr>');
  return pageHead('Gestion', t('prets'), 'Taux ' + '1,5 % mensuel dégressif · pénalité ' + RULES.penalite_pret_pct + ' % du capital échu par mois de retard',
    canEdit() ? '<button class="btn btn-primary" data-act="loanNew">Nouveau prêt</button>' : '') +
    '<div class="kpis">' + kpi('Capital prêté (en cours)', fmt(sum(enCours, (x) => x.p.capital)) + ' <small>HTG</small>', enCours.length + ' prêt(s)', 'navy') +
      kpi('Intérêts attendus', fmt(sum(enCours, (x) => x.t.interets)) + ' <small>HTG</small>', 'déjà perçus : ' + fmt(sum(tots, (x) => x.t.intRemb)), 'green') +
      kpi('À rembourser', fmt(sum(enCours, (x) => x.t.reste)) + ' <small>HTG</small>', 'capital + intérêts restants', 'orange') +
      kpi('Pénalités perçues', fmt(sum(tots, (x) => x.t.penRemb)) + ' <small>HTG</small>', '', 'red') + '</div>' +
    '<section class="panel">' + table(['N°', 'Membre', 'Date', ['Capital', 'n'], ['Durée', 'n'], ['Intérêts', 'n'], ['Remboursé', 'n'], ['Reste', 'n'], ['Éch.', 'c'], 'Statut'], rows) + '</section>';
};
ACTIONS.openLoan = (id) => { STATE.page = 'prets'; STATE.param = id; render(); window.scrollTo(0, 0); };
function scheduleTable(p, editable) {
  const lt = loanTotals(p);
  const rows = lt.rows.map((r) => {
    const pay = r.payment;
    let st = '';
    if (pay) st = '<span class="badge b-green">✓ Payé le ' + esc(String(pay.date).slice(0, 5)) + '</span>';
    else if (r.late) st = '<span class="badge b-red">En retard</span>';
    else st = '<span class="badge b-grey">À venir</span>';
    const act = editable ? (pay ? '<button class="btn btn-sm btn-danger" data-act="payUndo" data-id="' + p.id + ':' + r.n + '">' + t('cancel') + '</button>'
      : '<button class="btn btn-sm btn-primary" data-act="payNew" data-id="' + p.id + ':' + r.n + '">Enregistrer paiement</button>') : '';
    return '<tr class="' + (pay ? 'row-paid' : r.late ? 'row-late' : '') + '"><td class="c num">' + r.n + '</td><td class="num">' + fmtD(r.due) + (r.grace ? ' <span class="badge b-navy">grâce</span>' : '') + '</td>' +
      '<td class="n">' + fmt(r.cap) + '</td><td class="n">' + fmt(r.int) + '</td><td class="n">' + (pay ? fmt(pay.pen) : r.pen ? '<span style="color:var(--red)">' + fmt(r.pen) + '</span>' : '0') + '</td>' +
      '<td class="n"><b>' + fmt(pay ? pay.montant : r.du) + '</b></td><td>' + st + (pay && pay.commentaire ? '<div class="muted" style="font-size:11px">' + esc(pay.commentaire) + '</div>' : '') + '</td>' +
      (editable ? '<td class="act">' + act + '</td>' : '') + '</tr>';
  });
  return table(['N°', 'Échéance', ['Capital', 'n'], ['Intérêts', 'n'], ['Pénalité', 'n'], ['Mensualité', 'n'], 'Statut'].concat(editable ? [''] : []), rows,
    '<tr><td colspan="2">Total</td><td class="n">' + fmt(p.capital) + '</td><td class="n">' + fmt(lt.interets) + '</td><td class="n">' + fmt(lt.penRemb) + '</td><td class="n">' + fmt(num(p.capital) + lt.interets) + '</td><td' + (editable ? ' colspan="2"' : '') + '></td></tr>');
}
function loanSheet(id) {
  const p = DB.prets.find((x) => +x.id === id); if (!p) return '<div class="empty">Prêt introuvable.</div>';
  const lt = loanTotals(p);
  return pageHead('Prêts', 'Prêt #' + p.id + ' — ' + nameOf(p.code_membre), 'Octroyé le ' + esc(p.date) + ' · ' + money(p.capital) + ' sur ' + p.duree + ' mois' + (p.grace ? ' + 1 mois de grâce' : '') + ' · ' + p.taux + ' % dégressif',
    '<button class="btn" data-go="prets">← Liste</button>' + (isAdmin() ? '<button class="btn btn-danger" data-act="loanDel" data-id="' + p.id + '">' + t('del') + '</button>' : '') + '<button class="btn" onclick="window.print()">' + t('print') + '</button>') +
    '<div class="kpis">' + kpi('Déjà remboursé', fmt(lt.rembourse) + ' <small>HTG</small>', 'capital ' + fmt(lt.capRemb) + ' · intérêts ' + fmt(lt.intRemb), 'green') +
      kpi('Reste à rembourser', fmt(lt.reste) + ' <small>HTG</small>', 'capital restant ' + fmt(lt.resteCap), 'orange') +
      kpi('Mensualités payées', lt.nbPaid + ' <small>/ ' + lt.nb + '</small>', lt.retard ? lt.retard + ' en retard' : 'aucun retard', lt.retard ? 'red' : 'navy') +
      kpi('Statut', p.status === 'Remboursé' ? 'Remboursé' : 'En cours', '', p.status === 'Remboursé' ? 'green' : 'navy') + '</div>' +
    panel('Échéancier', scheduleTable(p, canEdit()), { flush: true, note: 'Intérêts calculés sur le capital restant dû (méthode dégressive). Les intérêts sont fixes même en cas de remboursement anticipé ; tout mois commencé est dû.' });
}
ACTIONS.payNew = (key) => {
  const [id, n] = key.split(':').map(Number);
  const p = DB.prets.find((x) => +x.id === id); const r = loanSchedule(p).find((x) => x.n === n);
  openModal({
    title: 'Paiement — mensualité n° ' + n, submit: t('save'),
    body: '<div class="form-grid">' + field(t('date'), input('date', toISO(today()), 'type="date" required')) + field('Mode', select('mode', [BANK, CASH], BANK)) +
      field('Capital', input('cap', r.cap, 'type="number" step="any" min="0" data-sum')) + field('Intérêts', input('int', r.int, 'type="number" step="any" min="0" data-sum')) +
      field('Pénalité', input('pen', r.pen, 'type="number" step="any" min="0" data-sum'), '', r.late ? r.monthsLate + ' mois de retard × ' + RULES.penalite_pret_pct + ' % du capital' : '') +
      field('Montant total', input('montant', r.du, 'type="number" step="any" readonly')) + field('Commentaire', input('commentaire', ''), 'full') + '</div>',
    onOpen: (el) => el.querySelectorAll('[data-sum]').forEach((i) => i.addEventListener('input', () => {
      const f = el.querySelector('form'); f.montant.value = round2(num(f.cap.value) + num(f.int.value) + num(f.pen.value));
    })),
    onSubmit: (d) => {
      const pay = { n, date: fmtD(d.date), montant: round2(num(d.cap) + num(d.int) + num(d.pen)), cap: num(d.cap), int: num(d.int), pen: num(d.pen), mode: d.mode, commentaire: d.commentaire.trim() };
      if (pay.montant <= 0) { toast('Montant invalide.', 'err'); return false; }
      p.payments = (p.payments || []).filter((x) => +x.n !== n).concat([pay]).sort((a, b) => a.n - b.n);
      refreshLoanStatus(p); saveDB(); toast('Paiement enregistré' + (p.status === 'Remboursé' ? ' — prêt entièrement remboursé.' : '.'), 'ok'); render();
    },
  });
};
ACTIONS.payUndo = (key) => {
  const [id, n] = key.split(':').map(Number); const p = DB.prets.find((x) => +x.id === id);
  confirmBox('Annuler le paiement', 'Annuler le paiement de la mensualité n° ' + n + ' ?', () => { p.payments = p.payments.filter((x) => +x.n !== n); refreshLoanStatus(p); saveDB(); render(); }, 'Annuler le paiement');
};
ACTIONS.loanDel = (id) => {
  const p = DB.prets.find((x) => +x.id === +id);
  confirmBox('Supprimer le prêt', 'Supprimer définitivement le prêt #' + id + ' de ' + esc(nameOf(p.code_membre)) + ' et ses ' + p.payments.length + ' paiement(s) ?', () => {
    DB.prets = DB.prets.filter((x) => +x.id !== +id); DB.demandes_pret.forEach((d) => { if (+d.pret_id === +id) d.pret_id = null; });
    saveDB(); STATE.param = null; render();
  }, t('del'));
};
function loanFormBody(code, montant, duree, grace) {
  return '<div class="form-grid">' + field(t('member'), select('code', memberOptions(true), code), 'full') + field('Date d’octroi', input('date', toISO(today()), 'type="date"')) +
    field('Capital (HTG)', input('capital', montant || '', 'type="number" min="1" step="any" required data-prev')) +
    field('Durée (mois)', input('duree', duree || 8, 'type="number" min="1" max="24" data-prev'), '', 'Règlement interne : 24 mois maximum.') +
    field('Taux mensuel (%)', input('taux', 1.5, 'type="number" step="0.01" min="0" data-prev')) +
    field('Mois de grâce', '<label class="check"><input type="checkbox" name="grace" data-prev' + (grace ? ' checked' : '') + '> Premier mois : intérêts seulement</label>', 'full') +
    '<div class="full" id="loan-prev"></div></div>';
}
function bindLoanPreview(el) {
  const f = el.querySelector('form');
  const upd = () => {
    const p = { capital: num(f.capital.value), duree: num(f.duree.value) || 1, taux: num(f.taux.value), grace: f.grace.checked, date: fmtD(f.date.value) || fmtD(today()), payments: [] };
    if (!p.capital) { el.querySelector('#loan-prev').innerHTML = ''; return; }
    const lt = loanTotals(p);
    const sc = creditScore(f.code.value);
    el.querySelector('#loan-prev').innerHTML = '<div class="banner soft" style="margin:0"><span>Intérêts : <b class="num">' + money(lt.interets) + '</b> · total à rembourser <b class="num">' + money(p.capital + lt.interets) + '</b> · 1re mensualité <b class="num">' + money(lt.rows[0].total) + '</b></span></div>' +
      '<div class="muted" style="margin-top:6px">Grille : score ' + sc.score + '/100 · ' + esc(sc.seuil.label) + ' · max indicatif ' + money(sc.max) + (sc.hasLoan ? ' · <b style="color:var(--red)">prêt déjà en cours</b>' : '') + '</div>';
  };
  f.querySelectorAll('[data-prev], [name=code], [name=date]').forEach((i) => { i.addEventListener('input', upd); i.addEventListener('change', upd); });
  upd();
}
ACTIONS.loanNew = () => openModal({
  title: 'Nouveau prêt', body: loanFormBody(), submit: 'Créer le prêt', onOpen: bindLoanPreview,
  onSubmit: (d) => {
    if (num(d.capital) <= 0) { toast('Capital invalide.', 'err'); return false; }
    if (num(d.duree) > 24) { toast('Durée maximale : 24 mois (règlement interne).', 'err'); return false; }
    const p = { id: nextLoanId(), code_membre: d.code, nom_membre: nameOf(d.code), date: fmtD(d.date), capital: num(d.capital), duree: num(d.duree), taux: num(d.taux), grace: d.grace, total_interets: 0, status: 'en cours', payments: [] };
    refreshLoanStatus(p); DB.prets.push(p); saveDB(); toast('Prêt #' + p.id + ' créé.', 'ok'); go('prets', p.id);
  },
});

/* Demandes de prêt et grille : voir 06b-credit.js */

/* ---------- Dépenses ---------- */
PAGES.depenses = function () {
  const list = DB.depenses.map((d, i) => Object.assign({ i }, d)).sort((a, b) => parseD(b.date) - parseD(a.date));
  const rows = list.map((d) => '<tr><td class="num">' + esc(d.date) + '</td><td class="code">' + esc(d.piece || '') + '</td><td>' + esc(d.beneficiaire || '') + '</td><td>' + esc(d.categorie) + '</td>' +
    '<td>' + esc(d.caisse || '') + '</td><td>' + esc(d.mode || BANK) + '</td><td class="n">' + fmt(d.montant) + '</td>' +
    '<td class="act">' + (d.recu ? '<button class="btn btn-sm" data-act="depRecu" data-id="' + d.i + '">Reçu</button>' : '') +
    (canEdit() ? '<button class="btn btn-sm" data-act="depEdit" data-id="' + d.i + '">' + t('edit') + '</button><button class="btn btn-sm btn-danger" data-act="depDel" data-id="' + d.i + '">' + t('del') + '</button>' : '') + '</td></tr>');
  const byCat = DEP_CATS.map((c) => '<tr><td>' + esc(c.label) + '</td><td class="code">' + c.acc + '</td><td class="n">' + fmt(sum(DB.depenses.filter((d) => d.categorie === c.label), (d) => d.montant)) + '</td></tr>');
  return pageHead('Gestion', t('depenses'), list.length + ' dépense(s) · ' + money(sum(list, (d) => d.montant)), canEdit() ? '<button class="btn btn-primary" data-act="depNew">Nouvelle dépense</button>' : '') +
    '<div class="grid-2-1"><section class="panel">' + table(['Date', 'Pièce', 'Bénéficiaire', 'Catégorie', 'Caisse', 'Payé par', ['Montant', 'n'], ''], rows) + '</section>' +
    panel('Par catégorie', table(['Catégorie', 'Compte', ['Total', 'n']], byCat), { flush: true, note: 'Règlement : les secours ne doivent pas dépasser 15 % de la Caisse Rouge (actuellement ' + money(treasury().rougeFonds * 0.15) + ').' }) + '</div>';
};
function depForm(d) {
  d = d || { date: fmtD(today()), categorie: DEP_CATS[0].label, caisse: 'Caisse Verte', mode: BANK, piece: 'DEP-' + String(DB.depenses.length + 1).padStart(3, '0') };
  return '<div class="form-grid">' + field(t('date'), input('date', toISO(d.date), 'type="date"')) + field('N° de pièce', input('piece', d.piece)) +
    field('Bénéficiaire', input('beneficiaire', d.beneficiaire || ''), 'full') + field('Catégorie', select('categorie', DEP_CATS.map((c) => c.label), d.categorie)) +
    field(t('amount') + ' (HTG)', input('montant', d.montant || '', 'type="number" min="0" step="any" required')) +
    field('Imputée à', select('caisse', ['Caisse Verte', 'Caisse Rouge'], d.caisse || 'Caisse Verte'), '', 'Secours → Caisse Rouge ; frais courants → produits (Caisse Verte).') +
    field('Payé par', select('mode', [BANK, CASH], d.mode || BANK)) +
    '<div class="full" style="display:flex;gap:10px;align-items:center"><button type="button" class="btn btn-sm" data-act="depPickRecu">Joindre le reçu scanné</button><span id="recu-state" class="muted">' + (d.recu ? 'Reçu joint' : 'Aucun reçu') + '</span>' +
    '<input type="hidden" name="recu" value="' + esc(d.recu || '') + '"></div></div>';
}
function saveDep(v, idx) {
  if (num(v.montant) <= 0) { toast('Montant invalide.', 'err'); return false; }
  const rec = { date: fmtD(v.date), piece: v.piece.trim(), caisse: v.caisse, beneficiaire: v.beneficiaire.trim(), categorie: v.categorie, montant: num(v.montant), mode: v.mode, recu: v.recu };
  if (idx === undefined) DB.depenses.push(rec); else DB.depenses[idx] = rec;
  saveDB(); toast('Dépense enregistrée.', 'ok'); render();
}
function bindDepCat(el) {
  const f = el.querySelector('form');
  f.categorie.addEventListener('change', () => { f.caisse.value = depAccount(f.categorie.value) === 5020 ? 'Caisse Rouge' : 'Caisse Verte'; });
}
ACTIONS.depNew = () => openModal({ title: 'Nouvelle dépense', body: depForm(), submit: t('save'), onOpen: bindDepCat, onSubmit: (v) => saveDep(v) });
ACTIONS.depEdit = (i) => openModal({ title: 'Modifier la dépense', body: depForm(DB.depenses[+i]), submit: t('save'), onOpen: bindDepCat, onSubmit: (v) => saveDep(v, +i) });
ACTIONS.depDel = (i) => confirmBox('Supprimer la dépense', 'Supprimer cette dépense de ' + money(DB.depenses[+i].montant) + ' ?', () => { DB.depenses.splice(+i, 1); saveDB(); render(); }, t('del'));
ACTIONS.depPickRecu = () => pickFile('image/*', (f) => readImage(f, 1400, 0.72).then((data) => {
  const form = document.querySelector('#modal form'); form.recu.value = data; document.getElementById('recu-state').textContent = 'Reçu joint (' + Math.round(data.length / 1024) + ' Ko)';
}).catch((e) => toast(e.message, 'err')));
ACTIONS.depRecu = (i) => openModal({ title: 'Reçu — ' + (DB.depenses[+i].piece || ''), wide: true, body: '<img alt="Reçu scanné" style="max-width:100%;border:1px solid var(--line)" src="' + DB.depenses[+i].recu + '">' });

/* ---------- Statistiques ---------- */
PAGES.stats = function () {
  const ms = monthlyStats().filter((m) => m.key >= monthKey(RULES.mutuelle_start));
  const labels = ms.map((m) => monthLabel(m.key, true));
  const withCot = ms.filter((m) => m.verte + m.rouge > 0);
  const best = withCot.slice().sort((a, b) => (b.verte + b.rouge) - (a.verte + a.rouge))[0];
  const worst = withCot.slice().sort((a, b) => (a.verte + a.rouge) - (b.verte + b.rouge))[0];
  const quarters = {};
  ms.forEach((m) => {
    const [y, mo] = m.key.split('-').map(Number);
    const q = y + ' T' + (Math.floor((mo - 1) / 3) + 1);
    const o = quarters[q] || (quarters[q] = { verte: 0, rouge: 0, amendes: 0, depenses: 0, prets: 0, remb: 0 });
    ['verte', 'rouge', 'amendes', 'depenses', 'prets', 'remb'].forEach((k) => { o[k] += m[k]; });
  });
  const qk = Object.keys(quarters);
  return pageHead('Gestion', t('stats'), 'Depuis le ' + fmtD(RULES.mutuelle_start)) +
    '<div class="kpis">' + kpi('Cotisations', fmt(sum(ms, (m) => m.verte + m.rouge)) + ' <small>HTG</small>', DB.cotisations.length + ' versements', 'navy') +
      kpi('Amendes', fmt(sum(ms, (m) => m.amendes)) + ' <small>HTG</small>', DB.amendes_paid.length + ' amendes', 'orange') +
      kpi('Dépenses', fmt(sum(ms, (m) => m.depenses)) + ' <small>HTG</small>', '', 'red') +
      kpi('Prêts octroyés', fmt(sum(ms, (m) => m.prets)) + ' <small>HTG</small>', DB.prets.length + ' prêts', 'green') +
      kpi('Meilleur mois', best ? monthLabel(best.key) : '—', best ? money(best.verte + best.rouge) : '', 'green') +
      kpi('Mois le plus faible', worst ? monthLabel(worst.key) : '—', worst ? money(worst.verte + worst.rouge) : '', 'red') + '</div>' +
    panel('Cotisations mensuelles', barChart(labels, [{ label: 'Caisse Verte', color: C.green, values: ms.map((m) => m.verte) }, { label: 'Caisse Rouge', color: C.red, values: ms.map((m) => m.rouge) }], { stacked: true, title: 'Cotisations mensuelles empilées' })) +
    '<div class="grid-2">' +
      panel('Cotisations, amendes et prêts', barChart(labels, [{ label: 'Cotisations', color: C.navy, values: ms.map((m) => m.verte + m.rouge) }, { label: 'Amendes', color: C.orange, values: ms.map((m) => m.amendes) }, { label: 'Prêts', color: C.grey, values: ms.map((m) => m.prets) }], { title: 'Comparaison mensuelle' })) +
      panel('Par trimestre', barChart(qk, [{ label: 'Caisse Verte', color: C.green, values: qk.map((k) => quarters[k].verte) }, { label: 'Caisse Rouge', color: C.red, values: qk.map((k) => quarters[k].rouge) }], { stacked: true, title: 'Cotisations trimestrielles' })) +
    '</div>' +
    panel('Détail mensuel', table(['Mois', ['Verte', 'n'], ['Rouge', 'n'], ['Total', 'n'], ['Versements', 'n'], ['Amendes', 'n'], ['Dépenses', 'n'], ['Prêts', 'n'], ['Rembours.', 'n']], ms.map((m) =>
      '<tr><td>' + monthLabel(m.key) + '</td><td class="n">' + fmt(m.verte) + '</td><td class="n">' + fmt(m.rouge) + '</td><td class="n">' + fmt(m.verte + m.rouge) + '</td><td class="n">' + m.nbCot + '</td><td class="n">' + fmt(m.amendes) + '</td><td class="n">' + fmt(m.depenses) + '</td><td class="n">' + fmt(m.prets) + '</td><td class="n">' + fmt(m.remb) + '</td></tr>')), { flush: true }) +
    panel('Détail trimestriel', table(['Trimestre', ['Verte', 'n'], ['Rouge', 'n'], ['Amendes', 'n'], ['Dépenses', 'n'], ['Prêts', 'n'], ['Rembours.', 'n']], qk.map((k) => {
      const o = quarters[k]; return '<tr><td>' + k + '</td><td class="n">' + fmt(o.verte) + '</td><td class="n">' + fmt(o.rouge) + '</td><td class="n">' + fmt(o.amendes) + '</td><td class="n">' + fmt(o.depenses) + '</td><td class="n">' + fmt(o.prets) + '</td><td class="n">' + fmt(o.remb) + '</td></tr>';
    })), { flush: true });
};

/* ---------- Caisse / Banque ---------- */
function movements(acc) {
  const out = []; let bal = 0;
  buildJournal().forEach((e) => e.lines.filter((l) => l.acc === acc).forEach((l) => { bal += num(l.d) - num(l.c); out.push({ e, d: num(l.d), c: num(l.c), bal }); }));
  return out.reverse();
}
function movTable(acc) {
  const mv = movements(acc).slice(0, 60);
  return table(['Date', 'Pièce', 'Libellé', ['Entrée', 'n'], ['Sortie', 'n'], ['Solde', 'n']], mv.map((x) =>
    '<tr><td class="num">' + fmtD(x.e.date) + '</td><td class="code">' + esc(x.e.piece) + '</td><td>' + esc(x.e.lib) + '</td><td class="n">' + (x.d ? fmt(x.d) : '') + '</td><td class="n">' + (x.c ? fmt(x.c) : '') + '</td><td class="n">' + fmt(x.bal) + '</td></tr>'));
}
PAGES.caisse = function () {
  const T = treasury();
  return pageHead('Trésorerie', t('caisse'), 'Liquidité physique en main — normalement zéro : tout est déposé à CAP-AIDER',
    canEdit() ? '<button class="btn btn-primary" data-act="trfNew" data-id="depot">Déposer à la banque</button><button class="btn" data-act="trfNew" data-id="retrait">Retrait banque → caisse</button>' : '') +
    '<div class="kpis">' + kpi('Solde de la caisse', fmt(T.caisse) + ' <small>HTG</small>', T.caisse ? 'à déposer à CAP-AIDER' : 'rien en main', T.caisse ? 'orange' : 'green', T.caisse < 0 ? 'neg' : '') + '</div>' +
    panel('Mouvements de caisse', movTable(1010), { flush: true });
};
PAGES.banque = function () {
  const T = treasury();
  return pageHead('Trésorerie', t('banque'), 'Compte de la mutuelle à CAP-AIDER') +
    '<div class="kpis">' + kpi('Solde CAP-AIDER', fmt(T.banque) + ' <small>HTG</small>', '', 'navy', T.banque < 0 ? 'neg' : '') +
      kpi('Prêts dehors', fmt(T.prets) + ' <small>HTG</small>', 'capital restant dû', 'orange') + kpi('Actif total', fmt(T.actif) + ' <small>HTG</small>', '', 'green') + '</div>' +
    (T.banque < 0 ? '<div class="banner import"><span>Solde négatif : il manque probablement des cotisations. Importez votre sauvegarde complète ou saisissez les cotisations.</span></div>' : '') +
    panel('Mouvements récents', movTable(1020), { flush: true });
};
ACTIONS.trfNew = (sens) => openModal({
  title: sens === 'retrait' ? 'Retrait de la banque vers la caisse' : 'Dépôt de la caisse à la banque', submit: t('save'),
  body: '<div class="form-grid">' + field(t('date'), input('date', toISO(today()), 'type="date"')) + field(t('amount') + ' (HTG)', input('montant', sens === 'retrait' ? '' : Math.max(0, treasury().caisse), 'type="number" min="0" step="any"')) +
    field('Référence (fiche de dépôt)', input('ref', ''), 'full') + '</div>',
  onSubmit: (d) => { if (num(d.montant) <= 0) { toast('Montant invalide.', 'err'); return false; } DB.transferts.push({ date: fmtD(d.date), montant: num(d.montant), sens: sens === 'retrait' ? 'retrait' : 'depot', ref: d.ref }); saveDB(); toast('Mouvement enregistré.', 'ok'); render(); },
});
