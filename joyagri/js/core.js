/* JOYAGRI — logique métier pure (calculs, prix, comptabilité).
 * Aucun accès à l'écran ici : ce fichier est testé tel quel avec Node (tests/core.test.js).
 * Tous les montants sont en CENTIMES (entiers) pour éviter les erreurs d'arrondi. */
(function (root) {
  'use strict';
  const J = (root.J = root.J || {});
  const TZ = 'America/Port-au-Prince';
  J.TZ = TZ;

  /* ---------- Montants ---------- */
  const toC = (x) => {
    if (x === null || x === undefined || x === '') return 0;
    if (typeof x === 'string') x = J.parseNum(x);
    return Math.round(Number(x) * 100) || 0;
  };
  J.toC = toC;
  J.fromC = (c) => (c || 0) / 100;
  J.parseNum = (s) => {
    if (typeof s === 'number') return s;
    s = String(s || '').replace(/[\s  ]/g, '').replace(/HTG|USD|\$/gi, '');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };
  /** 1250000 -> "12 500 HTG" ; 1250050 -> "12 500,50 HTG" */
  J.fmt = (c, cur) => {
    c = Math.round(c || 0);
    const neg = c < 0;
    const a = Math.abs(c);
    const ent = Math.floor(a / 100);
    const dec = a % 100;
    const s = String(ent).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const out = (neg ? '-' : '') + s + (dec ? ',' + String(dec).padStart(2, '0') : '');
    return cur === '' ? out : out + ' ' + (cur || 'HTG');
  };
  J.fmtQty = (q) => {
    const n = Math.round((Number(q) || 0) * 1000) / 1000;
    return String(n).replace('.', ',');
  };

  /* ---------- Dates (fuseau d'Haïti) ---------- */
  const parts = (d) => {
    const f = new Intl.DateTimeFormat('fr-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const o = {};
    f.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
    return o;
  };
  J.dayKey = (iso) => {
    const p = parts(iso ? new Date(iso) : new Date());
    return `${p.year}-${p.month}-${p.day}`;
  };
  J.today = () => J.dayKey();
  J.monthKey = (iso) => J.dayKey(iso).slice(0, 7);
  J.nowISO = () => new Date().toISOString();
  J.fmtDate = (v) => {
    if (!v) return '';
    const k = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : J.dayKey(v);
    const [y, m, d] = k.split('-');
    return `${d}/${m}/${y}`;
  };
  J.fmtTime = (iso) => { const p = parts(new Date(iso)); return `${p.hour}:${p.minute}`; };
  J.fmtDateTime = (iso) => `${J.fmtDate(iso)} ${J.fmtTime(iso)}`;
  J.daysBetween = (fromKey, toKey) => {
    const a = Date.UTC(+fromKey.slice(0, 4), +fromKey.slice(5, 7) - 1, +fromKey.slice(8, 10));
    const b = Date.UTC(+toKey.slice(0, 4), +toKey.slice(5, 7) - 1, +toKey.slice(8, 10));
    return Math.round((b - a) / 86400000);
  };
  J.addDays = (key, n) => {
    const d = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10) + n));
    return d.toISOString().slice(0, 10);
  };
  J.startOfWeek = (key) => {
    const d = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)));
    const wd = (d.getUTCDay() + 6) % 7; // lundi = 0
    return J.addDays(key, -wd);
  };
  J.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- Prix gros / détail ---------- */
  /** Retourne le prix appliqué ET la raison, pour que le vendeur la voie. */
  J.priceFor = (product, qty, client) => {
    if (client && client.type === 'grossiste') {
      return { price: product.wholesalePrice, type: 'gros', reason: 'Client grossiste / revendeur' };
    }
    const min = Number(product.minWholesaleQty) || 0;
    if (min > 0 && Number(qty) >= min) {
      return { price: product.wholesalePrice, type: 'gros', reason: `Quantité ≥ ${J.fmtQty(min)}` };
    }
    return { price: product.retailPrice, type: 'detail', reason: 'Prix de détail' };
  };

  /* ---------- Calcul d'une fiche ---------- */
  J.discountAmount = (base, type, value) => {
    if (!value) return 0;
    let d = type === 'pct' ? Math.round((base * Number(value)) / 100) : Math.round(value);
    if (d < 0) d = 0;
    if (d > base) d = base;
    return d;
  };
  /** Ligne : { qty, unitPrice (c), discType 'pct'|'amt', discValue (% ou centimes) } */
  J.lineCalc = (l) => {
    const gross = Math.round(Number(l.qty) * l.unitPrice);
    const disc = J.discountAmount(gross, l.discType, l.discValue);
    return { gross, disc, total: gross - disc };
  };
  /** Répartit la réduction globale sur les lignes (au prorata, reste au plus grand).
   *  Indispensable pour que chaque compte de produit reçoive le bon montant net. */
  J.allocate = (amount, weights) => {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!sum || !amount) return weights.map(() => 0);
    const raw = weights.map((w) => (amount * w) / sum);
    const out = raw.map(Math.floor);
    let rest = amount - out.reduce((a, b) => a + b, 0);
    const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; rest > 0; k = (k + 1) % order.length) { out[order[k][1]]++; rest--; }
    return out;
  };
  J.saleCalc = (sale) => {
    const lines = (sale.lines || []).map((l) => Object.assign({}, l, J.lineCalc(l)));
    const gross = lines.reduce((a, l) => a + l.gross, 0);
    const lineDisc = lines.reduce((a, l) => a + l.disc, 0);
    const subtotal = lines.reduce((a, l) => a + l.total, 0);
    const globalDisc = J.discountAmount(subtotal, sale.globalDiscType, sale.globalDiscValue);
    const alloc = J.allocate(globalDisc, lines.map((l) => l.total));
    lines.forEach((l, i) => { l.globalShare = alloc[i]; l.net = l.total - alloc[i]; });
    const total = subtotal - globalDisc;
    return { lines, gross, lineDisc, subtotal, globalDisc, totalDisc: lineDisc + globalDisc, total };
  };
  J.salePaid = (sale) => (sale.payments || []).reduce((a, p) => a + p.amount, 0);
  J.saleRest = (sale) => (sale.status === 'annulee' ? 0 : Math.max(0, sale.total - J.salePaid(sale)));
  J.payStatus = (sale) => {
    if (sale.status === 'annulee') return 'annulee';
    const paid = J.salePaid(sale);
    if (paid >= sale.total) return 'payee';
    if (paid > 0) return 'partielle';
    return 'credit';
  };
  J.PAY_STATUS_LABEL = { payee: 'Payée', partielle: 'Paiement partiel', credit: 'À crédit', annulee: 'Annulée' };

  /* ---------- Plan comptable (proposé, à valider par le comptable) ---------- */
  // type : A actif, P passif, K capitaux, C charge, R produit. contra = amortissement (actif à solde créditeur)
  J.DEFAULT_ACCOUNTS = [
    ['101', 'Capital — apport du propriétaire', 'K'],
    ['108', "Compte de l'exploitant (apports / retraits)", 'K'],
    ['164', 'Emprunts', 'P'],
    ['2154', 'Matériel agricole (tracteur, outils)', 'A'],
    ['2181', 'Installation solaire (panneaux, batteries, onduleur)', 'A'],
    ['2182', 'Matériel de transport', 'A'],
    ['2183', 'Matériel informatique, téléphones, imprimante', 'A'],
    ['2184', 'Mobilier', 'A'],
    ['2185', 'Congélateurs (freezers)', 'A'],
    ['2186', 'Glacières (igloos)', 'A'],
    ['2188', 'Autres équipements (balance…)', 'A'],
    ['28154', 'Amort. matériel agricole', 'A', true],
    ['28181', 'Amort. installation solaire', 'A', true],
    ['28182', 'Amort. matériel de transport', 'A', true],
    ['28183', 'Amort. matériel informatique', 'A', true],
    ['28184', 'Amort. mobilier', 'A', true],
    ['28185', 'Amort. congélateurs', 'A', true],
    ['28186', 'Amort. glacières', 'A', true],
    ['28188', 'Amort. autres équipements', 'A', true],
    ['37', 'Stock de crème glacée (marchandises)', 'A'],
    ['401', 'Fournisseurs', 'P'],
    ['411', 'Clients', 'A'],
    ['421', 'Personnel — salaires à payer', 'P'],
    ['512', 'Banque', 'A'],
    ['5141', 'MonCash', 'A'],
    ['5142', 'NatCash', 'A'],
    ['531', 'Caisse', 'A'],
    ['6045', 'Coûts directs des services agricoles (carburant tracteur, main-d’œuvre)', 'C'],
    ['6061', 'Électricité', 'C'],
    ['6062', 'Carburant (génératrice, véhicule)', 'C'],
    ['6063', 'Glace (pour glacières)', 'C'],
    ['6064', 'Fournitures et emballages', 'C'],
    ['6071', 'Coût d’achat des glaces vendues', 'C'],
    ['613', 'Loyer', 'C'],
    ['615', 'Entretien et réparations', 'C'],
    ['6241', 'Transport', 'C'],
    ['626', 'Téléphone et Internet', 'C'],
    ['627', 'Frais bancaires, MonCash / NatCash', 'C'],
    ['641', 'Salaires', 'C'],
    ['658', 'Charges diverses', 'C'],
    ['6587', 'Pertes sur stock (fonte, coupure de courant, produit abîmé)', 'C'],
    ['6588', 'Manquants de caisse', 'C'],
    ['675', 'Valeur comptable des immobilisations cédées / mises au rebut', 'C'],
    ['681', 'Dotations aux amortissements', 'C'],
    ['7061', 'Prestations de services agricoles', 'R'],
    ['7071', 'Ventes de crème glacée en gros', 'R'],
    ['7072', 'Ventes de crème glacée au détail', 'R'],
    ['7587', 'Excédents d’inventaire', 'R'],
    ['775', 'Produits des cessions d’immobilisations', 'R'],
    ['7588', 'Excédents de caisse et produits divers', 'R'],
  ].map(([code, name, type, contra]) => ({ code, name, type, contra: !!contra }));

  J.ASSET_CATEGORIES = [
    { acc: '2181', dep: '28181', label: 'Installation solaire', life: 120 },
    { acc: '2185', dep: '28185', label: 'Congélateurs', life: 60 },
    { acc: '2186', dep: '28186', label: 'Glacières (igloos)', life: 36 },
    { acc: '2154', dep: '28154', label: 'Matériel agricole', life: 96 },
    { acc: '2182', dep: '28182', label: 'Matériel de transport', life: 60 },
    { acc: '2183', dep: '28183', label: 'Informatique / téléphone / imprimante', life: 36 },
    { acc: '2184', dep: '28184', label: 'Mobilier', life: 60 },
    { acc: '2188', dep: '28188', label: 'Autres équipements', life: 60 },
  ];

  J.PAY_MODES = [
    { id: 'cash', label: 'Cash', acc: '531' },
    { id: 'moncash', label: 'MonCash', acc: '5141' },
    { id: 'natcash', label: 'NatCash', acc: '5142' },
    { id: 'virement', label: 'Virement', acc: '512' },
    { id: 'cheque', label: 'Chèque', acc: '512' },
  ];
  J.payAcc = (mode) => (J.PAY_MODES.find((m) => m.id === mode) || J.PAY_MODES[0]).acc;
  J.payLabel = (mode) => (mode === 'credit' ? 'Crédit' : (J.PAY_MODES.find((m) => m.id === mode) || { label: mode }).label);

  J.EXPENSE_CATEGORIES = [
    { id: 'electricite', label: 'Électricité', acc: '6061', act: 'GL' },
    { id: 'carburant', label: 'Carburant (génératrice, véhicule)', acc: '6062', act: 'C' },
    { id: 'services', label: 'Carburant tracteur / main-d’œuvre (services agricoles)', acc: '6045', act: 'S' },
    { id: 'transport', label: 'Transport', acc: '6241', act: 'C' },
    { id: 'glace', label: 'Glace pour glacières', acc: '6063', act: 'GL' },
    { id: 'salaires', label: 'Salaires', acc: '641', act: 'C' },
    { id: 'entretien', label: 'Entretien et réparations', acc: '615', act: 'C' },
    { id: 'loyer', label: 'Loyer', acc: '613', act: 'C' },
    { id: 'telephone', label: 'Téléphone / Internet', acc: '626', act: 'C' },
    { id: 'fournitures', label: 'Fournitures et emballages', acc: '6064', act: 'GL' },
    { id: 'frais', label: 'Frais bancaires / MonCash', acc: '627', act: 'C' },
    { id: 'divers', label: 'Divers', acc: '658', act: 'C' },
  ];
  J.ACTIVITIES = { S: 'Services agricoles', GL: 'Crème glacée', C: 'Commun (non réparti)' };

  /* ---------- Écritures ---------- */
  /** Construit une écriture et VÉRIFIE l'équilibre débit = crédit (sinon erreur). */
  J.makeEntry = (date, label, source, rawLines) => {
    const merged = {};
    rawLines.forEach((l) => {
      if (!l || (!l.debit && !l.credit)) return;
      const k = l.account + '|' + (l.act || '');
      if (!merged[k]) merged[k] = { account: l.account, act: l.act || '', debit: 0, credit: 0 };
      merged[k].debit += Math.round(l.debit || 0);
      merged[k].credit += Math.round(l.credit || 0);
    });
    const lines = Object.values(merged).map((l) => {
      const n = l.debit - l.credit; // on garde une seule colonne par compte
      return { account: l.account, act: l.act, debit: n > 0 ? n : 0, credit: n < 0 ? -n : 0 };
    }).filter((l) => l.debit || l.credit);
    const d = lines.reduce((a, l) => a + l.debit, 0);
    const c = lines.reduce((a, l) => a + l.credit, 0);
    if (d !== c) throw new Error(`Écriture déséquilibrée (${label}) : débit ${d} ≠ crédit ${c}`);
    return { id: J.uid(), date, label, source, lines, createdAt: J.nowISO() };
  };
  const revAcc = (l) => (l.kind === 'service' ? '7061' : l.priceType === 'gros' ? '7071' : '7072');
  const revAct = (l) => (l.kind === 'service' ? 'S' : l.priceType === 'gros' ? 'G' : 'D');

  /** Écriture d'une vente : produits nets par compte, trésorerie / client, et coût des glaces vendues. */
  J.saleEntry = (sale) => {
    const lines = [];
    sale.lines.forEach((l) => {
      lines.push({ account: revAcc(l), act: revAct(l), credit: l.net });
      if (l.kind === 'product' && l.cost) {
        lines.push({ account: '6071', act: revAct(l), debit: l.cost });
        lines.push({ account: '37', credit: l.cost });
      }
    });
    const first = (sale.payments || []).filter((p) => p.atSale);
    let paid = 0;
    first.forEach((p) => { lines.push({ account: J.payAcc(p.mode), debit: p.amount }); paid += p.amount; });
    if (sale.total - paid > 0) lines.push({ account: '411', debit: sale.total - paid });
    return J.makeEntry(J.dayKey(sale.date), `Vente fiche ${sale.no} — ${sale.client.name}`, { type: 'vente', id: sale.id }, lines);
  };
  J.paymentEntry = (sale, p) => J.makeEntry(J.dayKey(p.date), `Encaissement fiche ${sale.no} — ${sale.client.name}`,
    { type: 'encaissement', id: sale.id, pid: p.id },
    [{ account: J.payAcc(p.mode), debit: p.amount }, { account: '411', credit: p.amount }]);
  /** Annulation : contre-passation de toutes les écritures de la fiche. */
  J.reverseEntries = (entries, date, label, source) => {
    const lines = [];
    entries.forEach((e) => e.lines.forEach((l) => lines.push({ account: l.account, act: l.act, debit: l.credit, credit: l.debit })));
    return J.makeEntry(date, label, source, lines);
  };
  J.purchaseEntry = (p) => {
    const lines = [{ account: '37', debit: p.total }];
    if (p.paid > 0) lines.push({ account: J.payAcc(p.payMode), credit: p.paid });
    if (p.total - p.paid > 0) lines.push({ account: '401', credit: p.total - p.paid });
    return J.makeEntry(p.date, `Achat ${p.no} — ${p.supplierName}`, { type: 'achat', id: p.id }, lines);
  };
  J.supplierPaymentEntry = (sp, supplierName) => J.makeEntry(sp.date, `Paiement fournisseur — ${supplierName}`,
    { type: 'paiement_fournisseur', id: sp.id },
    [{ account: '401', debit: sp.amount }, { account: J.payAcc(sp.mode), credit: sp.amount }]);
  J.expenseEntry = (e) => {
    const cat = J.EXPENSE_CATEGORIES.find((c) => c.id === e.category) || J.EXPENSE_CATEGORIES[J.EXPENSE_CATEGORIES.length - 1];
    return J.makeEntry(e.date, `Dépense — ${cat.label}${e.description ? ' : ' + e.description : ''}`, { type: 'depense', id: e.id },
      [{ account: cat.acc, act: e.act || cat.act, debit: e.amount }, { account: J.payAcc(e.mode), credit: e.amount }]);
  };
  J.lossEntry = (m, label) => J.makeEntry(m.date, label, { type: 'perte', id: m.id },
    [{ account: '6587', act: 'GL', debit: m.value }, { account: '37', credit: m.value }]);
  J.inventoryGainEntry = (m, label) => J.makeEntry(m.date, label, { type: 'inventaire', id: m.id },
    [{ account: '37', debit: m.value }, { account: '7587', act: 'GL', credit: m.value }]);
  J.cashDiffEntry = (date, diff, sid) => (diff > 0
    ? J.makeEntry(date, 'Excédent de caisse', { type: 'caisse', id: sid }, [{ account: '531', debit: diff }, { account: '7588', act: 'C', credit: diff }])
    : J.makeEntry(date, 'Manquant de caisse', { type: 'caisse', id: sid }, [{ account: '6588', act: 'C', debit: -diff }, { account: '531', credit: -diff }]));

  /** Bilan d'ouverture : la différence actif − dettes = capital (apport du propriétaire). */
  J.openingEntry = (o) => {
    const lines = [];
    (o.assets || []).forEach((a) => {
      const cat = J.ASSET_CATEGORIES.find((c) => c.acc === a.acc);
      lines.push({ account: a.acc, debit: a.cost });
      if (a.accumulated) lines.push({ account: cat ? cat.dep : '28188', credit: a.accumulated });
    });
    if (o.stockValue) lines.push({ account: '37', debit: o.stockValue });
    [['531', o.cash], ['512', o.bank], ['5141', o.moncash], ['5142', o.natcash], ['411', o.receivables]]
      .forEach(([a, v]) => v && lines.push({ account: a, debit: v }));
    if (o.payables) lines.push({ account: '401', credit: o.payables });
    if (o.loans) lines.push({ account: '164', credit: o.loans });
    const d = lines.reduce((a, l) => a + (l.debit || 0), 0);
    const c = lines.reduce((a, l) => a + (l.credit || 0), 0);
    const capital = d - c;
    if (capital >= 0) lines.push({ account: '101', credit: capital });
    else lines.push({ account: '101', debit: -capital });
    const e = J.makeEntry(o.date, "Bilan d'ouverture (à-nouveaux)", { type: 'ouverture' }, lines);
    e.capital = capital;
    return e;
  };
  /* ---------- Amortissement linéaire ----------
   * Base amortissable = coût − valeur résiduelle. Dotation mensuelle = base / durée (en mois).
   * L'amortissement commence le mois de mise en service et s'arrête quand la base est atteinte
   * ou quand le bien sort (vente / mise au rebut). */
  J.depBase = (a) => Math.max(0, (a.cost || 0) - (a.residual || 0));
  J.monthlyDep = (a) => Math.round(J.depBase(a) / Math.max(1, a.lifeMonths || 1));
  J.monthsBetween = (fromMonth, toMonth) => {
    const [y1, m1] = fromMonth.split('-').map(Number);
    const [y2, m2] = toMonth.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1);
  };
  J.depForMonth = (asset, month) => {
    if (month < asset.depStart) return 0;
    if (asset.disposedMonth && month > asset.disposedMonth) return 0;
    if (asset.lastDepMonth && month <= asset.lastDepMonth) return 0; // jamais deux fois le même mois
    const remaining = J.depBase(asset) - (asset.accumulated || 0) - (asset.depPosted || 0);
    if (remaining <= 0) return 0;
    // dernier mois de la durée de vie : on solde l'arrondi pour finir exactement à la base
    const idx = J.monthsBetween(asset.depStart, month) + 1;
    if (idx >= (asset.lifeMonths || 1)) return remaining;
    return Math.min(J.monthlyDep(asset), remaining);
  };
  /** Amortissements déjà faits à une date (pour le bilan d'ouverture) : mois écoulés AVANT le mois de départ. */
  J.accumulatedBefore = (asset, startMonth) => {
    const n = Math.max(0, Math.min(asset.lifeMonths || 1, J.monthsBetween(asset.depStart, startMonth)));
    if (n >= (asset.lifeMonths || 1)) return J.depBase(asset);
    return Math.min(J.depBase(asset), n * J.monthlyDep(asset));
  };
  /** Tableau d'amortissement prévisionnel, année par année. */
  J.depSchedule = (asset) => {
    const a = Object.assign({}, asset, { accumulated: 0, depPosted: 0, disposedMonth: null, lastDepMonth: null });
    const rows = [];
    let m = a.depStart;
    let cum = 0;
    let guard = 0;
    while (cum < J.depBase(a) && guard++ < 1200) {
      const v = J.depForMonth(Object.assign(a, { depPosted: cum }), m);
      const y = m.slice(0, 4);
      if (!rows.length || rows[rows.length - 1].year !== y) rows.push({ year: y, months: 0, dot: 0 });
      const r = rows[rows.length - 1];
      r.months += v > 0 ? 1 : 0; r.dot += v; cum += v;
      r.cum = cum; r.vnc = (a.cost || 0) - cum;
      m = J.nextMonth(m);
    }
    return rows;
  };
  J.assetNBV = (a) => (a.cost || 0) - (a.accumulated || 0) - (a.depPosted || 0);
  J.nextMonth = (m) => {
    let [y, mo] = m.split('-').map(Number);
    mo++; if (mo > 12) { mo = 1; y++; }
    return `${y}-${String(mo).padStart(2, '0')}`;
  };
  J.lastDayOfMonth = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')}`;
  };

  /* ---------- États comptables ---------- */
  J.inRange = (key, from, to) => (!from || key >= from) && (!to || key <= to);
  J.trialBalance = (entries, accounts, from, to) => {
    const map = {};
    accounts.forEach((a) => { map[a.code] = { code: a.code, name: a.name, type: a.type, contra: a.contra, debit: 0, credit: 0 }; });
    entries.forEach((e) => {
      if (!J.inRange(e.date, from, to)) return;
      e.lines.forEach((l) => {
        if (!map[l.account]) map[l.account] = { code: l.account, name: '(compte inconnu)', type: '?', debit: 0, credit: 0 };
        map[l.account].debit += l.debit; map[l.account].credit += l.credit;
      });
    });
    const rows = Object.values(map).filter((r) => r.debit || r.credit).sort((a, b) => a.code.localeCompare(b.code));
    rows.forEach((r) => { r.solde = r.debit - r.credit; });
    const td = rows.reduce((a, r) => a + r.debit, 0);
    const tc = rows.reduce((a, r) => a + r.credit, 0);
    return { rows, totalDebit: td, totalCredit: tc, balanced: td === tc };
  };
  J.ledger = (entries, account, from, to) => {
    let solde = 0;
    let before = 0;
    const rows = [];
    entries.slice().sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt)).forEach((e) => {
      e.lines.filter((l) => l.account === account).forEach((l) => {
        if (from && e.date < from) { before += l.debit - l.credit; return; }
        if (to && e.date > to) return;
        solde += l.debit - l.credit;
        rows.push({ date: e.date, label: e.label, debit: l.debit, credit: l.credit, solde: before + solde });
      });
    });
    return { before, rows, end: before + solde };
  };
  /** Compte de résultat par activité (S services, GL crème glacée = G + D + GL, C commun). */
  J.incomeStatement = (entries, accounts, from, to) => {
    const tb = J.trialBalance(entries, accounts, from, to);
    const byAct = { S: { rev: 0, exp: 0 }, GL: { rev: 0, exp: 0 }, C: { rev: 0, exp: 0 } };
    const detail = {};
    entries.forEach((e) => {
      if (!J.inRange(e.date, from, to)) return;
      e.lines.forEach((l) => {
        const t = l.account[0];
        if (t !== '6' && t !== '7') return;
        const act = l.act === 'S' ? 'S' : (l.act === 'G' || l.act === 'D' || l.act === 'GL') ? 'GL' : 'C';
        const v = t === '7' ? l.credit - l.debit : l.debit - l.credit;
        byAct[act][t === '7' ? 'rev' : 'exp'] += v;
        const k = l.account + '|' + act;
        detail[k] = (detail[k] || 0) + v;
      });
    });
    const sumType = (ty) => tb.rows.filter((r) => r.type === ty).reduce((a, r) => a + (ty === 'R' ? -r.solde : r.solde), 0);
    const revenue = sumType('R');
    const expenses = sumType('C');
    Object.values(byAct).forEach((v) => { v.result = v.rev - v.exp; });
    const g = (acc) => tb.rows.filter((r) => r.code === acc).reduce((a, r) => a + (acc[0] === '7' ? -r.solde : r.solde), 0);
    const glMargin = {
      gros: { rev: g('7071'), cost: 0 }, detail: { rev: g('7072'), cost: 0 },
    };
    entries.forEach((e) => {
      if (!J.inRange(e.date, from, to)) return;
      e.lines.forEach((l) => {
        if (l.account !== '6071') return;
        const v = l.debit - l.credit;
        if (l.act === 'G') glMargin.gros.cost += v; else glMargin.detail.cost += v;
      });
    });
    return { rows: tb.rows.filter((r) => r.type === 'R' || r.type === 'C'), revenue, expenses, result: revenue - expenses, byAct, detail, glMargin };
  };
  J.balanceSheet = (entries, accounts, to) => {
    const tb = J.trialBalance(entries, accounts, null, to);
    const is = J.incomeStatement(entries, accounts, null, to);
    const assets = tb.rows.filter((r) => r.type === 'A' && r.solde !== 0);
    const liab = tb.rows.filter((r) => (r.type === 'P' || r.type === 'K') && r.solde !== 0);
    const totalAssets = assets.reduce((a, r) => a + r.solde, 0);
    const totalLiab = liab.reduce((a, r) => a - r.solde, 0) + is.result;
    return { assets, liab, result: is.result, totalAssets, totalLiab, balanced: totalAssets === totalLiab };
  };

  /* ---------- Coût moyen pondéré (CMUP) ---------- */
  J.newAvgCost = (stockQty, avgCost, inQty, inUnitCost) => {
    const q = Math.max(0, stockQty);
    const tot = q + inQty;
    if (tot <= 0) return inUnitCost;
    return Math.round((q * avgCost + inQty * inUnitCost) / tot);
  };

  /* ---------- Téléphone Haïti (+509) ---------- */
  J.waPhone = (p) => {
    let d = String(p || '').replace(/\D/g, '');
    if (d.length === 8) d = '509' + d;
    return d;
  };

  /* ---------- SHA-256 (mots de passe, fonctionne hors ligne partout) ---------- */
  J.sha256 = (ascii) => {
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const utf8 = unescape(encodeURIComponent(ascii));
    const K = []; const H = [];
    let p = 0;
    for (let c = 2; p < 64; c++) {
      let prime = true;
      for (let i = 2; i * i <= c; i++) if (c % i === 0) { prime = false; break; }
      if (prime) {
        if (p < 8) H[p] = (Math.pow(c, 1 / 2) * 4294967296) | 0;
        K[p++] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
      }
    }
    const bytes = [];
    for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
    for (let j = 0; j < bytes.length; j += 64) {
      const w = [];
      for (let i = 0; i < 16; i++) w[i] = (bytes[j + i * 4] << 24) | (bytes[j + i * 4 + 1] << 16) | (bytes[j + i * 4 + 2] << 8) | bytes[j + i * 4 + 3];
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        if (i >= 16) {
          const w15 = w[i - 15]; const w2 = w[i - 2];
          w[i] = (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0;
        }
        const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  };
  /** Hachage salé et répété : un mot de passe n'est jamais stocké en clair. */
  J.hashPassword = (pw, salt) => {
    let h = salt + '|' + pw;
    for (let i = 0; i < 2000; i++) h = J.sha256(h + salt);
    return h;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = J;
})(typeof window !== 'undefined' ? window : globalThis);
