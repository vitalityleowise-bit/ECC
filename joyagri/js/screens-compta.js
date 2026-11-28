/* JOYAGRI — rapports, comptabilité (ouverture, journal, grand livre, balance, bilan, résultat,
 * immobilisations & amortissements, trésorerie, plan comptable), paramètres, utilisateurs, sauvegarde. */
(function (root) {
  'use strict';
  const J = root.J;
  const U = J.ui;
  const A = J.app;
  const { h, icon } = U;
  const accName = (code) => (J.db.accounts.find((a) => a.code === code) || { name: '?' }).name;

  /* ---------- Sélecteur de période ---------- */
  A.period = (onchange, initial) => {
    const today = J.today();
    let kind = initial || 'mois';
    const st = { from: today, to: today };
    const custom = h('div', { class: 'row' });
    const fFrom = h('input', { type: 'date', class: 'inp sm', style: { width: 'auto', marginTop: 0 } });
    const fTo = h('input', { type: 'date', class: 'inp sm', style: { width: 'auto', marginTop: 0 } });
    const compute = () => {
      if (kind === 'jour') { st.from = today; st.to = today; }
      if (kind === 'semaine') { st.from = J.startOfWeek(today); st.to = today; }
      if (kind === 'mois') { st.from = today.slice(0, 8) + '01'; st.to = today; }
      if (kind === 'annee') { st.from = today.slice(0, 5) + '01-01'; st.to = today; }
      if (kind === 'tout') { st.from = null; st.to = null; }
      if (kind === 'perso') { st.from = fFrom.value || null; st.to = fTo.value || null; }
      custom.style.display = kind === 'perso' ? '' : 'none';
      onchange(st);
    };
    fFrom.value = today.slice(0, 8) + '01'; fTo.value = today;
    fFrom.onchange = compute; fTo.onchange = compute;
    custom.append(h('span', { class: 'small muted' }, 'du'), fFrom, h('span', { class: 'small muted' }, 'au'), fTo);
    const seg = U.seg([['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['annee', 'Année'], ['tout', 'Tout'], ['perso', 'Dates…']], kind, (v) => { kind = v; compute(); });
    const el = h('div', { class: 'row', style: { marginBottom: '12px' } }, seg, custom);
    el.start = compute;
    el.label = () => (st.from ? `du ${J.fmtDate(st.from)} au ${J.fmtDate(st.to)}` : 'depuis le début');
    return el;
  };

  /* ================= RAPPORTS ================= */
  A.screens.rapports = () => {
    const box = h('div');
    const per = A.period((st) => {
      box.innerHTML = '';
      const r = J.salesReport(st.from, st.to);
      const rec = J.receivables().reduce((a, x) => a + x.amount, 0);
      box.append(
        h('div', { class: 'grid g4' }, U.kpi('Chiffre d’affaires', J.fmt(r.total), `${r.count} fiche(s) ${per.label()}`), U.kpi('Marge brute', J.fmt(r.margin), r.total ? `${Math.round((r.margin / r.total) * 100)} % du CA` : '', 'gold'),
          U.kpi('Encaissé', J.fmt(r.collected), 'ventes + crédits', 'blue'), U.kpi('Réductions accordées', J.fmt(r.disc), `créances totales ${J.fmt(rec)}`, 'red')),
        h('div', { class: 'grid g2 stack', style: { marginTop: '12px' } },
          h('div', { class: 'card' }, h('h2', null, 'Par activité'), A.donut([{ l: 'Services agricoles', v: r.act.S, c: A.COLORS.S }, { l: 'Crème glacée — gros', v: r.act.G, c: A.COLORS.G }, { l: 'Crème glacée — détail', v: r.act.D, c: A.COLORS.D }]),
            U.table(['Activité', { t: 'Ventes', n: 1 }], [['Services agricoles', r.act.S], ['Crème glacée — gros', r.act.G], ['Crème glacée — détail', r.act.D]].map(([l, v]) => h('tr', null, U.td(l), U.td(J.fmt(v), 1))))),
          h('div', { class: 'card' }, h('h2', null, 'Ventes par jour'), (() => {
            const days = Object.keys(r.byDay).sort();
            if (!days.length) return h('p', { class: 'muted' }, 'Aucune vente sur la période.');
            const from = st.from || days[0]; const to = st.to || days[days.length - 1];
            const n = Math.min(31, J.daysBetween(from, to) + 1);
            return A.bars(r.byDay, J.addDays(to, -(n - 1)), n);
          })())),
        h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Par produit / service — meilleurs en premier', h('button', { class: 'btn sm light', onclick: () => U.download('ventes-par-produit.csv', U.csv([['Produit / service', 'Type', 'Quantité', 'Unité', 'Ventes HTG', 'Coût HTG', 'Marge HTG']].concat(r.items.map((i) => [i.name, i.kind === 'service' ? 'Service' : 'Crème glacée', J.fmtQty(i.qty), i.unit, J.fromC(i.amount), J.fromC(i.cost), J.fromC(i.margin)]))), 'text/csv') }, icon('download'), 'CSV')),
          r.items.length ? U.table(['#', 'Produit / service', { t: 'Quantité', n: 1 }, { t: 'Ventes', n: 1 }, { t: 'Coût', n: 1 }, { t: 'Marge', n: 1 }, { t: 'Marge %', n: 1 }],
            r.items.map((i, k) => h('tr', null, U.td(k < 3 ? h('span', { class: 'tag gold' }, icon('star'), k + 1) : k + 1), U.td([h('b', null, i.name), ' ', i.kind === 'service' ? h('span', { class: 'tag gold' }, 'Service') : null]), U.td(`${J.fmtQty(i.qty)} ${i.unit || ''}`, 1),
              U.td(J.fmt(i.amount, ''), 1), U.td(J.fmt(i.cost, ''), 1), U.td(h('b', { class: i.margin < 0 ? 'red' : 'green' }, J.fmt(i.margin, '')), 1), U.td(i.amount ? Math.round((i.margin / i.amount) * 100) + ' %' : '—', 1))))
            : h('p', { class: 'muted' }, 'Aucune vente.')),
        h('div', { class: 'grid g2 stack', style: { marginTop: '12px' } },
          h('div', { class: 'card' }, h('h2', null, 'Par client'), r.byClient.length ? A.hbars(r.byClient.slice(0, 10)) : h('p', { class: 'muted' }, '—')),
          h('div', { class: 'card' }, h('h2', null, 'Par vendeur'), r.bySeller.length ? A.hbars(r.bySeller, 'blue') : h('p', { class: 'muted' }, '—'))));
    });
    setTimeout(per.start, 0);
    return h('div', null, A.title('Rapports'), per, box);
  };

  /* ================= COMPTABILITÉ ================= */
  const TABS = [['ouverture', "Bilan d'ouverture"], ['immo', 'Immobilisations & amortissements'], ['journal', 'Journal'], ['grandlivre', 'Grand livre'], ['balance', 'Balance'], ['bilan', 'Bilan'], ['resultat', 'Compte de résultat'], ['tresorerie', 'Trésorerie'], ['plan', 'Plan comptable']];
  A.screens.compta = () => {
    let tab = A.param('tab') || (J.db.opening.done ? 'resultat' : 'ouverture');
    const box = h('div');
    const draw = () => { box.innerHTML = ''; box.appendChild((C[tab] || C.resultat)(draw)); };
    const sel = h('select', { class: 'inp', style: { marginTop: 0 }, onchange: (e) => { tab = e.target.value; draw(); } }, TABS.map(([v, t]) => h('option', { value: v, selected: v === tab ? 'selected' : null }, t)));
    draw();
    const tb = J.trialBalance(J.db.entries, J.db.accounts);
    return h('div', null, A.title('Comptabilité', tb.balanced ? h('span', { class: 'tag' }, icon('check'), 'Balance équilibrée') : h('span', { class: 'tag red' }, 'Balance déséquilibrée !')),
      h('div', { style: { marginBottom: '12px', maxWidth: '420px' } }, sel), box);
  };
  const C = {};

  /* ----- Bilan d'ouverture ----- */
  C.ouverture = (redraw) => {
    const o = J.db.opening;
    if (o.done) {
      const e = J.db.entries.find((x) => x.id === o.entryId);
      return h('div', null, h('div', { class: 'alert green' }, icon('check'), h('span', null, `Bilan d'ouverture validé le ${J.fmtDate(o.validatedAt)} par ${o.by}, date de départ du système : `, h('b', null, J.fmtDate(o.date)), '. Capital (apport du propriétaire) : ', h('b', null, J.fmt(o.capital)))),
        h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Écriture à-nouveaux'), entryTable(e)));
    }
    const st = A.openingDraft || (A.openingDraft = { date: J.today().slice(0, 8) + '01', assets: [], stock: {}, cash: 0, bank: 0, moncash: 0, natcash: 0, clientDebts: [], supplierDebts: [], loans: 0 });
    const wrap = h('div');
    const summary = h('div');
    const calc = () => {
      const assets = st.assets.reduce((a, x) => a + x.cost - (x.accumulated || 0), 0);
      const stock = Object.keys(st.stock).reduce((a, k) => a + Math.round((st.stock[k].qty || 0) * (st.stock[k].unitCost || 0)), 0);
      const treso = st.cash + st.bank + st.moncash + st.natcash;
      const rec = st.clientDebts.reduce((a, d) => a + d.amount, 0);
      const pay = st.supplierDebts.reduce((a, d) => a + d.amount, 0);
      const cap = assets + stock + treso + rec - pay - st.loans;
      summary.innerHTML = '';
      summary.appendChild(h('div', { class: 'card', style: { position: 'sticky', bottom: 'calc(var(--nav-h) + 6px)', zIndex: 4, marginTop: '12px', borderColor: 'var(--a)' } },
        h('div', { class: 'grid g4' }, U.kpi('Immobilisations nettes', J.fmt(assets)), U.kpi('Stock + trésorerie', J.fmt(stock + treso), null, 'blue'), U.kpi('Créances − dettes', J.fmt(rec - pay - st.loans), null, 'red'), U.kpi('Capital (calculé)', J.fmt(cap), 'actif − dettes', 'gold')),
        h('div', { class: 'row end', style: { marginTop: '10px' } }, h('button', { class: 'btn xl gold', onclick: U.safe(validate) }, icon('check'), "Valider le bilan d'ouverture"))));
    };
    const money = (label, key) => U.field(label, 'money', st[key], { oninput: (e) => { st[key] = J.toC(e.target.value); calc(); } });
    const drawAll = () => {
      wrap.innerHTML = '';
      const d = U.field('Date de départ du système', 'date', st.date, { onchange: (e) => { st.date = e.target.value; drawAll(); } });
      wrap.appendChild(h('div', { class: 'card' }, h('h2', null, '1. Date de départ'), h('p', { class: 'muted small' }, 'Tout ce qui est saisi ici est la situation de l’entreprise à cette date. Les ventes commencent après.'), d));
      // Immobilisations
      const at = h('div', { class: 'list' });
      st.assets.forEach((a, i) => {
        const cat = J.ASSET_CATEGORIES.find((c) => c.acc === a.acc);
        const auto = J.accumulatedBefore({ cost: a.cost, residual: a.residual, lifeMonths: a.lifeMonths, depStart: (a.serviceDate || a.date || st.date).slice(0, 7) }, st.date.slice(0, 7));
        at.appendChild(h('div', { class: 'item', onclick: () => assetDialog(a, (x) => { Object.assign(a, x); drawAll(); }, st.date) }, h('span', { class: 'avatar' }, icon(a.acc === '2181' ? 'sun' : a.acc === '2185' || a.acc === '2186' ? 'snow' : a.acc === '2154' ? 'tractor' : 'box')),
          h('div', { class: 'main' }, h('b', null, `${a.name}${a.qty > 1 ? ' × ' + a.qty : ''}`), h('small', null, `${cat.label} · acheté le ${J.fmtDate(a.date)} · ${a.lifeMonths / 12} an(s) · amort. déjà fait ${J.fmt(a.accumulated != null ? a.accumulated : auto)}`)),
          h('div', { class: 'side-v' }, J.fmt(a.cost), h('div', { class: 'small muted' }, 'VNC ' + J.fmt(a.cost - (a.accumulated != null ? a.accumulated : auto)))),
          h('button', { class: 'iconbtn', onclick: (e) => { e.stopPropagation(); st.assets.splice(i, 1); drawAll(); } }, icon('trash'))));
        if (a.accumulated == null) a.accumulated = auto;
      });
      wrap.appendChild(h('div', { class: 'card' }, h('h2', null, '2. Ce que l’entreprise possède déjà (immobilisations)', h('button', { class: 'btn sm gold', onclick: () => assetDialog(null, (x) => { st.assets.push(x); drawAll(); }, st.date) }, icon('plus'), 'Ajouter un bien')),
        h('p', { class: 'muted small' }, 'Installation solaire (panneaux, batteries, onduleur), congélateurs, glacières, balance, téléphone, imprimante, mobilier, transport… Les amortissements déjà faits avant la date de départ sont calculés automatiquement (linéaire), vous pouvez les corriger.'),
        st.assets.length ? at : h('p', { class: 'muted' }, 'Aucun bien saisi.')));
      // Stock
      const prods = J.db.products.filter((p) => p.active !== false);
      wrap.appendChild(h('div', { class: 'card' }, h('h2', null, '3. Stock de départ (crème glacée)'),
        prods.length ? U.table(['Produit', { t: 'Quantité', n: 1 }, { t: 'Coût unitaire', n: 1 }, { t: 'Valeur', n: 1 }], prods.map((p) => {
          const s = st.stock[p.id] || (st.stock[p.id] = { qty: 0, unitCost: p.buyPrice || 0 });
          const val = h('span');
          const upd = () => { val.textContent = J.fmt(Math.round(s.qty * s.unitCost), ''); calc(); };
          upd();
          return h('tr', null, U.td(J.productLabel(p)), h('td', { class: 'n' }, h('input', { class: 'inp sm', inputmode: 'decimal', value: s.qty || '', style: { width: '90px', marginLeft: 'auto' }, oninput: (e) => { s.qty = J.parseNum(e.target.value); upd(); } })),
            h('td', { class: 'n' }, h('input', { class: 'inp sm', inputmode: 'decimal', value: J.fmt(s.unitCost, '').replace(/ /g, ' '), style: { width: '110px', marginLeft: 'auto' }, oninput: (e) => { s.unitCost = J.toC(e.target.value); upd(); } })), U.td(val, 1));
        })) : h('div', { class: 'alert' }, icon('alert'), h('span', null, 'Ajoutez d’abord les produits au ', h('a', { href: '#/catalogue' }, 'catalogue'), ' pour saisir le stock de départ.'))));
      // Trésorerie
      wrap.appendChild(h('div', { class: 'card' }, h('h2', null, '4. Argent disponible'), h('div', { class: 'grid g4' }, money('En caisse (cash)', 'cash'), money('En banque', 'bank'), money('Sur MonCash', 'moncash'), money('Sur NatCash', 'natcash'))));
      // Créances et dettes
      const debts = (title, list, kind) => {
        const lst = h('div', { class: 'list' });
        list.forEach((d, i) => {
          const who = kind === 'client' ? J.byId('clients', d.clientId) : J.byId('suppliers', d.supplierId);
          lst.appendChild(h('div', { class: 'item' }, h('div', { class: 'main' }, h('b', null, who ? who.name : '?')), h('b', null, J.fmt(d.amount)), h('button', { class: 'iconbtn', onclick: () => { list.splice(i, 1); drawAll(); } }, icon('trash'))));
        });
        const add = () => {
          const pick = (p) => {
            const f = U.field('Montant', 'money', '');
            U.modal(`${kind === 'client' ? 'Ce que doit' : 'Ce que l’entreprise doit à'} ${p.name}`, f, [{ label: 'Ajouter', icon: 'check', click: () => { list.push(kind === 'client' ? { clientId: p.id, amount: f.get() } : { supplierId: p.id, amount: f.get() }); drawAll(); } }]);
          };
          if (kind === 'client') A.pickClient((c) => { if (c) pick(c); else U.toast('Choisissez un client enregistré.', 'err'); });
          else {
            const sel = U.field('Fournisseur', 'select', '', { options: J.db.suppliers.map((s) => [s.id, s.name]) });
            U.modal('Dette fournisseur', h('div', null, sel, h('button', { class: 'btn sm light', onclick: () => A.supplierForm(null, () => { drawAll(); }) }, icon('plus'), 'Nouveau fournisseur')),
              [{ label: 'Continuer', click: () => { const s = J.byId('suppliers', sel.get()); if (!s) throw new Error('Choisissez un fournisseur.'); pick(s); } }]);
          }
        };
        return h('div', { class: 'card' }, h('h2', null, title, h('button', { class: 'btn sm light', onclick: add }, icon('plus'), 'Ajouter')), list.length ? lst : h('p', { class: 'muted small' }, 'Aucun.'));
      };
      wrap.appendChild(h('div', { class: 'grid g2 stack' }, debts('5. Argent que des clients doivent déjà', st.clientDebts, 'client'), debts('6. Dettes envers les fournisseurs', st.supplierDebts, 'fournisseur')));
      wrap.appendChild(h('div', { class: 'card' }, h('h2', null, '7. Prêts et emprunts'), money('Total des emprunts à rembourser', 'loans'),
        h('p', { class: 'muted small' }, 'Le capital (apport du propriétaire) est calculé automatiquement : ce que l’entreprise possède − ce qu’elle doit. Ainsi le bilan est toujours équilibré.')));
      calc();
    };
    const validate = async () => {
      const stock = Object.keys(st.stock).filter((k) => st.stock[k].qty > 0).map((k) => ({ productId: k, qty: st.stock[k].qty, unitCost: st.stock[k].unitCost }));
      if (!(await U.confirm("Valider le bilan d'ouverture ?", 'Une fois validé, il ne pourra plus être modifié (les corrections se feront par écritures). Vérifiez bien les montants.', 'Valider'))) return;
      const e = J.saveOpening({ date: st.date, assets: st.assets, stock, cash: st.cash, bank: st.bank, moncash: st.moncash, natcash: st.natcash, clientDebts: st.clientDebts, supplierDebts: st.supplierDebts, loans: st.loans }, A.user);
      A.openingDraft = null;
      U.toast(`Bilan d'ouverture validé. Capital : ${J.fmt(e.capital)}.`, 'ok');
      redraw();
    };
    drawAll();
    return h('div', null, wrap, summary);
  };

  /** Fiche d'un bien (ouverture ou achat) avec aperçu du tableau d'amortissement. */
  const assetDialog = (a, cb, openingDate, purchase) => {
    a = Object.assign({ acc: '2181', qty: 1, residual: 0, date: openingDate || J.today() }, a || {});
    const cat0 = J.ASSET_CATEGORIES.find((c) => c.acc === a.acc);
    if (!a.lifeMonths) a.lifeMonths = cat0.life;
    let mode = 'cash';
    let payStatus = 'full';
    const f = {
      name: U.field('Désignation', 'text', a.name, { placeholder: 'ex. 6 panneaux 400 W + 4 batteries + onduleur' }),
      cat: U.field('Catégorie', 'select', a.acc, { options: J.ASSET_CATEGORIES.map((c) => [c.acc, `${c.label} (${c.acc})`]) }),
      qty: U.field('Quantité', 'qty', a.qty), cost: U.field('Coût total d’achat', 'money', a.cost),
      date: U.field("Date d'achat", 'date', a.date), sdate: U.field('Mise en service', 'date', a.serviceDate || a.date, { hint: 'début de l’amortissement' }),
      years: U.field('Durée de vie (années)', 'qty', J.fmtQty(a.lifeMonths / 12)), res: U.field('Valeur résiduelle', 'money', a.residual, { hint: 'souvent 0' }),
      act: U.field('Activité', 'select', a.act || 'C', { options: [['C', 'Commun'], ['GL', 'Crème glacée'], ['S', 'Services agricoles']] }),
    };
    const acc = !purchase ? U.field('Amortissements déjà faits avant la date de départ', 'money', a.accumulated, { hint: 'calculé automatiquement' }) : null;
    let accTouched = false;
    if (acc) acc.input.addEventListener('input', () => { accTouched = true; });
    const prev = h('div');
    const read = () => ({ name: f.name.get(), acc: f.cat.get(), qty: f.qty.get() || 1, cost: f.cost.get(), date: f.date.get(), serviceDate: f.sdate.get() || f.date.get(), lifeMonths: Math.round(f.years.get() * 12), residual: f.res.get(), act: f.act.get() });
    const upd = () => {
      const x = read();
      prev.innerHTML = '';
      if (!(x.cost > 0 && x.lifeMonths > 0)) return;
      const tmp = Object.assign({}, x, { depStart: x.serviceDate.slice(0, 7) });
      if (acc && !accTouched) acc.input.value = J.fmt(J.accumulatedBefore(tmp, (openingDate || J.today()).slice(0, 7)), '').replace(/ /g, ' ');
      const rows = J.depSchedule(tmp);
      prev.appendChild(h('div', null, h('p', { class: 'small' }, 'Dotation : ', h('b', null, J.fmt(J.monthlyDep(tmp)) + ' / mois'), ' · ', h('b', null, J.fmt(J.monthlyDep(tmp) * 12) + ' / an'), ` · taux ${(100 / (x.lifeMonths / 12)).toFixed(1).replace('.', ',')} %`),
        U.table(['Année', { t: 'Mois', n: 1 }, { t: 'Dotation', n: 1 }, { t: 'Cumul', n: 1 }, { t: 'Valeur nette', n: 1 }], rows.map((r) => h('tr', null, U.td(r.year), U.td(r.months, 1), U.td(J.fmt(r.dot, ''), 1), U.td(J.fmt(r.cum, ''), 1), U.td(J.fmt(r.vnc, ''), 1))))));
    };
    f.cat.input.addEventListener('change', () => { const c = J.ASSET_CATEGORIES.find((k) => k.acc === f.cat.get()); f.years.input.value = J.fmtQty(c.life / 12); upd(); });
    [f.cost, f.date, f.sdate, f.years, f.res].forEach((x) => x.input.addEventListener('input', upd));
    f.date.input.addEventListener('change', () => { if (!f.sdate.input.value || f.sdate.input.value < f.date.input.value) f.sdate.input.value = f.date.input.value; upd(); });
    const payBox = h('div');
    const paid = U.field('Montant payé maintenant', 'money', '');
    const drawPay = () => {
      payBox.innerHTML = '';
      if (!purchase) return;
      payBox.append(h('label', { class: 'f' }, 'Paiement'), U.seg([['full', 'Payé'], ['partial', 'Partiel'], ['credit', 'À crédit']], payStatus, (v) => { payStatus = v; drawPay(); }, true));
      if (payStatus !== 'credit') payBox.append(h('div', { style: { height: '8px' } }), U.seg(J.PAY_MODES.map((m) => [m.id, m.label]), mode, (v) => { mode = v; }, true));
      if (payStatus === 'partial') payBox.append(paid);
    };
    drawPay();
    setTimeout(upd, 0);
    U.modal(purchase ? 'Achat d’un équipement (immobilisation)' : 'Bien déjà possédé', h('div', null, f.name, h('div', { class: 'grid g2' }, f.cat, f.qty), h('div', { class: 'grid g2' }, f.cost, f.act),
      h('div', { class: 'grid g2' }, f.date, f.sdate), h('div', { class: 'grid g2' }, f.years, f.res), acc, payBox,
      h('h3', { style: { fontSize: '15px', margin: '10px 0 6px', color: 'var(--p)' } }, "Tableau d'amortissement linéaire"), prev),
    [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer', icon: 'check', cls: 'gold', click: () => {
      const x = read();
      if (!x.name || !(x.cost > 0) || !(x.lifeMonths > 0)) throw new Error('Désignation, coût et durée de vie obligatoires.');
      if (x.residual >= x.cost) throw new Error('La valeur résiduelle doit être inférieure au coût.');
      if (acc) x.accumulated = acc.get();
      if (purchase) x.pay = { mode: payStatus === 'credit' ? 'credit' : mode, paid: payStatus === 'full' ? x.cost : payStatus === 'credit' ? 0 : paid.get() };
      cb(x);
    } }], { wide: true, sticky: true });
  };

  /* ----- Immobilisations & amortissements ----- */
  C.immo = (redraw) => {
    const list = J.db.assets;
    const active = list.filter((a) => !a.disposedMonth);
    const brut = active.reduce((s, a) => s + a.cost, 0);
    const cum = active.reduce((s, a) => s + (a.accumulated || 0) + (a.depPosted || 0), 0);
    const yearDot = active.reduce((s, a) => s + J.monthlyDep(a) * 12, 0);
    const until = J.db.depPostedUntil;
    const thisMonth = J.monthKey();
    const lastFull = J.monthKey(new Date(Date.UTC(+thisMonth.slice(0, 4), +thisMonth.slice(5, 7) - 2, 15)).toISOString());
    const late = until && until < lastFull;
    const monthIn = h('input', { type: 'month', class: 'inp sm', value: until && until >= lastFull ? thisMonth : lastFull, style: { width: 'auto', marginTop: 0 } });
    const post = U.safe(async () => {
      const m = monthIn.value;
      if (!m) throw new Error('Choisissez le mois.');
      if (!(await U.confirm('Passer les amortissements ?', `Une écriture par mois sera passée (681 Dotations / 28xx Amortissements) jusqu'à ${m.slice(5)}/${m.slice(0, 4)} inclus.`, 'Passer les écritures'))) return;
      const n = J.postDepreciation(m, A.user);
      U.toast(n ? `${n} écriture(s) d'amortissement passée(s).` : 'Rien à amortir pour cette période.', 'ok'); redraw();
    });
    const buy = () => assetDialog(null, (x) => { J.addAsset(x, x.pay.mode, A.user, x.pay.paid); U.toast('Équipement enregistré.', 'ok'); redraw(); }, null, true);
    const dispose = (a) => {
      let mode = 'cash';
      const d = U.field('Date de sortie', 'date', J.today());
      const p = U.field('Prix de vente (0 si jeté / hors service)', 'money', '');
      const r = U.field('Motif', 'text', '', { placeholder: 'ex. vendu, en panne, volé…' });
      U.modal(`Sortie du bien — ${a.name}`, h('div', null, h('p', null, `Valeur nette actuelle : `, h('b', null, J.fmt(J.assetNBV(a))), '. Les amortissements jusqu’au mois de sortie seront passés automatiquement.'),
        h('div', { class: 'grid g2' }, d, p), r, h('label', { class: 'f' }, 'Prix encaissé en'), U.seg(J.PAY_MODES.map((m) => [m.id, m.label]).concat([['credit', 'À crédit']]), mode, (v) => { mode = v; }, true)),
      [{ label: 'Annuler', cls: 'light' }, { label: 'Sortir le bien', cls: 'danger', click: () => {
        const res = J.disposeAsset(a.id, { date: d.get(), price: p.get(), mode, reason: r.get() }, A.user);
        U.toast(res.gain >= 0 ? `Sortie enregistrée. Plus-value : ${J.fmt(res.gain)}.` : `Sortie enregistrée. Moins-value : ${J.fmt(-res.gain)}.`, 'ok'); redraw();
      } }]);
    };
    const detail = (a) => {
      const rows = J.depSchedule(a);
      const done = (a.accumulated || 0) + (a.depPosted || 0);
      U.modal(a.name, h('div', null,
        h('p', { class: 'muted' }, `${(J.ASSET_CATEGORIES.find((c) => c.acc === a.acc) || {}).label} · compte ${a.acc} / ${a.dep} · acheté le ${J.fmtDate(a.date)} · mise en service ${J.fmtDate(a.serviceDate || a.date)}`),
        h('div', { class: 'grid g4' }, U.kpi('Coût', J.fmt(a.cost)), U.kpi('Amorti', J.fmt(done), `${Math.round((done / Math.max(1, J.depBase(a))) * 100)} %`, 'gold'), U.kpi('Valeur nette', J.fmt(a.cost - done), null, 'blue'), U.kpi('Dotation', J.fmt(J.monthlyDep(a)), `par mois · ${a.lifeMonths / 12} an(s)`)),
        a.disposal ? h('div', { class: 'alert', style: { marginTop: '10px' } }, icon('alert'), `Sorti le ${J.fmtDate(a.disposal.date)} — prix ${J.fmt(a.disposal.price)}, VNC ${J.fmt(a.disposal.nbv)}, ${a.disposal.gain >= 0 ? 'plus' : 'moins'}-value ${J.fmt(Math.abs(a.disposal.gain))}. ${a.disposal.reason}`) : null,
        h('h3', { style: { fontSize: '15px', margin: '14px 0 6px', color: 'var(--p)' } }, "Tableau d'amortissement linéaire"),
        U.table(['Année', { t: 'Mois', n: 1 }, { t: 'Dotation', n: 1 }, { t: 'Cumul', n: 1 }, { t: 'Valeur nette', n: 1 }], rows.map((r) => h('tr', null, U.td(r.year), U.td(r.months, 1), U.td(J.fmt(r.dot, ''), 1), U.td(J.fmt(r.cum, ''), 1), U.td(J.fmt(r.vnc, ''), 1))))),
      [a.disposedMonth ? null : { label: 'Vendre / mettre au rebut', icon: 'x', cls: 'light', click: () => dispose(a) },
        { label: 'Imprimer', icon: 'print', keep: true, click: () => J.print.printHTML(h('div', { class: 'invoice' }, h('h2', null, `Tableau d'amortissement — ${a.name}`), h('p', null, `Coût ${J.fmt(a.cost)} · durée ${a.lifeMonths / 12} an(s) · mise en service ${J.fmtDate(a.serviceDate || a.date)} · linéaire`),
          h('table', null, h('thead', null, h('tr', null, ['Année', 'Mois', 'Dotation', 'Cumul', 'Valeur nette'].map((x) => h('th', null, x)))), h('tbody', null, rows.map((r) => h('tr', null, [r.year, r.months, J.fmt(r.dot), J.fmt(r.cum), J.fmt(r.vnc)].map((x) => h('td', null, x))))))).outerHTML, 'A4') }].filter(Boolean), { wide: true });
    };
    return h('div', null,
      h('div', { class: 'grid g4' }, U.kpi('Valeur d’achat', J.fmt(brut), `${active.length} bien(s) en service`), U.kpi('Amortissements cumulés', J.fmt(cum), null, 'gold'), U.kpi('Valeur nette comptable', J.fmt(brut - cum), null, 'blue'), U.kpi('Dotation annuelle', J.fmt(yearDot), 'linéaire', 'red')),
      h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Amortissements mensuels'),
        h('p', { class: 'muted small' }, until ? `Amortissements passés jusqu'à ${until.slice(5)}/${until.slice(0, 4)}.` : 'Aucun amortissement passé pour le moment.'),
        late ? h('div', { class: 'alert', style: { marginBottom: '10px' } }, icon('clock'), 'Des mois ne sont pas encore amortis.') : null,
        h('div', { class: 'row' }, h('span', null, "Passer jusqu'au mois"), monthIn, h('button', { class: 'btn gold', onclick: post, disabled: !list.length }, icon('check'), 'Passer les amortissements'))),
      h('div', { class: 'card' }, h('h2', null, 'Registre des immobilisations', h('button', { class: 'btn sm gold', onclick: buy }, icon('plus'), 'Achat d’un équipement')),
        list.length ? U.table(['Bien', 'Catégorie', 'Mise en service', { t: 'Durée', n: 1 }, { t: 'Coût', n: 1 }, { t: 'Dotation / mois', n: 1 }, { t: 'Cumul', n: 1 }, { t: 'VNC', n: 1 }, ''],
          list.map((a) => {
            const done = (a.accumulated || 0) + (a.depPosted || 0);
            const pctDone = Math.round((done / Math.max(1, J.depBase(a))) * 100);
            return h('tr', { class: 'click', onclick: () => detail(a) }, U.td(h('b', null, a.name + (a.qty > 1 ? ` × ${J.fmtQty(a.qty)}` : ''))), U.td((J.ASSET_CATEGORIES.find((c) => c.acc === a.acc) || {}).label), U.td(J.fmtDate(a.serviceDate || a.date)),
              U.td(`${J.fmtQty(a.lifeMonths / 12)} an(s)`, 1), U.td(J.fmt(a.cost, ''), 1), U.td(J.fmt(J.monthlyDep(a), ''), 1), U.td(J.fmt(done, ''), 1), U.td(h('b', null, J.fmt(a.cost - done, '')), 1),
              U.td(a.disposedMonth ? h('span', { class: 'tag grey' }, 'Sorti') : pctDone >= 100 ? h('span', { class: 'tag gold' }, 'Totalement amorti') : h('span', { class: 'tag' }, pctDone + ' %')));
          })) : U.empty('sun', 'Aucun bien. Ajoutez-les dans le bilan d’ouverture ou avec « Achat d’un équipement ».')),
      h('p', { class: 'small muted' }, 'Méthode : amortissement linéaire mensuel à partir du mois de mise en service. Dotation = (coût − valeur résiduelle) ÷ durée en mois ; le dernier mois corrige l’arrondi pour finir exactement à la valeur résiduelle. Durées proposées (à valider) : solaire 10 ans, congélateurs 5 ans, glacières 3 ans, matériel agricole 8 ans, transport 5 ans, informatique 3 ans, mobilier 5 ans.'));
  };

  /* ----- Journal, grand livre, balance ----- */
  const entryTable = (e) => U.table(['Compte', 'Libellé', { t: 'Débit', n: 1 }, { t: 'Crédit', n: 1 }], e.lines.map((l) => h('tr', null, U.td(h('b', null, l.account)), U.td(accName(l.account)), U.td(l.debit ? J.fmt(l.debit, '') : '', 1), U.td(l.credit ? J.fmt(l.credit, '') : '', 1))),
    h('tr', null, h('td', null, 'Total'), h('td'), U.td(J.fmt(e.lines.reduce((a, l) => a + l.debit, 0), ''), 1), U.td(J.fmt(e.lines.reduce((a, l) => a + l.credit, 0), ''), 1)));
  C.journal = () => {
    const box = h('div');
    const per = A.period((st) => {
      box.innerHTML = '';
      const rows = J.db.entries.filter((e) => J.inRange(e.date, st.from, st.to)).sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
      const td = rows.reduce((a, e) => a + e.lines.reduce((x, l) => x + l.debit, 0), 0);
      box.append(h('div', { class: 'row between', style: { marginBottom: '10px' } }, h('span', { class: 'muted' }, `${rows.length} écriture(s) · total ${J.fmt(td)}`),
        h('button', { class: 'btn sm light', onclick: () => U.download('journal.csv', U.csv([['Date', 'Libellé', 'Compte', 'Intitulé', 'Débit', 'Crédit']].concat(...rows.map((e) => e.lines.map((l) => [J.fmtDate(e.date), e.label, l.account, accName(l.account), J.fromC(l.debit), J.fromC(l.credit)])))), 'text/csv') }, icon('download'), 'CSV')));
      rows.slice().reverse().slice(0, 200).forEach((e) => box.appendChild(h('div', { class: 'card' }, h('h2', null, h('span', null, `${J.fmtDate(e.date)} — ${e.label}`)), entryTable(e))));
    });
    setTimeout(per.start, 0);
    return h('div', null, per, box);
  };
  C.grandlivre = () => {
    const box = h('div');
    let acc = '531';
    let st = { from: null, to: null };
    const draw = () => {
      box.innerHTML = '';
      const L = J.ledger(J.db.entries, acc, st.from, st.to);
      box.appendChild(h('div', { class: 'card' }, h('h2', null, `${acc} — ${accName(acc)}`, h('span', { class: 'tag' }, 'Solde ' + J.fmt(L.end))),
        U.table(['Date', 'Libellé', { t: 'Débit', n: 1 }, { t: 'Crédit', n: 1 }, { t: 'Solde', n: 1 }],
          [st.from ? h('tr', null, U.td(J.fmtDate(st.from)), U.td(h('i', null, 'Solde antérieur')), h('td'), h('td'), U.td(J.fmt(L.before, ''), 1)) : null].concat(L.rows.map((r) => h('tr', null, U.td(J.fmtDate(r.date)), U.td(r.label), U.td(r.debit ? J.fmt(r.debit, '') : '', 1), U.td(r.credit ? J.fmt(r.credit, '') : '', 1), U.td(h('b', null, J.fmt(r.solde, '')), 1)))))));
    };
    const used = new Set(); J.db.entries.forEach((e) => e.lines.forEach((l) => used.add(l.account)));
    const sel = U.field('Compte', 'select', acc, { options: J.db.accounts.filter((a) => used.has(a.code)).map((a) => [a.code, `${a.code} — ${a.name}`]), onchange: (e) => { acc = e.target.value; draw(); } });
    const per = A.period((s) => { st = s; draw(); }, 'tout');
    setTimeout(per.start, 0);
    return h('div', null, h('div', { style: { maxWidth: '520px' } }, sel), per, box);
  };
  C.balance = () => {
    const box = h('div');
    const per = A.period((st) => {
      box.innerHTML = '';
      const tb = J.trialBalance(J.db.entries, J.db.accounts, st.from, st.to);
      box.appendChild(h('div', { class: 'card' }, h('h2', null, 'Balance générale', tb.balanced ? h('span', { class: 'tag' }, icon('check'), 'Débit = Crédit') : h('span', { class: 'tag red' }, 'Déséquilibre')),
        U.table(['Compte', 'Intitulé', { t: 'Débit', n: 1 }, { t: 'Crédit', n: 1 }, { t: 'Solde débiteur', n: 1 }, { t: 'Solde créditeur', n: 1 }],
          tb.rows.map((r) => h('tr', null, U.td(h('b', null, r.code)), U.td(r.name), U.td(J.fmt(r.debit, ''), 1), U.td(J.fmt(r.credit, ''), 1), U.td(r.solde > 0 ? J.fmt(r.solde, '') : '', 1), U.td(r.solde < 0 ? J.fmt(-r.solde, '') : '', 1))),
          h('tr', null, h('td', null, 'TOTAL'), h('td'), U.td(J.fmt(tb.totalDebit, ''), 1), U.td(J.fmt(tb.totalCredit, ''), 1), U.td(J.fmt(tb.rows.reduce((a, r) => a + Math.max(0, r.solde), 0), ''), 1), U.td(J.fmt(tb.rows.reduce((a, r) => a + Math.max(0, -r.solde), 0), ''), 1)))));
    }, 'tout');
    setTimeout(per.start, 0);
    return h('div', null, per, box);
  };

  /* ----- Bilan ----- */
  C.bilan = () => {
    const to = J.today();
    const bs = J.balanceSheet(J.db.entries, J.db.accounts, to);
    const tb = J.trialBalance(J.db.entries, J.db.accounts, null, to);
    const sol = (code) => (tb.rows.find((r) => r.code === code) || { solde: 0 }).solde;
    const immo = J.ASSET_CATEGORIES.map((c) => ({ l: c.label, brut: sol(c.acc), am: -sol(c.dep) })).filter((x) => x.brut || x.am);
    const row = (l, v, b) => h('tr', null, U.td(b ? h('b', null, l) : l), U.td(b ? h('b', null, J.fmt(v, '')) : J.fmt(v, ''), 1));
    const treso = ['531', '512', '5141', '5142'].map((c) => [accName(c), sol(c)]).filter((x) => x[1]);
    const actif = h('div', { class: 'card' }, h('h2', null, 'ACTIF'), U.table(['', { t: 'Brut', n: 1 }, { t: 'Amort.', n: 1 }, { t: 'Net', n: 1 }],
      immo.map((x) => h('tr', null, U.td(x.l), U.td(J.fmt(x.brut, ''), 1), U.td(J.fmt(x.am, ''), 1), U.td(J.fmt(x.brut - x.am, ''), 1)))
        .concat([h('tr', null, U.td(h('b', null, 'Immobilisations nettes')), h('td'), h('td'), U.td(h('b', null, J.fmt(immo.reduce((a, x) => a + x.brut - x.am, 0), '')), 1))]),
      null), U.table(['', { t: 'Montant', n: 1 }], [row('Stock de crème glacée', sol('37')), row('Clients (créances)', sol('411'))].concat(treso.map(([l, v]) => row(l, v))),
      row('TOTAL ACTIF', bs.totalAssets, true)));
    const passif = h('div', { class: 'card' }, h('h2', null, 'PASSIF'), U.table(['', { t: 'Montant', n: 1 }], [
      row('Capital — apport du propriétaire', -sol('101')), row("Compte de l'exploitant", -sol('108')), row('Résultat de la période', bs.result),
      row('Capitaux propres', -sol('101') - sol('108') + bs.result, true), row('Emprunts', -sol('164')), row('Fournisseurs', -sol('401')), sol('421') ? row('Personnel', -sol('421')) : null,
      row('TOTAL PASSIF', bs.totalLiab, true)].filter(Boolean)));
    return h('div', null, h('p', { class: 'muted' }, `Bilan au ${J.fmtDate(to)} `, bs.balanced ? h('span', { class: 'tag' }, icon('check'), 'Actif = Passif') : h('span', { class: 'tag red' }, 'Écart ' + J.fmt(bs.totalAssets - bs.totalLiab))),
      h('div', { class: 'grid g2 stack' }, actif, passif));
  };

  /* ----- Compte de résultat par activité ----- */
  C.resultat = () => {
    const box = h('div');
    const per = A.period((st) => {
      box.innerHTML = '';
      const is = J.incomeStatement(J.db.entries, J.db.accounts, st.from, st.to);
      const acts = ['S', 'GL', 'C'];
      const codes = [...new Set(Object.keys(is.detail).map((k) => k.split('|')[0]))].sort();
      const v = (code, act) => is.detail[code + '|' + act] || 0;
      const line = (code) => h('tr', null, U.td(`${code} — ${accName(code)}`), acts.map((a) => U.td(v(code, a) ? J.fmt(v(code, a), '') : '', 1)), U.td(h('b', null, J.fmt(acts.reduce((x, a) => x + v(code, a), 0), '')), 1));
      const tot = (label, key) => h('tr', null, U.td(h('b', null, label)), acts.map((a) => U.td(h('b', null, J.fmt(is.byAct[a][key], '')), 1)), U.td(h('b', null, J.fmt(acts.reduce((x, a) => x + is.byAct[a][key], 0), '')), 1));
      const g = is.glMargin;
      box.append(
        h('div', { class: 'grid g4' }, U.kpi('Produits', J.fmt(is.revenue)), U.kpi('Charges', J.fmt(is.expenses), null, 'red'), U.kpi('Résultat', J.fmt(is.result), is.result >= 0 ? 'bénéfice' : 'perte', is.result >= 0 ? 'gold' : 'red'), U.kpi('Résultat services', J.fmt(is.byAct.S.result), `glace : ${J.fmt(is.byAct.GL.result)}`, 'blue')),
        h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, `Compte de résultat par activité — ${per.label()}`),
          U.table(['', { t: 'Services agricoles', n: 1 }, { t: 'Crème glacée', n: 1 }, { t: 'Commun', n: 1 }, { t: 'Total', n: 1 }],
            [h('tr', null, h('td', { colspan: 5 }, h('b', { class: 'green' }, 'PRODUITS')))].concat(codes.filter((c) => c[0] === '7').map(line), [tot('Total produits', 'rev'), h('tr', null, h('td', { colspan: 5 }, h('b', { class: 'red' }, 'CHARGES')))], codes.filter((c) => c[0] === '6').map(line), [tot('Total charges', 'exp'), tot('RÉSULTAT', 'result')]))),
        h('div', { class: 'card' }, h('h2', null, 'Marge crème glacée : gros / détail'),
          U.table(['', { t: 'Ventes', n: 1 }, { t: 'Coût d’achat', n: 1 }, { t: 'Marge', n: 1 }, { t: 'Taux', n: 1 }], [['Gros', g.gros], ['Détail', g.detail]].map(([l, x]) => h('tr', null, U.td(l), U.td(J.fmt(x.rev, ''), 1), U.td(J.fmt(x.cost, ''), 1), U.td(h('b', null, J.fmt(x.rev - x.cost, '')), 1), U.td(x.rev ? Math.round(((x.rev - x.cost) / x.rev) * 100) + ' %' : '—', 1))))));
    });
    setTimeout(per.start, 0);
    return h('div', null, per, box);
  };

  /* ----- Trésorerie ----- */
  C.tresorerie = (redraw) => {
    const tb = J.trialBalance(J.db.entries, J.db.accounts);
    const sol = (c) => (tb.rows.find((r) => r.code === c) || { solde: 0 }).solde;
    const form = (kind) => {
      let m1 = 'cash'; let m2 = 'virement';
      const a = U.field('Montant', 'money', ''); const d = U.field('Date', 'date', J.today()); const l = U.field('Libellé', 'text', '');
      const titles = { apport: 'Apport du propriétaire', retrait: 'Retrait du propriétaire', transfert: 'Transfert entre comptes' };
      U.modal(titles[kind], h('div', null, h('div', { class: 'grid g2' }, a, d), l, h('label', { class: 'f' }, kind === 'transfert' ? 'De' : 'Compte'), U.seg(J.PAY_MODES.filter((x) => x.id !== 'cheque').map((x) => [x.id, x.label]), m1, (v) => { m1 = v; }, true),
        kind === 'transfert' ? [h('label', { class: 'f', style: { marginTop: '10px' } }, 'Vers'), U.seg(J.PAY_MODES.filter((x) => x.id !== 'cheque').map((x) => [x.id, x.label]), m2, (v) => { m2 = v; }, true)] : null),
      [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer', icon: 'check', click: () => { J.treasuryMove(kind, a.get(), m1, m2, l.get(), d.get(), A.user); U.toast('Mouvement enregistré.', 'ok'); redraw(); } }]);
    };
    return h('div', null, h('div', { class: 'grid g4' }, U.kpi('Caisse', J.fmt(sol('531'))), U.kpi('Banque', J.fmt(sol('512')), null, 'blue'), U.kpi('MonCash', J.fmt(sol('5141')), null, 'red'), U.kpi('NatCash', J.fmt(sol('5142')), null, 'gold')),
      h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn light', onclick: () => form('apport') }, icon('plus'), 'Apport du propriétaire'), h('button', { class: 'btn light', onclick: () => form('retrait') }, icon('minus'), 'Retrait du propriétaire'), h('button', { class: 'btn light', onclick: () => form('transfert') }, icon('refresh'), 'Transfert (ex. caisse → banque)')));
  };

  /* ----- Plan comptable ----- */
  C.plan = (redraw) => {
    const T = { A: 'Actif', P: 'Passif', K: 'Capitaux', C: 'Charge', R: 'Produit' };
    const edit = (a) => {
      const isNew = !a;
      a = a || { type: 'C' };
      const c = U.field('Numéro de compte', 'text', a.code); const n = U.field('Intitulé', 'text', a.name); const t = U.field('Nature', 'select', a.type, { options: Object.entries(T) });
      if (!isNew) c.input.disabled = true;
      U.modal(isNew ? 'Nouveau compte' : 'Modifier le compte', h('div', null, c, n, t), [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer', icon: 'check', click: () => {
        if (isNew) { if (!/^\d{2,8}$/.test(c.get())) throw new Error('Numéro invalide.'); if (J.db.accounts.some((x) => x.code === c.get())) throw new Error('Ce compte existe déjà.'); J.db.accounts.push({ code: c.get(), name: n.get(), type: t.get() }); J.db.accounts.sort((x, y) => x.code.localeCompare(y.code)); } else Object.assign(a, { name: n.get(), type: t.get() });
        J.save(); redraw();
      } }]);
    };
    return h('div', { class: 'card' }, h('h2', null, 'Plan comptable proposé — à valider', h('button', { class: 'btn sm gold', onclick: () => edit() }, icon('plus'), 'Compte')),
      h('p', { class: 'small muted' }, 'Inspiré du plan comptable général. Produits séparés par activité : 7061 services agricoles, 7071 glace en gros, 7072 glace au détail. Stock suivi en inventaire permanent (coût moyen pondéré).'),
      U.table(['N°', 'Intitulé', 'Nature'], J.db.accounts.map((a) => h('tr', { class: 'click', onclick: () => edit(a) }, U.td(h('b', null, a.code)), U.td(a.name), U.td(h('span', { class: 'tag ' + ({ A: 'blue', P: 'red', K: 'gold', C: 'red', R: '' }[a.type]) }, T[a.type] + (a.contra ? ' (amort.)' : '')))))));
  };

  /* ================= PARAMÈTRES ================= */
  A.screens.parametres = () => {
    const s = J.db.settings;
    const f = {
      name: U.field('Nom commercial', 'text', s.name), slogan: U.field('Slogan', 'text', s.slogan), owner: U.field('Propriétaire', 'text', s.owner), phone: U.field('Téléphone(s)', 'tel', s.phone),
      address: U.field('Adresse', 'text', s.address), nif: U.field('NIF', 'text', s.nif), ninu: U.field('NINU', 'text', s.ninu), rc: U.field("N° d'immatriculation", 'text', s.rc),
      footer: U.field('Texte en bas de la fiche', 'text', s.footer), prefix: U.field('Préfixe des fiches', 'text', s.slipPrefix), next: U.field('Prochain numéro de fiche', 'number', s.nextSlipNo),
      rate: U.field('Taux du dollar (HTG pour 1 USD)', 'number', s.usdRate ? J.fmtQty(s.usdRate / 100) : ''), width: U.field('Largeur du papier', 'select', s.ticketWidth, { options: [[58, '58 mm'], [80, '80 mm']] }),
      mode: U.field("Mode d'impression", 'select', s.printMode, { options: [['escpos', 'Imprimante thermique Bluetooth ESC/POS (via RawBT)'], ['browser', 'Impression du système (PC / Android)']] }),
      model: U.field("Modèle d'imprimante", 'text', s.printerModel),
      acc: U.field('Accents sur le ticket thermique', 'select', s.escposAccents, { options: [['ascii', 'Sans accents (sûr : é → e)'], ['cp858', 'Avec accents (page PC858, si l’imprimante le supporte)']] }),
      maxd: U.field('Réduction maximale du vendeur (%)', 'number', s.sellerMaxDiscountPct), days: U.field('Délai de crédit par défaut (jours)', 'number', s.creditDefaultDays),
      loyal: U.field('1 point fidélité tous les', 'money', s.loyaltyPer),
    };
    const chk = (label, key) => { const el = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!s[key] }), label); el.key = key; return el; };
    const pchecks = [chk('Imprimer le logo sur le ticket thermique', 'escposLogo'), chk('Couper le papier (imprimante 80 mm avec massicot)', 'escposCut')];
    const checks = [chk('Activer le dollar US (USD)', 'usdEnabled'), chk('Autoriser la vente sans stock (déconseillé)', 'allowNegativeStock'), chk('Le vendeur peut déclarer les pertes', 'sellerCanDeclareLoss'), chk('Programme de fidélité (points)', 'loyaltyEnabled')];
    const logoImg = h('img', { src: A.logo(), style: { width: '90px', height: '90px', borderRadius: '50%', border: '1px solid var(--ligne)' } });
    const save = U.safe(() => {
      Object.assign(s, { name: f.name.get(), slogan: f.slogan.get(), owner: f.owner.get(), phone: f.phone.get(), address: f.address.get(), nif: f.nif.get(), ninu: f.ninu.get(), rc: f.rc.get(), footer: f.footer.get(), slipPrefix: f.prefix.get() || 'F',
        nextSlipNo: Math.max(1, Math.round(f.next.get())), usdRate: J.toC(f.rate.input.value), ticketWidth: Number(f.width.get()), printMode: f.mode.get(), printerModel: f.model.get(), escposAccents: f.acc.get(), sellerMaxDiscountPct: f.maxd.get(), creditDefaultDays: Math.round(f.days.get()) || 15, loyaltyPer: f.loyal.get() || 100000 });
      checks.concat(pchecks).forEach((c) => { s[c.key] = c.querySelector('input').checked; });
      J.save(); U.toast('Paramètres enregistrés.', 'ok'); A.render();
    });
    const demoSale = () => ({ no: J.nextSlipNo(), date: J.nowISO(), type: 'vente', status: 'valide', sellerName: A.user.name, client: { name: 'Client de passage' }, lines: [{ kind: 'product', name: 'Test d’impression — Vanille', unit: 'cornet', qty: 2, unitPrice: 5000, priceType: 'detail', gross: 10000, disc: 0, total: 10000 }], gross: 10000, totalDisc: 0, total: 10000, payments: [{ amount: 10000, mode: 'cash', atSale: true, date: J.nowISO() }] });
    const themeCard = h('div', { class: 'card' }, h('h2', null, 'Apparence — choisissez votre modèle'),
      h('p', { class: 'muted small' }, 'Touchez un modèle : il s’applique tout de suite sur cet appareil et sur les tickets / factures.'),
      h('div', { class: 'themes three' }, A.THEMES.map((t) => h('button', { class: 'tcard' + ((s.theme || 'jardin') === t.id ? ' on' : ''), 'data-theme': t.id, onclick: () => { s.theme = t.id; J.save(); U.toast(`Modèle « ${t.name} » appliqué.`, 'ok'); A.render(); } },
        h('div', { class: 'mini' }, h('div', { class: 'mt' }, h('i'), h('b')),
          s.menuTop ? h('div', { class: 'mh' }, h('span', { class: 'on' }), h('span'), h('span'), h('span')) : null,
          h('div', { class: 'mb' }, s.menuTop ? null : h('div', { class: 'ms' }, h('span', { class: 'on' }), h('span'), h('span'), h('span'), h('span')),
            h('div', { class: 'mc' }, h('div'), h('div'), h('div', { class: 'cta' }), h('div'), h('div')))),
        h('div', { class: 'tx' }, h('b', null, t.name, (s.theme || 'jardin') === t.id ? ' ✓' : ''), h('small', null, t.desc), h('div', { class: 'sw' }, t.sw.map((c) => h('i', { style: { background: c } }))))))),
      h('div', { class: 'row', style: { marginTop: '14px' } }, h('span', { class: 'small muted' }, 'Menu sur ordinateur :'),
        U.seg([['side', 'À gauche'], ['top', 'En haut']], s.menuTop ? 'top' : 'side', (v) => { s.menuTop = v === 'top'; J.save(); A.render(); })));
    return h('div', null, A.title('Paramètres', h('button', { class: 'btn gold', onclick: save }, icon('save'), 'Enregistrer')),
      themeCard,
      h('div', { class: 'card' }, h('h2', null, 'Entreprise'), h('div', { class: 'row', style: { gap: '16px', alignItems: 'center', marginBottom: '12px' } }, logoImg,
        h('div', { class: 'row' }, h('button', { class: 'btn sm light', onclick: async () => { const d = await U.pickImage(600); if (d) { s.logo = d; logoImg.src = d; J.save(); } } }, icon('image'), 'Changer le logo'), s.logo ? h('button', { class: 'btn sm ghost', onclick: () => { s.logo = null; J.save(); A.render(); } }, 'Logo d’origine') : null)),
        h('div', { class: 'grid g2 stack' }, f.name, f.slogan, f.owner, f.phone), f.address, h('div', { class: 'grid g3 stack' }, f.nif, f.ninu, f.rc)),
      h('div', { class: 'card' }, h('h2', null, 'Fiche de vente et impression', h('button', { class: 'btn sm gold', onclick: () => {
        Object.assign(s, { printerModel: 'PT-210', ticketWidth: 58, printMode: 'escpos', escposAccents: 'ascii', escposLogo: true, escposCut: false });
        J.save(); U.toast('Réglages PT-210 appliqués (58 mm, Bluetooth, ESC/POS).', 'ok'); A.render();
      } }, icon('print'), 'Préréglage PT-210')), f.footer, h('div', { class: 'grid g2 stack' }, f.prefix, f.next, f.width, f.mode, f.model, f.acc), pchecks,
        h('div', { class: 'row' }, h('button', { class: 'btn sm light', onclick: () => J.print.printHTML(J.print.ticketHTML(demoSale()), Number(f.width.get())) }, icon('print'), 'Test ticket'), h('button', { class: 'btn sm light', onclick: U.safe(() => J.print.sendEscpos(demoSale())) }, icon('print'), 'Test ESC/POS')),
        h('div', { class: 'alert green', style: { marginTop: '10px' } }, icon('print'), h('span', null, h('b', null, 'PT-210 sur Android : '), '1) Allumez l’imprimante (bouton rond). 2) Réglages du téléphone → Bluetooth → associez « PT-210 » (code 0000 ou 1234). 3) Installez l’application gratuite « RawBT » (Play Store), choisissez l’imprimante PT-210 et le mode 58 mm. 4) Dans JOYAGRI, touchez « Imprimer » sur la fiche : RawBT imprime le ticket.'))),
      h('div', { class: 'card' }, h('h2', null, 'Règles de vente'), h('div', { class: 'grid g2 stack' }, f.maxd, f.days, f.rate, f.loyal), checks),
      h('div', { class: 'row end' }, h('button', { class: 'btn light', onclick: () => U.download('profil-entreprise.json', JSON.stringify({ profile: true, settings: Object.assign({}, s, { nextSlipNo: undefined }) }, null, 2), 'application/json') }, icon('download'), 'Exporter le profil'), h('button', { class: 'btn gold', onclick: save }, icon('save'), 'Enregistrer')));
  };

  /* ================= UTILISATEURS ================= */
  A.screens.utilisateurs = () => {
    const form = (u) => {
      const isNew = !u;
      const n = U.field('Nom', 'text', u && u.name); const l = U.field('Identifiant', 'text', u && u.login);
      const r = U.field('Rôle', 'select', u ? u.role : 'seller', { options: [['seller', 'Vendeur — vend et encaisse, ne supprime rien, ne voit pas la comptabilité'], ['owner', 'Propriétaire — accès à tout']] });
      const p = U.field(isNew ? 'Mot de passe' : 'Nouveau mot de passe (laisser vide pour ne pas changer)', 'password', '');
      p.input.autocomplete = 'new-password';
      if (!isNew) l.input.disabled = true;
      U.modal(isNew ? 'Nouvel utilisateur' : `Modifier ${u.name}`, h('div', null, n, l, r, p, !isNew ? h('p', { class: 'small muted' }, 'L’ancien mot de passe n’est pas nécessaire pour en donner un nouveau.') : null),
        [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer', icon: 'check', click: () => {
          if (isNew) { J.createUser(n.get(), l.get(), r.get(), p.input.value); J.audit(A.user, 'Utilisateur créé', n.get()); } else {
            if (u.role === 'owner' && r.get() !== 'owner' && J.db.users.filter((x) => x.role === 'owner' && x.active).length < 2) throw new Error('Il faut garder au moins un propriétaire actif.');
            u.name = n.get(); u.role = r.get();
            if (p.input.value) { J.setPassword(u.id, p.input.value); J.audit(A.user, 'Mot de passe changé', u.name); }
          }
          J.save(); U.toast('Utilisateur enregistré.', 'ok'); A.render();
        } }]);
    };
    const toggle = (u) => {
      if (u.id === A.user.id) { U.toast('Vous ne pouvez pas désactiver votre propre compte.', 'err'); return; }
      u.active = !u.active; J.audit(A.user, u.active ? 'Utilisateur réactivé' : 'Utilisateur désactivé', u.name); J.save(); A.render();
    };
    return h('div', null, A.title('Utilisateurs', h('button', { class: 'btn gold', onclick: () => form() }, icon('plus'), 'Nouvel utilisateur')),
      h('div', { class: 'list' }, J.db.users.map((u) => h('div', { class: 'item' }, h('span', { class: 'avatar ' + (u.role === 'owner' ? 'gold' : '') }, U.initials(u.name)),
        h('div', { class: 'main', onclick: () => form(u) }, h('b', null, u.name), h('small', null, `identifiant : ${u.login} · ${u.role === 'owner' ? 'Propriétaire' : 'Vendeur'}`)),
        u.active ? h('span', { class: 'tag' }, 'Actif') : h('span', { class: 'tag grey' }, 'Désactivé'),
        h('button', { class: 'btn sm light', onclick: () => form(u) }, icon('lock'), 'Mot de passe'), h('button', { class: 'btn sm ghost', onclick: () => toggle(u) }, u.active ? 'Désactiver' : 'Réactiver')))),
      h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Journal des actions'), U.table(['Date', 'Utilisateur', 'Action', 'Détail'], J.db.audit.slice().reverse().slice(0, 80).map((x) => h('tr', null, U.td(J.fmtDateTime(x.date)), U.td(x.user), U.td(x.action), U.td(x.detail))))));
  };

  /* ================= SAUVEGARDE ================= */
  A.screens.sauvegarde = () => {
    const owner = J.isOwner(A.user);
    const autos = h('div', { class: 'list' }, h('p', { class: 'muted' }, 'Chargement…'));
    J.listAutoBackups().then((keys) => {
      autos.innerHTML = '';
      if (!keys.length) autos.appendChild(h('p', { class: 'muted' }, 'Aucune sauvegarde automatique pour le moment.'));
      keys.forEach((k) => autos.appendChild(h('div', { class: 'item' }, h('span', { class: 'avatar' }, icon('save')), h('div', { class: 'main' }, h('b', null, 'Sauvegarde du ' + J.fmtDate(k.slice(7)))),
        owner ? h('button', { class: 'btn sm light', onclick: U.safe(async () => {
          if (!(await U.confirm('Revenir à cette sauvegarde ?', `Les données reviendront à l'état du ${J.fmtDate(k.slice(7))}. Exportez d'abord une sauvegarde actuelle si nécessaire.`, 'Restaurer', 'danger'))) return;
          await J.replaceDB(JSON.parse(await J.getAutoBackup(k))); A.user = null; A.render();
        }) }, 'Restaurer') : null)));
    });
    const last = J.db.lastExport;
    const old = !last || J.daysBetween(J.dayKey(last), J.today()) > 7;
    return h('div', null, A.title('Sauvegarde'),
      old ? h('div', { class: 'alert', style: { marginBottom: '12px' } }, icon('alert'), last ? `Dernière sauvegarde exportée le ${J.fmtDate(last)} : pensez à en faire une nouvelle.` : 'Aucune sauvegarde exportée pour le moment.') : null,
      h('div', { class: 'grid g2 stack' },
        h('div', { class: 'card' }, h('h2', null, 'Exporter'), h('p', { class: 'muted small' }, 'Crée un fichier avec toutes les données (fiches, clients, stock, comptabilité). Gardez-le sur une clé USB, sur le PC ou envoyez-le-vous par e-mail.'),
          h('button', { class: 'btn xl gold block', onclick: A.exportBackup }, icon('download'), 'Exporter une sauvegarde'),
          h('button', { class: 'btn light block', style: { marginTop: '8px' }, onclick: () => U.download('fiches-de-vente.csv', U.csv([['N°', 'Date', 'Client', 'Vendeur', 'Total HTG', 'Payé HTG', 'Reste HTG', 'Statut']].concat(J.db.sales.filter((s) => s.type === 'vente').map((s) => [s.no, J.fmtDateTime(s.date), s.client.name, s.sellerName, J.fromC(s.total), J.fromC(J.salePaid(s)), J.fromC(J.saleRest(s)), J.PAY_STATUS_LABEL[J.payStatus(s)]]))), 'text/csv') }, icon('download'), 'Exporter les fiches (Excel / CSV)')),
        owner ? h('div', { class: 'card' }, h('h2', null, 'Restaurer'), h('p', { class: 'muted small' }, 'Remplace les données de cet appareil par celles d’un fichier de sauvegarde (par exemple pour passer du téléphone au PC).'),
          h('button', { class: 'btn xl light block', onclick: A.importFile }, icon('upload'), 'Importer un fichier')) : null),
      h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Sauvegardes automatiques (14 derniers jours)'), h('p', { class: 'muted small' }, root.JoyNative ? 'Une copie est aussi écrite chaque jour dans Documents/JOYAGRI.' : 'Une copie est gardée chaque jour sur cet appareil. Sur la version Windows / Android, une copie est aussi écrite dans Documents/JOYAGRI.'), autos),
      owner && !J.db.sales.length && J.loadDemo ? h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Données d’exemple'), h('p', { class: 'muted small' }, 'Pour s’entraîner seulement : ajoute des produits, services, clients et ventes fictifs. À ne pas utiliser sur l’appareil de production.'),
        h('button', { class: 'btn light', onclick: U.safe(async () => { if (await U.confirm('Charger des données d’exemple ?', 'Des données fictives seront ajoutées.', 'Charger')) { J.loadDemo(A.user); U.toast('Données d’exemple chargées.', 'ok'); A.go('accueil'); } }) }, 'Charger les données d’exemple')) : null);
  };
})(window);
