/* =========================================================================
   Calculs métier : membres, prévisions, prêts, grille, trésorerie, comptabilité
   ========================================================================= */
const COT = () => num(RULES.cot_verte) + num(RULES.cot_rouge);
const BANK = 'Banque CAP-AIDER';
const CASH = 'Liquidité';
function isBank(mode) { return mode !== CASH; }

/* Dates de réunion « réelles » : jours où au moins une cotisation ou une absence a été saisie */
/* Cache des calculs de réunions (vidé à chaque enregistrement et à chaque affichage) */
let CALC = {};
function resetCalc() { CALC = {}; }
/* Réunions tenues : cotisations le dernier jeudi, feuille de présence saisie, ou réunion programmée passée avec feuille */
function heldMeetingDates() {
  if (CALC.held) return CALC.held;
  const set = new Set();
  DB.cotisations.forEach((c) => { const d = parseD(c.date); if (d && d.getTime() === lastThursdayOf(d).getTime()) set.add(fmtD(d)); });
  DB.absences.forEach((a) => set.add(fmtD(a.date)));
  (DB.reunions || []).forEach((r) => { if (r.type !== 'comite' && sheetExists(r.date)) set.add(fmtD(r.date)); });
  CALC.held = [...set].map(parseD).filter((d) => d && d <= today()).sort((a, b) => a - b);
  return CALC.held;
}
/* Réunions VALIDES : tenues ET avec le quorum (50 % + 1 des membres actifs, représentés compris).
   Sans quorum, la réunion ne compte pas (ni retard, ni absence) et ses opérations passent au mois suivant. */
function meetingDates() {
  if (CALC.valid) return CALC.valid;
  CALC.valid = heldMeetingDates().filter((d) => quorumInfo(d).reached);
  return CALC.valid;
}
function membersActiveAt(date) {
  return DB.members.filter((m) => m.statut !== 'Inactif' && (!parseD(m.date_adhesion) || parseD(m.date_adhesion) <= date));
}
function reunionInfo(date) { const k = fmtD(date); return (DB.reunions || []).find((r) => fmtD(r.date) === k && r.type !== 'comite') || null; }
function sheetExists(date) { const k = fmtD(date); return DB.absences.some((a) => fmtD(a.date) === k && a.type); }
function quorumInfo(date) {
  const k = 'q' + fmtD(date); if (CALC[k]) return CALC[k];
  const mem = membersActiveAt(date); const N = mem.length; const req = Math.floor(N / 2) + 1;
  const pres = mem.filter((m) => attendanceType(m.code, date) !== 'absence').length;
  const info = reunionInfo(date); const forced = info && info.quorum && info.quorum !== 'auto' ? info.quorum === 'oui' : null;
  CALC[k] = { N, req, pres, reached: forced === null ? pres >= req : forced, forced: forced !== null, sheet: sheetExists(date) };
  return CALC[k];
}
/* Le mois a-t-il eu une réunion valide ? */
function validMeetingMonth(key) { return meetingDates().some((d) => monthKey(d) === key); }
/* Pointage d'une réunion : présent | retard | represente | absence.
   Saisie manuelle (feuille de présence) prioritaire ; sinon présent si une cotisation est enregistrée ce jour-là. */
const ATT_TYPES = [
  { v: 'present', l: 'Présent' }, { v: 'retard', l: 'Retard' }, { v: 'represente', l: 'Représenté (ayant droit)' }, { v: 'absence', l: 'Absent' },
];
function attendanceRecord(code, date) {
  const k = fmtD(date);
  return DB.absences.find((a) => a.code === code && fmtD(a.date) === k) || null;
}
function attendanceType(code, date, cots) {
  const rec = attendanceRecord(code, date);
  if (rec) return rec.type || 'absence';
  // Une feuille de présence existe : seul le pointage compte (on peut cotiser sans être présent)
  if (sheetExists(date)) return 'absence';
  // Sans feuille (anciennes réunions) : présence estimée d'après la cotisation du jour
  const k = fmtD(date);
  return (cots || DB.cotisations).some((c) => c.code === code && fmtD(c.date) === k) ? 'present' : 'absence';
}
function memberStart(m) {
  const d = parseD(m.date_adhesion);
  const s = parseD(RULES.mutuelle_start);
  return d && d > s ? d : s;
}

function memberStats(code, asOf) {
  const m = getMember(code) || { code };
  const limit = asOf ? parseD(asOf) : null;
  const inRange = (x) => !limit || parseD(x.date) <= limit;
  const cots = DB.cotisations.filter((c) => c.code === code && inRange(c));
  const verte = sum(cots, (c) => c.verte);
  const rouge = sum(cots, (c) => c.rouge);
  const total = verte + rouge;
  const attendu = num(RULES.nb_cotisations_attendues) * COT();
  const reste = Math.max(0, attendu - total);
  const moisRetard = COT() ? Math.floor(reste / COT() + 1e-9) : 0;
  let statut = 'À jour';
  if (reste > 0) statut = moisRetard >= 1 ? 'En retard — ' + moisRetard + ' mois' : 'Partiel';
  // Amende de 50 HTG par cotisation mensuelle versée après la réunion (règlement chap. II art. 5)
  const cotMonths = cotMonthsStatus(code, asOf);
  const nbCotRetard = cotMonths.filter((x) => x.late).length;
  const amendeRetard = nbCotRetard * num(RULES.amende_cot_retard);

  // Présences : réunions tenues depuis l'adhésion
  const start = parseD(m.date_adhesion);
  const meetings = meetingDates().filter((d) => (!start || d >= start) && (!limit || d <= limit));
  const attendance = meetings.map((d) => ({ date: d, type: attendanceType(code, d, cots) }));
  const absentDates = attendance.filter((a) => a.type === 'absence').map((a) => a.date);
  const presents = meetings.length - absentDates.length;
  const retards = attendance.filter((a) => a.type === 'retard').length;
  const amendeAbs = absentDates.length * num(RULES.amende_absence) + retards * num(RULES.amende_retard_reunion);

  const amendesPaid = sum(DB.amendes_paid.filter((a) => a.code === code && inRange(a)), (a) => a.montant);
  const amendesDues = Math.max(0, amendeRetard + amendeAbs - amendesPaid);
  const loan = activeLoan(code);
  const loanDue = loan ? nextInstallment(loan) : null;
  const cotMois = m.statut === 'Inactif' ? 0 : COT();
  const totalAVerser = reste + amendesDues + cotMois + (loanDue ? loanDue.du : 0);
  return {
    member: m, cots, verte, rouge, total, attendu, reste, moisRetard, statut, amendeRetard, nbCotRetard, cotMonths,
    meetings, attendance, absentDates, presents, retards, amendeAbs, amendesPaid, amendesDues, loan, loanDue, cotMois, totalAVerser,
  };
}

/* ---------- Prêts ---------- */
/* Échéancier : intérêts 1,5 % dégressifs calculés sur le tableau d'amortissement standard
   (40 000 / 8 mois → 600, 525, 450 … 75 = 2 700 HTG).
   Mois de grâce (règle de l'ancienne application, appliquée aux prêts en cours) : la durée reste la même,
   le 1er mois ne paie que l'intérêt, et le capital est réparti sur les mois restants ; les intérêts ne changent pas. */
function loanSchedule(p) {
  const rows = []; const n = Math.max(1, num(p.duree)); const t = num(p.taux) / 100; const cap = num(p.capital);
  const start = parseD(p.date) || today();
  const due = (i) => lastThursday(start.getFullYear(), start.getMonth() + i);
  const grace = !!p.grace && n > 1;
  const nbCap = grace ? n - 1 : n;
  const mc = round2(cap / nbCap);
  let rest = cap;
  for (let i = 0; i < n; i++) {
    const int = round2(cap * (1 - i / n) * t);
    let c;
    if (grace && i === 0) c = 0;
    else if (i === n - 1) c = round2(rest);
    else c = mc;
    rows.push({ n: i + 1, due: due(i + 1), cap: c, int, grace: grace && i === 0 });
    rest = round2(rest - c);
  }
  const pct = num(RULES.penalite_pret_pct) / 100;
  const t0 = today();
  rows.forEach((r) => {
    r.total = r.cap + r.int;
    r.payment = (p.payments || []).find((x) => +x.n === r.n) || null;
    r.late = !r.payment && r.due < t0;
    r.monthsLate = r.late ? Math.max(1, (t0.getFullYear() - r.due.getFullYear()) * 12 + t0.getMonth() - r.due.getMonth()) : 0;
    r.pen = r.late ? round2(r.cap * pct * r.monthsLate) : 0;
    r.du = r.total + r.pen;
  });
  return rows;
}
function loanTotals(p) {
  const rows = loanSchedule(p);
  const interets = sum(rows, (r) => r.int);
  const paid = p.payments || [];
  const rembourse = sum(paid, (x) => x.montant);
  const capRemb = sum(paid, (x) => x.cap);
  const intRemb = sum(paid, (x) => x.int);
  const penRemb = sum(paid, (x) => x.pen);
  const resteCap = Math.max(0, num(p.capital) - capRemb);
  const reste = Math.max(0, num(p.capital) + interets - capRemb - intRemb);
  const nbPaid = rows.filter((r) => r.payment).length;
  return { rows, interets, rembourse, capRemb, intRemb, penRemb, resteCap, reste, nbPaid, nb: rows.length, retard: rows.filter((r) => r.late).length };
}
function activeLoan(code) { return DB.prets.find((p) => p.code_membre === code && p.status !== 'Remboursé') || null; }
function nextInstallment(p) { return loanSchedule(p).find((r) => !r.payment) || null; }
function refreshLoanStatus(p) {
  const t = loanTotals(p);
  p.total_interets = t.interets;
  p.status = t.nbPaid >= t.nb ? 'Remboursé' : 'en cours';
}
function nextLoanId() { return DB.prets.reduce((mx, p) => Math.max(mx, +p.id || 0), 0) + 1; }

/* ---------- Grille d'évaluation de crédit (document officiel UNIE-MUSO) ---------- */
function monthDiff(a, b) { a = parseD(a); b = parseD(b); return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); }
function seuilFor(score) {
  const s = Math.round(score);
  return GRILLE.seuils.find((x) => s >= x.min && s <= x.max) || (s > 100 ? GRILLE.seuils[GRILLE.seuils.length - 1] : GRILLE.seuils[0]);
}
/* Rubrique 1 : 5 dernières rencontres */
function gridPresence(code, asOf) {
  const s = memberStats(code, asOf);
  const last = s.attendance.slice(-num(GRILLE.nb_reunions));
  const ded = { present: 0, represente: num(GRILLE.ded_represente), retard: num(GRILLE.ded_retard), absence: num(GRILLE.ded_absence) };
  const lost = sum(last, (a) => ded[a.type] || 0);
  return { pts: Math.max(0, num(GRILLE.pts_presence) - lost), max: num(GRILLE.pts_presence), detail: last };
}
/* Pour chaque mois depuis le démarrage (à partir du mois d'adhésion) : la cotisation était-elle à jour à la réunion ?
   Tous les membres doivent cotiser depuis avril : le cumul attendu au mois n est n × cotisation mensuelle. */
function cotMonthsStatus(code, asOf) {
  const m = getMember(code) || {}; const t0 = asOf ? parseD(asOf) : today();
  const start = parseD(RULES.mutuelle_start); const adh = parseD(m.date_adhesion);
  const adhMonth = adh ? new Date(adh.getFullYear(), adh.getMonth(), 1) : null;
  const cots = DB.cotisations.filter((c) => c.code === code);
  // Seuls les mois où une réunion s'est réellement tenue comptent (ex. : pas de réunion en juillet 2026)
  const held = new Set(meetingDates().map((d) => monthKey(d)));
  const out = []; let idx = 0;
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= t0; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const meet = lastThursday(d.getFullYear(), d.getMonth());
    idx++;
    // Le mois n'est « en retard » qu'une fois la réunion passée (le jour même, on peut encore payer)
    if (meet >= t0) break;
    if (adhMonth && meet < adhMonth) continue;
    if (!held.has(monthKey(meet))) continue;
    const paid = sum(cots.filter((c) => parseD(c.date) <= meet), (c) => num(c.verte) + num(c.rouge));
    out.push({ key: monthKey(d), meet, idx, paid, late: paid + 0.01 < idx * COT() });
  }
  return out;
}
/* Rubrique 2 : cotisations des 5 derniers mois (un mois est en retard si le cumul versé à la réunion est inférieur au cumul attendu) */
function gridCotisation(code, asOf) {
  const recent = cotMonthsStatus(code, asOf).slice(-num(GRILLE.nb_mois_cot));
  const nbLate = recent.filter((x) => x.late).length;
  return { pts: Math.max(0, num(GRILLE.pts_cotisation) - nbLate * num(GRILLE.ded_cot_mois)), max: num(GRILLE.pts_cotisation), nbLate, detail: recent };
}
/* Rubrique 3 : 3 derniers prêts, retards sur les 5 derniers mois (sans prêt antérieur : note pleine) */
function gridCredits(code, asOf) {
  const t0 = asOf ? parseD(asOf) : today();
  const from = new Date(t0.getFullYear(), t0.getMonth() - num(GRILLE.nb_mois_credit), t0.getDate());
  const loans = DB.prets.filter((p) => p.code_membre === code && parseD(p.date) <= t0).sort((a, b) => parseD(b.date) - parseD(a.date)).slice(0, num(GRILLE.nb_credits));
  const per = num(GRILLE.pts_credit);
  const credits = [];
  for (let i = 0; i < num(GRILLE.nb_credits); i++) {
    const p = loans[i];
    if (!p) { credits.push({ pts: per, max: per, loan: null, monthsLate: 0 }); continue; }
    let late = 0;
    loanSchedule(p).forEach((r) => {
      if (r.due < from || r.due > t0) return;
      if (r.payment) late += Math.max(0, monthDiff(r.due, r.payment.date) + (parseD(r.payment.date) > r.due && monthDiff(r.due, r.payment.date) === 0 ? 0 : 0));
      else late += Math.max(1, monthDiff(r.due, t0));
    });
    credits.push({ pts: Math.max(0, per - late * num(GRILLE.ded_credit_mois)), max: per, loan: p, monthsLate: late });
  }
  return { pts: sum(credits, (c) => c.pts), max: per * num(GRILLE.nb_credits), credits };
}
/* Score automatique (rubriques 1 à 3) ; la rubrique 4 vient des notes du comité */
function creditScore(code, asOf) {
  const s = memberStats(code, asOf);
  const pres = gridPresence(code, asOf), cot = gridCotisation(code, asOf), cred = gridCredits(code, asOf);
  const auto = pres.pts + cot.pts + cred.pts;
  const autoMax = pres.max + cot.max + cred.max;
  const base = s.verte; // cotisations Caisse Verte à jour
  const best = seuilFor(auto + num(GRILLE.pts_comite));
  return { auto, autoMax, pres, cot, cred, base, stats: s, hasLoan: !!s.loan,
    bestSeuil: best, bestMax: best.eligible ? Math.round(base * num(best.mult)) : 0 };
}
/* Évaluation complète d'une demande : automatique + moyenne des notes des membres du comité */
function comiteMembers() { return DB.members.filter((m) => m.is_comite && m.statut !== 'Inactif').sort(sortByCode); }
function evaluateDemande(d) {
  const ev = d.evaluation || {};
  const sc = creditScore(d.code_membre, d.date_demande);
  const pres = ev.presence !== undefined && ev.presence !== null && ev.presence !== '' ? num(ev.presence) : sc.pres.pts;
  const cot = ev.cotisation !== undefined && ev.cotisation !== null && ev.cotisation !== '' ? num(ev.cotisation) : sc.cot.pts;
  const cred = Array.isArray(ev.credits) && ev.credits.length ? sum(ev.credits) : sc.cred.pts;
  // Le demandeur ne note jamais sa propre demande, même s'il est membre du comité
  const graders = comiteMembers().filter((m) => m.code !== d.code_membre).map((m) => m.code);
  const notes = Object.keys(ev.notes_comite || {}).filter((k) => k !== d.code_membre).map((k) => ({ code: k, note: ev.notes_comite[k] })).filter((n) => n.note !== '' && n.note !== null && n.note !== undefined);
  const appreciation = notes.length ? round2(sum(notes, (n) => n.note) / notes.length) : null;
  const total = round2(pres + cot + cred + (appreciation || 0));
  const seuil = appreciation === null ? null : seuilFor(total);
  const montant = seuil ? (seuil.eligible ? Math.round(sc.base * num(seuil.mult)) : 0) : null;
  return { sc, pres, cot, cred, notes, appreciation, total, seuil, montant, complete: appreciation !== null, nbComite: graders.length, graders };
}

/* ---------- Comptabilité : plan comptable et journal ---------- */
const ACCOUNTS = {
  1010: 'Encaisse (liquidité)', 1020: 'Banque CAP-AIDER', 1210: 'Prêts aux membres',
  3010: 'CAISSE VERTE — épargne des membres', 3020: 'CAISSE BLEUE — dons et subventions', 3090: 'Résultat de l’exercice',
  4010: 'Frais d’inscription', 4020: 'Cotisations Caisse Rouge', 4030: 'Amendes',
  4040: 'Intérêts sur prêts', 4050: 'Pénalités sur prêts',
  5010: 'Frais administratifs', 5020: 'CAISSE ROUGE — solidarité / secours', 5030: 'Frais bancaires CAP-AIDER',
  5040: 'Frais de réunion', 5090: 'Autres charges',
};
const DEP_CATS = [
  { label: 'Frais administratifs', acc: 5010 },
  { label: 'Frais bancaires CAP-AIDER', acc: 5030 },
  { label: 'Frais de réunion', acc: 5040 },
  { label: 'Secours maladie/mariage/urgence', acc: 5020 },
  { label: 'Autres', acc: 5090 },
];
function depAccount(cat) { const c = DEP_CATS.find((x) => x.label === cat); return c ? c.acc : 5090; }
function cashAcc(mode) { return isBank(mode) ? 1020 : 1010; }
function accClass(acc) { return +String(acc)[0]; }

function buildJournal() {
  const E = [];
  const add = (date, piece, lib, lines, src) => E.push({ date: parseD(date), piece, lib, lines: lines.filter((l) => num(l.d) || num(l.c)), src });
  DB.cotisations.forEach((c, i) => {
    const v = num(c.verte), r = num(c.rouge);
    add(c.date, 'COT-' + (i + 1), 'Cotisation ' + c.code + ' — ' + nameOf(c.code), [
      { acc: cashAcc(c.mode), d: v + r }, { acc: 3010, c: v }, { acc: 4020, c: r }], 'cot');
  });
  DB.amendes_paid.forEach((a, i) => add(a.date, 'AM-' + (i + 1), 'Amende ' + a.code + ' — ' + nameOf(a.code),
    [{ acc: cashAcc(a.mode || BANK), d: a.montant }, { acc: 4030, c: a.montant }], 'am'));
  DB.depenses.forEach((d, i) => add(d.date, d.piece || 'DEP-' + (i + 1), 'Dépense — ' + (d.beneficiaire || d.categorie),
    [{ acc: depAccount(d.categorie), d: d.montant }, { acc: cashAcc(d.mode || BANK), c: d.montant }], 'dep'));
  DB.prets.forEach((p) => {
    add(p.date, 'PRET-' + p.id, 'Décaissement prêt ' + p.code_membre + ' — ' + nameOf(p.code_membre),
      [{ acc: 1210, d: p.capital }, { acc: cashAcc(p.mode || BANK), c: p.capital }], 'pret');
    (p.payments || []).forEach((x) => add(x.date, 'RMB-' + p.id + '-' + x.n, 'Remboursement prêt #' + p.id + ' éch. ' + x.n + ' — ' + p.code_membre, [
      { acc: cashAcc(x.mode), d: x.montant }, { acc: 1210, c: x.cap }, { acc: 4040, c: x.int }, { acc: 4050, c: x.pen }], 'rmb'));
  });
  (DB.dons || []).forEach((d, i) => add(d.date, 'DON-' + (i + 1), 'Caisse Bleue — ' + (d.nature || 'Don') + ' de ' + (d.donateur || ''),
    [{ acc: cashAcc(d.mode || BANK), d: d.montant }, { acc: 3020, c: d.montant }], 'don'));
  DB.transferts.forEach((t, i) => {
    const toBank = t.sens !== 'retrait';
    add(t.date, 'TRF-' + (i + 1), toBank ? 'Dépôt de la caisse à la banque' : 'Retrait de la banque vers la caisse',
      toBank ? [{ acc: 1020, d: t.montant }, { acc: 1010, c: t.montant }] : [{ acc: 1010, d: t.montant }, { acc: 1020, c: t.montant }], 'trf');
  });
  E.sort((a, b) => (a.date - b.date) || a.piece.localeCompare(b.piece));
  return E;
}
/* Soldes par compte jusqu'à une date (incluse), mouvements sur une période */
function balances(journal, from, to) {
  const f = from ? parseD(from) : null; const t = to ? parseD(to) : null;
  const B = {};
  journal.forEach((e) => {
    if (t && e.date > t) return;
    const inPeriod = !f || e.date >= f;
    e.lines.forEach((l) => {
      const b = B[l.acc] || (B[l.acc] = { acc: l.acc, d: 0, c: 0, pd: 0, pc: 0 });
      b.d += num(l.d); b.c += num(l.c);
      if (inPeriod) { b.pd += num(l.d); b.pc += num(l.c); }
    });
  });
  return B;
}
function solde(B, acc) { const b = B[acc]; return b ? b.d - b.c : 0; }
function financials(from, to) {
  const J = buildJournal(); const B = balances(J, from, to);
  const accs = Object.keys(B).map(Number);
  const produits = accs.filter((a) => accClass(a) === 4).map((a) => ({ acc: a, v: B[a].pc - B[a].pd, cum: B[a].c - B[a].d }));
  const charges = accs.filter((a) => accClass(a) === 5).map((a) => ({ acc: a, v: B[a].pd - B[a].pc, cum: B[a].d - B[a].c }));
  const totP = sum(produits, (x) => x.v), totC = sum(charges, (x) => x.v);
  const totPcum = sum(produits, (x) => x.cum), totCcum = sum(charges, (x) => x.cum);
  const actif = [1010, 1020, 1210].map((a) => ({ acc: a, v: solde(B, a) }));
  const passif = accs.filter((a) => accClass(a) === 2).map((a) => ({ acc: a, v: -solde(B, a) }));
  const capitaux = [{ acc: 3010, v: -solde(B, 3010) }].concat(B[3020] ? [{ acc: 3020, v: -solde(B, 3020) }] : []).concat([{ acc: 3090, v: totPcum - totCcum }]);
  return { J, B, produits, charges, totP, totC, resultat: totP - totC, resultatCum: totPcum - totCcum, actif, passif, capitaux,
    totActif: sum(actif, (x) => x.v), totPassif: sum(passif, (x) => x.v) + sum(capitaux, (x) => x.v) };
}

/* ---------- Trésorerie et fonds ---------- */
function treasury(asOf) {
  const B = balances(buildJournal(), null, asOf);
  const t = asOf ? parseD(asOf) : null; const ok = (x) => !t || parseD(x.date) <= t;
  const caisse = solde(B, 1010), banque = solde(B, 1020), prets = solde(B, 1210);
  const verteCot = sum(DB.cotisations.filter(ok), (c) => c.verte);
  const rougeCot = sum(DB.cotisations.filter(ok), (c) => c.rouge);
  const deps = DB.depenses.filter(ok);
  const depRouge = sum(deps.filter((d) => (d.caisse || (depAccount(d.categorie) === 5020 ? 'Caisse Rouge' : 'Caisse Verte')) === 'Caisse Rouge'), (d) => d.montant);
  const depVerte = sum(deps, (d) => d.montant) - depRouge;
  const produitsVerte = solde(B, 4030) * -1 + solde(B, 4040) * -1 + solde(B, 4050) * -1 + solde(B, 4010) * -1;
  // Caisse Verte (statuts art. 25.1) : cotisations vertes + amendes, intérêts, pénalités, frais d'inscription
  const verteFonds = verteCot + produitsVerte - depVerte;
  const rougeFonds = rougeCot - depRouge;
  const bleueFonds = -solde(B, 3020);
  return { caisse, banque, prets, actif: caisse + banque + prets, verteFonds, verteDispo: verteFonds - prets, rougeFonds, bleueFonds, verteCot, rougeCot, depRouge, depVerte };
}
function monthsRange(fromKey, toKey) {
  const out = []; let [y, m] = fromKey.split('-').map(Number); const [ty, tm] = toKey.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(y + '-' + pad(m)); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
function activityMonths() {
  const start = monthKey(RULES.mutuelle_start);
  const dates = [].concat(DB.cotisations, DB.depenses, DB.prets, DB.amendes_paid).map((x) => monthKey(x.date)).filter(Boolean).sort();
  const end = [monthKey(today()), dates[dates.length - 1] || start].sort().pop();
  return monthsRange(start < (dates[0] || start) ? start : (dates[0] || start), end);
}
function endOfMonth(key) { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0); }
function monthlyStats() {
  return activityMonths().map((k) => {
    const inM = (x) => monthKey(x.date) === k;
    const cots = DB.cotisations.filter(inM);
    const prets = DB.prets.filter(inM);
    const rmb = []; DB.prets.forEach((p) => (p.payments || []).forEach((x) => { if (monthKey(x.date) === k) rmb.push(x); }));
    return {
      key: k, verte: sum(cots, (c) => c.verte), rouge: sum(cots, (c) => c.rouge), nbCot: cots.length,
      amendes: sum(DB.amendes_paid.filter(inM), (a) => a.montant), depenses: sum(DB.depenses.filter(inM), (d) => d.montant),
      prets: sum(prets, (p) => p.capital), remb: sum(rmb, (x) => x.montant), interets: sum(rmb, (x) => x.int),
    };
  });
}

/* ---------- Demandes ---------- */
function nextDemandeId() { return DB.demandes_pret.reduce((mx, d) => Math.max(mx, +d.id || 0), 0) + 1; }
function createLoanFromDemande(d) {
  const p = {
    id: nextLoanId(), code_membre: d.code_membre, nom_membre: nameOf(d.code_membre), date: d.date_decision || fmtD(today()),
    capital: num(d.montant_approuve), duree: num(d.duree_approuvee) || 8, taux: 1.5, grace: !!d.grace_approuve, mode: d.mode_remise || BANK,
    total_interets: 0, status: 'en cours', payments: [],
  };
  refreshLoanStatus(p);
  DB.prets.push(p); d.pret_id = p.id;
  return p;
}
