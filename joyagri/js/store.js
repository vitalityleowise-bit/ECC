/* JOYAGRI — données et opérations métier.
 * Chaque opération met à jour les données ET génère ses écritures comptables équilibrées.
 * Rien n'est jamais supprimé : une fiche est annulée (contre-passation), un article est désactivé. */
(function (root) {
  'use strict';
  const J = root.J;

  J.newDB = () => ({
    schema: 1,
    createdAt: J.nowISO(),
    settings: {
      name: 'JOYAGRI', slogan: 'Cultiver aujourd’hui, nourrir demain', owner: '', nif: '', ninu: '', rc: '',
      address: '', phone: '', footer: 'Merci pour votre achat !', slipPrefix: 'F', nextSlipNo: 1,
      purchasePrefix: 'A', nextPurchaseNo: 1, usdEnabled: false, usdRate: 0, ticketWidth: 58,
      sellerMaxDiscountPct: 10, allowNegativeStock: false, printMode: 'escpos', escposAccents: 'ascii', escposLogo: true, escposCut: false, printerModel: 'PT-210', logo: null,
      sellerCanDeclareLoss: false, creditDefaultDays: 15, loyaltyEnabled: true, loyaltyPer: 100000,
    },
    users: [], clients: [], products: [], services: [], suppliers: [],
    sales: [], purchases: [], supplierPayments: [], stockMoves: [], expenses: [],
    cashSessions: [], assets: [], entries: [], audit: [], treasury: [],
    accounts: J.DEFAULT_ACCOUNTS.map((a) => Object.assign({}, a)),
    opening: { done: false },
    depPostedUntil: null,
  });

  /* ---------- Persistance : IndexedDB (+ localStorage de secours) + copie native ---------- */
  const IDB = { db: null };
  const idbOpen = () => new Promise((res) => {
    if (!root.indexedDB) return res(null);
    try {
      const r = root.indexedDB.open('joyagri', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  const idbGet = (k) => new Promise((res) => {
    if (!IDB.db) return res(null);
    const r = IDB.db.transaction('kv').objectStore('kv').get(k);
    r.onsuccess = () => res(r.result || null); r.onerror = () => res(null);
  });
  const idbSet = (k, v) => new Promise((res) => {
    if (!IDB.db) return res(false);
    const tx = IDB.db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(v, k);
    tx.oncomplete = () => res(true); tx.onerror = () => res(false);
  });
  const idbKeys = () => new Promise((res) => {
    if (!IDB.db) return res([]);
    const r = IDB.db.transaction('kv').objectStore('kv').getAllKeys();
    r.onsuccess = () => res(r.result || []); r.onerror = () => res([]);
  });
  const lsGet = (k) => { try { return root.localStorage.getItem('joyagri:' + k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { root.localStorage.setItem('joyagri:' + k, v); return true; } catch (e) { return false; } };

  J.load = async () => {
    IDB.db = await idbOpen();
    let raw = await idbGet('db');
    if (!raw) raw = lsGet('db');
    if (!raw && root.JoyNative && root.JoyNative.readLatest) raw = await root.JoyNative.readLatest();
    J.db = raw ? J.migrate(JSON.parse(raw)) : J.newDB();
    return J.db;
  };
  J.migrate = (db) => {
    const fresh = J.newDB();
    Object.keys(fresh).forEach((k) => { if (db[k] === undefined) db[k] = fresh[k]; });
    db.settings = Object.assign({}, fresh.settings, db.settings);
    return db;
  };
  let saveTimer = null;
  J.save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(J.saveNow, 250);
  };
  J.saveNow = async () => {
    if (!J.db) return;
    J.db.savedAt = J.nowISO();
    const raw = JSON.stringify(J.db);
    const ok = await idbSet('db', raw);
    if (!ok) lsSet('db', raw);
    const day = J.today();
    if (J.db.lastAutoBackup !== day) {
      J.db.lastAutoBackup = day;
      await idbSet('backup-' + day, raw);
      const keys = (await idbKeys()).filter((k) => String(k).startsWith('backup-')).sort();
      while (keys.length > 14) {
        const k = keys.shift();
        IDB.db.transaction('kv', 'readwrite').objectStore('kv').delete(k);
      }
    }
    // Copie dans Documents/JOYAGRI (version Windows / Android si le pont natif existe)
    if (root.JoyNative && root.JoyNative.writeBackup) {
      try { root.JoyNative.writeBackup(raw, day); } catch (e) { /* jamais bloquant */ }
    }
  };
  J.listAutoBackups = async () => (await idbKeys()).filter((k) => String(k).startsWith('backup-')).sort().reverse();
  J.getAutoBackup = (k) => idbGet(k);
  J.replaceDB = async (obj) => {
    if (!obj || !obj.settings || !Array.isArray(obj.sales)) throw new Error('Fichier de sauvegarde invalide.');
    J.db = J.migrate(obj);
    await J.saveNow();
  };

  /* ---------- Outils ---------- */
  const db = () => J.db;
  J.audit = (user, action, detail) => {
    db().audit.push({ id: J.uid(), date: J.nowISO(), user: user ? user.name : '—', action, detail: detail || '' });
  };
  J.byId = (list, id) => db()[list].find((x) => x.id === id);
  J.isOwner = (u) => u && u.role === 'owner';
  const need = (cond, msg) => { if (!cond) throw new Error(msg); };

  /* ---------- Utilisateurs ---------- */
  J.createUser = (name, login, role, pw) => {
    need(name && login, 'Nom et identifiant obligatoires.');
    need(pw && pw.length >= 4, 'Mot de passe : au moins 4 caractères.');
    need(!db().users.some((u) => u.login.toLowerCase() === login.toLowerCase()), 'Cet identifiant existe déjà.');
    const salt = J.uid() + J.uid();
    const u = { id: J.uid(), name, login, role, salt, hash: J.hashPassword(pw, salt), active: true, createdAt: J.nowISO() };
    db().users.push(u);
    return u;
  };
  /** Le propriétaire donne un nouveau mot de passe sans connaître l'ancien. */
  J.setPassword = (userId, pw) => {
    need(pw && pw.length >= 4, 'Mot de passe : au moins 4 caractères.');
    const u = J.byId('users', userId);
    u.salt = J.uid() + J.uid();
    u.hash = J.hashPassword(pw, u.salt);
  };
  J.checkPassword = (u, pw) => u && u.active && J.hashPassword(pw, u.salt) === u.hash;

  /* ---------- Stock ---------- */
  const moveStock = (product, qty, type, ref, reason, date, unitCost) => {
    const m = { id: J.uid(), date: date || J.today(), at: J.nowISO(), productId: product.id, qty, type, ref: ref || '', reason: reason || '', unitCost: unitCost != null ? unitCost : product.avgCost || 0 };
    m.value = Math.round(Math.abs(qty) * m.unitCost);
    product.stock = Math.round(((product.stock || 0) + qty) * 1000) / 1000;
    db().stockMoves.push(m);
    return m;
  };
  J.stockValue = () => db().products.reduce((a, p) => a + Math.round(Math.max(0, p.stock || 0) * (p.avgCost || 0)), 0);

  /* ---------- Ventes ---------- */
  J.nextSlipNo = () => `${db().settings.slipPrefix}-${String(db().settings.nextSlipNo).padStart(5, '0')}`;
  /** draft = { client (objet ou null), lines:[{kind, refId, qty, discType, discValue, serviceDate, serviceLocation, cost}],
   *           globalDiscType, globalDiscValue, payMode, paidNow, promiseDate, note, received } */
  J.resolveDraft = (draft) => {
    const client = draft.client;
    const lines = draft.lines.map((d) => {
      if (d.kind === 'product') {
        const p = J.byId('products', d.refId);
        const pr = J.priceFor(p, d.qty, client);
        return Object.assign({}, d, {
          name: J.productLabel(p), unit: p.unit || 'unité', unitPrice: pr.price, priceType: pr.type, priceReason: pr.reason,
        });
      }
      const s = J.byId('services', d.refId);
      return Object.assign({}, d, { name: s.name, unit: s.unit, unitPrice: d.unitPrice != null ? d.unitPrice : s.price, priceType: null });
    });
    return Object.assign({}, draft, { lines });
  };
  J.productLabel = (p) => [p.name, p.format].filter(Boolean).join(' — ');

  J.createSale = (draft, user) => {
    const s = db().settings;
    need(draft.lines.length > 0, 'La fiche est vide.');
    const r = J.resolveDraft(draft);
    r.lines.forEach((l) => need(Number(l.qty) > 0, `Quantité invalide pour « ${l.name} ».`));
    const calc = J.saleCalc(r);
    // Contrôle de la réduction maximale d'un vendeur
    if (!J.isOwner(user) && calc.totalDisc > 0) {
      const pct = (calc.totalDisc * 100) / Math.max(1, calc.gross);
      need(pct <= s.sellerMaxDiscountPct + 1e-9, `Réduction trop forte (${pct.toFixed(1)} %). Maximum autorisé au vendeur : ${s.sellerMaxDiscountPct} %.`);
    }
    // Stock suffisant ?
    const needQty = {};
    calc.lines.filter((l) => l.kind === 'product').forEach((l) => { needQty[l.refId] = (needQty[l.refId] || 0) + Number(l.qty); });
    if (!s.allowNegativeStock) {
      Object.keys(needQty).forEach((id) => {
        const p = J.byId('products', id);
        need((p.stock || 0) >= needQty[id], `Stock insuffisant pour « ${J.productLabel(p)} » (reste ${J.fmtQty(p.stock || 0)}).`);
      });
    }
    const paidNow = draft.payMode === 'credit' ? 0 : Math.min(Math.max(0, draft.paidNow || 0), calc.total);
    if (paidNow < calc.total) {
      need(draft.client && draft.client.id, 'Un client enregistré est obligatoire pour une vente à crédit ou un paiement partiel (pas « client de passage »).');
      const c = draft.client;
      if (c.creditLimit) {
        const owed = J.clientBalance(c.id) + (calc.total - paidNow);
        need(owed <= c.creditLimit || J.isOwner(user), `Plafond de crédit dépassé pour ${c.name} (${J.fmt(c.creditLimit)}). Seul le propriétaire peut l'autoriser.`);
      }
    }
    const date = J.nowISO();
    const sale = {
      id: J.uid(), no: J.nextSlipNo(), date, type: 'vente', status: 'valide',
      sellerId: user.id, sellerName: user.name,
      clientId: draft.client ? draft.client.id || null : null,
      client: draft.client
        ? { name: draft.client.name, phone: draft.client.phone || '', address: draft.client.address || '', type: draft.client.type || 'particulier' }
        : { name: 'Client de passage', phone: '', address: '', type: 'particulier' },
      lines: calc.lines.map((l) => ({
        kind: l.kind, refId: l.refId, name: l.name, unit: l.unit, qty: Number(l.qty), unitPrice: l.unitPrice,
        priceType: l.priceType, priceReason: l.priceReason || '', discType: l.discType || 'pct', discValue: l.discValue || 0,
        gross: l.gross, disc: l.disc, total: l.total, globalShare: l.globalShare, net: l.net,
        serviceDate: l.serviceDate || '', serviceLocation: l.serviceLocation || '', cost: 0,
        extraCost: l.kind === 'service' ? Math.round(l.cost || 0) : 0,
      })),
      gross: calc.gross, lineDisc: calc.lineDisc, subtotal: calc.subtotal,
      globalDiscType: draft.globalDiscType || 'pct', globalDiscValue: draft.globalDiscValue || 0, globalDisc: calc.globalDisc,
      totalDisc: calc.totalDisc, total: calc.total,
      payMode: draft.payMode, payments: [], promiseDate: paidNow < calc.total ? draft.promiseDate || J.addDays(J.today(), s.creditDefaultDays) : '',
      received: draft.received || 0, change: 0, note: draft.note || '',
      usdRate: s.usdEnabled ? s.usdRate : 0,
    };
    if (paidNow > 0) {
      const received = Math.max(paidNow, draft.payMode === 'cash' ? draft.received || paidNow : paidNow);
      sale.received = received;
      sale.change = draft.payMode === 'cash' ? received - paidNow : 0;
      sale.payments.push({ id: J.uid(), date, amount: paidNow, mode: draft.payMode, userId: user.id, userName: user.name, atSale: true });
    }
    // Sorties de stock au coût moyen
    sale.lines.forEach((l) => {
      if (l.kind !== 'product') return;
      const p = J.byId('products', l.refId);
      const m = moveStock(p, -l.qty, 'vente', sale.no, '', J.dayKey(date));
      l.cost = m.value;
    });
    const e = J.saleEntry(sale);
    db().entries.push(e);
    sale.entryIds = [e.id];
    db().sales.push(sale);
    s.nextSlipNo += 1;
    J.audit(user, 'Vente', `${sale.no} — ${J.fmt(sale.total)}`);
    J.save();
    return sale;
  };

  J.addPayment = (saleId, amount, mode, user, received) => {
    const sale = J.byId('sales', saleId);
    need(sale && sale.status !== 'annulee', 'Fiche introuvable ou annulée.');
    const rest = J.saleRest(sale);
    need(amount > 0, 'Montant invalide.');
    need(amount <= rest, `Le montant dépasse le reste à payer (${J.fmt(rest)}).`);
    need(mode !== 'credit', 'Choisissez un mode de paiement.');
    const p = { id: J.uid(), date: J.nowISO(), amount, mode, userId: user.id, userName: user.name, received: received || amount };
    sale.payments.push(p);
    const e = J.paymentEntry(sale, p);
    db().entries.push(e);
    sale.entryIds = (sale.entryIds || []).concat(e.id);
    J.audit(user, 'Encaissement', `${sale.no} — ${J.fmt(amount)} (${J.payLabel(mode)})`);
    J.save();
    return p;
  };

  J.cancelSale = (saleId, reason, user) => {
    need(J.isOwner(user), 'Seul le propriétaire peut annuler une fiche.');
    need(reason && reason.trim().length >= 3, "Le motif d'annulation est obligatoire.");
    const sale = J.byId('sales', saleId);
    need(sale && sale.status !== 'annulee', 'Fiche déjà annulée.');
    const entries = db().entries.filter((e) => (sale.entryIds || []).includes(e.id));
    if (entries.length) {
      const rev = J.reverseEntries(entries, J.today(), `Annulation fiche ${sale.no} — ${reason}`, { type: 'annulation', id: sale.id });
      db().entries.push(rev);
      sale.entryIds.push(rev.id);
    }
    sale.lines.filter((l) => l.kind === 'product').forEach((l) => {
      const p = J.byId('products', l.refId);
      if (p) moveStock(p, l.qty, 'annulation', sale.no, reason, J.today(), l.qty ? Math.round(l.cost / l.qty) : p.avgCost);
    });
    sale.status = 'annulee';
    sale.cancel = { date: J.nowISO(), user: user.name, reason };
    J.audit(user, 'Annulation', `${sale.no} — ${reason}`);
    J.save();
  };

  /* ---------- Clients ---------- */
  J.clientSales = (clientId) => db().sales.filter((s) => s.clientId === clientId);
  J.clientBalance = (clientId) => J.clientSales(clientId).reduce((a, s) => a + J.saleRest(s), 0);
  J.loyaltyPoints = (clientId) => {
    const per = db().settings.loyaltyPer || 100000;
    const tot = J.clientSales(clientId).filter((s) => s.status !== 'annulee' && s.type === 'vente').reduce((a, s) => a + s.total, 0);
    return Math.floor(tot / per);
  };
  J.saveClient = (c, user) => {
    need(c.name && c.name.trim(), 'Le nom du client est obligatoire.');
    if (c.id) Object.assign(J.byId('clients', c.id), c);
    else { c.id = J.uid(); c.createdAt = J.nowISO(); db().clients.push(c); J.audit(user, 'Nouveau client', c.name); }
    J.save();
    return c;
  };

  /* ---------- Catalogue ---------- */
  J.saveProduct = (p, user) => {
    need(J.isOwner(user), 'Seul le propriétaire modifie le catalogue.');
    need(p.name && p.name.trim(), 'Le nom du produit est obligatoire.');
    need(p.retailPrice > 0, 'Le prix de détail est obligatoire.');
    if (!p.wholesalePrice) p.wholesalePrice = p.retailPrice;
    if (p.id) Object.assign(J.byId('products', p.id), p);
    else {
      Object.assign(p, { id: J.uid(), stock: 0, avgCost: p.buyPrice || 0, createdAt: J.nowISO() });
      db().products.push(p);
    }
    J.save();
    return p;
  };
  J.saveService = (s, user) => {
    need(J.isOwner(user), 'Seul le propriétaire modifie le catalogue.');
    need(s.name && s.name.trim(), 'Le nom du service est obligatoire.');
    if (s.id) Object.assign(J.byId('services', s.id), s);
    else { s.id = J.uid(); s.createdAt = J.nowISO(); db().services.push(s); }
    J.save();
    return s;
  };

  /* ---------- Fournisseurs et achats ---------- */
  J.saveSupplier = (f) => {
    need(f.name && f.name.trim(), 'Le nom du fournisseur est obligatoire.');
    if (f.id) Object.assign(J.byId('suppliers', f.id), f);
    else { f.id = J.uid(); db().suppliers.push(f); }
    J.save();
    return f;
  };
  J.supplierBalance = (id) => {
    const due = db().purchases.filter((p) => p.supplierId === id && p.status !== 'annule').reduce((a, p) => a + p.total - p.paid, 0);
    const paid = db().supplierPayments.filter((x) => x.supplierId === id).reduce((a, x) => a + x.amount, 0);
    return due - paid;
  };
  J.createPurchase = (d, user) => {
    need(J.isOwner(user), 'Seul le propriétaire enregistre les achats.');
    need(d.supplierId, 'Choisissez un fournisseur.');
    need(d.lines.length, "Ajoutez au moins un produit à l'achat.");
    const s = db().settings;
    const sup = J.byId('suppliers', d.supplierId);
    const lines = d.lines.map((l) => ({ productId: l.productId, qty: Number(l.qty), unitCost: l.unitCost, total: Math.round(Number(l.qty) * l.unitCost) }));
    lines.forEach((l) => need(l.qty > 0 && l.unitCost >= 0, 'Quantité ou coût invalide.'));
    const total = lines.reduce((a, l) => a + l.total, 0);
    const paid = d.payMode === 'credit' ? 0 : Math.min(total, d.paid == null ? total : d.paid);
    const p = {
      id: J.uid(), no: `${s.purchasePrefix}-${String(s.nextPurchaseNo).padStart(4, '0')}`, date: d.date || J.today(),
      supplierId: sup.id, supplierName: sup.name, lines, total, paid, payMode: d.payMode, dueDate: d.dueDate || '',
      ref: d.ref || '', note: d.note || '', attachment: d.attachment || null, status: 'valide', createdAt: J.nowISO(), user: user.name,
    };
    lines.forEach((l) => {
      const pr = J.byId('products', l.productId);
      pr.avgCost = J.newAvgCost(pr.stock || 0, pr.avgCost || 0, l.qty, l.unitCost);
      pr.buyPrice = l.unitCost;
      moveStock(pr, l.qty, 'achat', p.no, sup.name, p.date, l.unitCost);
    });
    const e = J.purchaseEntry(p);
    db().entries.push(e);
    p.entryId = e.id;
    db().purchases.push(p);
    s.nextPurchaseNo += 1;
    J.audit(user, 'Achat', `${p.no} — ${sup.name} — ${J.fmt(total)}`);
    J.save();
    return p;
  };
  J.paySupplier = (supplierId, amount, mode, date, user) => {
    need(J.isOwner(user), 'Seul le propriétaire paie les fournisseurs.');
    const bal = J.supplierBalance(supplierId);
    need(amount > 0 && amount <= bal, `Montant invalide (dette actuelle : ${J.fmt(bal)}).`);
    const sp = { id: J.uid(), supplierId, amount, mode, date: date || J.today(), user: user.name };
    db().supplierPayments.push(sp);
    db().entries.push(J.supplierPaymentEntry(sp, J.byId('suppliers', supplierId).name));
    J.save();
    return sp;
  };

  /* ---------- Pertes et inventaire ---------- */
  J.LOSS_REASONS = ['Fonte', 'Coupure de courant', 'Produit abîmé', 'Date dépassée', 'Vol / disparition', 'Autre'];
  J.declareLoss = (productId, qty, reason, note, user) => {
    need(J.isOwner(user) || db().settings.sellerCanDeclareLoss, 'Seul le propriétaire déclare les pertes.');
    const p = J.byId('products', productId);
    need(qty > 0 && qty <= (p.stock || 0), `Quantité invalide (stock : ${J.fmtQty(p.stock || 0)}).`);
    const m = moveStock(p, -qty, 'perte', '', `${reason}${note ? ' — ' + note : ''}`);
    db().entries.push(J.lossEntry(m, `Perte de stock — ${J.productLabel(p)} × ${J.fmtQty(qty)} (${reason})`));
    J.audit(user, 'Perte', `${J.productLabel(p)} × ${J.fmtQty(qty)} — ${reason}`);
    J.save();
    return m;
  };
  /** counts = { productId: quantité comptée }. Génère l'écart et l'écriture. */
  J.applyInventory = (counts, user) => {
    need(J.isOwner(user), "Seul le propriétaire valide l'inventaire.");
    const res = [];
    Object.keys(counts).forEach((id) => {
      const p = J.byId('products', id);
      const counted = Number(counts[id]);
      if (!isFinite(counted) || counted < 0) return;
      const diff = Math.round((counted - (p.stock || 0)) * 1000) / 1000;
      if (!diff) return;
      const m = moveStock(p, diff, 'inventaire', 'Inventaire', diff < 0 ? 'Manquant constaté' : 'Excédent constaté');
      const label = `Inventaire — ${J.productLabel(p)} : écart ${diff > 0 ? '+' : ''}${J.fmtQty(diff)}`;
      if (m.value) db().entries.push(diff < 0 ? J.lossEntry(m, label) : J.inventoryGainEntry(m, label));
      res.push({ product: p, diff, value: m.value });
    });
    J.audit(user, 'Inventaire', `${res.length} écart(s)`);
    J.save();
    return res;
  };

  /* ---------- Dépenses ---------- */
  J.addExpense = (e, user) => {
    need(e.amount > 0, 'Montant invalide.');
    need(e.category, 'Choisissez une catégorie.');
    Object.assign(e, { id: J.uid(), date: e.date || J.today(), user: user.name, createdAt: J.nowISO() });
    db().expenses.push(e);
    const en = J.expenseEntry(e);
    db().entries.push(en);
    e.entryId = en.id;
    J.audit(user, 'Dépense', `${J.fmt(e.amount)} — ${e.category}`);
    J.save();
    return e;
  };

  /* ---------- Caisse du jour ---------- */
  J.currentCash = () => db().cashSessions.find((c) => !c.closedAt);
  J.openCash = (amount, user) => {
    need(!J.currentCash(), 'La caisse est déjà ouverte.');
    const c = { id: J.uid(), day: J.today(), openedAt: J.nowISO(), openedBy: user.name, opening: amount, fromIdx: db().entries.length };
    db().cashSessions.push(c);
    J.audit(user, 'Ouverture de caisse', J.fmt(amount));
    J.save();
    return c;
  };
  /** Mouvements du compte Caisse (531) depuis l'ouverture, hors écarts de caisse. */
  J.cashMovements = (session) => {
    // On se base sur l'ordre des écritures (fiable même si deux opérations tombent à la même milliseconde)
    const to = session.toIdx != null ? session.toIdx : db().entries.length;
    const out = { sales: 0, collections: 0, expenses: 0, purchases: 0, other: 0 };
    db().entries.slice(session.fromIdx || 0, to).forEach((e) => {
      if (e.source && e.source.type === 'caisse') return;
      e.lines.filter((l) => l.account === '531').forEach((l) => {
        const v = l.debit - l.credit;
        const t = e.source && e.source.type;
        if (t === 'vente' || t === 'annulation') out.sales += v;
        else if (t === 'encaissement') out.collections += v;
        else if (t === 'depense') out.expenses += v;
        else if (t === 'achat' || t === 'paiement_fournisseur') out.purchases += v;
        else out.other += v;
      });
    });
    out.expected = session.opening + out.sales + out.collections + out.expenses + out.purchases + out.other;
    return out;
  };
  J.closeCash = (counted, note, user) => {
    const c = J.currentCash();
    need(c, "La caisse n'est pas ouverte.");
    const mv = J.cashMovements(c);
    c.toIdx = db().entries.length;
    c.closedAt = J.nowISO(); c.closedBy = user.name; c.counted = counted; c.expected = mv.expected;
    c.diff = counted - mv.expected; c.note = note || ''; c.detail = mv;
    if (c.diff) db().entries.push(J.cashDiffEntry(J.today(), c.diff, c.id));
    J.audit(user, 'Clôture de caisse', `compté ${J.fmt(counted)}, écart ${J.fmt(c.diff)}`);
    J.save();
    return c;
  };

  /* ---------- Trésorerie : apports, retraits, transferts ---------- */
  J.treasuryMove = (kind, amount, mode, mode2, label, date, user) => {
    need(J.isOwner(user), 'Réservé au propriétaire.');
    need(amount > 0, 'Montant invalide.');
    date = date || J.today();
    let e;
    const src = { type: 'tresorerie', id: J.uid() };
    if (kind === 'apport') e = J.makeEntry(date, label || 'Apport du propriétaire', src, [{ account: J.payAcc(mode), debit: amount }, { account: '108', credit: amount }]);
    else if (kind === 'retrait') e = J.makeEntry(date, label || 'Retrait du propriétaire', src, [{ account: '108', debit: amount }, { account: J.payAcc(mode), credit: amount }]);
    else {
      need(J.payAcc(mode) !== J.payAcc(mode2), 'Choisissez deux comptes différents.');
      e = J.makeEntry(date, label || `Transfert ${J.payLabel(mode)} → ${J.payLabel(mode2)}`, src, [{ account: J.payAcc(mode2), debit: amount }, { account: J.payAcc(mode), credit: amount }]);
    }
    db().entries.push(e);
    J.save();
    return e;
  };

  /* ---------- Bilan d'ouverture et immobilisations ---------- */
  /** o = { date, assets:[{name, acc, date, qty, cost, lifeMonths, accumulated}], stock:[{productId, qty, unitCost}],
   *        cash, bank, moncash, natcash, clientDebts:[{clientId, amount}], supplierDebts:[{supplierId, amount}], loans } */
  J.saveOpening = (o, user) => {
    need(J.isOwner(user), 'Réservé au propriétaire.');
    (o.assets || []).forEach((a) => {
      if (a.accumulated == null || a.accumulated === '') {
        a.accumulated = J.accumulatedBefore({ cost: a.cost, residual: a.residual, lifeMonths: a.lifeMonths, depStart: (a.serviceDate || a.date || o.date).slice(0, 7) }, (o.date || '').slice(0, 7));
      }
    });
    need(!db().opening.done, "Le bilan d'ouverture est déjà validé.");
    need(o.date, 'Indiquez la date de départ.');
    const stockValue = (o.stock || []).reduce((a, s) => a + Math.round(s.qty * s.unitCost), 0);
    const receivables = (o.clientDebts || []).reduce((a, d) => a + d.amount, 0);
    const payables = (o.supplierDebts || []).reduce((a, d) => a + d.amount, 0);
    const e = J.openingEntry({
      date: o.date, assets: o.assets, stockValue, cash: o.cash, bank: o.bank, moncash: o.moncash, natcash: o.natcash,
      receivables, payables, loans: o.loans,
    });
    db().entries.push(e);
    (o.assets || []).forEach((a) => {
      const cat = J.ASSET_CATEGORIES.find((c) => c.acc === a.acc);
      db().assets.push(Object.assign({ id: J.uid(), dep: cat.dep, depPosted: 0, residual: 0, qty: 1, atOpening: true }, a,
        { depStart: (a.serviceDate || a.date || o.date).slice(0, 7) }));
    });
    (o.stock || []).forEach((s) => {
      const p = J.byId('products', s.productId);
      p.avgCost = s.unitCost;
      moveStock(p, s.qty, 'ouverture', "Bilan d'ouverture", '', o.date, s.unitCost);
    });
    (o.clientDebts || []).forEach((d) => {
      const c = J.byId('clients', d.clientId);
      db().sales.push({
        id: J.uid(), no: 'SOLDE-OUV', date: new Date(o.date + 'T12:00:00Z').toISOString(), type: 'ouverture', status: 'valide',
        clientId: c.id, client: { name: c.name, phone: c.phone || '', address: c.address || '', type: c.type },
        sellerName: user.name, lines: [{ kind: 'ouverture', name: "Solde dû à l'ouverture", qty: 1, unit: '', unitPrice: d.amount, total: d.amount, net: d.amount }],
        total: d.amount, subtotal: d.amount, gross: d.amount, totalDisc: 0, payments: [], entryIds: [], promiseDate: '',
      });
    });
    (o.supplierDebts || []).forEach((d) => {
      const f = J.byId('suppliers', d.supplierId);
      db().purchases.push({ id: J.uid(), no: 'SOLDE-OUV', date: o.date, supplierId: f.id, supplierName: f.name, lines: [], total: d.amount, paid: 0, payMode: 'credit', status: 'valide', type: 'ouverture' });
    });
    db().opening = Object.assign({ done: true, capital: e.capital, entryId: e.id, validatedAt: J.nowISO(), by: user.name }, o);
    db().depPostedUntil = J.monthKey(new Date(Date.UTC(+o.date.slice(0, 4), +o.date.slice(5, 7) - 2, 15)).toISOString());
    J.audit(user, "Bilan d'ouverture", `capital ${J.fmt(e.capital)}`);
    J.save();
    return e;
  };
  /** Achat d'un équipement après l'ouverture : payé, à crédit (401) ou en partie. */
  J.addAsset = (a, mode, user, paid) => {
    need(J.isOwner(user), 'Réservé au propriétaire.');
    need(a.name && a.cost > 0 && a.lifeMonths > 0, 'Nom, coût et durée de vie obligatoires.');
    need(a.date, "Indiquez la date d'achat.");
    need(!a.residual || a.residual < a.cost, 'La valeur résiduelle doit être inférieure au coût.');
    const cat = J.ASSET_CATEGORIES.find((c) => c.acc === a.acc);
    const start = (a.serviceDate || a.date).slice(0, 7);
    const asset = Object.assign({ id: J.uid(), dep: cat.dep, depPosted: 0, accumulated: 0, residual: 0, qty: 1 }, a, { depStart: start, createdAt: J.nowISO() });
    const pay = mode === 'credit' ? 0 : Math.min(a.cost, paid == null ? a.cost : paid);
    const lines = [{ account: a.acc, debit: a.cost }];
    if (pay > 0) lines.push({ account: J.payAcc(mode), credit: pay });
    if (a.cost - pay > 0) lines.push({ account: '401', credit: a.cost - pay });
    const e = J.makeEntry(a.date, `Acquisition — ${a.name}`, { type: 'immobilisation', id: asset.id }, lines);
    db().entries.push(e);
    asset.entryId = e.id;
    asset.paid = pay; asset.payMode = mode;
    db().assets.push(asset);
    // un équipement acheté avant le dernier mois amorti : on rattrape au prochain calcul
    if (db().depPostedUntil && start <= db().depPostedUntil) asset.catchUpFrom = start;
    if (!db().depPostedUntil) db().depPostedUntil = J.monthKey(new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 2, 15)).toISOString());
    J.audit(user, 'Immobilisation', `${a.name} — ${J.fmt(a.cost)}`);
    J.save();
    return asset;
  };
  /** Dotation d'un mois pour une liste de biens → lignes d'écriture. */
  const depLines = (assets, m) => {
    const lines = [];
    assets.forEach((a) => {
      const v = J.depForMonth(a, m);
      if (v > 0) { lines.push({ account: '681', act: a.act || 'C', debit: v }, { account: a.dep, credit: v }); a.depPosted = (a.depPosted || 0) + v; a.lastDepMonth = m; }
    });
    return lines;
  };
  /** Passe les amortissements mensuels jusqu'au mois indiqué (inclus), une écriture par mois. */
  J.postDepreciation = (untilMonth, user) => {
    need(J.isOwner(user), 'Réservé au propriétaire.');
    need(db().assets.length, 'Aucune immobilisation enregistrée.');
    let count = 0;
    // rattrapage des biens ajoutés avec une date de mise en service déjà passée
    db().assets.filter((a) => a.catchUpFrom).forEach((a) => {
      let m = a.catchUpFrom;
      while (m <= db().depPostedUntil && m <= untilMonth) {
        const lines = depLines([a], m);
        if (lines.length) { db().entries.push(J.makeEntry(J.lastDayOfMonth(m), `Amortissement (rattrapage) ${m.slice(5)}/${m.slice(0, 4)} — ${a.name}`, { type: 'amortissement', month: m, asset: a.id }, lines)); count++; }
        m = J.nextMonth(m);
      }
      delete a.catchUpFrom;
    });
    let m = db().depPostedUntil ? J.nextMonth(db().depPostedUntil) : db().assets.map((a) => a.depStart).sort()[0];
    while (m <= untilMonth) {
      const lines = depLines(db().assets, m);
      if (lines.length) { db().entries.push(J.makeEntry(J.lastDayOfMonth(m), `Amortissements du mois ${m.slice(5)}/${m.slice(0, 4)}`, { type: 'amortissement', month: m }, lines)); count++; }
      db().depPostedUntil = m;
      m = J.nextMonth(m);
    }
    if (count) J.audit(user, 'Amortissements', `jusqu'à ${untilMonth}`);
    J.save();
    return count;
  };
  /** Sortie d'un bien : vente ou mise au rebut. Amortit jusqu'au mois de sortie, puis sort le bien du bilan. */
  J.disposeAsset = (id, d, user) => {
    need(J.isOwner(user), 'Réservé au propriétaire.');
    const a = J.byId('assets', id);
    need(a && !a.disposedMonth, 'Bien introuvable ou déjà sorti.');
    need(d.date, 'Indiquez la date de sortie.');
    const month = d.date.slice(0, 7);
    need(month >= a.depStart, 'La date de sortie est avant la mise en service.');
    // amortissements du bien non encore passés jusqu'au mois de sortie
    let m = db().depPostedUntil && db().depPostedUntil >= a.depStart ? J.nextMonth(db().depPostedUntil) : a.depStart;
    if (a.catchUpFrom) { m = a.catchUpFrom; delete a.catchUpFrom; }
    const dl = [];
    while (m <= month) { dl.push(...depLines([a], m)); m = J.nextMonth(m); }
    a.disposedMonth = month;
    const cum = (a.accumulated || 0) + (a.depPosted || 0);
    const nbv = a.cost - cum;
    const lines = dl.slice();
    if (cum) lines.push({ account: a.dep, debit: cum });
    if (nbv) lines.push({ account: '675', act: a.act || 'C', debit: nbv });
    lines.push({ account: a.acc, credit: a.cost });
    const price = d.price || 0;
    if (price > 0) lines.push({ account: d.mode === 'credit' ? '411' : J.payAcc(d.mode), debit: price }, { account: '775', act: a.act || 'C', credit: price });
    const e = J.makeEntry(d.date, `${price > 0 ? 'Vente' : 'Mise au rebut'} — ${a.name}${d.reason ? ' (' + d.reason + ')' : ''}`, { type: 'cession', id: a.id }, lines);
    db().entries.push(e);
    a.disposal = { date: d.date, price, mode: d.mode, reason: d.reason || '', nbv, gain: price - nbv, entryId: e.id };
    J.audit(user, 'Sortie immobilisation', `${a.name} — VNC ${J.fmt(nbv)}, prix ${J.fmt(price)}`);
    J.save();
    return a.disposal;
  };

  /* ---------- Rapports ---------- */
  J.salesIn = (from, to) => db().sales.filter((s) => s.type === 'vente' && s.status !== 'annulee' && J.inRange(J.dayKey(s.date), from, to));
  J.salesReport = (from, to) => {
    const sales = J.salesIn(from, to);
    const act = { S: 0, G: 0, D: 0 };
    const byItem = {}; const byClient = {}; const bySeller = {}; const byDay = {};
    let cost = 0; let disc = 0;
    sales.forEach((s) => {
      disc += s.totalDisc || 0;
      byClient[s.client.name] = (byClient[s.client.name] || 0) + s.total;
      bySeller[s.sellerName] = (bySeller[s.sellerName] || 0) + s.total;
      const d = J.dayKey(s.date); byDay[d] = (byDay[d] || 0) + s.total;
      s.lines.forEach((l) => {
        const a = l.kind === 'service' ? 'S' : l.priceType === 'gros' ? 'G' : 'D';
        act[a] += l.net;
        const c = l.kind === 'service' ? l.extraCost || 0 : l.cost || 0;
        cost += c;
        const k = l.kind + '|' + l.refId;
        if (!byItem[k]) byItem[k] = { name: l.name, kind: l.kind, unit: l.unit, qty: 0, amount: 0, cost: 0 };
        byItem[k].qty += l.qty; byItem[k].amount += l.net; byItem[k].cost += c;
      });
    });
    const total = act.S + act.G + act.D;
    const items = Object.values(byItem).map((i) => Object.assign(i, { margin: i.amount - i.cost })).sort((a, b) => b.amount - a.amount);
    const sortObj = (o) => Object.entries(o).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    const collected = db().sales.reduce((a, s) => a + (s.payments || []).filter((p) => J.inRange(J.dayKey(p.date), from, to)).reduce((x, p) => x + p.amount, 0), 0);
    return { count: sales.length, total, act, items, byClient: sortObj(byClient), bySeller: sortObj(bySeller), byDay, cost, margin: total - cost, disc, collected };
  };
  J.receivables = () => {
    const today = J.today();
    const rows = {};
    db().sales.forEach((s) => {
      const r = J.saleRest(s);
      if (r <= 0) return;
      const k = s.clientId || 'passage';
      if (!rows[k]) rows[k] = { clientId: s.clientId, name: s.client.name, phone: s.client.phone, amount: 0, oldest: J.dayKey(s.date), sales: [], overdue: false };
      rows[k].amount += r; rows[k].sales.push(s);
      if (J.dayKey(s.date) < rows[k].oldest) rows[k].oldest = J.dayKey(s.date);
      if (s.promiseDate && s.promiseDate < today) rows[k].overdue = true;
    });
    return Object.values(rows).map((r) => Object.assign(r, { days: J.daysBetween(r.oldest, today) })).sort((a, b) => b.days - a.days);
  };
  /** Prévision d'achat : vente moyenne / jour sur 14 jours → jours de stock restants. */
  J.forecast = () => {
    const from = J.addDays(J.today(), -13);
    const sold = {};
    J.salesIn(from, null).forEach((s) => s.lines.forEach((l) => { if (l.kind === 'product') sold[l.refId] = (sold[l.refId] || 0) + l.qty; }));
    return db().products.filter((p) => p.active !== false).map((p) => {
      const perDay = (sold[p.id] || 0) / 14;
      const days = perDay > 0 ? (p.stock || 0) / perDay : null;
      const suggest = perDay > 0 ? Math.max(0, Math.ceil(perDay * 7 - (p.stock || 0))) : 0;
      return { p, perDay, days, suggest };
    }).sort((a, b) => (a.days == null ? 1e9 : a.days) - (b.days == null ? 1e9 : b.days));
  };
  /** Produits qui dorment : en stock mais non vendus depuis N jours (risque de fonte / qualité). */
  J.sleepingStock = (days) => {
    const lastSale = {};
    db().sales.forEach((s) => { if (s.status !== 'annulee') s.lines.forEach((l) => { if (l.kind === 'product') { const d = J.dayKey(s.date); if (!lastSale[l.refId] || d > lastSale[l.refId]) lastSale[l.refId] = d; } }); });
    const lastIn = {};
    db().stockMoves.forEach((m) => { if (m.qty > 0 && (!lastIn[m.productId] || m.date > lastIn[m.productId])) lastIn[m.productId] = m.date; });
    return db().products.filter((p) => (p.stock || 0) > 0).map((p) => {
      const ref = lastSale[p.id] || lastIn[p.id] || J.today();
      return { p, since: J.daysBetween(ref, J.today()) };
    }).filter((x) => x.since >= days);
  };
})(typeof window !== 'undefined' ? window : globalThis);
