/* =========================================================================
   Pages : réunions et quorum, Caisse Bleue, messages et suggestions,
   écran de bienvenue
   ========================================================================= */

/* ---------- Réunions et quorum ---------- */
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
    if (!r.auto && canEdit()) act += '<button class="btn btn-sm btn-danger" data-act="reunionDel" data-id="' + esc(k + '|' + (r.type || '')) + '">' + t('del') + '</button>';
    const type = (REUNION_TYPES.find((x) => x.v === (r.type || 'ordinaire')) || REUNION_TYPES[0]).l;
    return '<tr><td class="num">' + esc(longDate(r.date)) + '<div class="muted" style="font-size:11px">' + esc((r.heure || SETTINGS.meeting_hour) + (r.lieu ? ' · ' + r.lieu : '')) + '</div></td>' +
      '<td>' + esc(type) + (r.objet ? '<div class="muted" style="font-size:11px">' + esc(r.objet) + '</div>' : '') + '</td>' +
      '<td class="c num">' + pres + '</td><td class="c num">' + qreq + '</td><td>' + st + '</td><td class="act">' + act + '</td></tr>';
  });
  return pageHead('Gestion', t('reunions'), 'Quorum : 50 % + 1 des membres actifs (présents, en retard et représentés comptent). Sans quorum, la réunion ne compte pas : pas d’amende de retard ni d’absence, et ses opérations passent au rapport du mois suivant.',
    (canEdit() ? '<button class="btn" data-go="membres">Registre des présences</button><button class="btn btn-primary" data-act="reunionNew">Programmer une réunion</button>' : '')) +
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
ACTIONS.reunionNew = () => openModal({
  title: 'Programmer une réunion', submit: t('save'),
  body: '<div class="form-grid">' + field('Type', select('type', REUNION_TYPES, 'extraordinaire')) + field(t('date'), input('date', toISO(today()), 'type="date" required')) +
    field('Heure', input('heure', SETTINGS.meeting_hour, 'type="time"')) + field('Lieu', input('lieu', '')) + field('Objet / ordre du jour', '<textarea name="objet"></textarea>', 'full') + '</div>' +
    '<div class="muted" style="margin-top:8px">Les réunions du comité sont programmées par la présidente. Les convocations par notification, avec confirmation de présence et relances, arriveront avec la version en ligne.</div>',
  onSubmit: (v) => {
    if (!parseD(v.date)) { toast('Date invalide.', 'err'); return false; }
    DB.reunions = DB.reunions || [];
    DB.reunions.push({ date: fmtD(v.date), type: v.type, heure: v.heure, lieu: v.lieu.trim(), objet: v.objet.trim(), quorum: 'auto', par: mySelfCode() || SESSION.id });
    saveDB(); toast('Réunion programmée le ' + fmtD(v.date) + '.', 'ok'); render();
  },
});
ACTIONS.reunionDel = (key) => {
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

/* ---------- Caisse Bleue (dons, subventions) ---------- */
PAGES.caissebleue = function () {
  const list = (DB.dons || []).map((d, i) => Object.assign({ i }, d)).sort((a, b) => parseD(b.date) - parseD(a.date));
  const total = sum(list, (d) => d.montant);
  return pageHead('Trésorerie', t('caissebleue'), 'Statuts art. 25.3 : fonds reçus de l’extérieur (dons, subventions) pour renforcer la mutuelle',
    canEdit() ? '<button class="btn btn-primary" data-act="donNew">Enregistrer un don</button>' : '') +
    '<div class="kpis">' + kpi('Caisse Bleue', fmt(total) + ' <small>HTG</small>', list.length + ' don(s)', 'navy') + '</div>' +
    '<section class="panel">' + table(['Date', 'Donateur', 'Nature', 'Mode', ['Montant', 'n'], ''], list.map((d) =>
      '<tr><td class="num">' + esc(d.date) + '</td><td>' + esc(d.donateur || '') + '</td><td>' + esc(d.nature || 'Don') + (d.note ? '<div class="muted" style="font-size:11px">' + esc(d.note) + '</div>' : '') + '</td>' +
      '<td>' + esc(d.mode || BANK) + '</td><td class="n">' + fmt(d.montant) + '</td><td class="act">' +
      (canEdit() ? '<button class="btn btn-sm" data-act="donEdit" data-id="' + d.i + '">' + t('edit') + '</button><button class="btn btn-sm btn-danger" data-act="donDel" data-id="' + d.i + '">' + t('del') + '</button>' : '') + '</td></tr>'),
      '<tr><td colspan="4">Total</td><td class="n">' + fmt(total) + '</td><td></td></tr>') +
    '<div class="section-note">Le compte comptable de la Caisse Bleue sera ajusté selon le plan comptable de la mutuelle.</div></section>';
};
function donForm(d) {
  d = d || { date: fmtD(today()), nature: 'Don', mode: BANK };
  return '<div class="form-grid">' + field(t('date'), input('date', toISO(d.date), 'type="date"')) + field('Donateur', input('donateur', d.donateur || '', 'required')) +
    field('Nature', select('nature', ['Don', 'Subvention', 'Don en matériel'], d.nature)) + field(t('amount') + ' (HTG)', input('montant', d.montant || '', 'type="number" min="0" step="any"')) +
    field('Mode', select('mode', [BANK, CASH], d.mode || BANK)) + field('Note', input('note', d.note || ''), 'full') + '</div>';
}
function saveDon(v, i) {
  if (num(v.montant) <= 0 || !v.donateur.trim()) { toast('Donateur et montant obligatoires.', 'err'); return false; }
  const rec = { date: fmtD(v.date), donateur: v.donateur.trim(), nature: v.nature, montant: num(v.montant), mode: v.mode, note: v.note.trim() };
  DB.dons = DB.dons || []; if (i === undefined) DB.dons.push(rec); else DB.dons[i] = rec;
  saveDB(); toast('Don enregistré en Caisse Bleue.', 'ok'); render();
}
ACTIONS.donNew = () => openModal({ title: 'Enregistrer un don', body: donForm(), submit: t('save'), onSubmit: (v) => saveDon(v) });
ACTIONS.donEdit = (i) => openModal({ title: 'Modifier le don', body: donForm(DB.dons[+i]), submit: t('save'), onSubmit: (v) => saveDon(v, +i) });
ACTIONS.donDel = (i) => confirmBox('Supprimer le don', 'Supprimer ce don de ' + money(DB.dons[+i].montant) + ' ?', () => { DB.dons.splice(+i, 1); saveDB(); render(); }, t('del'));

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
  let body;
  if (tab === 'messages') {
    body = msgs.length ? msgs.map((m) => messageThread(m, true)).join('') : '<div class="panel"><div class="empty">Aucun message pour le moment.</div></div>';
  } else {
    body = '<section class="panel">' + table(['Date', 'Membre', 'Suggestion', 'Suite donnée', ''], sugg.map((s) =>
      '<tr><td class="num">' + esc(fmtDT(s.date)) + '</td><td>' + esc(s.anonyme ? 'Anonyme' : s.from_name) + '</td><td style="white-space:pre-wrap">' + esc(s.texte) + '</td>' +
      '<td>' + (s.reponse ? esc(s.reponse) + '<div class="muted" style="font-size:11px">' + esc(s.reponse_by || '') + '</div>' : '<span class="muted">—</span>') + '</td>' +
      '<td class="act"><button class="btn btn-sm" data-act="suggReply" data-id="' + s.id + '">Répondre</button></td></tr>')) + '</section>';
  }
  return pageHead('Communication', t('messages'), 'Les membres écrivent depuis « Mon compte » ; le comité répond ici. Chaque message indique qui l’a envoyé et qui a répondu.') +
    '<div class="tabs"><button class="' + (tab === 'messages' ? 'on' : '') + '" data-act="mtab" data-id="messages">Messages' + (waiting ? ' (' + waiting + ' en attente)' : '') + '</button>' +
    '<button class="' + (tab === 'suggestions' ? 'on' : '') + '" data-act="mtab" data-id="suggestions">Suggestions (' + sugg.length + ')</button></div>' + body +
    '<div class="muted" style="margin-top:6px">Avec la version en ligne, les messages arriveront automatiquement sur les téléphones, avec notification.</div>';
};
ACTIONS.mtab = (id) => { STATE.mtab = id; render(); };
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
    '<div class="welcome-hello">' + (SETTINGS.lang === 'kr' ? 'Byenvini' : 'Bienvenue') + '</div>' +
    '<div class="welcome-name">' + esc(name) + '</div>' +
    '<div class="welcome-line"></div>' +
    '<div class="welcome-sub">UNIE-MUSO · Unie Mutuelle Solidarité</div>' +
    '<div class="welcome-meet">' + t('next_meeting') + ' : <b>' + esc(longDate(d)) + '</b> · ' + esc(SETTINGS.meeting_hour) + '</div>' +
    '<button class="btn btn-accent" data-close-welcome>' + (SETTINGS.lang === 'kr' ? 'Antre' : 'Entrer') + '</button></div>';
  document.body.appendChild(el);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 350); };
  el.addEventListener('click', close);
  setTimeout(close, 3500);
}
