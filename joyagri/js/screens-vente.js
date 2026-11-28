/* JOYAGRI — écrans de vente : nouvelle fiche, fiches, crédits, clients. */
(function (root) {
  'use strict';
  const J = root.J;
  const U = J.ui;
  const A = J.app;
  const { h, icon } = U;

  const newCart = () => ({ client: null, lines: [], tab: 'glace', q: '', globalDiscType: 'pct', globalDiscValue: 0, payStatus: 'full', payMode: 'cash', paid: 0, received: 0, promiseDate: '', note: '' });
  A.cart = newCart();

  /* ================= NOUVELLE VENTE ================= */
  A.screens.vente = (main) => {
    const cart = A.cart;
    const cid = A.param('client');
    if (cid && (!cart.client || cart.client.id !== cid)) cart.client = J.byId('clients', cid) || null;
    const left = h('div');
    const right = h('div', { class: 'cartcol' });
    const sticky = h('div');
    const redraw = () => { drawLeft(); drawCart(); };
    const owner = J.isOwner(A.user);

    const qtyInCart = (id) => cart.lines.filter((l) => l.kind === 'product' && l.refId === id).reduce((a, l) => a + Number(l.qty), 0);
    const addProduct = (p) => {
      const l = cart.lines.find((x) => x.kind === 'product' && x.refId === p.id);
      if (l) l.qty = Number(l.qty) + 1;
      else cart.lines.push({ kind: 'product', refId: p.id, qty: 1, discType: 'pct', discValue: 0 });
      redraw();
    };
    const serviceDialog = (svc, line) => {
      const isNew = !line;
      line = line || { kind: 'service', refId: svc.id, qty: 1, discType: 'pct', discValue: 0, serviceDate: J.today(), serviceLocation: '', cost: 0, unitPrice: svc.price };
      const fq = U.field(`Quantité (${svc.unit})`, 'qty', J.fmtQty(line.qty));
      const fp = U.field(`Prix par ${svc.unit}`, 'money', line.unitPrice != null ? line.unitPrice : svc.price, { hint: owner ? 'modifiable par le propriétaire' : 'fixé au catalogue' });
      if (!owner) fp.input.disabled = true;
      const fd = U.field('Date de la prestation', 'date', line.serviceDate);
      const fl = U.field('Lieu de la prestation', 'text', line.serviceLocation, { placeholder: 'ex. Ravine Sèche, parcelle 3' });
      const fc = U.field('Coût engagé (carburant, main-d’œuvre)', 'money', line.cost || Math.round((svc.costPerUnit || 0) * Number(line.qty)), { hint: 'pour connaître la marge' });
      fq.input.addEventListener('input', () => { if (svc.costPerUnit) fc.input.value = J.fmt(Math.round(svc.costPerUnit * fq.get()), '').replace(/ /g, ' '); });
      U.modal(svc.name, h('div', null, svc.description ? h('p', { class: 'muted' }, svc.description) : null,
        h('div', { class: 'grid g2' }, fq, fp), h('div', { class: 'grid g2 stack' }, fd, fl), fc),
      [{ label: 'Annuler', cls: 'light' }, {
        label: isNew ? 'Ajouter à la fiche' : 'Modifier', icon: 'check', click: () => {
          if (!(fq.get() > 0)) throw new Error('Quantité invalide.');
          Object.assign(line, { qty: fq.get(), unitPrice: fp.get(), serviceDate: fd.get(), serviceLocation: fl.get(), cost: fc.get() });
          if (isNew) cart.lines.push(line);
          redraw();
        },
      }]);
    };

    /* ----- Colonne gauche : client + catalogue ----- */
    const drawLeft = () => {
      left.innerHTML = '';
      const c = cart.client;
      const clientCard = h('div', { class: 'item', onclick: () => A.pickClient((cl) => { cart.client = cl; redraw(); }) },
        h('span', { class: 'avatar ' + (c && c.type === 'grossiste' ? 'gold' : '') }, c ? U.initials(c.name) : icon('user')),
        h('div', { class: 'main' }, h('b', null, c ? c.name : 'Client de passage'),
          h('small', null, c ? [c.phone, c.type === 'grossiste' ? 'Grossiste / revendeur — prix de gros' : 'Particulier', J.clientBalance(c.id) ? `doit ${J.fmt(J.clientBalance(c.id))}` : ''].filter(Boolean).join(' · ') : 'Touchez pour choisir ou ajouter un client')),
        c ? h('button', { class: 'iconbtn', title: 'Client de passage', onclick: (e) => { e.stopPropagation(); cart.client = null; redraw(); } }, icon('x')) : icon('search'));
      const search = h('div', { class: 'search' }, icon('search'), h('input', {
        class: 'inp', placeholder: 'Chercher un produit ou un service…', value: cart.q,
        oninput: (e) => { cart.q = e.target.value; drawGrid(); },
      }));
      const tabs = U.seg([['glace', 'Crème glacée'], ['service', 'Services agricoles']], cart.tab, (v) => { cart.tab = v; drawGrid(); }, true);
      const grid = h('div', { class: 'prodgrid' });
      const drawGrid = () => {
        grid.innerHTML = '';
        const q = cart.q.toLowerCase();
        if (cart.tab === 'glace') {
          const list = J.db.products.filter((p) => p.active !== false && (!q || J.productLabel(p).toLowerCase().includes(q)));
          if (!list.length) grid.appendChild(h('div', { style: { gridColumn: '1/-1' } }, U.empty('icecream', 'Aucun produit. Ajoutez-les dans le Catalogue.', owner ? h('a', { class: 'btn light', href: '#/catalogue' }, 'Ouvrir le catalogue') : null)));
          list.forEach((p) => {
            const inCart = qtyInCart(p.id);
            const st = p.stock || 0;
            const pr = J.priceFor(p, Math.max(1, inCart), cart.client);
            grid.appendChild(h('button', { class: 'prod' + (st <= 0 && !J.db.settings.allowNegativeStock ? ' out' : ''), onclick: () => addProduct(p) },
              inCart ? h('span', { class: 'badge' }, J.fmtQty(inCart)) : null,
              h('span', { class: 'ico' }, icon('icecream')),
              h('span', { class: 'nm' }, p.name), h('span', { class: 'fm' }, [p.kind, p.format].filter(Boolean).join(' · ')),
              h('span', { class: 'pr' }, h('span', null, h('b', null, J.fmt(pr.price)), h('br'), h('span', { class: 'small muted' }, pr.type === 'gros' ? 'prix de gros' : `gros dès ${J.fmtQty(p.minWholesaleQty || 0)}`)),
                h('span', { class: 'st ' + (st <= (p.lowStock || 0) ? 'red' : 'green') }, `stock ${J.fmtQty(st)}`))));
          });
        } else {
          const list = J.db.services.filter((s) => s.active !== false && (!q || s.name.toLowerCase().includes(q)));
          if (!list.length) grid.appendChild(h('div', { style: { gridColumn: '1/-1' } }, U.empty('tractor', 'Aucun service. La liste et les prix seront ajoutés au Catalogue.')));
          list.forEach((s) => grid.appendChild(h('button', { class: 'prod svc', onclick: () => serviceDialog(s) },
            h('span', { class: 'ico' }, icon('tractor')), h('span', { class: 'nm' }, s.name), h('span', { class: 'fm' }, s.description || ''),
            h('span', { class: 'pr' }, h('span', { class: 'u' }, h('b', null, J.fmt(s.price)), h('span', { class: 'small muted' }, ' / ' + s.unit))))));
        }
      };
      drawGrid();
      left.append(clientCard, h('div', { style: { height: '10px' } }), tabs, h('div', { style: { height: '10px' } }), search, h('div', { style: { height: '10px' } }), grid);
    };

    /* ----- Colonne droite : la fiche ----- */
    const drawCart = () => {
      right.innerHTML = '';
      sticky.innerHTML = '';
      const r = J.resolveDraft(cart);
      const calc = J.saleCalc(r);
      const card = h('div', { class: 'card' });
      card.appendChild(h('h2', null, `Fiche ${J.nextSlipNo()}`, h('span', { class: 'tag grey' }, A.user.name)));
      if (!cart.lines.length) card.appendChild(h('p', { class: 'muted' }, 'Touchez un produit ou un service pour l’ajouter.'));
      calc.lines.forEach((l, i) => {
        const src = cart.lines[i];
        const isSvc = l.kind === 'service';
        const tag = isSvc ? h('span', { class: 'tag gold' }, 'Service') : l.priceType === 'gros'
          ? h('span', { class: 'tag', title: l.priceReason }, 'GROS · ' + l.priceReason) : h('span', { class: 'tag blue' }, 'Détail');
        const qty = h('div', { class: 'qty' },
          h('button', { 'aria-label': 'Moins', onclick: () => { src.qty = Math.max(0, Number(src.qty) - 1); if (src.qty <= 0) cart.lines.splice(i, 1); redraw(); } }, '−'),
          h('input', { value: J.fmtQty(src.qty), inputmode: 'decimal', 'aria-label': 'Quantité', onchange: (e) => { const v = J.parseNum(e.target.value); if (v > 0) src.qty = v; else cart.lines.splice(i, 1); redraw(); } }),
          h('button', { 'aria-label': 'Plus', onclick: () => { src.qty = Number(src.qty) + 1; redraw(); } }, '+'));
        const discBtn = h('button', { class: 'btn sm light', onclick: () => A.discountDialog(src, l.gross, redraw) }, icon('percent'), l.disc ? '-' + J.fmt(l.disc) : 'Réduction');
        card.appendChild(h('div', { class: 'cline' },
          h('div', { class: 'top' }, h('div', { class: 'nm' }, l.name, h('div', { class: 'small muted' }, `${J.fmt(l.unitPrice)} / ${l.unit || 'unité'}`,
            isSvc && (src.serviceDate || src.serviceLocation) ? ` · ${J.fmtDate(src.serviceDate)} ${src.serviceLocation ? '· ' + src.serviceLocation : ''}` : '')),
          h('b', { class: 'num' }, J.fmt(l.total)), h('button', { class: 'iconbtn', 'aria-label': 'Retirer', onclick: () => { cart.lines.splice(i, 1); redraw(); } }, icon('trash'))),
          h('div', { class: 'ctr' }, tag, h('span', { class: 'spacer' }), isSvc ? h('button', { class: 'btn sm light', onclick: () => serviceDialog(J.byId('services', src.refId), src) }, icon('edit'), J.fmtQty(src.qty) + ' ' + l.unit) : qty, discBtn)));
      });
      if (cart.lines.length) {
        const gd = h('button', { class: 'btn sm ghost', onclick: () => A.discountDialog(cart, calc.subtotal, redraw, true) }, icon('percent'), calc.globalDisc ? `Réduction fiche : -${J.fmt(calc.globalDisc)}` : 'Réduction sur toute la fiche');
        card.appendChild(h('div', { class: 'totals' },
          calc.totalDisc ? h('div', { class: 'l' }, h('span', null, 'Sous-total'), h('span', null, J.fmt(calc.gross))) : null,
          calc.lineDisc ? h('div', { class: 'l muted' }, h('span', null, 'Réductions sur lignes'), h('span', null, '-' + J.fmt(calc.lineDisc))) : null,
          calc.globalDisc ? h('div', { class: 'l muted' }, h('span', null, 'Réduction sur la fiche'), h('span', null, '-' + J.fmt(calc.globalDisc))) : null,
          h('div', { class: 'l grand' }, h('span', null, 'TOTAL'), h('span', null, J.fmt(calc.total))),
          J.db.settings.usdEnabled && J.db.settings.usdRate ? h('div', { class: 'l small muted' }, h('span', null, 'Équivalent USD'), h('span', null, '$ ' + (calc.total / J.db.settings.usdRate).toFixed(2))) : null,
          gd));
      }
      right.appendChild(card);
      if (cart.lines.length) right.appendChild(drawPayment(calc));
      // barre résumé (téléphone)
      if (cart.lines.length) sticky.appendChild(h('div', { class: 'card', style: { position: 'sticky', bottom: 'calc(var(--nav-h) + 8px)', zIndex: 5, display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', padding: '10px 14px' }, id: 'cartbar' },
        h('div', { style: { flex: 1 } }, h('div', { class: 'small muted' }, `${cart.lines.length} ligne(s)`), h('b', { style: { fontSize: '20px', color: 'var(--vert)' } }, J.fmt(calc.total))),
        h('button', { class: 'btn gold', onclick: () => right.scrollIntoView({ behavior: 'smooth' }) }, 'Voir la fiche')));
    };

    const drawPayment = (calc) => {
      const card = h('div', { class: 'card' }, h('h2', null, 'Paiement'));
      const status = U.seg([['full', 'Payé en entier'], ['partial', 'Partiel'], ['credit', 'Tout à crédit']], cart.payStatus, (v) => {
        cart.payStatus = v;
        if (v === 'partial' && !cart.paid) cart.paid = Math.round(calc.total / 2);
        drawCart();
      }, true);
      card.appendChild(status);
      const box = h('div', { style: { marginTop: '12px' } });
      card.appendChild(box);
      if (cart.payStatus !== 'credit') {
        box.appendChild(h('div', { class: 'paybtns' }, J.PAY_MODES.map((m) => h('button', { class: cart.payMode === m.id ? 'on' : '', onclick: () => { cart.payMode = m.id; drawCart(); } }, m.label))));
      }
      const paidNow = cart.payStatus === 'full' ? calc.total : cart.payStatus === 'credit' ? 0 : Math.min(cart.paid, calc.total);
      const rest = calc.total - paidNow;
      if (cart.payStatus === 'partial') {
        const f = U.field('Montant payé maintenant', 'money', cart.paid, { onchange: (e) => { cart.paid = J.toC(e.target.value); drawCart(); } });
        box.appendChild(h('div', { style: { marginTop: '10px' } }, f, h('div', { class: 'row' },
          h('button', { class: 'btn sm light', onclick: () => { cart.paid = Math.round(calc.total / 2); drawCart(); } }, 'Moitié'),
          h('button', { class: 'btn sm light', onclick: () => { cart.paid = Math.round(calc.total / 4); drawCart(); } }, 'Un quart'))));
      }
      if (cart.payMode === 'cash' && paidNow > 0) {
        const f = U.field('Montant reçu du client (cash)', 'money', cart.received || '', { onchange: (e) => { cart.received = J.toC(e.target.value); drawCart(); } });
        box.appendChild(h('div', { style: { marginTop: '10px' } }, f));
        if (cart.received > paidNow) box.appendChild(h('div', { class: 'alert green' }, icon('cash'), h('span', null, 'Monnaie à rendre : ', h('b', null, J.fmt(cart.received - paidNow)))));
        else if (cart.received && cart.received < paidNow) box.appendChild(h('div', { class: 'alert red' }, icon('alert'), 'Montant reçu inférieur au montant payé.'));
      }
      if (rest > 0) {
        if (!cart.promiseDate) cart.promiseDate = J.addDays(J.today(), J.db.settings.creditDefaultDays || 15);
        box.appendChild(h('div', { class: 'totals' }, h('div', { class: 'l' }, h('span', null, 'Payé maintenant'), h('b', null, J.fmt(paidNow))),
          h('div', { class: 'l' }, h('span', null, 'Reste à payer'), h('b', { class: 'red' }, J.fmt(rest)))));
        box.appendChild(U.field('Date promise pour le reste', 'date', cart.promiseDate, { onchange: (e) => { cart.promiseDate = e.target.value; } }));
        if (!cart.client) box.appendChild(h('div', { class: 'alert red' }, icon('user'), 'Choisissez un client enregistré : impossible de faire crédit à un « client de passage ».'));
      }
      box.appendChild(U.field('Note (facultatif)', 'text', cart.note, { oninput: (e) => { cart.note = e.target.value; } }));
      const cashWarn = cart.payMode === 'cash' && paidNow > 0 && !J.currentCash();
      if (cashWarn) box.appendChild(h('div', { class: 'alert' }, icon('cash'), h('span', null, 'La caisse n’est pas ouverte. ', h('a', { href: '#/caisse' }, 'Ouvrir la caisse'))));
      card.appendChild(h('div', { class: 'row', style: { marginTop: '12px' } },
        h('button', { class: 'btn light', onclick: async () => { if (await U.confirm('Vider la fiche ?', 'Toutes les lignes seront retirées.', 'Vider', 'danger')) { A.cart = newCart(); A.render(); } } }, icon('trash')),
        h('button', { class: 'btn xl gold', style: { flex: 1 }, onclick: U.safe(validate) }, icon('check'), `Valider ${J.fmt(calc.total)}`)));
      return card;
    };

    const validate = () => {
      const r = J.resolveDraft(cart);
      const calc = J.saleCalc(r);
      const paidNow = cart.payStatus === 'full' ? calc.total : cart.payStatus === 'credit' ? 0 : Math.min(cart.paid, calc.total);
      if (cart.payStatus === 'partial' && (paidNow <= 0 || paidNow >= calc.total)) throw new Error('Pour un paiement partiel, indiquez un montant entre 0 et le total.');
      if (cart.payMode === 'cash' && cart.received && cart.received < paidNow) throw new Error('Le montant reçu est inférieur au montant à payer.');
      const sale = J.createSale({
        client: cart.client, lines: cart.lines, globalDiscType: cart.globalDiscType, globalDiscValue: cart.globalDiscValue,
        payMode: cart.payStatus === 'credit' ? 'credit' : cart.payMode, paidNow, received: cart.received, promiseDate: cart.promiseDate, note: cart.note,
      }, A.user);
      A.cart = newCart();
      A.render();
      A.showSale(sale, true);
    };

    redraw();
    return h('div', null, A.title('Nouvelle vente'), h('div', { class: 'pos' }, left, h('div', null, right)), sticky);
  };

  /** Réduction d'une ligne (ou de toute la fiche) : en % ou en montant. */
  A.discountDialog = (target, base, done, global) => {
    const kT = global ? 'globalDiscType' : 'discType';
    const kV = global ? 'globalDiscValue' : 'discValue';
    let type = target[kT] || 'pct';
    const owner = J.isOwner(A.user);
    const max = J.db.settings.sellerMaxDiscountPct;
    const val = U.field('Valeur', type === 'pct' ? 'number' : 'money', type === 'pct' ? target[kV] || '' : target[kV] || '');
    const seg = U.seg([['pct', 'En %'], ['amt', 'En gourdes']], type, (v) => { type = v; val.input.value = ''; val.input.focus(); }, true);
    const quick = h('div', { class: 'row' }, [5, 10, 15, 20].filter((p) => owner || p <= max).map((p) => h('button', { class: 'btn sm light', onclick: () => { type = 'pct'; target[kT] = 'pct'; target[kV] = p; m.close(); done(); } }, p + ' %')));
    const m = U.modal(global ? 'Réduction sur toute la fiche' : 'Réduction sur la ligne', h('div', null,
      h('p', { class: 'muted small' }, `Base : ${J.fmt(base)}${owner ? '' : ` — maximum vendeur : ${max} %`}`), seg, h('div', { style: { height: '10px' } }), val, quick),
    [{ label: 'Retirer', cls: 'light', click: () => { target[kV] = 0; done(); } },
      { label: 'Appliquer', icon: 'check', click: () => {
        const v = type === 'pct' ? J.parseNum(val.input.value) : J.toC(val.input.value);
        if (v < 0) throw new Error('Valeur invalide.');
        target[kT] = type; target[kV] = v; done();
      } }]);
  };

  /** Choix d'un client avec recherche et ajout rapide. */
  A.pickClient = (cb) => {
    const list = h('div', { class: 'list', style: { maxHeight: '50vh', overflow: 'auto' } });
    const draw = (q) => {
      list.innerHTML = '';
      list.appendChild(h('div', { class: 'item', onclick: () => { m.close(); cb(null); } }, h('span', { class: 'avatar' }, icon('user')), h('div', { class: 'main' }, h('b', null, 'Client de passage'), h('small', null, 'vente rapide, paiement immédiat'))));
      J.db.clients.filter((c) => !q || (c.name + ' ' + (c.phone || '')).toLowerCase().includes(q.toLowerCase())).slice(0, 60).forEach((c) => {
        const bal = J.clientBalance(c.id);
        list.appendChild(h('div', { class: 'item', onclick: () => { m.close(); cb(c); } }, h('span', { class: 'avatar ' + (c.type === 'grossiste' ? 'gold' : '') }, U.initials(c.name)),
          h('div', { class: 'main' }, h('b', null, c.name), h('small', null, [c.phone, c.type === 'grossiste' ? 'Grossiste' : 'Particulier'].filter(Boolean).join(' · '))),
          bal ? h('span', { class: 'tag red' }, 'doit ' + J.fmt(bal)) : null));
      });
    };
    const s = h('div', { class: 'search' }, icon('search'), h('input', { class: 'inp', placeholder: 'Nom ou téléphone…', oninput: (e) => draw(e.target.value) }));
    const m = U.modal('Choisir le client', h('div', null, s, h('div', { style: { height: '10px' } }), list),
      [{ label: 'Nouveau client', icon: 'plus', cls: 'gold', click: () => { A.clientForm(null, (c) => cb(c)); } }]);
    draw('');
  };

  /* ================= FICHE : affichage, impression, partage ================= */
  A.showSale = (sale, justCreated) => {
    const s = J.db.settings;
    const owner = J.isOwner(A.user);
    const rest = J.saleRest(sale);
    const prev = h('div', { class: 'preview-ticket', html: J.print.ticketHTML(sale) });
    const acts = h('div', { class: 'grid g2', style: { marginTop: '12px' } },
      s.printMode === 'escpos'
        ? h('button', { class: 'btn gold', onclick: U.safe(async () => { const how = await J.print.sendEscpos(sale); U.toast(how === 'rawbt' ? `Envoyé à ${s.printerModel || 'l’imprimante'} par RawBT.` : 'Envoyé à l’imprimante.', 'ok'); }) }, icon('print'), `Imprimer (${s.printerModel || 'thermique'})`)
        : h('button', { class: 'btn', onclick: () => J.print.printHTML(J.print.ticketHTML(sale), s.ticketWidth) }, icon('print'), `Ticket ${s.ticketWidth} mm`),
      s.printMode === 'escpos' ? h('button', { class: 'btn light', onclick: () => J.print.printHTML(J.print.ticketHTML(sale), s.ticketWidth) }, icon('print'), 'Impression système') : null,
      h('button', { class: 'btn light', onclick: () => J.print.printHTML(J.print.invoiceHTML(sale), 'A5') }, icon('receipt'), 'Facture A5'),
      h('button', { class: 'btn light', onclick: () => J.print.printHTML(J.print.invoiceHTML(sale), 'A4') }, icon('receipt'), 'Facture A4'),
      h('button', { class: 'btn light', onclick: () => J.print.openWhatsApp(sale.client.phone, J.print.whatsappText(sale)) }, icon('chat'), 'WhatsApp (texte)'),
      h('button', { class: 'btn light', onclick: U.safe(async () => { const r = await J.print.shareImage(sale); if (r === 'downloaded') U.toast('Image enregistrée : joignez-la dans WhatsApp.', 'ok'); }) }, icon('image'), 'Image de la fiche'));
    const extra = h('div', { class: 'row', style: { marginTop: '10px' } },
      rest > 0 ? h('button', { class: 'btn gold', onclick: () => { m.close(); A.payDialog(sale); } }, icon('cash'), `Encaisser (${J.fmt(rest)})`) : null,
      owner && sale.status !== 'annulee' && sale.type === 'vente' ? h('button', { class: 'btn ghost red', onclick: () => { m.close(); A.cancelDialog(sale); } }, icon('x'), 'Annuler la fiche') : null);
    const head = justCreated ? h('div', { class: 'alert green', style: { marginBottom: '10px' } }, icon('check'), h('span', null, h('b', null, `Fiche ${sale.no} enregistrée. `), sale.change ? `Monnaie à rendre : ${J.fmt(sale.change)}` : '')) : null;
    const m = U.modal(`Fiche ${sale.no}`, h('div', null, head, prev, acts, extra), justCreated ? [{ label: 'Nouvelle vente', icon: 'plus', cls: 'gold', click: () => A.go('vente') }] : [], { wide: false, noFocus: true });
  };

  A.payDialog = (sale, after) => {
    const rest = J.saleRest(sale);
    let mode = 'cash';
    const amt = U.field('Montant encaissé', 'money', rest);
    const rec = U.field('Montant reçu (cash) — pour la monnaie', 'money', '');
    const info = h('div');
    const upd = () => { const a = amt.get(); const r = rec.get(); info.innerHTML = ''; if (mode === 'cash' && r > a) info.appendChild(h('div', { class: 'alert green' }, icon('cash'), `Monnaie à rendre : ${J.fmt(r - a)}`)); };
    amt.input.addEventListener('input', upd); rec.input.addEventListener('input', upd);
    const modes = h('div', { class: 'paybtns' });
    const drawModes = () => { modes.innerHTML = ''; J.PAY_MODES.forEach((pm) => modes.appendChild(h('button', { class: mode === pm.id ? 'on' : '', onclick: () => { mode = pm.id; rec.style.display = mode === 'cash' ? '' : 'none'; drawModes(); upd(); } }, pm.label))); };
    drawModes();
    U.modal(`Encaisser — fiche ${sale.no}`, h('div', null,
      h('p', null, `${sale.client.name} · reste à payer `, h('b', { class: 'red' }, J.fmt(rest))), amt,
      h('div', { class: 'row', style: { marginBottom: '10px' } }, h('button', { class: 'btn sm light', onclick: () => { amt.input.value = J.fmt(rest, ''); upd(); } }, 'Tout'), h('button', { class: 'btn sm light', onclick: () => { amt.input.value = J.fmt(Math.round(rest / 2), ''); upd(); } }, 'Moitié')),
      modes, h('div', { style: { height: '10px' } }), rec, info),
    [{ label: 'Annuler', cls: 'light' }, { label: 'Encaisser', icon: 'check', cls: 'gold', click: () => {
      J.addPayment(sale.id, amt.get(), mode, A.user, rec.get());
      U.toast(`Paiement de ${J.fmt(amt.get())} enregistré.`, 'ok');
      A.render(); if (after) after(); A.showSale(sale);
    } }]);
  };

  A.cancelDialog = (sale) => {
    const f = U.field("Motif de l'annulation (obligatoire)", 'textarea', '', { placeholder: 'ex. erreur de saisie, client a rendu la marchandise…' });
    U.modal(`Annuler la fiche ${sale.no} ?`, h('div', null,
      h('div', { class: 'alert' }, icon('alert'), h('span', null, 'La fiche n’est pas supprimée : elle reste dans l’historique avec la mention ANNULÉE. Le stock est remis et les écritures comptables sont contre-passées.')),
      h('div', { style: { height: '10px' } }), f),
    [{ label: 'Retour', cls: 'light' }, { label: 'Annuler la fiche', cls: 'danger', click: () => { J.cancelSale(sale.id, f.get(), A.user); U.toast('Fiche annulée.', 'ok'); A.render(); } }]);
  };

  /* ================= LISTE DES FICHES ================= */
  A.screens.fiches = () => {
    let filter = A.param('f') || 'jour';
    let q = '';
    const list = h('div', { class: 'list' });
    const sumBox = h('div');
    const draw = () => {
      list.innerHTML = '';
      const today = J.today();
      let rows = J.db.sales.slice().reverse();
      if (filter === 'jour') rows = rows.filter((s) => J.dayKey(s.date) === today);
      if (filter === 'credit') rows = rows.filter((s) => J.saleRest(s) > 0);
      if (filter === 'annulee') rows = rows.filter((s) => s.status === 'annulee');
      if (!J.isOwner(A.user) && filter !== 'credit') rows = rows.filter((s) => s.sellerId === A.user.id || J.dayKey(s.date) === today);
      if (q) rows = rows.filter((s) => (s.no + ' ' + s.client.name + ' ' + (s.client.phone || '')).toLowerCase().includes(q.toLowerCase()));
      const valid = rows.filter((s) => s.status !== 'annulee' && s.type === 'vente');
      sumBox.innerHTML = '';
      sumBox.appendChild(h('div', { class: 'grid g3', style: { margin: '10px 0' } }, U.kpi('Fiches', String(valid.length)), U.kpi('Total', J.fmt(valid.reduce((a, s) => a + s.total, 0))), U.kpi('Reste dû', J.fmt(rows.reduce((a, s) => a + J.saleRest(s), 0)), null, 'red')));
      if (!rows.length) list.appendChild(U.empty('receipt', 'Aucune fiche.'));
      rows.slice(0, 300).forEach((s) => {
        const st = J.payStatus(s);
        const cls = { payee: '', partielle: 'gold', credit: 'red', annulee: 'grey' }[st];
        list.appendChild(h('div', { class: 'item', onclick: () => A.showSale(s) },
          h('span', { class: 'avatar ' + (st === 'credit' || st === 'partielle' ? 'gold' : '') }, icon('receipt')),
          h('div', { class: 'main' }, h('b', null, `${s.no} — ${s.client.name}`), h('small', null, `${J.fmtDateTime(s.date)} · ${s.sellerName || ''} · ${s.lines.length} ligne(s)`)),
          h('div', { class: 'side-v' }, h('div', { style: s.status === 'annulee' ? { textDecoration: 'line-through' } : null }, J.fmt(s.total)), h('span', { class: 'tag ' + cls }, J.PAY_STATUS_LABEL[st]))));
      });
    };
    const seg = U.seg([['jour', "Aujourd'hui"], ['tout', 'Toutes'], ['credit', 'Non soldées'], ['annulee', 'Annulées']], filter, (v) => { filter = v; draw(); });
    draw();
    return h('div', null, A.title('Fiches de vente', h('a', { class: 'btn gold', href: '#/vente' }, icon('plus'), 'Nouvelle')),
      h('div', { class: 'row' }, seg, h('div', { class: 'search', style: { flex: 1, minWidth: '220px' } }, icon('search'), h('input', { class: 'inp', placeholder: 'N° de fiche, client, téléphone…', oninput: (e) => { q = e.target.value; draw(); } }))),
      sumBox, list);
  };

  /* ================= CRÉDITS CLIENTS ================= */
  A.screens.credits = () => {
    const rows = J.receivables();
    const total = rows.reduce((a, r) => a + r.amount, 0);
    const bucket = (d) => (d <= 7 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : 3);
    const ages = [0, 0, 0, 0];
    rows.forEach((r) => r.sales.forEach((s) => { ages[bucket(J.daysBetween(J.dayKey(s.date), J.today()))] += J.saleRest(s); }));
    return h('div', null, A.title('Crédits clients'),
      h('div', { class: 'grid g4' }, U.kpi('Total à recevoir', J.fmt(total), `${rows.length} client(s)`, 'red'), U.kpi('0 – 7 jours', J.fmt(ages[0])), U.kpi('8 – 30 jours', J.fmt(ages[1]), null, 'gold'), U.kpi('Plus de 30 jours', J.fmt(ages[2] + ages[3]), null, 'red')),
      h('div', { class: 'list', style: { marginTop: '12px' } }, rows.length ? rows.map((r) => h('div', { class: 'item', onclick: () => A.creditDetail(r) },
        h('span', { class: 'avatar gold' }, U.initials(r.name)),
        h('div', { class: 'main' }, h('b', null, r.name), h('small', null, `${r.sales.length} fiche(s) · depuis ${r.days} jour(s)${r.phone ? ' · ' + r.phone : ''}`)),
        h('div', { class: 'side-v' }, h('div', { class: 'red' }, J.fmt(r.amount)), r.overdue ? h('span', { class: 'tag red' }, 'En retard') : h('span', { class: 'tag' }, 'Dans les délais'))))
        : U.empty('check', 'Aucun crédit en cours. Bravo !')));
  };
  A.creditDetail = (r) => {
    const body = h('div', null,
      h('p', null, `Total dû : `, h('b', { class: 'red' }, J.fmt(r.amount)), ` · plus ancienne dette : ${r.days} jour(s)`),
      h('div', { class: 'list' }, r.sales.map((s) => h('div', { class: 'item' },
        h('div', { class: 'main' }, h('b', null, s.no === 'SOLDE-OUV' ? "Solde d'ouverture" : `Fiche ${s.no}`), h('small', null, `${J.fmtDate(s.date)} · total ${J.fmt(s.total)}${s.promiseDate ? ' · promis pour le ' + J.fmtDate(s.promiseDate) : ''}`)),
        h('b', { class: 'red' }, J.fmt(J.saleRest(s))),
        h('button', { class: 'btn sm gold', onclick: () => { m.close(); A.payDialog(s); } }, 'Encaisser')))));
    const m = U.modal(r.name, body, [
      r.phone ? { label: 'Rappel WhatsApp', icon: 'chat', cls: 'light', keep: true, click: () => J.print.openWhatsApp(r.phone, J.print.reminderText(r)) } : null,
      { label: 'Copier le rappel', icon: 'edit', cls: 'light', keep: true, click: () => { navigator.clipboard && navigator.clipboard.writeText(J.print.reminderText(r)); U.toast('Message copié.', 'ok'); } },
      r.clientId ? { label: 'Relevé de compte', icon: 'print', keep: true, click: () => J.print.printHTML(J.print.statementHTML(J.byId('clients', r.clientId)), 'A4') } : null,
    ].filter(Boolean));
  };

  /* ================= CLIENTS ================= */
  A.clientForm = (c, cb) => {
    const isNew = !c;
    c = Object.assign({ type: 'particulier', creditLimit: 0 }, c || {});
    let type = c.type;
    const f = { name: U.field('Nom', 'text', c.name), phone: U.field('Téléphone', 'tel', c.phone, { placeholder: 'ex. 3712 3456' }), address: U.field('Adresse', 'text', c.address), limit: U.field('Plafond de crédit (0 = sans plafond)', 'money', c.creditLimit), note: U.field('Note', 'textarea', c.note) };
    const seg = U.seg([['particulier', 'Particulier'], ['grossiste', 'Grossiste / revendeur']], type, (v) => { type = v; }, true);
    U.modal(isNew ? 'Nouveau client' : 'Modifier le client', h('div', null, f.name, h('div', { class: 'grid g2 stack' }, f.phone, f.limit), f.address,
      h('label', { class: 'f' }, 'Type de client'), seg, h('p', { class: 'small muted' }, 'Un grossiste / revendeur paie toujours le prix de gros.'), f.note),
    [{ label: 'Annuler', cls: 'light' }, { label: 'Enregistrer', icon: 'check', click: () => {
      const saved = J.saveClient(Object.assign(c, { name: f.name.get(), phone: f.phone.get(), address: f.address.get(), creditLimit: f.limit.get(), note: f.note.get(), type }), A.user);
      U.toast('Client enregistré.', 'ok');
      if (cb) cb(saved); else A.render();
    } }]);
  };
  A.screens.clients = () => {
    let q = '';
    let type = 'tous';
    const list = h('div', { class: 'list' });
    const draw = () => {
      list.innerHTML = '';
      const rows = J.db.clients.filter((c) => (type === 'tous' || c.type === type || (type === 'doit' && J.clientBalance(c.id) > 0)) && (!q || (c.name + ' ' + (c.phone || '')).toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!rows.length) list.appendChild(U.empty('users', 'Aucun client.'));
      rows.forEach((c) => {
        const bal = J.clientBalance(c.id);
        list.appendChild(h('div', { class: 'item', onclick: () => A.clientDetail(c) }, h('span', { class: 'avatar ' + (c.type === 'grossiste' ? 'gold' : '') }, U.initials(c.name)),
          h('div', { class: 'main' }, h('b', null, c.name), h('small', null, [c.phone, c.address].filter(Boolean).join(' · ') || '—')),
          h('div', { class: 'side-v' }, c.type === 'grossiste' ? h('span', { class: 'tag gold' }, 'Grossiste') : h('span', { class: 'tag' }, 'Particulier'), bal ? h('div', { class: 'red small' }, 'doit ' + J.fmt(bal)) : null)));
      });
    };
    draw();
    return h('div', null, A.title('Clients', h('button', { class: 'btn gold', onclick: () => A.clientForm() }, icon('plus'), 'Nouveau client')),
      h('div', { class: 'row', style: { marginBottom: '12px' } }, U.seg([['tous', 'Tous'], ['particulier', 'Particuliers'], ['grossiste', 'Grossistes'], ['doit', 'Qui doivent']], type, (v) => { type = v; draw(); }),
        h('div', { class: 'search', style: { flex: 1, minWidth: '220px' } }, icon('search'), h('input', { class: 'inp', placeholder: 'Nom ou téléphone…', oninput: (e) => { q = e.target.value; draw(); } }))),
      list);
  };
  A.clientDetail = (c) => {
    const sales = J.clientSales(c.id).slice().reverse();
    const valid = sales.filter((s) => s.status !== 'annulee' && s.type === 'vente');
    const bal = J.clientBalance(c.id);
    const pts = J.db.settings.loyaltyEnabled ? J.loyaltyPoints(c.id) : null;
    const body = h('div', null,
      h('p', { class: 'muted' }, [c.phone, c.address, c.type === 'grossiste' ? 'Grossiste / revendeur' : 'Particulier', c.creditLimit ? `plafond ${J.fmt(c.creditLimit)}` : ''].filter(Boolean).join(' · ')),
      c.note ? h('p', null, c.note) : null,
      h('div', { class: 'grid g3' }, U.kpi('Achats', J.fmt(valid.reduce((a, s) => a + s.total, 0)), `${valid.length} fiche(s)`), U.kpi('Doit', J.fmt(bal), null, bal ? 'red' : ''),
        pts !== null ? U.kpi('Fidélité', `${pts} pt(s)`, `1 pt / ${J.fmt(J.db.settings.loyaltyPer)}`, 'gold') : U.kpi('Dernier achat', valid[0] ? J.fmtDate(valid[0].date) : '—')),
      h('h3', { style: { margin: '14px 0 8px', fontSize: '15px', color: 'var(--vert)' } }, 'Historique'),
      h('div', { class: 'list' }, sales.length ? sales.map((s) => h('div', { class: 'item', onclick: () => A.showSale(s) },
        h('div', { class: 'main' }, h('b', null, s.no === 'SOLDE-OUV' ? "Solde d'ouverture" : s.no), h('small', null, `${J.fmtDate(s.date)} · ${s.lines.map((l) => l.name).join(', ')}`)),
        h('div', { class: 'side-v' }, J.fmt(s.total), h('div', null, h('span', { class: 'tag ' + ({ payee: '', partielle: 'gold', credit: 'red', annulee: 'grey' }[J.payStatus(s)]) }, J.PAY_STATUS_LABEL[J.payStatus(s)]))))) : U.empty('receipt', 'Aucun achat.')));
    U.modal(c.name, body, [
      { label: 'Modifier', icon: 'edit', cls: 'light', click: () => A.clientForm(c) },
      { label: 'Relevé', icon: 'print', cls: 'light', keep: true, click: () => J.print.printHTML(J.print.statementHTML(c), 'A4') },
      bal && c.phone ? { label: 'Rappel', icon: 'chat', cls: 'light', keep: true, click: () => J.print.openWhatsApp(c.phone, J.print.reminderText(J.receivables().find((r) => r.clientId === c.id))) } : null,
      { label: 'Vendre', icon: 'cart', cls: 'gold', click: () => { A.cart.client = c; A.go('vente'); } },
    ].filter(Boolean), { wide: true });
  };
})(window);
