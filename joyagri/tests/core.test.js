/* Tests des calculs JOYAGRI : node tests/core.test.js */
'use strict';
const assert = require('assert');
const J = require('../js/core.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };

t('format haïtien des montants', () => {
  assert.strictEqual(J.fmt(1250000), '12 500 HTG');
  assert.strictEqual(J.fmt(1250050), '12 500,50 HTG');
  assert.strictEqual(J.fmt(-500), '-5 HTG');
  assert.strictEqual(J.toC('12 500,50'), 1250050);
  assert.strictEqual(J.toC('1.5'), 150);
});

t('dates JJ/MM/AAAA, fuseau Haïti', () => {
  assert.strictEqual(J.fmtDate('2026-10-06'), '06/10/2026');
  // 03:30 UTC le 7 = encore le 6 au soir en Haïti
  assert.strictEqual(J.dayKey('2026-10-07T03:30:00Z'), '2026-10-06');
  assert.strictEqual(J.daysBetween('2026-01-30', '2026-03-01'), 30);
  assert.strictEqual(J.startOfWeek('2026-11-28'), '2026-11-23');
});

const cone = { wholesalePrice: 4000, retailPrice: 5000, minWholesaleQty: 24 };
t('prix gros / détail avec raison', () => {
  assert.deepStrictEqual(J.priceFor(cone, 2, { type: 'particulier' }).type, 'detail');
  const q = J.priceFor(cone, 24, null);
  assert.strictEqual(q.type, 'gros'); assert.match(q.reason, /Quantité/);
  assert.strictEqual(J.priceFor(cone, 1, { type: 'grossiste' }).reason, 'Client grossiste / revendeur');
});

const sale = {
  lines: [
    { kind: 'product', priceType: 'detail', qty: 3, unitPrice: 5000, discType: 'pct', discValue: 10, cost: 9000 },
    { kind: 'product', priceType: 'gros', qty: 24, unitPrice: 4000, discType: 'amt', discValue: 2000, cost: 72000 },
    { kind: 'service', qty: 1.5, unitPrice: 300000, discType: 'pct', discValue: 0 },
  ],
  globalDiscType: 'amt', globalDiscValue: 10001,
};
t('totaux, réductions par ligne et globale', () => {
  const c = J.saleCalc(sale);
  assert.strictEqual(c.lines[0].total, 13500); // 15000 - 10 %
  assert.strictEqual(c.lines[1].total, 94000); // 96000 - 20 HTG
  assert.strictEqual(c.lines[2].total, 450000); // 1,5 ha × 3000
  assert.strictEqual(c.subtotal, 557500);
  assert.strictEqual(c.total, 547499);
  assert.strictEqual(c.lines.reduce((a, l) => a + l.globalShare, 0), 10001, 'réduction globale répartie exactement');
  assert.strictEqual(c.lines.reduce((a, l) => a + l.net, 0), c.total);
});

t('réduction jamais supérieure au montant', () => {
  assert.strictEqual(J.lineCalc({ qty: 1, unitPrice: 1000, discType: 'amt', discValue: 5000 }).total, 0);
  assert.strictEqual(J.lineCalc({ qty: 1, unitPrice: 1000, discType: 'pct', discValue: 150 }).total, 0);
});

t('paiement partiel, reste à payer, statut', () => {
  const s = { total: 100000, status: 'valide', payments: [{ amount: 50000 }] };
  assert.strictEqual(J.saleRest(s), 50000); assert.strictEqual(J.payStatus(s), 'partielle');
  s.payments.push({ amount: 50000 }); assert.strictEqual(J.payStatus(s), 'payee');
  assert.strictEqual(J.payStatus({ total: 1, payments: [] }), 'credit');
});

const bal = (e) => e.lines.reduce((a, l) => a + l.debit - l.credit, 0);
t('écriture de vente équilibrée avec comptes séparés par activité', () => {
  const c = J.saleCalc(sale);
  const s = Object.assign({ id: 'x', no: 'F-1', date: '2026-11-28T15:00:00Z', client: { name: 'Test' } }, c, {
    lines: c.lines, payments: [{ amount: 200000, mode: 'cash', atSale: true }],
  });
  const e = J.saleEntry(s);
  assert.strictEqual(bal(e), 0);
  const get = (a) => e.lines.filter((l) => l.account === a).reduce((x, l) => x + l.debit - l.credit, 0);
  assert.strictEqual(get('7061') + get('7071') + get('7072'), -547499);
  assert.strictEqual(get('531'), 200000);
  assert.strictEqual(get('411'), 347499);
  assert.strictEqual(get('37'), -81000);
  const rev = J.reverseEntries([e], '2026-11-29', 'Annulation', {});
  assert.strictEqual(bal(rev), 0);
  assert.strictEqual(rev.lines.find((l) => l.account === '531').credit, 200000);
});

t('écriture déséquilibrée refusée', () => {
  assert.throws(() => J.makeEntry('2026-01-01', 'x', {}, [{ account: '531', debit: 10 }, { account: '7072', credit: 9 }]));
});

t("bilan d'ouverture : capital = actif − dettes, balance et bilan équilibrés", () => {
  const o = J.openingEntry({
    date: '2026-11-01',
    assets: [{ acc: '2181', cost: 30000000, accumulated: 5000000 }, { acc: '2185', cost: 9000000 }],
    stockValue: 1500000, cash: 500000, bank: 2000000, moncash: 300000, receivables: 100000, payables: 400000, loans: 1000000,
  });
  assert.strictEqual(o.capital, 30000000 - 5000000 + 9000000 + 1500000 + 500000 + 2000000 + 300000 + 100000 - 400000 - 1000000);
  const p = J.purchaseEntry({ id: 'p', no: 'A-1', date: '2026-11-02', supplierName: 'F', total: 600000, paid: 200000, payMode: 'cash' });
  const ex = J.expenseEntry({ id: 'e', date: '2026-11-03', category: 'electricite', amount: 50000, mode: 'cash' });
  const loss = J.lossEntry({ id: 'l', date: '2026-11-03', value: 12000 }, 'Fonte');
  const entries = [o, p, ex, loss];
  const tb = J.trialBalance(entries, J.DEFAULT_ACCOUNTS);
  assert.ok(tb.balanced);
  const bs = J.balanceSheet(entries, J.DEFAULT_ACCOUNTS, '2026-12-31');
  assert.ok(bs.balanced, 'bilan équilibré');
  const is = J.incomeStatement(entries, J.DEFAULT_ACCOUNTS);
  assert.strictEqual(is.result, -62000);
  assert.strictEqual(is.byAct.GL.exp, 62000);
});

t('amortissement linéaire mensuel plafonné', () => {
  const a = { cost: 120000, lifeMonths: 12, accumulated: 0, depPosted: 115000, depStart: '2026-01' };
  assert.strictEqual(J.depForMonth(a, '2026-12'), 5000);
  assert.strictEqual(J.depForMonth(a, '2025-12'), 0);
  assert.strictEqual(J.lastDayOfMonth('2028-02'), '2028-02-29');
});

t('coût moyen pondéré', () => {
  assert.strictEqual(J.newAvgCost(10, 3000, 10, 4000), 3500);
  assert.strictEqual(J.newAvgCost(-2, 3000, 10, 4000), 4000);
});

t('SHA-256 conforme', () => {
  assert.strictEqual(J.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.notStrictEqual(J.hashPassword('a', 's1'), J.hashPassword('a', 's2'));
});

t('téléphone WhatsApp Haïti', () => {
  assert.strictEqual(J.waPhone('3712-3456'), '50937123456');
  assert.strictEqual(J.waPhone('+509 37 12 34 56'), '50937123456');
});

console.log(`\n${n} tests réussis.`);
