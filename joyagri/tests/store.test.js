/* Scénario complet d'une journée JOYAGRI : node tests/store.test.js */
'use strict';
const assert = require('assert');
const J = require('../js/core.js');
require('../js/store.js');
J.save = () => {}; // pas de disque pendant les tests

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
J.db = J.newDB();
const owner = J.createUser('Propriétaire', 'patron', 'owner', 'secret1');
const seller = J.createUser('Vendeur A', 'vendeur', 'seller', 'vente1');
const balanced = () => assert.ok(J.trialBalance(J.db.entries, J.db.accounts).balanced, 'balance déséquilibrée');

const cone = J.saveProduct({ name: 'Cornet vanille', format: 'Cornet', unit: 'unité', buyPrice: 3000, wholesalePrice: 4000, retailPrice: 5000, minWholesaleQty: 24, lowStock: 10 }, owner);
const pot = J.saveProduct({ name: 'Pot chocolat', format: '1 litre', unit: 'pot', buyPrice: 30000, wholesalePrice: 40000, retailPrice: 50000, minWholesaleQty: 6 }, owner);
const labour = J.saveService({ name: 'Labour au tracteur', unit: 'hectare', price: 500000, costPerUnit: 150000 }, owner);
const client = J.saveClient({ name: 'Marie Exemple', phone: '37000000', type: 'particulier', creditLimit: 0 }, owner);
const gros = J.saveClient({ name: 'Boutique Exemple', phone: '38000000', type: 'grossiste' }, owner);
const sup = J.saveSupplier({ name: 'Fournisseur Exemple' });

t("bilan d'ouverture", () => {
  const e = J.saveOpening({
    date: '2026-11-01',
    assets: [{ name: 'Panneaux + batteries', acc: '2181', date: '2025-06-01', qty: 1, cost: 25000000, lifeMonths: 120, accumulated: 3000000 },
      { name: 'Congélateur', acc: '2185', date: '2026-01-10', qty: 2, cost: 6000000, lifeMonths: 60, accumulated: 0 }],
    stock: [{ productId: cone.id, qty: 50, unitCost: 3000 }],
    cash: 500000, bank: 1000000, clientDebts: [{ clientId: client.id, amount: 20000 }], supplierDebts: [{ supplierId: sup.id, amount: 100000 }],
  }, owner);
  assert.strictEqual(e.capital, 25000000 - 3000000 + 6000000 + 150000 + 500000 + 1000000 + 20000 - 100000);
  assert.strictEqual(cone.stock, 50);
  assert.strictEqual(J.clientBalance(client.id), 20000);
  assert.strictEqual(J.supplierBalance(sup.id), 100000);
  balanced();
});

t('achat à crédit partiel : stock et coût moyen', () => {
  J.createPurchase({ supplierId: sup.id, payMode: 'cash', paid: 100000, lines: [{ productId: cone.id, qty: 50, unitCost: 3400 }, { productId: pot.id, qty: 10, unitCost: 30000 }] }, owner);
  assert.strictEqual(cone.stock, 100);
  assert.strictEqual(cone.avgCost, 3200);
  assert.strictEqual(J.supplierBalance(sup.id), 100000 + 470000 - 100000);
  balanced();
});

t('caisse ouverte', () => { J.openCash(200000, seller); });

let s1;
t('vente au détail payée cash avec monnaie rendue', () => {
  s1 = J.createSale({ client: null, lines: [{ kind: 'product', refId: cone.id, qty: 3, discType: 'pct', discValue: 0 }], payMode: 'cash', paidNow: 15000, received: 20000 }, seller);
  assert.strictEqual(s1.total, 15000); assert.strictEqual(s1.change, 5000);
  assert.strictEqual(s1.lines[0].priceType, 'detail');
  assert.strictEqual(s1.lines[0].cost, 9600);
  assert.strictEqual(cone.stock, 97);
  balanced();
});

t('vente en gros (quantité) + service, moitié payée, reste à crédit', () => {
  const s = J.createSale({
    client, payMode: 'moncash', paidNow: 300000, globalDiscType: 'pct', globalDiscValue: 5,
    lines: [{ kind: 'product', refId: cone.id, qty: 24, discType: 'pct', discValue: 0 },
      { kind: 'service', refId: labour.id, qty: 1, discType: 'amt', discValue: 0, serviceDate: '2026-11-30', serviceLocation: 'Ravine Sèche', cost: 120000 }],
  }, seller);
  assert.strictEqual(s.lines[0].priceType, 'gros');
  assert.strictEqual(s.total, Math.round((96000 + 500000) * 0.95));
  assert.strictEqual(J.saleRest(s), s.total - 300000);
  assert.strictEqual(J.payStatus(s), 'partielle');
  balanced();
  J.addPayment(s.id, J.saleRest(s), 'cash', seller);
  assert.strictEqual(J.payStatus(s), 'payee');
  balanced();
});

t('client grossiste = prix de gros dès 1 unité', () => {
  const s = J.createSale({ client: gros, lines: [{ kind: 'product', refId: pot.id, qty: 1 }], payMode: 'credit' }, seller);
  assert.strictEqual(s.lines[0].unitPrice, 40000);
  assert.strictEqual(J.payStatus(s), 'credit');
  balanced();
});

t('refus : client de passage à crédit, réduction vendeur trop forte, stock insuffisant', () => {
  assert.throws(() => J.createSale({ client: null, lines: [{ kind: 'product', refId: cone.id, qty: 1 }], payMode: 'credit' }, seller), /client enregistré/);
  assert.throws(() => J.createSale({ client: null, lines: [{ kind: 'product', refId: cone.id, qty: 1, discType: 'pct', discValue: 50 }], payMode: 'cash', paidNow: 2500 }, seller), /Réduction trop forte/);
  assert.throws(() => J.createSale({ client: null, lines: [{ kind: 'product', refId: pot.id, qty: 999 }], payMode: 'cash', paidNow: 1 }, seller), /Stock insuffisant/);
});

t('annulation : seulement le propriétaire, stock remis, écritures contre-passées', () => {
  assert.throws(() => J.cancelSale(s1.id, 'Erreur de saisie', seller), /propriétaire/);
  J.cancelSale(s1.id, 'Erreur de saisie', owner);
  assert.strictEqual(s1.status, 'annulee');
  assert.strictEqual(cone.stock, 73 + 3);
  assert.ok(J.db.sales.includes(s1), 'la fiche est gardée');
  balanced();
});

t('perte (fonte) et inventaire', () => {
  J.declareLoss(cone.id, 2, 'Fonte', 'coupure de courant la nuit', owner);
  assert.strictEqual(cone.stock, 74);
  J.applyInventory({ [cone.id]: 72, [pot.id]: 9 }, owner);
  assert.strictEqual(cone.stock, 72);
  balanced();
});

t('dépense cash et clôture de caisse avec écart', () => {
  J.addExpense({ category: 'glace', amount: 25000, mode: 'cash' }, seller);
  const mv = J.cashMovements(J.currentCash());
  const expected = 200000 + 15000 - 15000 + (Math.round(596000 * 0.95) - 300000) - 25000;
  assert.strictEqual(mv.expected, expected);
  const c = J.closeCash(expected - 500, '', seller);
  assert.strictEqual(c.diff, -500);
  balanced();
});

t('amortissements mensuels', () => {
  const k = J.postDepreciation('2026-12', owner);
  assert.strictEqual(k, 2);
  const tb = J.trialBalance(J.db.entries, J.db.accounts);
  const dep = tb.rows.find((r) => r.code === '681').solde;
  assert.strictEqual(dep, 2 * (Math.round(25000000 / 120) + 100000));
  balanced();
});

t('bilan équilibré, résultat par activité, rapports', () => {
  const bs = J.balanceSheet(J.db.entries, J.db.accounts, '2099-12-31');
  assert.ok(bs.balanced, `bilan ${bs.totalAssets} ≠ ${bs.totalLiab}`);
  const is = J.incomeStatement(J.db.entries, J.db.accounts);
  assert.ok(is.byAct.S.rev > 0 && is.byAct.GL.rev > 0);
  const r = J.salesReport(null, null);
  assert.strictEqual(r.count, 2);
  assert.strictEqual(r.total, r.act.S + r.act.G + r.act.D);
  assert.strictEqual(J.receivables().length, 2);
});

t('mot de passe : changé sans l’ancien, jamais en clair', () => {
  J.setPassword(seller.id, 'nouveau9');
  assert.ok(J.checkPassword(seller, 'nouveau9'));
  assert.ok(!J.checkPassword(seller, 'vente1'));
  assert.ok(!JSON.stringify(J.db).includes('nouveau9'));
});

console.log(`\n${n} tests réussis.`);
