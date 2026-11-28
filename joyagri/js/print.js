/* JOYAGRI — fiche de vente : ticket 58/80 mm, facture A5/A4, ESC/POS, image et WhatsApp.
 * Une seule description de la fiche (rows) sert à tous les formats : ce qui est imprimé = ce qui est partagé. */
(function (root) {
  'use strict';
  const J = root.J;
  const Pr = (J.print = {});
  const S = () => J.db.settings;
  const logo = () => S().logo || J.LOGO;
  const U = () => J.ui;

  /* ---------- Description commune du ticket ---------- */
  Pr.rows = (sale) => {
    const s = S();
    const R = [];
    const lr = (a, z, o) => R.push(Object.assign({ t: 'lr', a, z }, o || {})); // a = gauche, z = droite
    R.push({ t: 'logo' });
    R.push({ t: 'c', v: s.name, big: true, b: true });
    if (s.slogan) R.push({ t: 'c', v: s.slogan, small: true });
    if (s.address) R.push({ t: 'c', v: s.address, small: true });
    if (s.phone) R.push({ t: 'c', v: 'Tél. : ' + s.phone, small: true });
    const ids = [s.nif && 'NIF : ' + s.nif, s.rc && 'Reg. : ' + s.rc].filter(Boolean).join('  ·  ');
    if (ids) R.push({ t: 'c', v: ids, small: true });
    R.push({ t: 'hr' });
    R.push({ t: 'c', v: sale.type === 'ouverture' ? 'SOLDE ANTÉRIEUR' : 'FICHE DE VENTE', b: true });
    lr('N°', sale.no, { b: true });
    lr('Date', J.fmtDateTime(sale.date));
    if (sale.sellerName) lr('Vendeur', sale.sellerName);
    lr('Client', sale.client.name);
    if (sale.client.phone) lr('Tél. client', sale.client.phone);
    if (sale.client.address) lr('Adresse', sale.client.address);
    if (sale.status === 'annulee') R.push({ t: 'c', v: '*** FICHE ANNULÉE ***', b: true, big: true }, { t: 'c', v: 'Motif : ' + sale.cancel.reason, small: true });
    R.push({ t: 'hr' });
    sale.lines.forEach((l) => {
      R.push({ t: 'txt', v: l.name, b: true });
      const pt = l.priceType === 'gros' ? ' (GROS)' : l.priceType === 'detail' ? ' (détail)' : '';
      lr(`  ${J.fmtQty(l.qty)} ${l.unit || ''} × ${J.fmt(l.unitPrice, '')}${pt}`, J.fmt(l.gross != null ? l.gross : l.total, ''));
      if (l.disc) lr(`  Réduction${l.discType === 'pct' ? ' ' + J.fmtQty(l.discValue) + ' %' : ''}`, '-' + J.fmt(l.disc, ''));
      if (l.kind === 'service' && (l.serviceDate || l.serviceLocation)) {
        R.push({ t: 'txt', v: '  Prestation' + (l.serviceDate ? ' le ' + J.fmtDate(l.serviceDate) : '') + (l.serviceLocation ? ' à ' + l.serviceLocation : ''), small: true });
      }
    });
    R.push({ t: 'hr' });
    if (sale.totalDisc) {
      lr('Sous-total', J.fmt(sale.gross, ''));
      if (sale.lineDisc) lr('Réductions sur lignes', '-' + J.fmt(sale.lineDisc, ''));
      if (sale.globalDisc) lr('Réduction sur la fiche' + (sale.globalDiscType === 'pct' ? ` (${J.fmtQty(sale.globalDiscValue)} %)` : ''), '-' + J.fmt(sale.globalDisc, ''));
    }
    lr('TOTAL', J.fmt(sale.total), { b: true, big: true });
    if (sale.usdRate) lr('Équivalent USD', '$ ' + (sale.total / sale.usdRate).toFixed(2) + ` (taux ${J.fmtQty(sale.usdRate / 100)})`, { small: true });
    const paid = J.salePaid(sale);
    (sale.payments || []).forEach((p) => lr(`Payé ${J.payLabel(p.mode)}${p.atSale ? '' : ' le ' + J.fmtDate(p.date)}`, J.fmt(p.amount, '')));
    if (sale.change) { lr('Montant reçu', J.fmt(sale.received, '')); lr('Monnaie rendue', J.fmt(sale.change, '')); }
    const rest = J.saleRest(sale);
    if (rest > 0) {
      lr('RESTE À PAYER', J.fmt(rest), { b: true });
      if (sale.promiseDate) lr('À payer avant le', J.fmtDate(sale.promiseDate));
    }
    R.push({ t: 'c', v: J.PAY_STATUS_LABEL[J.payStatus(sale)].toUpperCase() + (paid && rest ? ` — payé ${J.fmt(paid)}` : ''), b: true });
    R.push({ t: 'hr' });
    if (s.footer) R.push({ t: 'c', v: s.footer });
    if (sale.note) R.push({ t: 'c', v: sale.note, small: true });
    return R;
  };

  /* ---------- HTML du ticket ---------- */
  Pr.ticketHTML = (sale, width) => {
    const e = U().esc;
    const w = width || S().ticketWidth || 80;
    const body = Pr.rows(sale).map((r) => {
      const cls = [r.b ? 'b' : '', r.big ? 'big' : '', r.small ? 'small' : ''].join(' ');
      if (r.t === 'logo') return `<img src="${logo()}" alt="">`;
      if (r.t === 'hr') return '<hr>';
      if (r.t === 'c') return `<div class="c ${cls}">${e(r.v)}</div>`;
      if (r.t === 'txt') return `<div class="${cls}">${e(r.v)}</div>`;
      return `<div class="lr ${cls}"><span>${e(r.a)}</span><span>${e(r.z)}</span></div>`;
    }).join('');
    return `<div class="ticket w${w}">${body}</div>`;
  };

  /* ---------- Facture A5 / A4 ---------- */
  Pr.invoiceHTML = (sale) => {
    const s = S();
    const e = U().esc;
    const name = e(s.name).replace(/GRI$/, '<span>GRI</span>');
    const rows = sale.lines.map((l, i) => `<tr><td>${i + 1}</td><td><b>${e(l.name)}</b>${l.kind === 'service' && (l.serviceDate || l.serviceLocation) ? `<br><small>Prestation${l.serviceDate ? ' le ' + J.fmtDate(l.serviceDate) : ''}${l.serviceLocation ? ' à ' + e(l.serviceLocation) : ''}</small>` : ''}${l.priceType ? `<br><small>${l.priceType === 'gros' ? 'Prix de gros' : 'Prix de détail'}</small>` : ''}</td>
      <td class="num">${J.fmtQty(l.qty)} ${e(l.unit || '')}</td><td class="num">${J.fmt(l.unitPrice, '')}</td>
      <td class="num">${l.disc ? '-' + J.fmt(l.disc, '') : ''}</td><td class="num"><b>${J.fmt(l.total, '')}</b></td></tr>`).join('');
    const rest = J.saleRest(sale);
    return `<div class="invoice">
      <div class="hd"><img src="${logo()}" alt=""><div style="flex:1"><h2>${name}</h2><div><i>${e(s.slogan)}</i></div>
        <div>${e(s.address)}</div><div>${s.phone ? 'Tél. : ' + e(s.phone) : ''}</div>
        <div>${s.nif ? 'NIF : ' + e(s.nif) : ''}${s.rc ? ' · Immatriculation : ' + e(s.rc) : ''}</div></div>
        <div style="text-align:right"><div style="font-size:18px;font-weight:800;color:var(--p)">FACTURE</div><div>N° <b>${e(sale.no)}</b></div>
        <div>${J.fmtDateTime(sale.date)}</div><div>Vendeur : ${e(sale.sellerName || '')}</div></div></div>
      <div style="margin-top:10px;display:flex;gap:20px"><div style="flex:1;background:var(--p-soft);padding:8px;border-radius:8px">
        <small>Client</small><div><b>${e(sale.client.name)}</b></div><div>${e(sale.client.phone || '')}</div><div>${e(sale.client.address || '')}</div></div>
        <div style="flex:1;padding:8px"><small>Paiement</small><div><b>${J.PAY_STATUS_LABEL[J.payStatus(sale)]}</b></div>
        ${(sale.payments || []).map((p) => `<div>${J.fmtDate(p.date)} — ${J.payLabel(p.mode)} : ${J.fmt(p.amount)}</div>`).join('')}
        ${rest > 0 && sale.promiseDate ? `<div>Reste à payer avant le ${J.fmtDate(sale.promiseDate)}</div>` : ''}</div></div>
      ${sale.status === 'annulee' ? `<div class="stamp">ANNULÉE — ${e(sale.cancel.reason)}</div>` : ''}
      <table><thead><tr><th>#</th><th>Désignation</th><th class="num">Qté</th><th class="num">Prix unit.</th><th class="num">Réduction</th><th class="num">Montant</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot">
        ${sale.totalDisc ? `<div><span>Sous-total</span><span>${J.fmt(sale.gross)}</span></div>` : ''}
        ${sale.lineDisc ? `<div><span>Réductions sur lignes</span><span>-${J.fmt(sale.lineDisc)}</span></div>` : ''}
        ${sale.globalDisc ? `<div><span>Réduction sur la facture</span><span>-${J.fmt(sale.globalDisc)}</span></div>` : ''}
        <div class="g"><span>TOTAL</span><span>${J.fmt(sale.total)}</span></div>
        ${sale.usdRate ? `<div><span>Équivalent USD</span><span>$ ${(sale.total / sale.usdRate).toFixed(2)}</span></div>` : ''}
        <div><span>Déjà payé</span><span>${J.fmt(J.salePaid(sale))}</span></div>
        <div><b>Reste à payer</b><b>${J.fmt(rest)}</b></div>
      </div>
      <div class="foot">${e(s.footer || '')}<br>${e(s.name)} — ${e(s.address)}</div></div>`;
  };

  /* ---------- Relevé de compte client ---------- */
  Pr.statementHTML = (client) => {
    const s = S();
    const e = U().esc;
    const ev = [];
    J.clientSales(client.id).forEach((x) => {
      if (x.status === 'annulee') { ev.push({ d: x.date, l: `Fiche ${x.no} (annulée)`, deb: 0, cr: 0 }); return; }
      ev.push({ d: x.date, l: x.type === 'ouverture' ? 'Solde antérieur' : `Fiche ${x.no}`, deb: x.total, cr: 0 });
      (x.payments || []).forEach((p) => ev.push({ d: p.date, l: `Paiement ${J.payLabel(p.mode)} — fiche ${x.no}`, deb: 0, cr: p.amount }));
    });
    ev.sort((a, b) => a.d.localeCompare(b.d));
    let bal = 0;
    const rows = ev.map((x) => { bal += x.deb - x.cr; return `<tr><td>${J.fmtDate(x.d)}</td><td>${e(x.l)}</td><td class="num">${x.deb ? J.fmt(x.deb, '') : ''}</td><td class="num">${x.cr ? J.fmt(x.cr, '') : ''}</td><td class="num"><b>${J.fmt(bal, '')}</b></td></tr>`; }).join('');
    return `<div class="invoice"><div class="hd"><img src="${logo()}" alt=""><div style="flex:1"><h2>${e(s.name).replace(/GRI$/, '<span>GRI</span>')}</h2>
      <div>${e(s.address)}</div><div>${s.phone ? 'Tél. : ' + e(s.phone) : ''}${s.nif ? ' · NIF : ' + e(s.nif) : ''}</div></div>
      <div style="text-align:right"><div style="font-size:18px;font-weight:800;color:var(--p)">RELEVÉ DE COMPTE</div><div>au ${J.fmtDate(J.today())}</div></div></div>
      <div style="margin-top:10px;background:var(--p-soft);padding:8px;border-radius:8px"><b>${e(client.name)}</b> — ${e(client.phone || '')} ${e(client.address || '')}</div>
      <table><thead><tr><th>Date</th><th>Opération</th><th class="num">Débit</th><th class="num">Crédit</th><th class="num">Solde</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><div class="g"><span>MONTANT DÛ</span><span>${J.fmt(bal)}</span></div></div>
      <div class="foot">${e(s.footer || '')}</div></div>`;
  };

  /* ---------- Impression navigateur / Windows ---------- */
  Pr.printHTML = (html, page) => {
    let st = document.getElementById('page-style');
    if (!st) { st = document.createElement('style'); st.id = 'page-style'; document.head.appendChild(st); }
    const sizes = { 58: '@page { size: 58mm auto; margin: 2mm; }', 80: '@page { size: 80mm auto; margin: 3mm; }', A5: '@page { size: A5; margin: 10mm; }', A4: '@page { size: A4; margin: 14mm; }' };
    st.textContent = sizes[page] || '';
    const area = document.getElementById('print');
    area.innerHTML = html;
    const imgs = Array.from(area.querySelectorAll('img'));
    Promise.all(imgs.map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = r; i.onerror = r; })))).then(() => {
      if (root.AndroidPrinter && root.AndroidPrinter.printPage) root.AndroidPrinter.printPage();
      else root.print();
    });
  };

  /* ---------- ESC/POS (imprimantes thermiques Bluetooth / USB) ---------- */
  const CP858 = { 'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c, 'É': 0x90, 'ô': 0x93, 'ö': 0x94, 'û': 0x96, 'ù': 0x97, 'Ô': 0xe2, 'È': 0xd4, 'Ê': 0xd2, 'À': 0xb7, 'Â': 0xb6, 'Î': 0xd7, 'Û': 0xea, '«': 0xae, '»': 0xbb, '°': 0xf8, '€': 0xd5 };
  const enc = (str) => {
    const out = [];
    // Mode « sans accents » : é → e, ç → c… (lisible sur toutes les imprimantes bon marché comme la PT-210)
    const ascii = S().escposAccents !== 'cp858';
    if (ascii) str = String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[«»]/g, '"').replace(/°/g, 'o').replace(/€/g, 'EUR');
    String(str).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[  ]/g, ' ').replace(/[–—]/g, '-').replace(/≥/g, '>=').replace(/≈/g, '~').replace(/×/g, 'x').replace(/·/g, '-')
      .split('').forEach((ch) => { const c = ch.charCodeAt(0); out.push(c < 128 ? c : (!ascii && CP858[ch]) || 0x3f); });
    return out;
  };
  const wrap = (text, w) => {
    const words = String(text).split(' ');
    const lines = [];
    let cur = '';
    words.forEach((wd) => {
      if ((cur + ' ' + wd).trim().length > w) { if (cur) lines.push(cur); cur = wd; while (cur.length > w) { lines.push(cur.slice(0, w)); cur = cur.slice(w); } } else cur = (cur + ' ' + wd).trim();
    });
    if (cur) lines.push(cur);
    return lines;
  };
  /** Convertit le logo en image noir et blanc (tramage) pour la commande GS v 0. */
  const rasterLogo = (px) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = px; c.height = px;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, px, px); x.drawImage(img, 0, 0, px, px);
      const d = x.getImageData(0, 0, px, px).data;
      const g = new Float32Array(px * px);
      for (let i = 0; i < px * px; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      const bytesW = Math.ceil(px / 8);
      const out = new Uint8Array(bytesW * px);
      for (let y = 0; y < px; y++) {
        for (let xx = 0; xx < px; xx++) {
          const i = y * px + xx;
          const old = g[i]; const nw = old < 150 ? 0 : 255; const err = old - nw;
          if (nw === 0) out[y * bytesW + (xx >> 3)] |= 0x80 >> (xx & 7);
          if (xx + 1 < px) g[i + 1] += (err * 7) / 16;
          if (y + 1 < px) { if (xx > 0) g[i + px - 1] += (err * 3) / 16; g[i + px] += (err * 5) / 16; if (xx + 1 < px) g[i + px + 1] += err / 16; }
        }
      }
      res([0x1d, 0x76, 0x30, 0, bytesW & 0xff, bytesW >> 8, px & 0xff, px >> 8, ...out]);
    };
    img.onerror = () => res([]);
    img.src = logo();
  });
  Pr.escpos = async (sale, width) => {
    const w = (width || S().ticketWidth) === 58 ? 32 : 48;
    const st = S();
    const b = [0x1b, 0x40]; // initialisation
    if (st.escposAccents === 'cp858') b.push(0x1b, 0x74, 19); // page de code PC858 (accents français)
    const align = (n) => b.push(0x1b, 0x61, n);
    const bold = (on) => b.push(0x1b, 0x45, on ? 1 : 0);
    const size = (big) => b.push(0x1d, 0x21, big ? 0x11 : 0x00);
    const line = (s) => { b.push(...enc(s), 0x0a); };
    for (const r of Pr.rows(sale)) {
      if (r.t === 'logo') { if (st.escposLogo !== false) { align(1); b.push(...(await rasterLogo(w === 32 ? 192 : 256))); } continue; }
      if (r.t === 'hr') { align(0); line('-'.repeat(w)); continue; }
      bold(r.b);
      if (r.t === 'c') { align(1); size(r.big && w === 48); wrap(r.v, r.big && w === 48 ? w / 2 : w).forEach(line); size(false); }
      else if (r.t === 'lr' && r.big) { // TOTAL : double hauteur, lisible même sur 58 mm
        align(0); b.push(0x1d, 0x21, 0x01);
        const right = String(r.z); const left = String(r.a);
        line(left.length + right.length + 1 <= w ? left + ' '.repeat(w - left.length - right.length) + right : left + ' ' + right);
        b.push(0x1d, 0x21, 0x00);
      }
      else if (r.t === 'txt') { align(0); wrap(r.v, w).forEach(line); }
      else {
        align(0);
        const right = String(r.z);
        const left = String(r.a);
        if (left.length + right.length + 1 <= w) line(left + ' '.repeat(w - left.length - right.length) + right);
        else { wrap(left, w).forEach(line); line(' '.repeat(Math.max(0, w - right.length)) + right); }
      }
      bold(false);
    }
    b.push(0x0a, 0x0a, 0x0a);
    if (w === 48 && st.escposCut) b.push(0x1d, 0x56, 0x42, 0x00); // coupe papier (80 mm avec massicot seulement ; la PT-210 n'en a pas)
    return new Uint8Array(b);
  };
  const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); };
  Pr.sendEscpos = async (sale) => {
    const data = b64(await Pr.escpos(sale));
    if (root.AndroidPrinter && root.AndroidPrinter.printBase64) { root.AndroidPrinter.printBase64(data); return 'android'; }
    if (root.JoyNative && root.JoyNative.printRaw) { await root.JoyNative.printRaw(data); return 'native'; }
    root.location.href = 'rawbt:base64,' + data; // application RawBT (Android) : imprime en Bluetooth
    return 'rawbt';
  };

  /* ---------- Image de la fiche (partage WhatsApp) ---------- */
  Pr.image = (sale) => new Promise((res) => {
    const W = 600; const pad = 26; const rows = Pr.rows(sale);
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    const font = (r) => `${r.b ? '700 ' : ''}${r.big ? 25 : r.small ? 16 : 19}px "Segoe UI", Roboto, Arial, sans-serif`;
    const lh = (r) => (r.big ? 34 : r.small ? 22 : 26);
    const wrapPx = (text, maxW, f) => { x.font = f; const out = []; let cur = ''; String(text).split(' ').forEach((wd) => { const t = (cur + ' ' + wd).trim(); if (x.measureText(t).width > maxW && cur) { out.push(cur); cur = wd; } else cur = t; }); if (cur) out.push(cur); return out; };
    const layout = () => {
      let y = pad; const ops = [];
      rows.forEach((r) => {
        if (r.t === 'logo') { ops.push({ k: 'logo', y }); y += 150; return; }
        if (r.t === 'hr') { ops.push({ k: 'hr', y: y + 8 }); y += 18; return; }
        const f = font(r);
        if (r.t === 'c' || r.t === 'txt') wrapPx(r.v, W - pad * 2, f).forEach((t) => { ops.push({ k: r.t, t, f, y: y + lh(r) - 7, r }); y += lh(r); });
        else { ops.push({ k: 'lr', a: r.a, z: r.z, f, y: y + lh(r) - 7, r }); y += lh(r); }
      });
      return { ops, h: y + pad + 20 };
    };
    const L = layout();
    c.width = W; c.height = L.h;
    const draw = (img) => {
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, L.h);
      const cs = getComputedStyle(document.documentElement);
      const pc = (cs.getPropertyValue('--p') || '#1D4ED8').trim(); const p2 = (cs.getPropertyValue('--p2') || '#1E40AF').trim();
      const dark = document.documentElement.dataset.theme === 'nuit';
      const ink = dark ? '#1E3A8A' : pc;
      x.fillStyle = ink; x.fillRect(0, 0, W, 8); x.fillStyle = dark ? '#3B82F6' : p2; x.fillRect(0, L.h - 8, W, 8);
      L.ops.forEach((o) => {
        if (o.k === 'logo') { if (img) x.drawImage(img, (W - 140) / 2, o.y, 140, 140); return; }
        if (o.k === 'hr') { x.strokeStyle = '#CBD5E1'; x.setLineDash([6, 5]); x.beginPath(); x.moveTo(pad, o.y); x.lineTo(W - pad, o.y); x.stroke(); x.setLineDash([]); return; }
        x.font = o.f;
        x.fillStyle = o.r.big || (o.r.b && o.k === 'c') ? ink : '#0F172A';
        if (o.k === 'c') { x.textAlign = 'center'; x.fillText(o.t, W / 2, o.y); }
        else if (o.k === 'txt') { x.textAlign = 'left'; x.fillText(o.t, pad, o.y); }
        else { x.textAlign = 'left'; x.fillText(o.a, pad, o.y); x.textAlign = 'right'; x.fillText(o.z, W - pad, o.y); }
      });
      x.textAlign = 'left';
      c.toBlob((bl) => res(bl), 'image/png');
    };
    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => draw(null);
    img.src = logo();
  });

  /* ---------- Texte WhatsApp ---------- */
  Pr.whatsappText = (sale) => {
    const s = S();
    const L = [`*${s.name}* — Fiche ${sale.no}`, `${J.fmtDateTime(sale.date)}`, `Client : ${sale.client.name}`, ''];
    sale.lines.forEach((l) => L.push(`• ${l.name} : ${J.fmtQty(l.qty)} ${l.unit || ''} × ${J.fmt(l.unitPrice)}${l.disc ? ` (réd. -${J.fmt(l.disc)})` : ''} = ${J.fmt(l.total)}`));
    if (sale.globalDisc) L.push(`Réduction sur la fiche : -${J.fmt(sale.globalDisc)}`);
    L.push('', `*TOTAL : ${J.fmt(sale.total)}*`);
    const paid = J.salePaid(sale); const rest = J.saleRest(sale);
    if (paid) L.push(`Payé : ${J.fmt(paid)}`);
    if (rest) L.push(`*Reste à payer : ${J.fmt(rest)}*${sale.promiseDate ? ` (avant le ${J.fmtDate(sale.promiseDate)})` : ''}`);
    if (sale.status === 'annulee') L.push('', '*FICHE ANNULÉE*');
    L.push('', s.footer || '', [s.phone && 'Tél. ' + s.phone, s.nif && 'NIF ' + s.nif].filter(Boolean).join(' · '));
    return L.join('\n').trim();
  };
  Pr.reminderText = (row) => {
    const s = S();
    const det = row.sales.map((x) => `• ${x.no === 'SOLDE-OUV' ? 'Solde antérieur' : 'Fiche ' + x.no} du ${J.fmtDate(x.date)} : ${J.fmt(J.saleRest(x))}`).join('\n');
    return `Bonjour ${row.name},\n\nPetit rappel amical de *${s.name}* : il reste *${J.fmt(row.amount)}* à régler.\n${det}\n\nVous pouvez payer en cash, MonCash ou NatCash. Merci pour votre confiance !\n${s.phone ? 'Tél. ' + s.phone : ''}`.trim();
  };
  Pr.openWhatsApp = (phone, text) => {
    const p = J.waPhone(phone);
    const url = `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
    if (root.JoyNative && root.JoyNative.openExternal) root.JoyNative.openExternal(url);
    else root.open(url, '_blank');
  };
  /** Partage de l'image (Android : menu Partager → WhatsApp ; PC : téléchargement). */
  Pr.shareImage = async (sale) => {
    const blob = await Pr.image(sale);
    const file = new File([blob], `${sale.no}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `Fiche ${sale.no}`, text: Pr.whatsappText(sale) }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancel'; }
    }
    U().download(`${sale.no}.png`, blob);
    return 'downloaded';
  };
})(window);
