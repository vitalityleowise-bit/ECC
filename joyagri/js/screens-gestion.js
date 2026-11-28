/* JOYAGRI — catalogue, stock, achats et fournisseurs, caisse du jour, dépenses. */
(function (root) {
  'use strict';
  const J = root.J;
  const U = J.ui;
  const A = J.app;
  const { h, icon } = U;
  const opts = (arr) => arr.map((x) => [x, x]);
  const KINDS = ['Cornet', 'Gobelet', 'Bâton', 'Pot', 'Litre', 'Seau', 'Carton', 'Sandwich', 'Autre'];
  const UNITS_SVC = ['heure', 'jour', 'hectare', 'carreau', 'parcelle', 'forfait', 'voyage', 'sac', 'unité'];
  const pct = (a, b) => (b ? Math.round(((a - b) / a) * 100) + ' %' : '—');

  /* ================= CATALOGUE ================= */
  A.screens.catalogue = () => {
    const owner = J.isOwner(A.user);
    let tab = A.param('tab') || 'glace';
    const box = h('div');
    const draw = () => {
      box.innerHTML = '';
      if (tab === 'glace') {
        const rows = J.db.products.slice().sort((a, b) => a.name.localeCompare(b.name));
        box.appendChild(rows.length ? U.table(['Produit', 'Type / format', { t: 'Achat', n: 1 }, { t: 'Gros', n: 1 }, { t: 'Gros dès', n: 1 }, { t: 'Détail', n: 1 }, { t: 'Marge détail', n: 1 }, { t: 'Stock', n: 1 }, ''],
          rows.map((p) => h('tr', { class: owner ? 'click' : '', onclick: owner ? () => productForm(p) : null },
            U.td(h('b', null, p.name)), U.td([p.kind, p.format].filter(Boolean).join(' · ')), U.td(J.fmt(p.avgCost || p.buyPrice, ''), 1), U.td(J.fmt(p.wholesalePrice, ''), 1),
            U.td(J.fmtQty(p.minWholesaleQty || 0), 1), U.td(h('b', null, J.fmt(p.retailPrice, '')), 1), U.td(pct(p.retailPrice, p.avgCost || p.buyPrice), 1),
            U.td(J.fmtQty(p.stock || 0), 1), U.td(p.active === false ? h('span', { class: 'tag grey' }, 'Inactif') : h('span', { class: 'tag' }, 'Actif')))))
          : U.empty('icecream', 'Aucun produit pour le moment.'));
      } else {
        const rows = J.db.services.slice().sort((a, b) => a.name.localeCompare(b.name));
        box.appendChild(rows.length ? U.table(['Service', 'Unité', { t: 'Prix', n: 1 }, { t: 'Coût estimé', n: 1 }, { t: 'Marge', n: 1 }, 'Matériel', ''],
          rows.map((s) => h('tr', { class: owner ? 'click' : '', onclick: owner ? () => serviceForm(s) : null },
            U.td([h('b', null, s.name), s.description ? h('div', { class: 'small muted' }, s.description) : null]), U.td(s.unit), U.td(J.fmt(s.price, ''), 1),
            U.td(J.fmt(s.costPerUnit || 0, ''), 1), U.td(pct(s.price, s.costPerUnit), 1), U.td(s.equipment || ''),
            U.td(s.active === false ? h('span', { class: 'tag grey' }, 'Inactif') : h('span', { class: 'tag' }, 'Actif')))))
          : U.empty('tractor', 'La liste des services et leurs prix seront ajoutés ici.'));
      }
    };
    const productForm = (p) => {
      p = Object.assign({ unit: 'unité', kind: 'Cornet', active: true, minWholesaleQty: 12, lowStock: 10 }, p || {});
      const f = {
        name: U.field('Parfum / nom', 'text', p.name, { placeholder: 'ex. Vanille' }), kind: U.field('Type', 'select', p.kind, { options: opts(KINDS) }),
        format: U.field('Format', 'text', p.format, { placeholder: 'ex. 120 ml, 1 litre, carton de 24' }), unit: U.field('Unité de vente', 'text', p.unit),
        buy: U.field("Prix d'achat", 'money', p.buyPrice), gros: U.field('PRIX DE GROS', 'money', p.wholesalePrice), detail: U.field('PRIX DE DÉTAIL', 'money', p.retailPrice),
        min: U.field('Quantité minimale pour le gros', 'qty', p.minWholesaleQty, { hint: '0 = seulement les grossistes' }), low: U.field('Alerte stock bas à', 'qty', p.lowStock),
      };
      const act = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.active !== false }), 'Produit actif (visible à la vente)');
      U.modal(p.id ? 'Modifier le produit' : 'Nouveau produit — crème glacée', h('div', null, f.name, h('div', { class: 'grid g2' }, f.kind, f.format), h('div', { class: 'grid g2' }, f.unit, f.buy),
        h('div', { class: 'grid g2' }, f.gros, f.detail), h('div', { class: 'grid g2' }, f.min, f.low), act),
      [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer', icon: 'check', click: () => {
        J.saveProduct(Object.assign(p, { name: f.name.get(), kind: f.kind.get(), format: f.format.get(), unit: f.unit.get() || 'unité', buyPrice: f.buy.get(), wholesalePrice: f.gros.get(), retailPrice: f.detail.get(), minWholesaleQty: f.min.get(), lowStock: f.low.get(), active: act.querySelector('input').checked }), A.user);
        U.toast('Produit enregistré.', 'ok'); draw();
      } }]);
    };
    const serviceForm = (s) => {
      s = Object.assign({ unit: 'hectare', active: true }, s || {});
      const f = {
        name: U.field('Nom du service', 'text', s.name, { placeholder: 'ex. Labour au tracteur' }), desc: U.field('Description', 'text', s.description),
        unit: U.field('Unité de prix', 'select', s.unit, { options: opts(UNITS_SVC) }), price: U.field('Prix par unité', 'money', s.price),
        cost: U.field('Coût estimé par unité', 'money', s.costPerUnit, { hint: 'carburant, main-d’œuvre' }), eq: U.field('Matériel utilisé', 'text', s.equipment, { placeholder: 'ex. tracteur, charrue' }),
      };
      const act = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.active !== false }), 'Service actif');
      U.modal(s.id ? 'Modifier le service' : 'Nouveau service agricole', h('div', null, f.name, f.desc, h('div', { class: 'grid g2' }, f.unit, f.price), h('div', { class: 'grid g2' }, f.cost, f.eq), act),
        [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer', icon: 'check', click: () => {
          J.saveService(Object.assign(s, { name: f.name.get(), description: f.desc.get(), unit: f.unit.get(), price: f.price.get(), costPerUnit: f.cost.get(), equipment: f.eq.get(), active: act.querySelector('input').checked }), A.user);
          U.toast('Service enregistré.', 'ok'); draw();
        } }]);
    };
    draw();
    return h('div', null, A.title('Catalogue', owner ? h('button', { class: 'btn gold', onclick: () => (tab === 'glace' ? productForm() : serviceForm()) }, icon('plus'), 'Ajouter') : null),
      h('div', { style: { marginBottom: '12px' } }, U.seg([['glace', 'Crème glacée'], ['service', 'Services agricoles']], tab, (v) => { tab = v; draw(); })),
      h('div', { class: 'card' }, box),
      h('p', { class: 'small muted' }, 'Le prix de gros s’applique automatiquement aux clients « grossiste / revendeur », ou dès que la quantité minimale est atteinte. Le vendeur voit toujours quel prix est appliqué et pourquoi.'));
  };

  /* ================= STOCK ================= */
  A.screens.stock = () => {
    const owner = J.isOwner(A.user);
    const canLoss = owner || J.db.settings.sellerCanDeclareLoss;
    let tab = 'etat';
    const box = h('div');
    const draw = () => {
      box.innerHTML = '';
      if (tab === 'etat') {
        const rows = J.db.products.filter((p) => p.active !== false);
        box.appendChild(h('div', { class: 'card' }, U.table(['Produit', { t: 'Stock', n: 1 }, { t: 'Coût moyen', n: 1 }, { t: 'Valeur', n: 1 }, 'État', ''],
          rows.map((p) => {
            const low = p.lowStock && (p.stock || 0) <= p.lowStock;
            return h('tr', null, U.td(h('b', null, J.productLabel(p))), U.td(h('b', null, J.fmtQty(p.stock || 0)), 1), U.td(J.fmt(p.avgCost || 0, ''), 1),
              U.td(J.fmt(Math.round((p.stock || 0) * (p.avgCost || 0)), ''), 1),
              U.td((p.stock || 0) <= 0 ? h('span', { class: 'tag red' }, 'Rupture') : low ? h('span', { class: 'tag red' }, 'Stock bas') : h('span', { class: 'tag' }, 'OK')),
              U.td(canLoss ? h('button', { class: 'btn sm light', onclick: () => lossForm(p) }, icon('snow'), 'Perte') : ''));
          }), h('tr', null, h('td', null, 'Valeur totale du stock'), h('td'), h('td'), U.td(J.fmt(J.stockValue()), 1), h('td'), h('td')))));
        const fc = J.forecast().filter((x) => x.perDay > 0);
        box.appendChild(h('div', { class: 'card' }, h('h2', null, 'Prévision d’achat (selon les ventes des 14 derniers jours)'),
          fc.length ? U.table(['Produit', { t: 'Vente / jour', n: 1 }, { t: 'Jours de stock', n: 1 }, { t: 'À commander (7 j)', n: 1 }],
            fc.map((x) => h('tr', null, U.td(J.productLabel(x.p)), U.td(J.fmtQty(Math.round(x.perDay * 10) / 10), 1),
              U.td(h('span', { class: x.days < 3 ? 'red' : '' }, x.days == null ? '—' : J.fmtQty(Math.round(x.days * 10) / 10)), 1), U.td(h('b', null, x.suggest ? J.fmtQty(x.suggest) : '—'), 1))))
            : h('p', { class: 'muted' }, 'Pas encore assez de ventes pour prévoir.')));
        const sl = J.sleepingStock(10);
        if (sl.length) box.appendChild(h('div', { class: 'alert' }, icon('snow'), h('span', null, h('b', null, 'Produits qui dorment (risque de fonte / qualité) : '), sl.map((x) => `${J.productLabel(x.p)} — ${x.since} j`).join(', '), '. Pensez à une promotion.')));
      } else if (tab === 'inventaire') {
        const inputs = {};
        const rows = J.db.products.filter((p) => p.active !== false).map((p) => {
          const inp = h('input', { class: 'inp sm', inputmode: 'decimal', placeholder: J.fmtQty(p.stock || 0), style: { width: '110px', marginLeft: 'auto' } });
          const diff = h('span', { class: 'small' });
          inp.addEventListener('input', () => { const v = J.parseNum(inp.value); const d = inp.value === '' ? 0 : Math.round((v - (p.stock || 0)) * 1000) / 1000; diff.textContent = inp.value === '' ? '' : d === 0 ? 'OK' : (d > 0 ? '+' : '') + J.fmtQty(d) + ' (' + J.fmt(Math.round(Math.abs(d) * (p.avgCost || 0))) + ')'; diff.className = 'small ' + (d < 0 ? 'red' : d > 0 ? 'gold' : 'green'); });
          inputs[p.id] = inp;
          return h('tr', null, U.td(h('b', null, J.productLabel(p))), U.td(J.fmtQty(p.stock || 0), 1), h('td', { class: 'n' }, inp), U.td(diff, 1));
        });
        box.appendChild(h('div', { class: 'card' }, h('h2', null, 'Inventaire physique'),
          h('p', { class: 'muted small' }, 'Comptez les produits dans les congélateurs et glacières, puis saisissez la quantité réelle. Laissez vide ce qui n’a pas été compté.'),
          U.table(['Produit', { t: 'Théorique', n: 1 }, { t: 'Compté', n: 1 }, { t: 'Écart', n: 1 }], rows),
          h('div', { class: 'row end', style: { marginTop: '12px' } }, h('button', { class: 'btn gold', disabled: !owner, onclick: U.safe(async () => {
            const counts = {};
            Object.keys(inputs).forEach((id) => { if (inputs[id].value !== '') counts[id] = J.parseNum(inputs[id].value); });
            if (!Object.keys(counts).length) throw new Error('Aucune quantité saisie.');
            if (!(await U.confirm("Valider l'inventaire ?", 'Le stock sera corrigé et les écarts passés en comptabilité (pertes ou excédents).', 'Valider'))) return;
            const res = J.applyInventory(counts, A.user);
            U.toast(`Inventaire validé : ${res.length} écart(s).`, 'ok'); tab = 'mouv'; draw();
          }) }, icon('check'), "Valider l'inventaire"))));
      } else {
        const rows = J.db.stockMoves.slice().reverse().slice(0, 300);
        const lab = { achat: ['Achat', ''], vente: ['Vente', 'blue'], perte: ['Perte', 'red'], inventaire: ['Inventaire', 'gold'], ouverture: ['Ouverture', 'grey'], annulation: ['Annulation', 'grey'] };
        box.appendChild(h('div', { class: 'card' }, rows.length ? U.table(['Date', 'Produit', 'Type', { t: 'Quantité', n: 1 }, { t: 'Valeur', n: 1 }, 'Détail'],
          rows.map((m) => { const p = J.byId('products', m.productId); return h('tr', null, U.td(J.fmtDate(m.date)), U.td(p ? J.productLabel(p) : '?'), U.td(h('span', { class: 'tag ' + (lab[m.type] || ['', ''])[1] }, (lab[m.type] || [m.type])[0])), U.td(h('b', { class: m.qty < 0 ? 'red' : 'green' }, (m.qty > 0 ? '+' : '') + J.fmtQty(m.qty)), 1), U.td(J.fmt(m.value, ''), 1), U.td([m.ref, m.reason].filter(Boolean).join(' — '))); }))
          : U.empty('box', 'Aucun mouvement.')));
      }
    };
    const lossForm = (p) => {
      const q = U.field('Quantité perdue', 'qty', '');
      const r = U.field('Motif', 'select', 'Fonte', { options: opts(J.LOSS_REASONS) });
      const n = U.field('Précision', 'text', '', { placeholder: 'ex. coupure de courant de 6 h, batterie faible' });
      U.modal(`Perte — ${J.productLabel(p)}`, h('div', null, h('p', { class: 'muted' }, `Stock actuel : ${J.fmtQty(p.stock || 0)} · coût moyen ${J.fmt(p.avgCost || 0)}`), h('div', { class: 'grid g2' }, q, r), n),
        [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer la perte', cls: 'danger', click: () => { const m = J.declareLoss(p.id, q.get(), r.get(), n.get(), A.user); U.toast(`Perte enregistrée (${J.fmt(m.value)}).`, 'ok'); draw(); } }]);
    };
    draw();
    return h('div', null, A.title('Stock', h('span', { class: 'tag' }, 'Valeur ' + J.fmt(J.stockValue()))),
      h('div', { style: { marginBottom: '12px' } }, U.seg([['etat', 'État du stock'], ['inventaire', 'Inventaire'], ['mouv', 'Mouvements']], tab, (v) => { tab = v; draw(); })), box);
  };

  /* ================= ACHATS & FOURNISSEURS ================= */
  A.supplierForm = (f, cb) => {
    f = f || {};
    const x = { name: U.field('Nom du fournisseur', 'text', f.name), phone: U.field('Téléphone', 'tel', f.phone), address: U.field('Adresse', 'text', f.address), terms: U.field('Conditions (crédit, délai…)', 'text', f.terms) };
    U.modal(f.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur', h('div', null, x.name, h('div', { class: 'grid g2 stack' }, x.phone, x.terms), x.address),
      [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer', icon: 'check', click: () => { const s = J.saveSupplier(Object.assign(f, { name: x.name.get(), phone: x.phone.get(), address: x.address.get(), terms: x.terms.get() })); if (cb) cb(s); } }]);
  };
  A.screens.achats = () => {
    let tab = 'achats';
    const box = h('div');
    const draw = () => {
      box.innerHTML = '';
      if (tab === 'achats') {
        const rows = J.db.purchases.filter((p) => p.type !== 'ouverture').slice().reverse();
        box.appendChild(h('div', { class: 'card' }, rows.length ? U.table(['N°', 'Date', 'Fournisseur', 'Produits', { t: 'Total', n: 1 }, { t: 'Payé', n: 1 }, 'Pièce'],
          rows.map((p) => h('tr', { class: 'click', onclick: () => purchaseView(p) }, U.td(h('b', null, p.no)), U.td(J.fmtDate(p.date)), U.td(p.supplierName),
            U.td(p.lines.map((l) => { const pr = J.byId('products', l.productId); return `${pr ? pr.name : '?'} × ${J.fmtQty(l.qty)}`; }).join(', ')),
            U.td(J.fmt(p.total, ''), 1), U.td(p.paid >= p.total ? h('span', { class: 'tag' }, 'Payé') : h('span', { class: 'tag red' }, J.fmt(p.paid, '')), 1), U.td(p.attachment ? icon('image') : p.ref || ''))))
          : U.empty('truck', 'Aucun achat enregistré.')));
      } else {
        box.appendChild(h('div', { class: 'list' }, J.db.suppliers.length ? J.db.suppliers.map((f) => {
          const bal = J.supplierBalance(f.id);
          return h('div', { class: 'item' }, h('span', { class: 'avatar' }, icon('truck')), h('div', { class: 'main', onclick: () => A.supplierForm(f, draw) }, h('b', null, f.name), h('small', null, [f.phone, f.terms].filter(Boolean).join(' · '))),
            h('div', { class: 'side-v' }, bal ? h('div', { class: 'red' }, 'dette ' + J.fmt(bal)) : h('span', { class: 'tag' }, 'Rien à payer')),
            bal ? h('button', { class: 'btn sm gold', onclick: () => payForm(f, bal) }, 'Payer') : null);
        }) : U.empty('truck', 'Aucun fournisseur.')));
      }
    };
    const payForm = (f, bal) => {
      let mode = 'cash';
      const a = U.field('Montant payé', 'money', bal);
      const d = U.field('Date', 'date', J.today());
      U.modal(`Payer ${f.name}`, h('div', null, h('p', null, 'Dette actuelle : ', h('b', { class: 'red' }, J.fmt(bal))), a, d, U.seg(J.PAY_MODES.map((m) => [m.id, m.label]), mode, (v) => { mode = v; }, true)),
        [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer le paiement', icon: 'check', click: () => { J.paySupplier(f.id, a.get(), mode, d.get(), A.user); U.toast('Paiement fournisseur enregistré.', 'ok'); draw(); } }]);
    };
    const purchaseView = (p) => U.modal(`Achat ${p.no}`, h('div', null, h('p', null, `${p.supplierName} · ${J.fmtDate(p.date)} · saisi par ${p.user || ''}`),
      U.table(['Produit', { t: 'Qté', n: 1 }, { t: 'Coût unit.', n: 1 }, { t: 'Total', n: 1 }], p.lines.map((l) => { const pr = J.byId('products', l.productId); return h('tr', null, U.td(pr ? J.productLabel(pr) : '?'), U.td(J.fmtQty(l.qty), 1), U.td(J.fmt(l.unitCost, ''), 1), U.td(J.fmt(l.total, ''), 1)); }),
        h('tr', null, h('td', null, 'Total'), h('td'), h('td'), U.td(J.fmt(p.total), 1))),
      h('p', null, `Payé : ${J.fmt(p.paid)} (${J.payLabel(p.payMode)}) · Reste : ${J.fmt(p.total - p.paid)}${p.ref ? ' · Pièce : ' + p.ref : ''}`),
      p.note ? h('p', { class: 'muted' }, p.note) : null, p.attachment ? h('img', { class: 'thumb', src: p.attachment, alt: 'Pièce justificative' }) : null), [], { wide: true });
    const purchaseForm = () => {
      if (!J.db.products.length) throw new Error("Ajoutez d'abord les produits au catalogue.");
      const st = { supplierId: (J.db.suppliers[0] || {}).id || '', lines: [], payStatus: 'full', payMode: 'cash', paid: 0, attachment: null };
      const body = h('div');
      const fd = U.field("Date de l'achat", 'date', J.today());
      const fref = U.field('N° de la facture / reçu fournisseur', 'text', '');
      const fnote = U.field('Note', 'text', '');
      const draw2 = () => {
        body.innerHTML = '';
        const sel = U.field('Fournisseur', 'select', st.supplierId, { options: [['', '— choisir —']].concat(J.db.suppliers.map((f) => [f.id, f.name])), onchange: (e) => { st.supplierId = e.target.value; } });
        body.append(h('div', { class: 'row' }, h('div', { style: { flex: 1 } }, sel), h('button', { class: 'btn sm light', onclick: () => A.supplierForm(null, (f) => { st.supplierId = f.id; draw2(); }) }, icon('plus'), 'Fournisseur')), fd);
        const lt = h('div', { class: 'list' });
        st.lines.forEach((l, i) => {
          const pSel = h('select', { class: 'inp sm', onchange: (e) => { l.productId = e.target.value; const p = J.byId('products', l.productId); l.unitCost = p.buyPrice || 0; draw2(); } }, J.db.products.filter((p) => p.active !== false).map((p) => h('option', { value: p.id, selected: p.id === l.productId ? 'selected' : null }, J.productLabel(p))));
          const q = h('input', { class: 'inp sm', inputmode: 'decimal', value: J.fmtQty(l.qty), style: { width: '80px' }, onchange: (e) => { l.qty = J.parseNum(e.target.value); draw2(); } });
          const c = h('input', { class: 'inp sm', inputmode: 'decimal', value: J.fmt(l.unitCost, '').replace(/ /g, ' '), style: { width: '110px' }, onchange: (e) => { l.unitCost = J.toC(e.target.value); draw2(); } });
          lt.appendChild(h('div', { class: 'item', style: { flexWrap: 'wrap', cursor: 'default' } }, h('div', { style: { flex: '1 1 200px' } }, pSel), h('span', { class: 'small muted' }, 'Qté'), q, h('span', { class: 'small muted' }, 'Coût'), c,
            h('b', { class: 'num', style: { minWidth: '90px' } }, J.fmt(Math.round(l.qty * l.unitCost))), h('button', { class: 'iconbtn', onclick: () => { st.lines.splice(i, 1); draw2(); } }, icon('trash'))));
        });
        const total = st.lines.reduce((a, l) => a + Math.round(l.qty * l.unitCost), 0);
        body.append(h('label', { class: 'f' }, 'Produits achetés'), lt,
          h('button', { class: 'btn sm light', style: { margin: '8px 0' }, onclick: () => { const p = J.db.products.find((x) => x.active !== false); st.lines.push({ productId: p.id, qty: 1, unitCost: p.buyPrice || 0 }); draw2(); } }, icon('plus'), 'Ajouter un produit'),
          h('div', { class: 'totals' }, h('div', { class: 'l grand' }, h('span', null, 'Total'), h('span', null, J.fmt(total)))),
          h('label', { class: 'f' }, 'Paiement au fournisseur'),
          U.seg([['full', 'Payé'], ['partial', 'Partiel'], ['credit', 'À crédit']], st.payStatus, (v) => { st.payStatus = v; draw2(); }, true));
        if (st.payStatus !== 'credit') body.append(h('div', { style: { height: '8px' } }), U.seg(J.PAY_MODES.map((m) => [m.id, m.label]), st.payMode, (v) => { st.payMode = v; }, true));
        if (st.payStatus === 'partial') body.append(U.field('Montant payé', 'money', st.paid, { onchange: (e) => { st.paid = J.toC(e.target.value); } }));
        body.append(h('div', { class: 'grid g2 stack', style: { marginTop: '10px' } }, fref, fnote),
          h('div', { class: 'row' }, h('button', { class: 'btn sm light', onclick: async () => { st.attachment = await U.pickImage(1000); draw2(); } }, icon('image'), st.attachment ? 'Changer la photo' : 'Photo de la pièce justificative'), st.attachment ? h('img', { class: 'thumb', src: st.attachment, style: { maxHeight: '80px' } }) : null));
      };
      draw2();
      U.modal('Nouvel achat', body, [{ label: 'Annuler', cls: 'light' }, { label: "Enregistrer l'achat", icon: 'check', cls: 'gold', click: () => {
        const total = st.lines.reduce((a, l) => a + Math.round(l.qty * l.unitCost), 0);
        const p = J.createPurchase({ supplierId: st.supplierId, date: fd.get(), lines: st.lines, payMode: st.payStatus === 'credit' ? 'credit' : st.payMode, paid: st.payStatus === 'full' ? total : st.payStatus === 'credit' ? 0 : st.paid, ref: fref.get(), note: fnote.get(), attachment: st.attachment }, A.user);
        U.toast(`Achat ${p.no} enregistré : le stock a augmenté.`, 'ok'); draw();
      } }], { wide: true, sticky: true });
    };
    draw();
    return h('div', null, A.title('Achats & fournisseurs', h('button', { class: 'btn light', onclick: () => A.supplierForm(null, draw) }, icon('plus'), 'Fournisseur'), h('button', { class: 'btn gold', onclick: U.safe(purchaseForm) }, icon('truck'), 'Nouvel achat')),
      h('div', { style: { marginBottom: '12px' } }, U.seg([['achats', 'Achats'], ['fournisseurs', 'Fournisseurs']], tab, (v) => { tab = v; draw(); })), box);
  };

  /* ================= CAISSE DU JOUR ================= */
  const DENOMS = [1000, 500, 250, 100, 50, 25, 10, 5, 1];
  A.screens.caisse = () => {
    const c = J.currentCash();
    const wrap = h('div', null, A.title('Caisse du jour'));
    if (!c) {
      const last = J.db.cashSessions.slice().reverse()[0];
      const f = U.field("Argent dans la caisse à l'ouverture", 'money', last ? last.counted : 0);
      wrap.appendChild(h('div', { class: 'card' }, h('h2', null, 'Ouvrir la caisse'),
        h('p', { class: 'muted' }, last ? `Dernière clôture : ${J.fmtDateTime(last.closedAt)} par ${last.closedBy}, montant compté ${J.fmt(last.counted)}.` : 'Comptez l’argent présent dans la caisse.'),
        f, h('button', { class: 'btn xl gold block', onclick: U.safe(() => { J.openCash(f.get(), A.user); U.toast('Caisse ouverte.', 'ok'); A.render(); }) }, icon('cash'), 'Ouvrir la caisse')));
    } else {
      const mv = J.cashMovements(c);
      const line = (l, v, b) => h('div', { class: 'l' }, h('span', null, l), h(b ? 'b' : 'span', { class: v < 0 ? 'red' : '' }, J.fmt(v)));
      const counts = {};
      const totalEl = h('b');
      const diffEl = h('div');
      const upd = () => {
        const t = DENOMS.reduce((a, d) => a + d * 100 * (Number(counts[d]) || 0), 0);
        totalEl.textContent = J.fmt(t);
        const d = t - mv.expected;
        diffEl.innerHTML = '';
        diffEl.appendChild(h('div', { class: 'alert ' + (d === 0 ? 'green' : 'red') }, icon(d === 0 ? 'check' : 'alert'), d === 0 ? 'La caisse est juste.' : `Écart : ${J.fmt(d)} (${d > 0 ? 'excédent' : 'manquant'})`));
        return t;
      };
      const grid = h('div', { class: 'grid g3' }, DENOMS.map((d) => h('label', { class: 'f' }, `${d} HTG ${d >= 25 ? '(billets)' : '(pièces)'}`, h('input', { inputmode: 'numeric', placeholder: '0', oninput: (e) => { counts[d] = e.target.value; upd(); } }))));
      const note = U.field('Note de clôture', 'text', '');
      wrap.append(h('div', { class: 'grid g2 stack' },
        h('div', { class: 'card' }, h('h2', null, 'Mouvements de la caisse', h('span', { class: 'tag' }, `ouverte à ${J.fmtTime(c.openedAt)} par ${c.openedBy}`)),
          h('div', { class: 'totals', style: { borderTop: 0 } }, line("Fond d'ouverture", c.opening), line('Ventes payées en cash', mv.sales), line('Crédits encaissés en cash', mv.collections), line('Dépenses payées en cash', mv.expenses), line('Achats / fournisseurs payés en cash', mv.purchases), mv.other ? line('Autres mouvements', mv.other) : null),
          h('div', { class: 'totals' }, h('div', { class: 'l grand' }, h('span', null, 'Attendu en caisse'), h('span', null, J.fmt(mv.expected)))),
          h('p', { class: 'small muted' }, 'MonCash, NatCash, virements et chèques ne passent pas par la caisse : ils sont suivis dans leurs propres comptes.')),
        h('div', { class: 'card' }, h('h2', null, 'Compter et fermer'), grid, h('div', { class: 'totals' }, h('div', { class: 'l grand' }, h('span', null, 'Compté'), totalEl)), diffEl, note,
          h('button', { class: 'btn xl block', onclick: U.safe(async () => {
            const t = upd();
            if (!(await U.confirm('Fermer la caisse ?', `Montant compté : ${J.fmt(t)}. Attendu : ${J.fmt(mv.expected)}.`, 'Fermer la caisse'))) return;
            const r = J.closeCash(t, note.get(), A.user);
            U.toast(r.diff ? `Caisse fermée avec un écart de ${J.fmt(r.diff)}.` : 'Caisse fermée : elle est juste.', r.diff ? 'err' : 'ok'); A.render();
          }) }, icon('lock'), 'Fermer la caisse'))));
      setTimeout(upd, 0);
    }
    const hist = J.db.cashSessions.filter((s) => s.closedAt).slice().reverse().slice(0, 30);
    if (hist.length) wrap.appendChild(h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Historique'),
      U.table(['Jour', 'Ouverture', 'Clôture', { t: 'Attendu', n: 1 }, { t: 'Compté', n: 1 }, { t: 'Écart', n: 1 }],
        hist.map((s) => h('tr', null, U.td(J.fmtDate(s.day)), U.td(`${J.fmtTime(s.openedAt)} — ${s.openedBy}`), U.td(`${J.fmtTime(s.closedAt)} — ${s.closedBy}`), U.td(J.fmt(s.expected, ''), 1), U.td(J.fmt(s.counted, ''), 1), U.td(h('b', { class: s.diff ? 'red' : 'green' }, J.fmt(s.diff, '')), 1))))));
    return wrap;
  };

  /* ================= DÉPENSES ================= */
  A.screens.depenses = () => {
    let month = J.monthKey();
    const box = h('div');
    const draw = () => {
      box.innerHTML = '';
      const rows = J.db.expenses.filter((e) => e.date.slice(0, 7) === month).slice().reverse();
      const byCat = {};
      rows.forEach((e) => { const c = J.EXPENSE_CATEGORIES.find((x) => x.id === e.category); byCat[c ? c.label : e.category] = (byCat[c ? c.label : e.category] || 0) + e.amount; });
      const tot = rows.reduce((a, e) => a + e.amount, 0);
      box.append(h('div', { class: 'grid g2 stack' },
        h('div', { class: 'card' }, h('h2', null, 'Par catégorie', h('span', { class: 'tag red' }, J.fmt(tot))), Object.keys(byCat).length ? A.hbars(Object.entries(byCat).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount), 'gold') : h('p', { class: 'muted' }, 'Aucune dépense ce mois-ci.')),
        h('div', { class: 'card' }, h('h2', null, 'Dépenses du mois'), rows.length ? h('div', { class: 'list' }, rows.map((e) => {
          const c = J.EXPENSE_CATEGORIES.find((x) => x.id === e.category);
          return h('div', { class: 'item', onclick: () => U.modal('Dépense', h('div', null, h('p', null, `${J.fmtDate(e.date)} · ${c ? c.label : e.category} · ${J.fmt(e.amount)} · ${J.payLabel(e.mode)} · ${J.ACTIVITIES[e.act || (c && c.act)] || ''}`), e.description ? h('p', null, e.description) : null, e.ref ? h('p', { class: 'muted' }, 'Pièce : ' + e.ref) : null, e.attachment ? h('img', { class: 'thumb', src: e.attachment }) : null, h('p', { class: 'small muted' }, 'Saisie par ' + e.user)), []) },
            h('span', { class: 'avatar' }, icon('wallet')), h('div', { class: 'main' }, h('b', null, c ? c.label : e.category), h('small', null, `${J.fmtDate(e.date)} · ${e.description || ''} · ${J.payLabel(e.mode)}`)), h('b', { class: 'num' }, J.fmt(e.amount)), e.attachment ? icon('image') : null);
        })) : U.empty('wallet', 'Rien pour ce mois.'))));
    };
    const form = () => {
      let mode = 'cash';
      let att = null;
      const f = {
        cat: U.field('Catégorie', 'select', 'electricite', { options: J.EXPENSE_CATEGORIES.map((c) => [c.id, c.label]) }),
        amt: U.field('Montant', 'money', ''), date: U.field('Date', 'date', J.today()), desc: U.field('Description', 'text', '', { placeholder: 'ex. carburant génératrice, recharge EDH' }),
        act: U.field('Activité concernée', 'select', '', { options: [['', 'Selon la catégorie'], ['S', 'Services agricoles'], ['GL', 'Crème glacée'], ['C', 'Commun']] }),
        ref: U.field('N° de la pièce justificative', 'text', ''),
      };
      const attBtn = h('button', { class: 'btn sm light', onclick: async () => { att = await U.pickImage(1000); attBtn.textContent = att ? 'Photo jointe ✓' : 'Photo du reçu'; } }, 'Photo du reçu');
      U.modal('Nouvelle dépense', h('div', null, h('div', { class: 'grid g2 stack' }, f.cat, f.amt), h('div', { class: 'grid g2 stack' }, f.date, f.act), f.desc,
        h('label', { class: 'f' }, 'Payée par'), U.seg(J.PAY_MODES.map((m) => [m.id, m.label]), mode, (v) => { mode = v; }, true), h('div', { style: { height: '10px' } }), f.ref, attBtn),
      [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer', icon: 'check', cls: 'gold', click: () => {
        J.addExpense({ category: f.cat.get(), amount: f.amt.get(), date: f.date.get(), description: f.desc.get(), act: f.act.get() || undefined, mode, ref: f.ref.get(), attachment: att }, A.user);
        U.toast('Dépense enregistrée.', 'ok'); draw();
      } }]);
    };
    draw();
    const mIn = h('input', { type: 'month', class: 'inp sm', value: month, style: { width: 'auto', marginTop: 0 }, onchange: (e) => { month = e.target.value || J.monthKey(); draw(); } });
    return h('div', null, A.title('Dépenses', mIn, h('button', { class: 'btn gold', onclick: form }, icon('plus'), 'Nouvelle dépense')), box);
  };
})(window);
