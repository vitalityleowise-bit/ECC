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
    const act = editable ? (pay ? '<button class="btn btn-sm" data-act="payNew" data-id="' + p.id + ':' + r.n + '">' + t('edit') + '</button><button class="btn btn-sm btn-danger" data-act="payUndo" data-id="' + p.id + ':' + r.n + '">' + t('cancel') + '</button>'
      : '<button class="btn btn-sm btn-primary" data-act="payNew" data-id="' + p.id + ':' + r.n + '">Enregistrer paiement</button>') : '';
    return '<tr class="' + (pay ? 'row-paid' : r.late ? 'row-late' : '') + '"><td class="c num">' + r.n + '</td><td class="num">' + fmtD(r.due) + (r.grace ? ' <span class="badge b-navy">grâce</span>' : '') + '</td>' +
      '<td class="n">' + fmt(r.cap) + '</td><td class="n">' + fmt(r.int) + '</td><td class="n">' + (pay ? fmt(pay.pen) : r.pen ? '<span style="color:var(--red)">' + fmt(r.pen) + '</span>' : '0') + '</td>' +
      '<td class="n"><b>' + fmt(pay ? pay.montant : r.du) + '</b></td><td>' + st + (pay ? ' <span class="muted" style="font-size:11px">' + esc(pay.mode || BANK) + '</span>' : '') + (pay && pay.commentaire ? '<div class="muted" style="font-size:11px">' + esc(pay.commentaire) + '</div>' : '') + '</td>' +
      (editable ? '<td class="act">' + act + '</td>' : '') + '</tr>';
  });
  return table(['N°', 'Échéance', ['Capital', 'n'], ['Intérêts', 'n'], ['Pénalité', 'n'], ['Mensualité', 'n'], 'Statut'].concat(editable ? [''] : []), rows,
    '<tr><td colspan="2">Total</td><td class="n">' + fmt(p.capital) + '</td><td class="n">' + fmt(lt.interets) + '</td><td class="n">' + fmt(lt.penRemb) + '</td><td class="n">' + fmt(num(p.capital) + lt.interets) + '</td><td' + (editable ? ' colspan="2"' : '') + '></td></tr>');
}
function loanSheet(id) {
  const p = DB.prets.find((x) => +x.id === id); if (!p) return '<div class="empty">Prêt introuvable.</div>';
  const lt = loanTotals(p);
  return pageHead('Prêts', 'Prêt #' + p.id + ' — ' + nameOf(p.code_membre), 'Octroyé le ' + esc(p.date) + ' · ' + money(p.capital) + ' sur ' + p.duree + ' mois' + (p.grace ? ' dont 1 mois de grâce' : '') + ' · ' + p.taux + ' % dégressif · remis par ' + esc(p.mode || BANK),
    '<button class="btn" data-go="prets">← Liste</button>' + (canEdit() ? '<button class="btn" data-act="loanEdit" data-id="' + p.id + '">' + t('edit') + '</button>' : '') + (isAdmin() ? '<button class="btn btn-danger" data-act="loanDel" data-id="' + p.id + '">' + t('del') + '</button>' : '') + '<button class="btn" onclick="window.print()">' + t('print') + '</button>') +
    '<div class="kpis">' + kpi('Déjà remboursé', fmt(lt.rembourse) + ' <small>HTG</small>', 'capital ' + fmt(lt.capRemb) + ' · intérêts ' + fmt(lt.intRemb), 'green') +
      kpi('Reste à rembourser', fmt(lt.reste) + ' <small>HTG</small>', 'capital restant ' + fmt(lt.resteCap), 'orange') +
      kpi('Mensualités payées', lt.nbPaid + ' <small>/ ' + lt.nb + '</small>', lt.retard ? lt.retard + ' en retard' : 'aucun retard', lt.retard ? 'red' : 'navy') +
      kpi('Statut', p.status === 'Remboursé' ? 'Remboursé' : 'En cours', '', p.status === 'Remboursé' ? 'green' : 'navy') + '</div>' +
    panel('Échéancier', scheduleTable(p, canEdit()), { flush: true, note: 'Intérêts calculés sur le capital restant dû (méthode dégressive). Les intérêts sont fixes même en cas de remboursement anticipé ; tout mois commencé est dû.' });
}
ACTIONS.payNew = (key) => {
  const [id, n] = key.split(':').map(Number);
  const p = DB.prets.find((x) => +x.id === id); const r = loanSchedule(p).find((x) => x.n === n);
  const old = r.payment;
  const v = old ? { date: old.date, mode: old.mode || BANK, cap: old.cap, int: old.int, pen: old.pen, du: old.montant, com: old.commentaire || '' }
    : { date: today(), mode: BANK, cap: r.cap, int: r.int, pen: r.pen, du: r.du, com: '' };
  openModal({
    title: (old ? 'Modifier le paiement' : 'Paiement') + ' — mensualité n° ' + n, submit: t('save'),
    body: '<div class="form-grid">' + field(t('date'), input('date', toISO(v.date), 'type="date" required')) + field('Mode', select('mode', [BANK, CASH], v.mode)) +
      field('Capital', input('cap', v.cap, 'type="number" step="any" min="0" data-sum')) + field('Intérêts', input('int', v.int, 'type="number" step="any" min="0" data-sum')) +
      field('Pénalité', input('pen', v.pen, 'type="number" step="any" min="0" data-sum'), '', !old && r.late ? r.monthsLate + ' mois de retard × ' + RULES.penalite_pret_pct + ' % du capital' : '') +
      field('Montant total', input('montant', v.du, 'type="number" step="any" readonly')) + field('Commentaire', input('commentaire', v.com), 'full') + '</div>',
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
    field('Prêt remis par', select('mode', [BANK, CASH], BANK), '', 'Sortie de la banque CAP-AIDER ou de la caisse (liquidité).') +
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
      '<div class="muted" style="margin-top:6px">Grille automatique : ' + fmt(sc.auto) + '/' + sc.autoMax + ' · au mieux (comité 20/20) : ' + esc(sc.bestSeuil.label) + ', ' + money(sc.bestMax) + (sc.hasLoan ? ' · <b style="color:var(--red)">prêt déjà en cours</b>' : '') + '</div>';
  };
  f.querySelectorAll('[data-prev], [name=code], [name=date]').forEach((i) => { i.addEventListener('input', upd); i.addEventListener('change', upd); });
  upd();
}
ACTIONS.loanNew = () => openModal({
  title: 'Nouveau prêt', body: loanFormBody(), submit: 'Créer le prêt', onOpen: bindLoanPreview,
  onSubmit: (d) => {
    if (num(d.capital) <= 0) { toast('Capital invalide.', 'err'); return false; }
    if (num(d.duree) > 24) { toast('Durée maximale : 24 mois (règlement interne).', 'err'); return false; }
    const p = { id: nextLoanId(), code_membre: d.code, nom_membre: nameOf(d.code), date: fmtD(d.date), capital: num(d.capital), duree: num(d.duree), taux: num(d.taux), grace: d.grace, mode: d.mode, total_interets: 0, status: 'en cours', payments: [] };
    refreshLoanStatus(p); DB.prets.push(p); saveDB(); toast('Prêt #' + p.id + ' créé.', 'ok'); go('prets', p.id);
  },
});

/* Modifier un prêt : date et mode de remise toujours ; montant, durée, taux et grâce seulement sans paiement */
ACTIONS.loanEdit = (id) => {
  const p = DB.prets.find((x) => +x.id === +id); const locked = (p.payments || []).length > 0;
  const ro = locked ? ' readonly' : '';
  openModal({
    title: 'Modifier le prêt #' + p.id, submit: t('save'),
    body: (locked ? '<div class="banner soft">Ce prêt a déjà des remboursements : seuls la date et le mode de remise sont modifiables.</div>' : '') +
      '<div class="form-grid">' + field('Date d’octroi', input('date', toISO(p.date), 'type="date"')) +
      field('Prêt remis par', select('mode', [BANK, CASH], p.mode || BANK)) +
      field('Capital (HTG)', input('capital', p.capital, 'type="number" min="1" step="any"' + ro)) + field('Durée (mois)', input('duree', p.duree, 'type="number" min="1" max="24"' + ro)) +
      field('Taux mensuel (%)', input('taux', p.taux, 'type="number" step="0.01" min="0"' + ro)) +
      field('Mois de grâce', '<label class="check"><input type="checkbox" name="grace"' + (p.grace ? ' checked' : '') + (locked ? ' disabled' : '') + '> Premier mois : intérêts seulement</label>') + '</div>',
    onSubmit: (d) => {
      p.date = fmtD(d.date) || p.date; p.mode = d.mode;
      if (!locked) {
        if (num(d.capital) <= 0 || num(d.duree) < 1 || num(d.duree) > 24) { toast('Capital ou durée invalide.', 'err'); return false; }
        p.capital = num(d.capital); p.duree = num(d.duree); p.taux = num(d.taux); p.grace = d.grace;
      }
      refreshLoanStatus(p); saveDB(); toast('Prêt modifié.', 'ok'); render();
    },
  });
};

/* Demandes de prêt et grille : voir 06b-credit.js */

/* ---------- Dépenses ---------- */
PAGES.depenses = function () {
  const fm = STATE.dmonth || '';
  const months = monthsRange(monthKey(RULES.mutuelle_start), monthKey(today())).reverse();
  const list = DB.depenses.map((d, i) => Object.assign({ i }, d)).filter((d) => !fm || monthKey(d.date) === fm).sort((a, b) => parseD(b.date) - parseD(a.date));
  const byMonth = months.map((k) => { const ds = DB.depenses.filter((d) => monthKey(d.date) === k); return { k, n: ds.length, t: sum(ds, (d) => d.montant) }; }).filter((x) => x.n);
  const rows = list.map((d) => '<tr><td class="num">' + esc(d.date) + '</td><td class="code">' + esc(d.piece || '') + '</td><td>' + esc(d.beneficiaire || '') + '</td><td>' + esc(d.categorie) + '</td>' +
    '<td>' + esc(d.caisse || '') + '</td><td>' + (d.retrait ? 'Caisse <span class="muted" style="font-size:11px">(retrait CAP-AIDER)</span>' : esc(d.mode === CASH ? 'Caisse' : (d.mode || BANK))) + '</td><td class="n">' + fmt(d.montant) + '</td>' +
    '<td class="act">' + (d.recu ? '<button class="btn btn-sm" data-act="depRecu" data-id="' + d.i + '">Reçu</button>' : '') +
    (canEdit() ? '<button class="btn btn-sm" data-act="depEdit" data-id="' + d.i + '">' + t('edit') + '</button><button class="btn btn-sm btn-danger" data-act="depDel" data-id="' + d.i + '">' + t('del') + '</button>' : '') + '</td></tr>');
  const byCat = DEP_CATS.map((c) => '<tr><td>' + esc(c.label) + '</td><td class="code">' + c.acc + '</td><td class="n">' + fmt(sum(DB.depenses.filter((d) => d.categorie === c.label), (d) => d.montant)) + '</td></tr>');
  return pageHead('Gestion', t('depenses'), list.length + ' dépense(s) · ' + money(sum(list, (d) => d.montant)), canEdit() ? '<button class="btn btn-primary" data-act="depNew">Nouvelle dépense</button>' : '') +
    '<div class="grid-2-1"><section class="panel"><div class="toolbar"><select data-change="depMonth"><option value="">Tous les mois</option>' +
      months.map((k) => '<option value="' + k + '"' + (k === fm ? ' selected' : '') + '>' + monthLabel(k) + '</option>').join('') + '</select>' +
      (canEdit() && fm ? '<button class="btn btn-sm btn-primary" data-act="depNew" data-id="' + fm + '">Ajouter une dépense en ' + esc(monthLabel(fm).toLowerCase()) + '</button>' : '') +
      '<span class="muted" style="margin-left:auto">' + list.length + ' · ' + money(sum(list, (d) => d.montant)) + '</span></div>' +
      table(['Date', 'Pièce', 'Bénéficiaire', 'Catégorie', 'Caisse', 'Payé par', ['Montant', 'n'], ''], rows,
        '<tr><td colspan="6">Total' + (fm ? ' ' + esc(monthLabel(fm).toLowerCase()) : '') + '</td><td class="n">' + fmt(sum(list, (d) => d.montant)) + '</td><td></td></tr>') + '</section><div>' +
    panel('Total par mois', table(['Mois', ['Nb', 'n'], ['Total', 'n']], byMonth.map((x) => '<tr class="clickable" data-act="depMonthGo" data-id="' + x.k + '"><td>' + monthLabel(x.k) + '</td><td class="n">' + x.n + '</td><td class="n">' + fmt(x.t) + '</td></tr>'),
      '<tr><td>Total</td><td class="n">' + DB.depenses.length + '</td><td class="n">' + fmt(sum(DB.depenses, (d) => d.montant)) + '</td></tr>'), { flush: true }) +
    panel('Par catégorie', table(['Catégorie', 'Compte', ['Total', 'n']], byCat), { flush: true, note: 'Règlement : les secours ne doivent pas dépasser 15 % de la Caisse Rouge (actuellement ' + money(treasury().rougeFonds * 0.15) + ').' }) + '</div></div>';
};
function depForm(d) {
  // Par défaut, l'argent d'une dépense sort de la caisse, après un retrait à CAP-AIDER
  d = d || { date: fmtD(today()), categorie: DEP_CATS[0].label, caisse: 'Caisse Verte', mode: CASH, retrait: true, piece: 'DEP-' + String(DB.depenses.length + 1).padStart(3, '0') };
  return '<div class="form-grid">' + field(t('date'), input('date', toISO(d.date), 'type="date"')) + field('N° de pièce', input('piece', d.piece)) +
    field('Bénéficiaire', (() => { const opts = memberOptions().map((o) => ({ v: memberName(getMember(o.v)) + ' (' + o.v + ')', l: o.l }));
      const isMember = opts.some((o) => o.v === d.beneficiaire);
      return select('benef_sel', [{ v: '', l: '— Choisir un membre —' }].concat(opts).concat([{ v: '__autre', l: 'Autre (banque, fournisseur…)' }]), isMember ? d.beneficiaire : (d.beneficiaire ? '__autre' : '')) +
        '<input name="beneficiaire" value="' + esc(isMember ? '' : (d.beneficiaire || '')) + '" placeholder="Nom du bénéficiaire" style="margin-top:6px' + (isMember || !d.beneficiaire ? ';display:none' : '') + '">'; })(), 'full') + field('Catégorie', select('categorie', DEP_CATS.map((c) => c.label), d.categorie)) +
    field(t('amount') + ' (HTG)', input('montant', d.montant || '', 'type="number" min="0" step="any" required')) +
    field('Imputée à', select('caisse', ['Caisse Verte', 'Caisse Rouge'], d.caisse || 'Caisse Verte'), '', 'Secours → Caisse Rouge ; frais courants → produits (Caisse Verte).') +
    field('Payé par', select('mode', [{ v: CASH, l: 'Caisse (liquidité)' }, { v: BANK, l: 'Directement par la banque CAP-AIDER' }], d.mode || CASH)) +
    '<div class="full" id="ret-box"' + ((d.mode || CASH) === CASH ? '' : ' style="display:none"') + '><label class="check"><input type="checkbox" name="retrait"' + (d.retrait ? ' checked' : '') + '> Retrait fait à CAP-AIDER pour cette dépense</label>' +
      '<div class="muted" style="font-size:11px;margin-top:3px">Le retrait est enregistré automatiquement (banque → caisse) le même jour : la caisse reste à zéro.</div></div>' +
    '<div class="full" style="display:flex;gap:10px;align-items:center"><button type="button" class="btn btn-sm" data-act="depPickRecu">Joindre le reçu scanné</button><span id="recu-state" class="muted">' + (d.recu ? 'Reçu joint' : 'Aucun reçu') + '</span>' +
    '<input type="hidden" name="recu" value="' + esc(d.recu || '') + '"></div></div>';
}
function saveDep(v, idx) {
  if (num(v.montant) <= 0) { toast('Montant invalide.', 'err'); return false; }
  const benef = v.benef_sel && v.benef_sel !== '__autre' ? v.benef_sel : (v.beneficiaire || '').trim();
  const rec = { date: fmtD(v.date), piece: v.piece.trim(), caisse: v.caisse, beneficiaire: benef, categorie: v.categorie, montant: num(v.montant), mode: v.mode, retrait: v.mode === CASH && !!v.retrait, recu: v.recu };
  if (idx === undefined) DB.depenses.push(rec); else DB.depenses[idx] = rec;
  saveDB(); toast('Dépense enregistrée.', 'ok'); render();
}
function bindDepCat(el) {
  const f = el.querySelector('form');
  f.mode.addEventListener('change', () => { el.querySelector('#ret-box').style.display = f.mode.value === CASH ? '' : 'none'; });
  f.benef_sel.addEventListener('change', () => { f.beneficiaire.style.display = f.benef_sel.value === '__autre' ? '' : 'none'; if (f.benef_sel.value === '__autre') f.beneficiaire.focus(); });
  f.categorie.addEventListener('change', () => { f.caisse.value = depAccount(f.categorie.value) === 5020 ? 'Caisse Rouge' : 'Caisse Verte'; });
}
ACTIONS.depNew = (month) => {
  // Dépense d'un mois passé : date proposée au dernier jeudi de ce mois
  const d = month && /^\d{4}-\d{2}$/.test(month) ? { date: fmtD(lastThursday(+month.slice(0, 4), +month.slice(5) - 1)), categorie: DEP_CATS[0].label, caisse: 'Caisse Verte', mode: CASH, retrait: true, piece: 'DEP-' + String(DB.depenses.length + 1).padStart(3, '0') } : null;
  openModal({ title: 'Nouvelle dépense', body: depForm(d), submit: t('save'), onOpen: bindDepCat, onSubmit: (v) => saveDep(v) });
};
ACTIONS.depMonth = (_i, el) => { STATE.dmonth = el.value; render(); };
ACTIONS.depMonthGo = (k) => { STATE.dmonth = k; render(); };
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
      kpi('Dépenses', fmt(sum(ms, (m) => m.depenses)) + ' <small>HTG</small>', DB.depenses.length + ' pièce(s)', 'red') +
      kpi('Prêts octroyés', fmt(sum(ms, (m) => m.prets)) + ' <small>HTG</small>', DB.prets.length + ' prêts', 'green') +
      kpi('Meilleur mois', best ? monthLabel(best.key) : '—', best ? money(best.verte + best.rouge) : '', 'green') +
      kpi('Mois le plus faible', worst ? monthLabel(worst.key) : '—', worst ? money(worst.verte + worst.rouge) : '', 'red') + '</div>' +
    panel('Cotisations mensuelles', barChart(labels, [{ label: 'Caisse Verte', color: C.green, values: ms.map((m) => m.verte) }, { label: 'Caisse Rouge', color: C.red, values: ms.map((m) => m.rouge) }], { stacked: true, title: 'Cotisations mensuelles empilées' })) +
    '<div class="grid-2">' +
      panel('Cotisations, amendes et prêts', barChart(labels, [{ label: 'Cotisations', color: C.navy, values: ms.map((m) => m.verte + m.rouge) }, { label: 'Amendes', color: C.orange, values: ms.map((m) => m.amendes) }, { label: 'Prêts', color: C.grey, values: ms.map((m) => m.prets) }], { title: 'Comparaison mensuelle' })) +
      panel('Par trimestre', barChart(qk, [{ label: 'Caisse Verte', color: C.green, values: qk.map((k) => quarters[k].verte) }, { label: 'Caisse Rouge', color: C.red, values: qk.map((k) => quarters[k].rouge) }], { stacked: true, title: 'Cotisations trimestrielles' })) +
    '</div>' +
    panel('Dépenses par mois', barChart(labels, [{ label: 'Dépenses', color: C.red, values: ms.map((m) => m.depenses) }], { title: 'Dépenses mensuelles', h: 200 }) +
      '<div class="legend">Total : ' + money(sum(ms, (m) => m.depenses)) + ' · moyenne ' + money(ms.length ? sum(ms, (m) => m.depenses) / ms.length : 0) + ' par mois</div>') +
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
    canEdit() ? '<button class="btn btn-primary" data-act="trfNew" data-id="depot">Déposer à la banque</button><button class="btn" data-act="trfNew" data-id="retrait">Retrait banque → caisse</button>' +
      (isAdmin() ? '<button class="btn btn-accent" data-act="allToBank">Tout passer en banque</button>' : '') : '') +
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

/* Passe toutes les opérations en « Banque CAP-AIDER » (tout l'argent de la mutuelle est à la banque) */
ACTIONS.allToBank = () => {
  const groups = [
    ['cotisation(s)', DB.cotisations], ['amende(s)', DB.amendes_paid], ['dépense(s)', DB.depenses], ['prêt(s) remis', DB.prets],
    ['remboursement(s)', [].concat(...DB.prets.map((p) => p.payments || []))],
  ].map(([l, arr]) => [l, arr.filter((x) => x.mode === CASH)]);
  const n = sum(groups, (g) => g[1].length);
  if (!n) { toast('Toutes les opérations sont déjà en Banque CAP-AIDER.', 'ok'); return; }
  confirmBox('Tout passer en banque', 'Les opérations suivantes passeront de « Liquidité » à « Banque CAP-AIDER » :<ul>' + groups.filter((g) => g[1].length).map((g) => '<li>' + g[1].length + ' ' + g[0] + '</li>').join('') + '</ul>' +
    '<span class="muted">Les dépôts et retraits caisse ↔ banque déjà saisis restent inchangés. Vous pourrez toujours repasser une ligne en Liquidité.</span>', () => {
    groups.forEach((g) => g[1].forEach((x) => { x.mode = BANK; }));
    saveDB(); toast(n + ' opération(s) passée(s) en Banque CAP-AIDER.', 'ok'); render();
  }, 'Tout passer en banque');
};
