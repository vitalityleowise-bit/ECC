/* JOYAGRI — données FICTIVES pour l'entraînement et les captures d'écran (aucune donnée réelle). */
(function (root) {
  'use strict';
  const J = root.J;
  const C = (htg) => Math.round(htg * 100);
  J.loadDemo = (user) => {
    const P = (name, kind, format, unit, buy, gros, det, min, low) => J.saveProduct({ name, kind, format, unit, buyPrice: C(buy), wholesalePrice: C(gros), retailPrice: C(det), minWholesaleQty: min, lowStock: low, active: true }, user);
    const vanille = P('Vanille', 'Cornet', '120 ml', 'cornet', 30, 40, 50, 24, 20);
    const choco = P('Chocolat', 'Gobelet', '150 ml', 'gobelet', 35, 45, 60, 24, 20);
    const fraise = P('Fraise', 'Bâton', 'bâtonnet', 'bâton', 20, 28, 35, 30, 25);
    const coco = P('Coco', 'Pot', '1 litre', 'pot', 300, 380, 450, 6, 5);
    const mix = P('Mix tropical', 'Seau', '5 litres', 'seau', 1200, 1500, 1750, 4, 2);
    const S = (name, unit, price, cost, description, equipment) => J.saveService({ name, unit, price: C(price), costPerUnit: C(cost), description, equipment, active: true }, user);
    const labour = S('Labour au tracteur', 'hectare', 6500, 2200, 'Labour profond avec charrue à disques', 'Tracteur + charrue');
    const prep = S('Préparation de terrain', 'carreau', 9000, 3000, 'Labour + hersage', 'Tracteur + herse');
    const transp = S('Transport de récolte', 'voyage', 2500, 900, 'Remorque, rayon 15 km', 'Tracteur + remorque');
    S('Conseil agricole', 'forfait', 1500, 0, 'Visite et recommandations', '');
    const cl = (name, phone, type, address, limit) => J.saveClient({ name, phone, type, address, creditLimit: limit ? C(limit) : 0 }, user);
    const marie = cl('Marie Exemple', '3700 0001', 'particulier', 'Petit-Goâve', 5000);
    const bout = cl('Boutique Exemple', '3700 0002', 'grossiste', 'Grand-Goâve', 0);
    const jean = cl('Jean Exemple', '3700 0003', 'particulier', 'Ravine Sèche', 0);
    const ferme = cl('Coopérative Exemple', '3700 0004', 'particulier', 'Meilleure Eau', 0);
    const fr = J.saveSupplier({ name: 'Fournisseur Glaces Exemple', phone: '3700 0009', terms: 'Crédit 15 jours' });
    const start = J.addDays(J.today(), -12);
    J.saveOpening({
      date: start,
      assets: [
        { name: 'Installation solaire (6 panneaux, 4 batteries, onduleur)', acc: '2181', date: J.addDays(start, -300), qty: 1, cost: C(240000), lifeMonths: 120, act: 'GL' },
        { name: 'Congélateur horizontal 300 L', acc: '2185', date: J.addDays(start, -200), qty: 2, cost: C(90000), lifeMonths: 60, act: 'GL' },
        { name: 'Glacières (igloos) 120 L', acc: '2186', date: J.addDays(start, -90), qty: 4, cost: C(24000), lifeMonths: 36, act: 'GL' },
        { name: 'Imprimante thermique + téléphone', acc: '2183', date: J.addDays(start, -30), qty: 1, cost: C(18000), lifeMonths: 36 },
      ],
      stock: [{ productId: vanille.id, qty: 120, unitCost: C(30) }, { productId: choco.id, qty: 80, unitCost: C(35) }, { productId: fraise.id, qty: 150, unitCost: C(20) }, { productId: coco.id, qty: 20, unitCost: C(300) }, { productId: mix.id, qty: 6, unitCost: C(1200) }],
      cash: C(15000), bank: C(60000), moncash: C(8000), natcash: 0,
      clientDebts: [{ clientId: jean.id, amount: C(1200) }], supplierDebts: [{ supplierId: fr.id, amount: C(10000) }], loans: 0,
    }, user);
    const shift = (sale, days, hour) => {
      const d = new Date(Date.now() - days * 86400000);
      d.setUTCHours(hour + 5, Math.floor(Math.random() * 59));
      const iso = d.toISOString();
      const key = J.dayKey(iso);
      sale.date = iso;
      (sale.payments || []).forEach((p) => { p.date = iso; });
      J.db.entries.filter((e) => (sale.entryIds || []).includes(e.id)).forEach((e) => { e.date = key; e.createdAt = iso; });
      J.db.stockMoves.filter((m) => m.ref === sale.no).forEach((m) => { m.date = key; });
      if (sale.promiseDate) sale.promiseDate = J.addDays(key, 15);
    };
    const sell = (days, hour, client, lines, payMode, paidNow, extra) => {
      const s = J.createSale(Object.assign({ client, lines, payMode, paidNow }, extra || {}), user);
      shift(s, days, hour);
      return s;
    };
    const pl = (p, qty, d) => Object.assign({ kind: 'product', refId: p.id, qty, discType: 'pct', discValue: 0 }, d || {});
    const tot = (lines, client) => J.saleCalc(J.resolveDraft({ client, lines })).total;
    const plan = [
      [10, 10, null, [pl(vanille, 4), pl(fraise, 3)], 'cash'], [10, 15, bout, [pl(choco, 24), pl(vanille, 24)], 'moncash'],
      [9, 9, ferme, [{ kind: 'service', refId: labour.id, qty: 2, unitPrice: C(6500), serviceDate: J.addDays(J.today(), -9), serviceLocation: 'Meilleure Eau', cost: C(4200), discType: 'pct', discValue: 0 }], 'virement'],
      [8, 13, null, [pl(coco, 1), pl(vanille, 2)], 'cash'], [7, 16, marie, [pl(mix, 1)], 'natcash'], [6, 11, null, [pl(fraise, 6)], 'cash'],
      [5, 12, bout, [pl(fraise, 30), pl(coco, 2)], 'cash'], [4, 10, jean, [{ kind: 'service', refId: transp.id, qty: 3, unitPrice: C(2500), serviceDate: J.addDays(J.today(), -4), serviceLocation: 'Ravine Sèche', cost: C(2700), discType: 'pct', discValue: 0 }], 'cash'],
      [3, 15, null, [pl(choco, 5), pl(vanille, 5)], 'cash'], [2, 14, marie, [pl(vanille, 6, { discType: 'pct', discValue: 10 })], 'moncash'], [1, 9, ferme, [{ kind: 'service', refId: prep.id, qty: 1.5, unitPrice: C(9000), serviceDate: J.addDays(J.today(), 2), serviceLocation: 'Parcelle nord', cost: C(4500), discType: 'pct', discValue: 0 }], 'cash'],
    ];
    plan.forEach(([d, hr, c, lines, mode]) => sell(d, hr, c, lines, mode, tot(lines, c)));
    // ventes avec crédit et paiement partiel
    const cr1 = [pl(choco, 24), pl(coco, 3)];
    sell(3, 17, bout, cr1, 'cash', Math.round(tot(cr1, bout) / 2));
    const cr2 = [{ kind: 'service', refId: labour.id, qty: 1, unitPrice: C(6500), serviceDate: J.addDays(J.today(), -2), serviceLocation: 'Ravine Sèche', cost: C(2100), discType: 'pct', discValue: 0 }];
    sell(2, 8, jean, cr2, 'credit', 0);
    J.createPurchase({ supplierId: fr.id, date: J.addDays(J.today(), -6), payMode: 'cash', paid: C(5000), lines: [{ productId: vanille.id, qty: 100, unitCost: C(31) }, { productId: choco.id, qty: 60, unitCost: C(35) }], ref: 'FAC-0001' }, user);
    [['electricite', 1500, 'Recharge EDH', 8], ['glace', 600, 'Sacs de glace pour igloos', 5], ['services', 2500, 'Gasoil tracteur', 4], ['transport', 400, 'Moto taxi', 2]].forEach(([category, amt, description, d]) => {
      J.addExpense({ category, amount: C(amt), description, mode: 'cash', date: J.addDays(J.today(), -d) }, user);
    });
    J.declareLoss(fraise.id, 4, 'Coupure de courant', 'nuit sans soleil, batteries faibles', user);
    // aujourd'hui
    J.openCash(C(5000), user);
    const t1 = [pl(vanille, 3), pl(fraise, 2)];
    J.createSale({ client: null, lines: t1, payMode: 'cash', paidNow: tot(t1, null), received: C(250) }, user);
    const t2 = [pl(coco, 6)];
    J.createSale({ client: marie, lines: t2, payMode: 'moncash', paidNow: tot(t2, marie) }, user);
    J.postDepreciation(J.monthKey(), user);
    J.saveNow();
  };
})(window);
