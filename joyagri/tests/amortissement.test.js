/* Amortissement linéaire : node tests/amortissement.test.js */
'use strict';
const assert = require('assert');
const J = require('../js/core.js');
require('../js/store.js');
J.save = () => {};
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
const balanced = () => assert.ok(J.trialBalance(J.db.entries, J.db.accounts).balanced, 'balance déséquilibrée');

t('tableau : total = base exacte, arrondi soldé au dernier mois', () => {
  const a = { cost: 1000000, residual: 100000, lifeMonths: 36, depStart: '2026-03' }; // 9 000 HTG sur 36 mois
  const rows = J.depSchedule(a);
  const tot = rows.reduce((x, r) => x + r.dot, 0);
  assert.strictEqual(tot, 900000);
  assert.strictEqual(rows[rows.length - 1].vnc, 100000, 'VNC finale = valeur résiduelle');
  assert.strictEqual(rows[0].months, 10); // mars → décembre
  assert.strictEqual(rows.reduce((x, r) => x + r.months, 0), 36);
  const odd = J.depSchedule({ cost: 100000, lifeMonths: 7, depStart: '2026-01' });
  assert.strictEqual(odd.reduce((x, r) => x + r.dot, 0), 100000);
});

t('amortissements antérieurs au bilan d’ouverture', () => {
  const a = { cost: 12000000, lifeMonths: 60, depStart: '2025-11' };
  assert.strictEqual(J.accumulatedBefore(a, '2026-11'), 12 * 200000);
  assert.strictEqual(J.accumulatedBefore(a, '2035-01'), 12000000);
  assert.strictEqual(J.accumulatedBefore(a, '2025-01'), 0);
});

J.db = J.newDB();
const owner = J.createUser('Patron', 'p', 'owner', 'secret1');
t('ouverture : cumul calculé automatiquement si non saisi', () => {
  J.saveOpening({ date: '2026-11-01', assets: [{ name: 'Congélateur', acc: '2185', date: '2025-11-01', cost: 12000000, lifeMonths: 60 }], cash: 1000000 }, owner);
  assert.strictEqual(J.db.assets[0].accumulated, 2400000);
  balanced();
});

t('achat d’équipement à crédit partiel + rattrapage', () => {
  J.postDepreciation('2026-12', owner);
  const a = J.addAsset({ name: 'Glacière 120 L', acc: '2186', date: '2026-12-10', cost: 360000, lifeMonths: 36 }, 'cash', owner, 100000);
  assert.ok(a.catchUpFrom);
  balanced();
  J.postDepreciation('2027-01', owner);
  assert.strictEqual(a.depPosted, 20000); // déc. (rattrapage) + janv.
  balanced();
  const tb = J.trialBalance(J.db.entries, J.db.accounts);
  assert.strictEqual(tb.rows.find((r) => r.code === '401').solde, -260000);
});

t('vente d’un bien avec plus-value : sortie du bilan, écriture équilibrée', () => {
  const c = J.db.assets[0];
  const d = J.disposeAsset(c.id, { date: '2027-03-15', price: 9000000, mode: 'cash', reason: 'remplacé' }, owner);
  // cumul : 12 avant + nov→mars (5 mois) = 17 × 200 000
  assert.strictEqual(d.nbv, 12000000 - 17 * 200000);
  assert.strictEqual(d.gain, 9000000 - d.nbv);
  balanced();
  const tb = J.trialBalance(J.db.entries, J.db.accounts);
  assert.strictEqual((tb.rows.find((r) => r.code === '2185') || { solde: 0 }).solde, 0);
  assert.strictEqual((tb.rows.find((r) => r.code === '28185') || { solde: 0 }).solde, 0);
  J.postDepreciation('2027-06', owner);
  assert.strictEqual(c.depPosted, 5 * 200000, 'plus d’amortissement après la sortie');
  assert.ok(J.balanceSheet(J.db.entries, J.db.accounts, '2099-12-31').balanced);
});
console.log(`\n${n} tests réussis.`);
