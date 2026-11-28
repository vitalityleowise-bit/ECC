/* =========================================================================
   Demandes de prêt et grille d'évaluation (document officiel UNIE-MUSO)
   Rubriques 1-3 calculées depuis les données ; rubrique 4 = moyenne des notes
   données par chaque membre du comité (chacun saisit sa propre note).
   ========================================================================= */
function evalBadge(ev) {
  if (!ev.complete) return '<span class="badge b-grey">' + ev.notes.length + '/' + ev.nbComite + ' notes</span>';
  return '<span class="badge ' + (ev.seuil.eligible ? 'b-green' : 'b-red') + '">' + fmt(ev.total) + ' · ' + esc(ev.seuil.label) + '</span>';
}
function canGradeAll() { return isAdmin(); }
function myComiteCode() { const m = currentMember(); return m && m.is_comite ? m.code : null; }
/* Code membre de la personne connectée (portail membre, ou compte de gestion relié à un membre) */
function mySelfCode() {
  if (!SESSION) return null;
  if (SESSION.type === 'member') return SESSION.code;
  const u = USERS[SESSION.id]; return u && u.member_code ? u.member_code : null;
}
/* Conflit d'intérêts : personne ne note, ne décide ni ne crée le prêt de sa propre demande */
function isOwnDemande(d) { return !!d && mySelfCode() === d.code_membre; }
function ownBlock(d) { if (isOwnDemande(d)) { toast('Vous ne pouvez pas noter ni décider votre propre demande de crédit.', 'err'); return true; } return false; }

PAGES.demandes = function () {
  const f = STATE.dfilt || '';
  const list = DB.demandes_pret.filter((d) => !f || d.statut === f).sort((a, b) => b.id - a.id);
  const me = myComiteCode();
  const rows = list.map((d) => {
    const ev = evaluateDemande(d);
    const mine = isOwnDemande(d) || (me && d.evaluation && d.evaluation.notes_comite && d.evaluation.notes_comite[me] !== undefined);
    return '<tr><td class="code">#' + d.id + '</td><td class="num">' + esc(d.date_demande) + '</td><td><span class="code">' + d.code_membre + '</span> ' + esc(nameOf(d.code_membre)) + '</td>' +
      '<td class="n">' + fmt(d.montant_demande) + '</td><td>' + esc(d.motif || '') + '</td>' +
      '<td class="n">' + fmt(ev.pres + ev.cot + ev.cred) + '<span class="muted">/80</span></td><td>' + evalBadge(ev) + '</td><td class="n">' + (ev.montant !== null ? fmt(ev.montant) : '—') + '</td>' +
      '<td>' + statusBadge(d.statut) + (d.montant_approuve && d.statut === 'Approuvée' ? '<div class="muted num" style="font-size:11px">' + fmt(d.montant_approuve) + ' · ' + d.duree_approuvee + ' mois</div>' : '') + '</td>' +
      '<td class="act"><button class="btn btn-sm' + (me && !mine && d.statut === 'En attente' ? ' btn-accent' : '') + '" data-act="demEval" data-id="' + d.id + '">' + (me && !mine ? 'Donner ma note' : 'Grille') + '</button>' +
      ((canGradeAll() || me) && !isOwnDemande(d) ? '<button class="btn btn-sm" data-act="demDecide" data-id="' + d.id + '">Décision</button>' : '') +
      (isOwnDemande(d) ? '<span class="badge b-grey" title="Conflit d’intérêts">votre demande</span>' : '') +
      (d.statut === 'Approuvée' && num(d.montant_approuve) > 0 && !d.pret_id && !isOwnDemande(d) && (canEdit() || currentRole() === 'comite') ? '<button class="btn btn-sm btn-primary" data-act="demCreateLoan" data-id="' + d.id + '">Créer le prêt →</button>' : '') +
      (d.pret_id && canSee('prets') ? '<button class="btn btn-sm" data-act="openLoan" data-id="' + d.pret_id + '">Prêt #' + d.pret_id + '</button>' : '') +
      (canEdit() && !d.pret_id ? '<button class="btn btn-sm btn-danger" data-act="demDel" data-id="' + d.id + '">' + t('del') + '</button>' : '') + '</td></tr>';
  });
  return pageHead('Gestion', t('demandes'), 'Grille officielle : rubriques 1 à 3 calculées automatiquement (80 pts), rubrique 4 = moyenne des notes des membres du comité (20 pts). La décision finale revient au comité.',
    '<button class="btn" data-act="grillePrint">Grille vierge</button><button class="btn btn-primary" data-act="demNew">Nouvelle demande</button>') +
    '<section class="panel"><div class="toolbar"><select data-change="demFilter">' + ['', 'En attente', 'Approuvée', 'Rejetée'].map((s) => '<option value="' + s + '"' + (s === f ? ' selected' : '') + '>' + (s || 'Tous les statuts') + '</option>').join('') + '</select></div>' +
    table(['N°', 'Date', 'Membre', ['Demandé', 'n'], 'Motif', ['Auto', 'n'], 'Note finale', ['Somme grille', 'n'], 'Statut', ''], rows) + '</section>';
};
ACTIONS.demDel = (id) => {
  const d = DB.demandes_pret.find((x) => +x.id === +id);
  confirmBox('Supprimer la demande', 'Supprimer la demande #' + d.id + ' de ' + esc(nameOf(d.code_membre)) + ' (' + money(d.montant_demande) + ') ?', () => {
    DB.demandes_pret = DB.demandes_pret.filter((x) => +x.id !== +id); saveDB(); toast('Demande supprimée.', 'ok'); render();
  }, t('del'));
};
ACTIONS.demFilter = (_i, el) => { STATE.dfilt = el.value; render(); };

function demandeForm(fixedCode) {
  return '<div class="form-grid">' + (fixedCode ? '<input type="hidden" name="code" value="' + fixedCode + '">' + field(t('member'), '<input value="' + esc(fixedCode + ' — ' + nameOf(fixedCode)) + '" readonly>', 'full')
    : field(t('member'), select('code', memberOptions(true).filter((o) => !activeLoan(o.v))), 'full', 'Les membres ayant un prêt en cours ne figurent pas dans la liste.')) +
    field('Date de la demande', input('date', toISO(today()), 'type="date"')) + field('Montant demandé (HTG)', input('montant', '', 'type="number" min="1" step="any" required')) +
    field('Motif / projet', '<textarea name="motif" placeholder="Ex. : commerce, scolarité, santé…"></textarea>', 'full') + '<div class="full" id="dem-prev"></div></div>';
}
function bindDemandePreview(el) {
  const f = el.querySelector('form');
  const upd = () => {
    const sc = creditScore(f.code.value);
    el.querySelector('#dem-prev').innerHTML = '<div class="banner soft" style="margin:0"><span>Grille automatique : <b class="num">' + fmt(sc.auto) + '/' + sc.autoMax + '</b> (présences ' + fmt(sc.pres.pts) + ', cotisations ' + fmt(sc.cot.pts) + ', crédits ' + fmt(sc.cred.pts) + ').' +
      ' Avec 20/20 du comité au mieux : ' + esc(sc.bestSeuil.label) + ', ' + money(sc.bestMax) + '.' + (sc.hasLoan ? ' <b style="color:var(--red)">Prêt déjà en cours.</b>' : '') + '</span></div>';
  };
  f.querySelectorAll('[name=code], [name=montant]').forEach((i) => { i.addEventListener('input', upd); i.addEventListener('change', upd); });
  upd();
}
function saveDemande(d) {
  if (num(d.montant) <= 0) { toast('Montant invalide.', 'err'); return false; }
  if (activeLoan(d.code)) { toast(nameOf(d.code) + ' a déjà un prêt en cours : pas de nouvelle demande avant le remboursement complet.', 'err'); return false; }
  const sc = creditScore(d.code);
  DB.demandes_pret.push({
    id: nextDemandeId(), code_membre: d.code, nom_membre: nameOf(d.code), date_demande: fmtD(d.date), montant_demande: num(d.montant), motif: d.motif.trim(),
    score_auto: sc.auto, max_auto: sc.bestMax, statut: 'En attente', date_decision: '', montant_approuve: 0, duree_approuvee: 0, grace_approuve: false,
    commentaire_comite: '', membres_comite: '', pret_id: null, key: uid(),
    evaluation: { notes_comite: {} },
  });
  saveDB(); toast('Demande enregistrée. Elle sera évaluée par le comité.', 'ok'); render();
}
ACTIONS.demNew = (code) => {
  const fixed = currentRole() === 'membre' || ((currentRole() === 'comite' || currentRole() === 'editeur') && code === 'self') ? currentMember().code : null;
  if (fixed && activeLoan(fixed)) { toast('Vous avez déjà un prêt en cours : nouvelle demande possible après le remboursement complet.', 'err'); return; }
  openModal({ title: 'Demande de prêt', body: demandeForm(fixed), submit: 'Envoyer la demande', onOpen: bindDemandePreview, onSubmit: saveDemande });
};

/* Grille d'évaluation d'une demande */
function gridTableHTML(d, editable) {
  const ev = evaluateDemande(d); const sc = ev.sc;
  const lbl = { present: 'Présence', represente: 'Représenté par ayant droit', retard: 'Retard', absence: 'Absence' };
  const counts = { present: 0, represente: 0, retard: 0, absence: 0 };
  sc.pres.detail.forEach((a) => { counts[a.type]++; });
  const ded = { present: 0, represente: GRILLE.ded_represente, retard: GRILLE.ded_retard, absence: GRILLE.ded_absence };
  const sec = (txt) => '<tr><td colspan="4" style="background:var(--orange);color:#fff;font-weight:700">' + txt + '</td></tr>';
  const edit = (name, val, max) => editable && canGradeAll() ? '<input name="' + name + '" type="number" step="0.5" min="0" max="' + max + '" value="' + val + '" style="width:70px;text-align:right">' : '<b class="num">' + fmt(val) + '</b>';
  let h = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Rubrique</th><th class="c">Cote</th><th class="c">Constat</th><th class="n">Note</th></tr></thead><tbody>';
  h += sec('1. Régularité dans les rencontres (' + GRILLE.nb_reunions + ' dernières rencontres) — ' + GRILLE.pts_presence + ' pts');
  ['present', 'represente', 'retard', 'absence'].forEach((k, i) => {
    h += '<tr><td>' + lbl[k] + '</td><td class="c num">' + (ded[k] ? '−' + fmt(ded[k]) : '0') + '</td><td class="c num">' + counts[k] + '</td>' + (i === 0 ? '<td class="n" rowspan="4">' + edit('presence', ev.pres, GRILLE.pts_presence) + '</td>' : '') + '</tr>';
  });
  h += sec('2. Régularité dans les cotisations (' + GRILLE.nb_mois_cot + ' derniers mois) — ' + GRILLE.pts_cotisation + ' pts');
  h += '<tr><td>Aucun retard</td><td class="c num">0</td><td class="c num">' + (sc.cot.detail.length - sc.cot.nbLate) + ' mois</td><td class="n" rowspan="2">' + edit('cotisation', ev.cot, GRILLE.pts_cotisation) + '</td></tr>';
  h += '<tr><td>Retard</td><td class="c num">−' + fmt(GRILLE.ded_cot_mois) + '</td><td class="c num">' + sc.cot.nbLate + ' mois</td></tr>';
  h += sec('3. Historique des ' + GRILLE.nb_credits + ' derniers prêts (' + GRILLE.nb_mois_credit + ' derniers mois) — ' + GRILLE.nb_credits + ' × ' + GRILLE.pts_credit + ' pts');
  const evc = (d.evaluation && Array.isArray(d.evaluation.credits)) ? d.evaluation.credits : null;
  sc.cred.credits.forEach((c, i) => {
    const val = evc && evc[i] !== undefined ? num(evc[i]) : c.pts;
    h += '<tr><td>Crédit #' + (i + 1) + (c.loan ? ' <span class="muted">— prêt #' + c.loan.id + ' du ' + esc(c.loan.date) + '</span>' : ' <span class="muted">— aucun prêt</span>') + '</td><td class="c num">−' + fmt(GRILLE.ded_credit_mois) + ' / mois</td><td class="c num">' + c.monthsLate + ' mois</td><td class="n">' + edit('credit' + i, val, GRILLE.pts_credit) + '</td></tr>';
  });
  h += sec('4. Appréciation du comité — ' + GRILLE.pts_comite + ' pts (moyenne des notes des membres du comité)');
  const me = myComiteCode(); const notes = (d.evaluation && d.evaluation.notes_comite) || {};
  comiteMembers().forEach((m) => {
    if (m.code === d.code_membre) {
      h += '<tr><td>' + esc(memberName(m)) + (m.comite_poste ? ' <span class="muted">(' + esc(m.comite_poste) + ')</span>' : '') + '</td><td colspan="3" class="muted">Demandeur — ne note pas sa propre demande (non compté dans la moyenne)</td></tr>';
      return;
    }
    const v = notes[m.code];
    const mayEdit = editable && !isOwnDemande(d) && (canGradeAll() || me === m.code);
    h += '<tr><td>' + esc(memberName(m)) + (m.comite_poste ? ' <span class="muted">(' + esc(m.comite_poste) + ')</span>' : '') + '</td><td class="c muted">/ ' + GRILLE.pts_comite + '</td><td class="c">' + (v === undefined || v === '' ? '<span class="muted">en attente</span>' : '') + '</td>' +
      '<td class="n">' + (mayEdit ? '<input name="note_' + m.code + '" type="number" step="0.5" min="0" max="' + GRILLE.pts_comite + '" value="' + (v === undefined ? '' : v) + '" style="width:70px;text-align:right">' : (v === undefined || v === '' ? '—' : '<b class="num">' + fmt(v) + '</b>')) + '</td></tr>';
  });
  if (!comiteMembers().length) h += '<tr><td colspan="4" class="muted">Aucun membre du comité défini (Paramètres → Accès portail des membres).</td></tr>';
  h += '<tr><td colspan="3"><b>Moyenne du comité</b></td><td class="n"><b class="num">' + (ev.appreciation === null ? '—' : fmt(ev.appreciation)) + '</b></td></tr>';
  h += '</tbody><tfoot><tr><td colspan="3">TOTAL / 100</td><td class="n">' + (ev.complete ? fmt(ev.total) : fmt(ev.pres + ev.cot + ev.cred) + ' + ?') + '</td></tr></tfoot></table></div>';
  h += '<div class="banner ' + (ev.complete ? (ev.seuil.eligible ? 'soft' : 'import') : 'soft') + '" style="margin:12px 0 0"><span>' + (ev.complete
    ? !ev.seuil.eligible ? 'Barème : <b>' + esc(ev.seuil.label) + '</b> — note de 50 ou moins : non éligible, aucun montant maximum.' : 'Barème : <b>' + esc(ev.seuil.label) + '</b> — ' + esc(ev.seuil.regle || '') + ' = <b class="num">' + money(ev.montant) + '</b> (cotisations Caisse Verte à jour : ' + money(sc.base) + ')'
    : 'En attente des notes du comité (' + ev.notes.length + '/' + ev.nbComite + ').') + '</span></div>';
  return h;
}
ACTIONS.demEval = (id) => {
  const d = DB.demandes_pret.find((x) => +x.id === +id);
  const editable = d.statut === 'En attente' && !isOwnDemande(d) && (canGradeAll() || !!myComiteCode());
  openModal({
    title: 'Grille d’évaluation — ' + nameOf(d.code_membre), wide: true, submit: editable ? t('save') : null,
    body: '<div class="banner soft">Demande #' + d.id + ' du ' + esc(d.date_demande) + ' · <b class="num">' + money(d.montant_demande) + '</b>' + (d.motif ? ' · ' + esc(d.motif) : '') + '</div>' +
      (isOwnDemande(d) ? '<div class="banner import">C’est votre propre demande : vous pouvez consulter la grille, mais pas la noter ni la décider.</div>' : '') + gridTableHTML(d, editable) +
      (canGradeAll() && editable ? '<div class="muted" style="margin-top:8px">Les rubriques 1 à 3 sont calculées automatiquement ; le trésorier peut les corriger (ex. : ayant droit présent non saisi).</div>' : ''),
    footLeft: '<button type="button" class="btn" data-act="demEvalPrint" data-id="' + d.id + '">' + t('print') + '</button>',
    onSubmit: (v) => {
      d.evaluation = d.evaluation || { notes_comite: {} };
      d.evaluation.notes_comite = d.evaluation.notes_comite || {};
      const max = num(GRILLE.pts_comite);
      for (const k of Object.keys(v)) {
        if (k.startsWith('note_')) {
          const code = k.slice(5);
          if (code === d.code_membre) continue;
          if (v[k] === '') { delete d.evaluation.notes_comite[code]; continue; }
          const n = num(v[k]); if (n < 0 || n > max) { toast('Note du comité entre 0 et ' + max + '.', 'err'); return false; }
          d.evaluation.notes_comite[code] = n;
        }
      }
      if (canGradeAll()) {
        d.evaluation.presence = v.presence; d.evaluation.cotisation = v.cotisation;
        d.evaluation.credits = [0, 1, 2].slice(0, num(GRILLE.nb_credits)).map((i) => num(v['credit' + i]));
      }
      const ev = evaluateDemande(d); d.score_auto = ev.pres + ev.cot + ev.cred; if (ev.montant !== null) d.max_auto = ev.montant;
      saveDB(); toast('Grille enregistrée' + (ev.complete ? ' — note finale ' + fmt(ev.total) + '/100 (' + ev.seuil.label + ').' : '.'), 'ok'); render();
    },
  });
};
ACTIONS.demEvalPrint = (id) => {
  const d = DB.demandes_pret.find((x) => +x.id === +id);
  printHTML('Grille — ' + nameOf(d.code_membre), gridPrintSheet(d));
};
function gridPrintSheet(d) {
  return '<div class="report"><div class="report-head">' + logoImg() + '<div><div class="t1">UNIE-MUSO</div><div class="t2">Unie Mutuelle Solidarité</div></div><div class="t3"><b>GRILLE D’ÉVALUATION<br>DE DEMANDE DE CRÉDIT</b></div></div>' +
    (d ? '<p><b>Nom complet du membre :</b> ' + esc(nameOf(d.code_membre)) + ' (' + d.code_membre + ') · demande #' + d.id + ' du ' + esc(d.date_demande) + ' · ' + money(d.montant_demande) + '</p>' + gridTableHTML(d, false)
      : '<p><b>Nom complet du membre :</b> ____________________________________________</p>' + blankGrid()) +
    '<h2>Barème de décision</h2>' + table(['Note finale', 'Observation', 'Somme approuvée'], GRILLE.seuils.map((s) => '<tr><td class="num">' + (s.min === 0 ? '< ' + (s.max + 1) : s.max >= 100 ? s.min + ' et +' : s.min + ' – ' + s.max) + '</td><td>' + esc(s.label) + '</td><td>' + esc(s.regle || '') + '</td></tr>')) +
    '<p style="margin-top:18px"><b>Décision finale :</b> ' + (d && d.statut !== 'En attente' ? esc(d.statut) + (d.montant_approuve ? ' — ' + money(d.montant_approuve) + ' sur ' + d.duree_approuvee + ' mois' : '') : '______________________________________________') + '</p>' +
    '<div class="sig"><div>' + esc(SETTINGS.sign_presidente) + '<br>Présidente</div><div>' + esc(SETTINGS.sign_tresorier) + '<br>Trésorier</div></div></div>';
}
function blankGrid() {
  const r = (a, b) => '<tr><td>' + a + '</td><td class="c">' + b + '</td><td></td><td></td></tr>';
  const sec = (txt, pts) => '<tr><td colspan="2" style="background:var(--orange);color:#fff;font-weight:700">' + txt + '</td><td class="c" style="background:var(--navy-050)"><b>' + pts + '</b></td><td></td></tr>';
  return '<table class="tbl"><thead><tr><th>Rubrique</th><th class="c">Cote</th><th class="c">Points</th><th>Note</th></tr></thead><tbody>' +
    sec('1. Régularité dans les rencontres (5 dernières rencontres)', GRILLE.pts_presence) + r('Présence', '0') + r('Représenté par ayant droit', '−' + fmt(GRILLE.ded_represente)) + r('Retard', '−' + fmt(GRILLE.ded_retard)) + r('Absence', '−' + fmt(GRILLE.ded_absence)) +
    sec('2. Régularité dans les cotisations pour les cinq derniers mois', GRILLE.pts_cotisation) + r('Aucun retard', '0') + r('Retard', '−' + fmt(GRILLE.ded_cot_mois)) +
    sec('3. Historique des trois derniers prêts', GRILLE.nb_credits + ' × ' + GRILLE.pts_credit) + r('Crédit #1', '−2 / mois en retard') + r('Crédit #2', '−2 / mois en retard') + r('Crédit #3', '−2 / mois en retard') +
    sec('4. Appréciation du comité', GRILLE.pts_comite) + r('Appréciation du comité', '') +
    '</tbody><tfoot><tr><td colspan="2">TOTAL</td><td class="c">100</td><td></td></tr><tr><td colspan="3" style="text-align:right">Moyenne</td><td></td></tr></tfoot></table>';
}
ACTIONS.grillePrint = () => printHTML('Grille d’évaluation', gridPrintSheet(null));

ACTIONS.demDecide = (id) => {
  const d = DB.demandes_pret.find((x) => +x.id === +id);
  if (ownBlock(d)) return;
  const ev = evaluateDemande(d);
  const present = comiteMembers().filter((m) => m.code !== d.code_membre && d.evaluation && d.evaluation.notes_comite && d.evaluation.notes_comite[m.code] !== undefined)
    .map((m) => memberName(m) + (m.comite_poste ? ' (' + m.comite_poste + ')' : '')).join(', ');
  openModal({
    title: 'Décision du comité — demande #' + d.id, submit: t('save'), wide: true,
    body: '<div class="banner soft">' + esc(nameOf(d.code_membre)) + ' demande <b class="num">' + money(d.montant_demande) + '</b> · grille ' +
        (ev.complete ? '<b>' + fmt(ev.total) + '/100 — ' + esc(ev.seuil.label) + '</b> · somme grille <b class="num">' + money(ev.montant) + '</b>' : 'incomplète (' + ev.notes.length + '/' + ev.nbComite + ' notes du comité)') + '</div>' +
      '<div class="form-grid">' + field('Statut', select('statut', ['En attente', 'Approuvée', 'Rejetée'], d.statut)) + field('Date de décision', input('date', toISO(d.date_decision || today()), 'type="date"')) +
      field('Montant approuvé (HTG)', input('montant', d.montant_approuve || Math.min(num(d.montant_demande), ev.montant || num(d.montant_demande)), 'type="number" min="0" step="any"')) +
      field('Durée (mois)', input('duree', d.duree_approuvee || 8, 'type="number" min="1" max="24"'), '', 'Règlement : 24 mois maximum.') +
      field('Mois de grâce', '<label class="check"><input type="checkbox" name="grace"' + (d.grace_approuve ? ' checked' : '') + '> Accordé</label>') +
      field('Membres du comité présents', input('membres', d.membres_comite || present), 'full') +
      field('Commentaire', '<textarea name="commentaire">' + esc(d.commentaire_comite || '') + '</textarea>', 'full') + '</div>',
    onSubmit: (v) => {
      if (num(v.duree) > 24) { toast('Durée maximale : 24 mois.', 'err'); return false; }
      if (v.statut === 'Approuvée' && !ev.complete && !confirm('Toutes les notes du comité ne sont pas saisies. Approuver quand même ?')) return false;
      Object.assign(d, { statut: v.statut, date_decision: fmtD(v.date), montant_approuve: v.statut === 'Approuvée' ? num(v.montant) : 0, duree_approuvee: num(v.duree), grace_approuve: v.grace, membres_comite: v.membres, commentaire_comite: v.commentaire.trim() });
      saveDB(); toast('Décision enregistrée.', 'ok'); render();
    },
  });
};
ACTIONS.demCreateLoan = (id) => {
  const d = DB.demandes_pret.find((x) => +x.id === +id);
  if (ownBlock(d)) return;
  confirmBox('Créer le prêt', 'Créer un prêt de <b>' + money(d.montant_approuve) + '</b> sur ' + d.duree_approuvee + ' mois' + (d.grace_approuve ? ' (+1 mois de grâce)' : '') + ' pour ' + esc(nameOf(d.code_membre)) + ', daté du ' + esc(d.date_decision) + ' ?', () => {
    const p = createLoanFromDemande(d); saveDB(); toast('Prêt #' + p.id + ' créé avec son échéancier.', 'ok');
    if (canSee('prets')) go('prets', p.id); else render();
  }, 'Créer le prêt');
};

/* ---------- Grille de crédit (vue d'ensemble) ---------- */
PAGES.grille = function () {
  const rows = DB.members.filter((m) => m.statut !== 'Inactif').sort(sortByCode).map((m) => {
    const sc = creditScore(m.code);
    return '<tr class="clickable" data-act="openMember" data-id="' + m.code + '"><td class="code">' + m.code + '</td><td>' + esc(memberName(m)) + '</td>' +
      '<td class="n">' + fmt(sc.pres.pts) + '</td><td class="n">' + fmt(sc.cot.pts) + '</td><td class="n">' + fmt(sc.cred.pts) + '</td>' +
      '<td class="n"><b class="num">' + fmt(sc.auto) + '</b></td><td class="n">' + fmt(sc.base) + '</td>' +
      '<td>' + '<span class="badge ' + (sc.bestSeuil.eligible ? 'b-green' : 'b-red') + '">' + esc(sc.bestSeuil.label) + '</span></td><td class="n">' + (sc.bestSeuil.eligible ? fmt(sc.bestMax) : '—') + '</td>' +
      '<td>' + (sc.hasLoan ? '<span class="badge b-orange">Prêt en cours</span>' : '') + '</td></tr>';
  });
  return pageHead('Gestion', t('grille'), 'Rubriques automatiques : présences /' + GRILLE.pts_presence + ' · cotisations /' + GRILLE.pts_cotisation + ' · 3 derniers prêts /' + (GRILLE.pts_credit * GRILLE.nb_credits) + ' — l’appréciation du comité (/' + GRILLE.pts_comite + ') se donne sur chaque demande.',
    '<button class="btn" data-act="grillePrint">Imprimer la grille vierge</button>' + (isAdmin() ? '<button class="btn btn-primary" data-act="grilleEdit">Modifier la grille</button>' : '')) +
    '<div class="grid-2-1"><section class="panel">' + table(['Code', 'Membre', ['Prés.', 'n'], ['Cot.', 'n'], ['Crédits', 'n'], ['Auto /80', 'n'], ['Cot. Verte', 'n'], 'Au mieux (+20)', ['Somme max', 'n'], ''], rows) +
    '<div class="section-note">« Au mieux » suppose 20/20 du comité : c’est le plafond possible, pas une décision. Somme = multiplicateur × cotisations Caisse Verte à jour. Le règlement interne (art. 35) limite aussi le crédit à 5 fois le capital propre du membre.</div></section>' +
    panel('Barème de décision', table(['Note finale', 'Observation', 'Somme approuvée'], GRILLE.seuils.map((s) => '<tr><td class="num">' + s.min + ' – ' + s.max + '</td><td>' + esc(s.label) + '</td><td>' + esc(s.regle || '') + '</td></tr>')), { flush: true }) + '</div>';
};
ACTIONS.grilleEdit = () => openModal({
  title: 'Modifier la grille de crédit', submit: t('save'), wide: true,
  body: '<h4 style="margin:0 0 8px">Points par rubrique</h4><div class="form-grid" style="grid-template-columns:repeat(4,1fr)">' +
      field('Rencontres', input('pts_presence', GRILLE.pts_presence, 'type="number" min="0"')) + field('Cotisations', input('pts_cotisation', GRILLE.pts_cotisation, 'type="number" min="0"')) +
      field('Par crédit (×3)', input('pts_credit', GRILLE.pts_credit, 'type="number" min="0"')) + field('Comité', input('pts_comite', GRILLE.pts_comite, 'type="number" min="0"')) + '</div>' +
    '<h4 style="margin:16px 0 8px">Retraits de points</h4><div class="form-grid" style="grid-template-columns:repeat(5,1fr)">' +
      field('Représenté', input('ded_represente', GRILLE.ded_represente, 'type="number" step="0.5" min="0"')) + field('Retard réunion', input('ded_retard', GRILLE.ded_retard, 'type="number" step="0.5" min="0"')) +
      field('Absence', input('ded_absence', GRILLE.ded_absence, 'type="number" step="0.5" min="0"')) + field('Mois cot. en retard', input('ded_cot_mois', GRILLE.ded_cot_mois, 'type="number" step="0.5" min="0"')) +
      field('Mois prêt en retard', input('ded_credit_mois', GRILLE.ded_credit_mois, 'type="number" step="0.5" min="0"')) + '</div>' +
    '<h4 style="margin:16px 0 8px">Barème</h4>' + GRILLE.seuils.map((s, i) => '<div class="form-grid" style="grid-template-columns:70px 70px 90px 1fr 2fr;margin-bottom:8px">' +
      field('Min', input('min' + i, s.min, 'type="number"')) + field('Max', input('max' + i, s.max, 'type="number"')) + field('× cotis.', input('mult' + i, s.mult, 'type="number" step="0.1" min="0"')) +
      field('Observation', input('label' + i, s.label)) + field('Somme approuvée', input('regle' + i, s.regle || '')) + '</div>').join(''),
  onSubmit: (d) => {
    const tot = num(d.pts_presence) + num(d.pts_cotisation) + 3 * num(d.pts_credit) + num(d.pts_comite);
    if (tot !== 100) { toast('Le total des points doit faire 100 (actuellement ' + tot + ').', 'err'); return false; }
    ['pts_presence', 'pts_cotisation', 'pts_credit', 'pts_comite', 'ded_represente', 'ded_retard', 'ded_absence', 'ded_cot_mois', 'ded_credit_mois'].forEach((k) => { GRILLE[k] = num(d[k]); });
    GRILLE.seuils = GRILLE.seuils.map((s, i) => ({ min: num(d['min' + i]), max: num(d['max' + i]), mult: num(d['mult' + i]), eligible: i > 0, label: d['label' + i], regle: d['regle' + i] }));
    saveGrille(); toast('Grille enregistrée.', 'ok'); render();
  },
});
