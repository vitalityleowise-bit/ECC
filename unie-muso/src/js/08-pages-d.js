/* =========================================================================
   Pages : réunions et quorum, Caisse Bleue, messages et suggestions,
   écran de bienvenue
   ========================================================================= */

/* ---------- Réunions et quorum ---------- */
/* Planifier les réunions et l'ordre du jour : réservé à la présidente et au (à la) secrétaire du comité */
function planPoste(m) { return m && m.is_comite && /^(pr[ée]sident|secr[ée]taire$)/i.test(String(m.comite_poste || '').trim()); }
function canPlanMeetings() { return !!planPoste(currentMember()); }
function planners() { return DB.members.filter(planPoste).map((m) => memberName(m) + ' (' + m.comite_poste + ')').join(' et ') || 'la présidente et le secrétaire (à désigner dans Paramètres)'; }
function planBlock() { if (canPlanMeetings()) return false; toast('Seuls ' + planners() + ' peuvent planifier les réunions.', 'err'); return true; }
const REUNION_TYPES = [
  { v: 'ordinaire', l: 'Assemblée ordinaire' }, { v: 'extraordinaire', l: 'Assemblée extraordinaire' }, { v: 'comite', l: 'Réunion du comité' },
];
function allReunionRows() {
  const rows = new Map(); const start = parseD(RULES.mutuelle_start); const lim = new Date(today().getFullYear(), today().getMonth() + 2, 0);
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= lim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const m = lastThursday(d.getFullYear(), d.getMonth()); rows.set(fmtD(m), { date: m, type: 'ordinaire', auto: true });
  }
  (DB.reunions || []).forEach((r) => {
    const d = parseD(r.date); if (!d) return;
    const k = fmtD(d) + (r.type === 'comite' ? '-c' : '');
    rows.set(k, Object.assign({}, rows.get(k) || {}, r, { date: d, auto: false }));
  });
  return [...rows.values()].sort((a, b) => b.date - a.date);
}
PAGES.reunions = function () {
  const held = new Set(heldMeetingDates().map(fmtD));
  const N = DB.members.filter((m) => m.statut !== 'Inactif').length; const req = Math.floor(N / 2) + 1;
  const rows = allReunionRows();
  const valid = heldMeetingDates().filter((d) => quorumInfo(d).reached).length; const noQ = heldMeetingDates().length - valid;
  const tr = rows.map((r) => {
    const k = fmtD(r.date); const isComite = r.type === 'comite'; const past = r.date <= today();
    let st; let pres = '—'; let qreq = '—'; let act = '';
    if (isComite) st = '<span class="badge b-navy">Comité</span>';
    else if (!past) st = '<span class="badge b-grey">À venir</span>';
    else if (!held.has(k)) st = '<span class="badge b-grey">Pas de réunion enregistrée</span>';
    else {
      const q = quorumInfo(r.date); pres = q.pres + ' / ' + q.N; qreq = q.req;
      st = q.reached ? '<span class="badge b-green">Quorum atteint</span>' : '<span class="badge b-red">Pas de quorum</span> <span class="muted" style="font-size:11px">opérations reportées au mois suivant</span>';
      if (!q.sheet) st += ' <span class="muted" style="font-size:11px">(présence estimée)</span>';
    }
    if (!isComite && past && canEdit()) {
      act = '<button class="btn btn-sm" data-act="attendanceSheet" data-id="' + toISO(r.date) + '">Liste de présence</button>';
      if (held.has(k)) {
        const info = reunionInfo(r.date); const cur = (info && info.quorum) || 'auto';
        act += '<select data-change="quorumSet" data-id="' + toISO(r.date) + '" style="padding:3px 4px;border:1px solid var(--line);border-radius:4px;font-size:11.5px;margin-left:4px">' +
          [['auto', 'Quorum automatique'], ['oui', 'Quorum : oui (décision)'], ['non', 'Quorum : non (décision)']].map((o) => '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
      }
    }
    const ex = (DB.reunions || []).find((x) => fmtD(x.date) === fmtD(r.date) && (x.type || 'ordinaire') === (r.type || 'ordinaire'));
    act += odjButton(ex);
    if (canPlanMeetings()) act += '<button class="btn btn-sm" data-act="reunionEdit" data-id="' + toISO(r.date) + '|' + esc(r.type || 'ordinaire') + '">' + (ex && ex.odj ? t('edit') : 'Ordre du jour / ' + t('edit').toLowerCase()) + '</button>';
    if (!r.auto && canPlanMeetings()) act += '<button class="btn btn-sm btn-danger" data-act="reunionDel" data-id="' + esc(k + '|' + (r.type || '')) + '">' + t('del') + '</button>';
    const type = (REUNION_TYPES.find((x) => x.v === (r.type || 'ordinaire')) || REUNION_TYPES[0]).l;
    return '<tr><td class="num">' + esc(longDate(r.date)) + '<div class="muted" style="font-size:11px">' + esc((r.heure || SETTINGS.meeting_hour) + (r.lieu ? ' · ' + r.lieu : '')) + '</div></td>' +
      '<td>' + esc(type) + (r.objet ? '<div class="muted" style="font-size:11px">' + esc(r.objet) + '</div>' : '') + '</td>' +
      '<td class="c num">' + pres + '</td><td class="c num">' + qreq + '</td><td>' + st + '</td><td class="act">' + act + '</td></tr>';
  });
  return pageHead('Gestion', t('reunions'), 'Quorum : 50 % + 1 des membres actifs (présents, en retard et représentés comptent). Sans quorum, la réunion ne compte pas : pas d’amende de retard ni d’absence, et ses opérations passent au rapport du mois suivant.',
    (canEdit() ? '<button class="btn" data-go="membres">Registre des présences</button>' : '') + (canPlanMeetings() ? '<button class="btn btn-primary" data-act="reunionNew">Programmer une réunion</button>' : '')) +
    '<div class="muted" style="margin:-8px 0 12px;font-size:12px">Planification des réunions et ordre du jour : ' + esc(planners()) + '.</div>' +
    '<div class="kpis">' + kpi('Membres actifs', N, '', 'navy') + kpi('Quorum requis', req, Math.floor(N / 2) + ' + 1', 'orange') +
      kpi('Réunions valides', valid, 'avec quorum', 'green') + kpi('Sans quorum', noQ, 'non comptées', noQ ? 'red' : '') + '</div>' +
    '<section class="panel">' + table(['Date', 'Type', ['Présents', 'c'], ['Requis', 'c'], 'Statut', ''], tr) + '</section>';
};
ACTIONS.quorumSet = (iso, el) => {
  const d = fmtD(iso); DB.reunions = DB.reunions || [];
  let r = DB.reunions.find((x) => fmtD(x.date) === d && x.type !== 'comite');
  if (!r) { r = { date: d, type: 'ordinaire' }; DB.reunions.push(r); }
  r.quorum = el.value; saveDB(); toast('Décision sur le quorum enregistrée.', 'ok'); render();
};
/* Formulaire de réunion avec fichier d'ordre du jour (photo ou PDF) */
function reunionForm(r) {
  r = r || { type: 'extraordinaire', date: fmtD(today()), heure: SETTINGS.meeting_hour, lieu: '', objet: '' };
  return '<div class="form-grid">' + field('Type', select('type', REUNION_TYPES, r.type || 'ordinaire')) + field(t('date'), input('date', toISO(r.date), 'type="date" required')) +
    field('Heure', input('heure', r.heure || SETTINGS.meeting_hour, 'type="time"')) + field('Lieu', input('lieu', r.lieu || '')) +
    field('Objet / ordre du jour (texte)', '<textarea name="objet">' + esc(r.objet || '') + '</textarea>', 'full') +
    '<div class="full" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button type="button" class="btn btn-sm" data-act="odjPick">Joindre le fichier de l’ordre du jour</button>' +
      '<span id="odj-state" class="muted">' + (r.odj ? esc(r.odj.name) + ' (' + Math.round(r.odj.data.length * 0.75 / 1024) + ' Ko)' : 'Aucun fichier — photo ou PDF') + '</span>' +
      '<input type="hidden" name="odj" value="' + esc(r.odj ? JSON.stringify(r.odj) : '') + '"></div></div>' +
    '<div class="muted" style="margin-top:8px">Les réunions sont planifiées par la présidente et le secrétaire. Les convocations par notification, avec confirmation de présence et relances, arriveront avec la version en ligne.</div>';
}
function saveReunion(v, existing) {
  if (planBlock()) return false;
  if (!parseD(v.date)) { toast('Date invalide.', 'err'); return false; }
  DB.reunions = DB.reunions || [];
  const rec = Object.assign(existing || { quorum: 'auto', par: mySelfCode() || SESSION.id }, {
    date: fmtD(v.date), type: v.type, heure: v.heure, lieu: v.lieu.trim(), objet: v.objet.trim(), odj: v.odj ? JSON.parse(v.odj) : null,
  });
  if (!existing) DB.reunions.push(rec);
  if (!saveDB()) return false;
  toast('Réunion du ' + rec.date + ' enregistrée' + (rec.odj ? ' avec son ordre du jour.' : '.'), 'ok'); render();
}
ACTIONS.reunionNew = () => planBlock() || openModal({ title: 'Programmer une réunion', submit: t('save'), body: reunionForm(), onSubmit: (v) => saveReunion(v) });
/* Modifier une réunion (ou ajouter l'ordre du jour d'une réunion mensuelle) : clé « date ISO|type » */
ACTIONS.reunionEdit = (key) => {
  if (planBlock()) return;
  const [iso, type] = key.split('|'); const k = fmtD(iso);
  const ex = (DB.reunions || []).find((r) => fmtD(r.date) === k && (r.type || 'ordinaire') === (type || 'ordinaire'));
  openModal({ title: 'Réunion du ' + k, submit: t('save'), body: reunionForm(ex || { type: type || 'ordinaire', date: k, heure: SETTINGS.meeting_hour }), onSubmit: (v) => saveReunion(v, ex) });
};
ACTIONS.odjPick = () => pickFile('image/*,application/pdf', (f) => {
  const done = (data) => {
    const form = document.querySelector('#modal form'); if (!form) return;
    form.odj.value = JSON.stringify({ name: f.name, type: f.type || 'application/octet-stream', data });
    document.getElementById('odj-state').textContent = f.name + ' (' + Math.round(data.length * 0.75 / 1024) + ' Ko)';
  };
  if (/^image\//.test(f.type)) { readImage(f, 1800, 0.8).then(done).catch((e) => toast(e.message, 'err')); return; }
  if (f.size > 1.5 * 1024 * 1024) { toast('PDF trop lourd (1,5 Mo maximum). Prenez plutôt une photo de l’ordre du jour.', 'err'); return; }
  const r = new FileReader(); r.onload = () => done(r.result); r.onerror = () => toast('Lecture impossible.', 'err'); r.readAsDataURL(f);
});
function dataUrlToBlob(u) {
  const [h, b64] = String(u).split(','); const mime = (h.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
/* Ouvrir l'ordre du jour : image affichée ; PDF ouvert ou téléchargé */
ACTIONS.odjOpen = (i) => {
  const r = DB.reunions[+i]; if (!r || !r.odj) return;
  if (/^image\//.test(r.odj.type)) { openModal({ title: 'Ordre du jour — ' + r.date, wide: true, body: '<img alt="Ordre du jour" style="max-width:100%;border:1px solid var(--line)" src="' + r.odj.data + '">' }); return; }
  const url = URL.createObjectURL(dataUrlToBlob(r.odj.data));
  const a = document.createElement('a'); a.href = url; a.download = r.odj.name || 'ordre-du-jour.pdf'; a.target = '_blank';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
};
function odjButton(r) { const i = (DB.reunions || []).indexOf(r); return r && r.odj && i >= 0 ? '<button class="btn btn-sm btn-accent" data-act="odjOpen" data-id="' + i + '">Ordre du jour</button>' : ''; }
/* « Mon compte » : prochaines réunions (et celles du comité pour ses membres) */
function memberMeetingsPanel(m) {
  const up = (DB.reunions || []).filter((r) => parseD(r.date) >= today() && (r.type !== 'comite' || m.is_comite)).sort((a, b) => parseD(a.date) - parseD(b.date));
  const btn = canPlanMeetings() ? '<button class="btn btn-sm btn-primary" data-act="reunionNew">Programmer une réunion</button><button class="btn btn-sm" data-go="reunions">Toutes les réunions</button>' : '';
  if (!up.length) return btn ? panel('Réunions programmées', '<span class="muted">Aucune réunion programmée.</span>', { right: btn }) : '';
  return panel('Réunions programmées', table(['Date', 'Type', 'Lieu', ''], up.map((r) => '<tr><td class="num">' + esc(longDate(r.date)) + ' · ' + esc(r.heure || '') + '</td><td>' + esc((REUNION_TYPES.find((x) => x.v === r.type) || REUNION_TYPES[0]).l) +
    (r.objet ? '<div class="muted" style="font-size:11px;white-space:pre-wrap">' + esc(r.objet) + '</div>' : '') + '</td><td>' + esc(r.lieu || '') + '</td><td class="act">' + odjButton(r) +
    (canPlanMeetings() ? '<button class="btn btn-sm" data-act="reunionEdit" data-id="' + toISO(r.date) + '|' + esc(r.type || 'ordinaire') + '">' + t('edit') + '</button>' : '') + '</td></tr>')), { flush: true, right: btn });
}
ACTIONS.reunionDel = (key) => {
  if (planBlock()) return;
  const [k, type] = key.split('|');
  confirmBox('Supprimer la réunion', 'Supprimer la réunion programmée du ' + esc(k.replace('-c', '')) + ' ?', () => {
    DB.reunions = DB.reunions.filter((r) => !(fmtD(r.date) === k.replace('-c', '') && (r.type || '') === type)); saveDB(); render();
  }, t('del'));
};
/* Période d'un rapport : le mois, plus les mois précédents sans réunion valide (opérations reportées) */
function reportRange(key) {
  const [y, m] = key.split('-').map(Number);
  let from = new Date(y, m - 1, 1); const to = new Date(y, m, 0); const carried = [];
  const startKey = monthKey(RULES.mutuelle_start);
  let pk = monthKey(new Date(y, m - 2, 1));
  while (pk >= startKey && !validMeetingMonth(pk)) {
    carried.unshift(pk); const [py, pm] = pk.split('-').map(Number); from = new Date(py, pm - 1, 1); pk = monthKey(new Date(py, pm - 2, 1));
  }
  const meet = lastThursday(y, m - 1);
  const invalid = !validMeetingMonth(key) && meet < today();
  return { from, to, carried, invalid, meet };
}

/* ---------- Dons et subventions ----------
   Reçus par la mutuelle (produit 4060) ou accordés par la mutuelle (charge 5050). */
const DON_SENS = [{ v: 'recu', l: 'Reçu par la mutuelle' }, { v: 'accorde', l: 'Accordé par la mutuelle' }];
PAGES.dons = function () {
  const list = (DB.dons || []).map((d, i) => Object.assign({ i }, d)).sort((a, b) => parseD(b.date) - parseD(a.date));
  const recus = list.filter((d) => d.sens !== 'accorde'); const acc = list.filter((d) => d.sens === 'accorde');
  return pageHead('Gestion', t('dons'), 'Un don ou une subvention reçu par la mutuelle (compte 4060), ou accordé par la mutuelle (compte 5050)',
    canEdit() ? '<button class="btn" data-act="donNew" data-id="accorde">Don accordé par la mutuelle</button><button class="btn btn-primary" data-act="donNew" data-id="recu">Don reçu par la mutuelle</button>' : '') +
    '<div class="kpis">' + kpi('Reçus', fmt(sum(recus, (d) => d.montant)) + ' <small>HTG</small>', recus.length + ' don(s) / subvention(s)', 'green') +
      kpi('Accordés', fmt(sum(acc, (d) => d.montant)) + ' <small>HTG</small>', acc.length + ' don(s)', 'orange') + '</div>' +
    '<section class="panel">' + table(['Date', 'Sens', 'Nature', 'Donateur / bénéficiaire', 'Mode', ['Montant', 'n'], ''], list.map((d) =>
      '<tr><td class="num">' + esc(d.date) + '</td><td>' + (d.sens === 'accorde' ? '<span class="badge b-orange">Accordé</span>' : '<span class="badge b-green">Reçu</span>') + '</td>' +
      '<td>' + esc(d.nature || 'Don') + (d.note ? '<div class="muted" style="font-size:11px">' + esc(d.note) + '</div>' : '') + '</td><td>' + esc(d.tiers || d.donateur || '') + '</td>' +
      '<td>' + esc(d.mode || BANK) + '</td><td class="n">' + fmt(d.montant) + '</td><td class="act">' +
      (canEdit() ? '<button class="btn btn-sm" data-act="donEdit" data-id="' + d.i + '">' + t('edit') + '</button><button class="btn btn-sm btn-danger" data-act="donDel" data-id="' + d.i + '">' + t('del') + '</button>' : '') + '</td></tr>')) + '</section>';
};
function donForm(d) {
  d = d || { date: fmtD(today()), nature: 'Don', mode: BANK, sens: 'recu' };
  return '<div class="form-grid">' + field('Sens', select('sens', DON_SENS, d.sens || 'recu')) + field(t('date'), input('date', toISO(d.date), 'type="date"')) +
    field('Nature', select('nature', ['Don', 'Subvention', 'Don en matériel'], d.nature)) + field(t('amount') + ' (HTG)', input('montant', d.montant || '', 'type="number" min="0" step="any"')) +
    field('Donateur ou bénéficiaire', input('tiers', d.tiers || d.donateur || '', 'required'), 'full', 'Qui donne à la mutuelle, ou à qui la mutuelle donne (membre ou organisation).') +
    field('Mode', select('mode', [BANK, CASH], d.mode || BANK)) + field('Note', input('note', d.note || '')) + '</div>';
}
function saveDon(v, i) {
  if (num(v.montant) <= 0 || !v.tiers.trim()) { toast('Donateur / bénéficiaire et montant obligatoires.', 'err'); return false; }
  const rec = { date: fmtD(v.date), sens: v.sens, tiers: v.tiers.trim(), nature: v.nature, montant: num(v.montant), mode: v.mode, note: v.note.trim() };
  DB.dons = DB.dons || []; if (i === undefined) DB.dons.push(rec); else DB.dons[i] = rec;
  saveDB(); toast(v.sens === 'accorde' ? 'Don accordé enregistré.' : 'Don reçu enregistré.', 'ok'); render();
}
ACTIONS.donNew = (sens) => openModal({ title: sens === 'accorde' ? 'Don accordé par la mutuelle' : 'Don ou subvention reçu', body: donForm({ date: fmtD(today()), nature: 'Don', mode: BANK, sens: sens || 'recu' }), submit: t('save'), onSubmit: (v) => saveDon(v) });
ACTIONS.donEdit = (i) => openModal({ title: 'Modifier', body: donForm(DB.dons[+i]), submit: t('save'), onSubmit: (v) => saveDon(v, +i) });
ACTIONS.donDel = (i) => confirmBox('Supprimer', 'Supprimer ce don de ' + money(DB.dons[+i].montant) + ' ?', () => { DB.dons.splice(+i, 1); saveDB(); render(); }, t('del'));

/* ---------- Plan comptable ---------- */
PAGES.plancomptable = function () {
  const B = balances(buildJournal(), null, null); const F = financials();
  const rows = [];
  [1, 2, 3, 4, 5].forEach((cl) => {
    rows.push('<tr><td colspan="4" style="background:var(--navy);color:#fff;font-weight:700">' + esc(ACCOUNT_CLASSES[cl]) + '</td></tr>');
    Object.keys(ACCOUNTS).map(Number).filter((a) => accClass(a) === cl).sort((a, b) => a - b).forEach((a) => {
      let v = B[a] ? B[a].d - B[a].c : 0;
      if (a === 3090) v = -F.resultatCum;
      const shown = cl === 1 || cl === 5 ? v : -v;
      rows.push('<tr><td class="code">' + a + '</td><td>' + esc(ACCOUNTS[a]) + '</td><td class="muted">' + esc(ACCOUNT_USAGE[a] || '') + '</td><td class="n">' + (shown ? fmt(shown) : '—') + '</td></tr>');
    });
  });
  return pageHead('Comptabilité', t('plancomptable'), 'Classes du plan comptable haïtien · soldes cumulés au ' + fmtD(today()), '<button class="btn" onclick="window.print()">' + t('print') + '</button>') +
    '<section class="panel">' + table(['Compte', 'Intitulé', 'Utilisation', ['Solde', 'n']], rows) +
    '<div class="section-note">Les produits (classe 4) et les charges (classe 5) ne sont jamais portés en capital : seul le résultat de l’exercice (3090 = produits − charges) apparaît dans les capitaux propres du bilan.</div></section>';
};

/* ---------- Messages et suggestions ----------
   Un membre écrit au comité ; les membres du comité voient le message, répondent ; on voit qui a écrit et qui a répondu. */
function nowISO() { return new Date().toISOString(); }
function fmtDT(iso) { return iso ? fmtD(iso.slice(0, 10)) + ' ' + iso.slice(11, 16) : ''; }
function whoName(code, fallback) { return code ? (getMember(code) ? memberName(getMember(code)) : code) : (fallback || ''); }
function myAuthor() { const c = mySelfCode(); return { code: c || '', name: c ? nameOf(c) : currentName() }; }
function messageThread(msg, canReply) {
  return '<div class="panel" style="margin-bottom:10px"><div class="panel-head"><h2>' + esc(msg.sujet || 'Message') + '</h2>' +
    '<span class="meta">de <b>' + esc(msg.from_name) + '</b> · ' + esc(fmtDT(msg.date)) + '</span>' +
    '<div class="right">' + (msg.replies && msg.replies.length ? '<span class="badge b-green">Répondu</span>' : '<span class="badge b-orange">En attente de réponse</span>') + '</div></div>' +
    '<div class="panel-body"><p style="margin:0 0 10px;white-space:pre-wrap">' + esc(msg.texte) + '</p>' +
    (msg.replies || []).map((r) => '<div style="border-left:3px solid var(--navy);padding:6px 10px;margin:6px 0;background:var(--navy-050)"><div class="muted" style="font-size:11px">Réponse de <b>' + esc(r.by_name) + '</b> · ' + esc(fmtDT(r.date)) + '</div><div style="white-space:pre-wrap">' + esc(r.texte) + '</div></div>').join('') +
    (canReply ? '<div style="display:flex;gap:6px;margin-top:8px"><textarea data-reply="' + msg.id + '" rows="2" style="flex:1;padding:6px 8px;border:1px solid var(--line);border-radius:5px" placeholder="Votre réponse…"></textarea><button class="btn btn-primary btn-sm" data-act="msgReply" data-id="' + msg.id + '">Répondre</button></div>' : '') +
    '</div></div>';
}
PAGES.messages = function () {
  const tab = STATE.mtab || 'messages';
  const msgs = (DB.messages || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const sugg = (DB.suggestions || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const waiting = msgs.filter((m) => !(m.replies || []).length).length;
  const sansSuite = sugg.filter((s) => !s.reponse).length;
  const ann = (DB.annonces || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  let body;
  if (tab === 'messages') {
    body = msgs.length ? msgs.map((m) => messageThread(m, true)).join('') : '<div class="panel"><div class="empty">Aucun message pour le moment.</div></div>';
  } else if (tab === 'annonces') {
    body = '<div style="margin-bottom:10px"><button class="btn btn-primary" data-act="annNew">Publier une annonce</button></div>' +
      (ann.length ? ann.map((a) => annonceCard(a, true)).join('') : '<div class="panel"><div class="empty">Aucune annonce. Une annonce publiée ici est visible par tous les membres dans « Mon compte ».</div></div>');
  } else {
    body = '<section class="panel">' + table(['Date', 'Membre', 'Suggestion', 'Suite donnée', ''], sugg.map((s) =>
      '<tr><td class="num">' + esc(fmtDT(s.date)) + '</td><td>' + esc(s.anonyme ? 'Anonyme' : s.from_name) + '</td><td style="white-space:pre-wrap">' + esc(s.texte) + '</td>' +
      '<td>' + (s.reponse ? esc(s.reponse) + '<div class="muted" style="font-size:11px">' + esc(s.reponse_by || '') + '</div>' : '<span class="muted">—</span>') + '</td>' +
      '<td class="act"><button class="btn btn-sm" data-act="suggReply" data-id="' + s.id + '">Répondre</button></td></tr>')) + '</section>';
  }
  return pageHead('Communication', t('messages'), 'Les membres écrivent depuis « Mon compte » ; le comité répond ici. Chaque message indique qui l’a envoyé et qui a répondu.') +
    '<div class="tabs"><button class="' + (tab === 'messages' ? 'on' : '') + '" data-act="mtab" data-id="messages">Messages' + (waiting ? ' (' + waiting + ' en attente)' : '') + '</button>' +
    '<button class="' + (tab === 'suggestions' ? 'on' : '') + '" data-act="mtab" data-id="suggestions">Suggestions' + (sansSuite ? ' (' + sansSuite + ' sans réponse)' : ' (' + sugg.length + ')') + '</button>' +
    '<button class="' + (tab === 'annonces' ? 'on' : '') + '" data-act="mtab" data-id="annonces">Annonces du comité (' + ann.length + ')</button></div>' + body +
    '<div class="muted" style="margin-top:6px">Avec la version en ligne, les messages arriveront automatiquement sur les téléphones, avec notification.</div>';
};
ACTIONS.mtab = (id) => { STATE.mtab = id; render(); };
/* ---------- Annonces du comité : tout membre du comité publie, tous les membres lisent ---------- */
function annonceCard(a, manage) {
  const lus = (a.seen || []).length; const total = DB.members.filter((m) => m.statut !== 'Inactif').length;
  return '<div class="panel" style="border-left:3px solid var(--orange)"><div class="panel-head"><h2>' + esc(a.titre) + '</h2><span class="meta">par <b>' + esc(a.by_name) + '</b> · ' + esc(fmtDT(a.date)) + '</span>' +
    (manage ? '<div class="right"><span class="muted" style="font-size:11.5px">lue par ' + lus + '/' + total + '</span>' + (canPostAnnonce() ? '<button class="btn btn-sm btn-danger" data-act="annDel" data-id="' + a.id + '">' + t('del') + '</button>' : '') + '</div>' : '') +
    '</div><div class="panel-body" style="white-space:pre-wrap">' + esc(a.texte) + '</div></div>';
}
function canPostAnnonce() { const r = currentRole(); return r === 'admin' || r === 'editeur' || r === 'comite'; }
ACTIONS.annNew = () => {
  if (!canPostAnnonce()) return;
  openModal({
    title: 'Publier une annonce', submit: 'Publier',
    body: field('Titre', input('titre', '', 'required maxlength="90"')) + field('Message à tous les membres', '<textarea name="texte" rows="6" required></textarea>', '', 'Visible par tous les membres dans « Mon compte », avec votre nom.'),
    onSubmit: (v) => {
      if (!v.titre.trim() || !v.texte.trim()) { toast('Titre et message obligatoires.', 'err'); return false; }
      const a = myAuthor(); DB.annonces = DB.annonces || [];
      DB.annonces.push({ id: uid(), by_code: a.code, by_name: a.name, date: nowISO(), titre: v.titre.trim(), texte: v.texte.trim(), seen: a.code ? [a.code] : [] });
      saveDB(); toast('Annonce publiée pour tous les membres.', 'ok'); render();
    },
  });
};
ACTIONS.annDel = (id) => confirmBox('Supprimer l’annonce', 'Supprimer cette annonce pour tous les membres ?', () => { DB.annonces = DB.annonces.filter((a) => a.id !== id); saveDB(); render(); }, t('del'));
/* Compteurs (pastilles rouges du menu) */
function commPending() { return (DB.messages || []).filter((m) => !(m.replies || []).length).length + (DB.suggestions || []).filter((s) => !s.reponse).length; }
function memberUnread(code, kind) {
  if (!code) return 0;
  const ann = (DB.annonces || []).filter((a) => !(a.seen || []).includes(code)).length;
  const rep = (DB.messages || []).filter((m) => m.from_code === code && (m.replies || []).length > (m.replies_seen || 0)).length;
  return kind === 'annonces' ? ann : kind === 'replies' ? rep : ann + rep;
}
/* À l'ouverture de « Mon compte », annonces et réponses sont marquées comme lues */
function markMemberRead(code, kind) {
  // Marqué comme lu après l'affichage : la pastille reste visible pendant cette visite
  clearTimeout(STATE.readTimer);
  STATE.readTimer = setTimeout(() => {
    if (!SESSION || SESSION.code !== code) return;
    let changed = false;
    if (kind === 'annonces') (DB.annonces || []).forEach((a) => { a.seen = a.seen || []; if (!a.seen.includes(code)) { a.seen.push(code); changed = true; } });
    if (kind === 'replies') (DB.messages || []).forEach((m) => { if (m.from_code === code && (m.replies || []).length > (m.replies_seen || 0)) { m.replies_seen = m.replies.length; changed = true; } });
    if (changed) saveDB();
  }, 2500);
}
ACTIONS.msgReply = (id) => {
  const ta = document.querySelector('[data-reply="' + id + '"]'); const txt = ta ? ta.value.trim() : '';
  if (!txt) { toast('Écrivez votre réponse.', 'err'); return; }
  const m = DB.messages.find((x) => x.id === id); const a = myAuthor();
  m.replies = (m.replies || []).concat([{ by_code: a.code, by_name: a.name, date: nowISO(), texte: txt }]);
  saveDB(); toast('Réponse envoyée.', 'ok'); render();
};
ACTIONS.msgNew = () => openModal({
  title: 'Écrire au comité', submit: 'Envoyer',
  body: field('Sujet', input('sujet', '', 'required maxlength="80"')) + field('Message', '<textarea name="texte" rows="5" required></textarea>', '', 'Le comité verra votre nom et vous répondra ici.'),
  onSubmit: (v) => {
    if (!v.texte.trim()) { toast('Écrivez votre message.', 'err'); return false; }
    const a = myAuthor(); DB.messages = DB.messages || [];
    DB.messages.push({ id: uid(), from_code: a.code, from_name: a.name, date: nowISO(), sujet: v.sujet.trim(), texte: v.texte.trim(), replies: [] });
    saveDB(); toast('Message envoyé au comité.', 'ok'); render();
  },
});
ACTIONS.suggNew = () => openModal({
  title: 'Donner une suggestion', submit: 'Envoyer',
  body: field('Votre idée pour faire avancer la mutuelle', '<textarea name="texte" rows="5" required></textarea>') +
    field('', '<label class="check"><input type="checkbox" name="anonyme"> Envoyer sans afficher mon nom</label>'),
  onSubmit: (v) => {
    if (!v.texte.trim()) { toast('Écrivez votre suggestion.', 'err'); return false; }
    const a = myAuthor(); DB.suggestions = DB.suggestions || [];
    DB.suggestions.push({ id: uid(), from_code: a.code, from_name: a.name, anonyme: !!v.anonyme, date: nowISO(), texte: v.texte.trim(), reponse: '' });
    saveDB(); toast('Merci pour votre suggestion !', 'ok'); render();
  },
});
ACTIONS.suggReply = (id) => {
  const s = DB.suggestions.find((x) => x.id === id);
  openModal({
    title: 'Suite donnée à la suggestion', submit: t('save'),
    body: '<p style="margin-top:0;white-space:pre-wrap">' + esc(s.texte) + '</p>' + field('Réponse du comité', '<textarea name="reponse" rows="4">' + esc(s.reponse || '') + '</textarea>'),
    onSubmit: (v) => { const a = myAuthor(); s.reponse = v.reponse.trim(); s.reponse_by = a.name + ' · ' + fmtDT(nowISO()); saveDB(); toast('Réponse enregistrée.', 'ok'); render(); },
  });
};
/* Bloc « Mon compte » : mes messages et mes suggestions */
function memberCommPanel(m) {
  if ((DB.messages || []).some((x) => x.from_code === m.code && (x.replies || []).length > (x.replies_seen || 0))) markMemberRead(m.code, 'replies');
  const mine = (DB.messages || []).filter((x) => x.from_code === m.code).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const sugg = (DB.suggestions || []).filter((x) => x.from_code === m.code);
  return '<section class="panel"><div class="panel-head"><h2>Messages au comité</h2><div class="right"><button class="btn btn-sm btn-primary" data-act="msgNew">Écrire au comité</button>' +
    '<button class="btn btn-sm" data-act="suggNew">Donner une suggestion</button></div></div><div class="panel-body">' +
    (mine.length ? mine.map((x) => messageThread(x, false)).join('') : '<span class="muted">Besoin d’une information ? Écrivez au comité : il vous répondra ici.</span>') +
    (sugg.length ? '<h4 style="margin:12px 0 6px">Mes suggestions</h4>' + sugg.map((s) => '<p style="margin:0 0 6px">• ' + esc(s.texte) + (s.reponse ? '<br><span class="muted">Réponse : ' + esc(s.reponse) + '</span>' : '') + '</p>').join('') : '') +
    '</div></section>';
}

/* ---------- Écran de bienvenue après connexion ---------- */
function showWelcome() {
  const old = document.getElementById('welcome'); if (old) old.remove();
  const name = currentName(); const d = nextMeeting();
  const el = document.createElement('div'); el.id = 'welcome'; el.className = 'welcome';
  el.innerHTML = '<div class="welcome-card">' + logoImg('welcome-logo') +
    '<div class="welcome-hello">' + (currentLang() === 'kr' ? 'Byenvini' : 'Bienvenue') + '</div>' +
    '<div class="welcome-name">' + esc(name) + '</div>' +
    '<div class="welcome-line"></div>' +
    '<div class="welcome-sub">UNIE-MUSO · Unie Mutuelle Solidarité</div>' +
    '<div class="welcome-meet">' + t('next_meeting') + ' : <b>' + esc(longDate(d)) + '</b> · ' + esc(SETTINGS.meeting_hour) + '</div>' +
    '<button class="btn btn-accent" data-close-welcome>' + (currentLang() === 'kr' ? 'Antre' : 'Entrer') + '</button></div>';
  document.body.appendChild(el);
  // L'image reste affichée jusqu'à ce que la personne touche « Entrer »
  el.querySelector('[data-close-welcome]').addEventListener('click', () => {
    el.classList.add('out'); setTimeout(() => el.remove(), 350);
    if (typeof ONLINE !== 'undefined' && ONLINE.pendingRender) { ONLINE.pendingRender = false; setTimeout(render, 360); }
  });
}
