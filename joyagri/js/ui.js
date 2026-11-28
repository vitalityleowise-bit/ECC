/* JOYAGRI — outils d'interface : création d'éléments, fenêtres, messages, icônes. */
(function (root) {
  'use strict';
  const J = root.J;
  const U = (J.ui = {});

  /** h('div', {class:'x', onclick:fn}, enfant1, 'texte', [liste]) */
  const h = (U.h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    const add = (c) => {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return el;
  });
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Icônes (dessinées pour JOYAGRI) ---------- */
  const P = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.3a2 2 0 002 1.7h8.6a2 2 0 002-1.6L22 8H6"/>',
    receipt: '<path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.6c2.3.3 4 1.9 4.5 5.4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    truck: '<path d="M1 6h13v10H1zM14 10h4l3 3v3h-7z"/><circle cx="5.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>',
    wallet: '<path d="M3 7a2 2 0 012-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.5"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5z"/><path d="M4 19.5V4.5M8 7h8M8 11h6"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
    save: '<path d="M5 3h11l5 5v13H5z"/><path d="M8 3v5h7M8 21v-7h8v7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    chat: '<path d="M3 20l1.5-4.2A8 8 0 1112 20a8 8 0 01-3.9-1z"/><path d="M9 10c.3 1.8 2.2 3.8 4 4.2l1.2-1.2 1.8.8"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.01"/>',
    tractor: '<circle cx="7" cy="16" r="4"/><circle cx="18" cy="18" r="2"/><path d="M5 12V6h6l2 6h5l2 3v3h-1M11 16h5"/><path d="M9 6V3"/>',
    icecream: '<path d="M7 11a5 5 0 1110 0"/><path d="M6 11h12l-6 11z"/><path d="M10 14l2 3"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 3h16"/>',
    logout: '<path d="M15 4h4v16h-4M10 17l-5-5 5-5M5 12h11"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>',
    snow: '<path d="M12 2v20M4.9 7l14.2 10M4.9 17L19.1 7"/><path d="M9 3.5L12 6l3-2.5M9 20.5L12 18l3 2.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.3-1.4M17.7 6.3l1.4-1.4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
    refresh: '<path d="M20 12a8 8 0 11-2.3-5.6L20 9"/><path d="M20 4v5h-5"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l8-8"/>',
  };
  U.icon = (name, cls) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.9'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    s.innerHTML = P[name] || P.box;
    return s;
  };

  /* ---------- Messages ---------- */
  let toastT;
  U.toast = (msg, kind) => {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = h('div', { class: 'toast ' + (kind || ''), role: 'status' }, msg);
    document.body.appendChild(t);
    clearTimeout(toastT);
    toastT = setTimeout(() => t.remove(), kind === 'err' ? 5000 : 2600);
  };
  /** Exécute fn ; en cas d'erreur métier, affiche le message au lieu de planter. */
  U.safe = (fn) => (...a) => {
    try { return fn(...a); } catch (e) { console.error(e); U.toast(e.message || String(e), 'err'); return undefined; }
  };

  /* ---------- Fenêtres ---------- */
  U.modal = (title, body, actions, opts) => {
    opts = opts || {};
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const m = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
      h('h3', null, title, h('button', { class: 'iconbtn', onclick: close, 'aria-label': 'Fermer' }, U.icon('x'))),
      body,
      actions && actions.length ? h('div', { class: 'actions' }, actions.map((a) => h('button', {
        class: 'btn ' + (a.cls || ''), onclick: U.safe(() => { const r = a.click ? a.click(close) : null; if (r !== false && !a.keep) close(); }),
      }, a.icon ? U.icon(a.icon) : null, a.label))) : null);
    const ov = h('div', { class: 'overlay', onclick: (e) => { if (e.target === ov && !opts.sticky) close(); } }, m);
    document.body.appendChild(ov);
    document.addEventListener('keydown', onKey);
    const f = m.querySelector('input:not([type=checkbox]),select,textarea');
    if (f && !opts.noFocus) setTimeout(() => f.focus(), 60);
    return { close, el: m };
  };
  U.confirm = (title, text, okLabel, cls) => new Promise((res) => {
    let done = false;
    U.modal(title, h('p', null, text), [
      { label: 'Retour', cls: 'light', click: () => { done = true; res(false); } },
      { label: okLabel || 'Confirmer', cls: cls || '', click: () => { done = true; res(true); } },
    ], { onClose: () => { if (!done) res(false); } });
  });

  /* ---------- Champs de formulaire ---------- */
  /** U.field('Libellé', 'text'|'money'|'number'|'date'|'select'|'textarea'|'tel', valeur, {options, placeholder}) */
  U.field = (label, type, value, o) => {
    o = o || {};
    let input;
    if (type === 'select') {
      input = h('select', { name: o.name }, (o.options || []).map(([v, t]) => h('option', { value: v, selected: String(v) === String(value) ? 'selected' : null }, t)));
    } else if (type === 'textarea') {
      input = h('textarea', { name: o.name, placeholder: o.placeholder }, value || '');
    } else {
      const map = { money: 'text', number: 'text', qty: 'text' };
      input = h('input', {
        type: map[type] || type, name: o.name, placeholder: o.placeholder || '',
        inputmode: type === 'money' || type === 'number' || type === 'qty' ? 'decimal' : type === 'tel' ? 'tel' : null,
        value: type === 'money' ? (value ? J.fmt(value, '').replace(/ /g, ' ') : '') : value == null ? '' : value,
        autocomplete: o.autocomplete || 'off',
      });
    }
    if (o.oninput) input.addEventListener('input', o.oninput);
    if (o.onchange) input.addEventListener('change', o.onchange);
    const l = h('label', { class: 'f' }, label, o.hint ? h('span', { class: 'muted small' }, ' — ' + o.hint) : null, input);
    l.input = input;
    l.get = () => (type === 'money' ? J.toC(input.value) : type === 'number' || type === 'qty' ? J.parseNum(input.value) : input.value.trim());
    return l;
  };
  U.seg = (options, value, onchange, full) => {
    const wrap = h('div', { class: 'seg' + (full ? ' full' : ''), role: 'group' });
    const draw = () => {
      wrap.innerHTML = '';
      options.forEach(([v, t]) => wrap.appendChild(h('button', {
        type: 'button', class: v === value ? 'on' : '', 'aria-pressed': v === value ? 'true' : 'false',
        onclick: () => { value = v; draw(); onchange(v); },
      }, t)));
    };
    draw();
    wrap.get = () => value;
    return wrap;
  };
  U.kpi = (label, value, sub, cls) => h('div', { class: 'kpi ' + (cls || '') }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), sub ? h('div', { class: 's' }, sub) : null);
  U.empty = (iconName, text, action) => h('div', { class: 'empty' }, U.icon(iconName), h('p', null, text), action || null);
  U.initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  U.table = (heads, rows, foot) => h('div', { class: 'tablewrap' }, h('table', { class: 't' },
    h('thead', null, h('tr', null, heads.map((x) => (typeof x === 'string' ? h('th', null, x) : h('th', { class: x.n ? 'n' : '' }, x.t))))),
    h('tbody', null, rows),
    foot ? h('tfoot', null, foot) : null));
  U.td = (v, n) => h('td', { class: n ? 'n' : '' }, v);

  /** Lecture d'un fichier image (pièce justificative, logo) réduite pour ne pas alourdir la sauvegarde. */
  U.pickImage = (maxSide) => new Promise((res) => {
    const inp = h('input', { type: 'file', accept: 'image/*' });
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return res(null);
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, (maxSide || 900) / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = r.result;
      };
      r.readAsDataURL(f);
    };
    inp.click();
  });
  U.download = (name, content, type) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'application/octet-stream' });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  U.csv = (rows) => '﻿' + rows.map((r) => r.map((c) => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
})(window);
