// Tiny DOM helpers. h('div.card#id', {onclick}, ...children)
export function h(sel, attrs, ...kids) {
  if (attrs == null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
    if (attrs != null) kids.unshift(attrs);
    attrs = {};
  }
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(sel);
  const el = document.createElement((m && m[1]) || 'div');
  if (m && m[2])
    for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1));
      else el.id = part.slice(1);
    }
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids.flat(Infinity)) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

let toastTimer = null;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = h('div#toast', { role: 'status', 'aria-live': 'polite' });
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// Segmented control
export function seg(options, value, onChange, { id, label, wide } = {}) {
  const wrap = h('div.seg', { role: 'radiogroup', 'aria-label': label || 'Choose', id, class: wide ? 'wide' : '' });
  for (const o of options) {
    const opt = typeof o === 'object' ? o : { value: o, label: o };
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(opt.value === value), class: opt.value === value ? 'on' : '', onclick: () => onChange(opt.value) }, opt.label);
    wrap.append(b);
  }
  return wrap;
}

export function select(options, value, onChange, { id, label } = {}) {
  const s = h('select', { id, 'aria-label': label, onchange: (e) => onChange(e.target.value) });
  for (const o of options) {
    const opt = typeof o === 'object' ? o : { value: o, label: o };
    s.append(h('option', { value: opt.value, selected: opt.value === value }, opt.label));
  }
  return s;
}

export function field(label, control) {
  return h('label.field', h('span.field-label', label), control);
}

// Icons: simple stroked glyphs drawn to one grid.
const P = {
  play: 'M8 5.5v13l10.5-6.5z',
  stop: 'M7 7h10v10H7z',
  today: 'M12 3v2M12 19v2M4.2 7l1.7 1M18.1 16l1.7 1M4.2 17l1.7-1M18.1 8l1.7-1M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
  pick: 'M12 20c-3-2-7-6-7-10a7 4.5 0 0 1 14 0c0 4-4 8-7 10z',
  moves: 'M3 19h5v-5h5V9h5V4h3',
  neck: 'M7 3v18M10 3v18M14 3v18M17 3v18M5 7h14M5 12h14M5 17h14',
  jam: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0M19 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0',
  ear: 'M8 18c0 2 3 3 4.5 1.5S14 16 15.5 14.5S18 11 18 9a6 6 0 0 0-12 0M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-2.5 3',
  you: 'M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6',
  metro: 'M9 20l2-15h2l2 15zM12 14l5-7M7.5 20h9',
  minus: 'M6 12h12',
  plus: 'M6 12h12M12 6v12',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7l7 7',
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z',
  check: 'M5 12.5l4.5 4.5L19 7',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  save: 'M6 4h10l3 3v13H6zM9 4v5h6V4M9 20v-6h6v6',
  loop: 'M4 12a6 6 0 0 1 6-6h8M15 3l3 3l-3 3M20 12a6 6 0 0 1-6 6H6M9 21l-3-3l3-3',
  eye: 'M2.5 12s3.5-6 9.5-6s9.5 6 9.5 6s-3.5 6-9.5 6s-9.5-6-9.5-6zM12 14.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 1 0 0 5',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
};
export function icon(name, size = 22) {
  const s = svg('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', class: 'icon' });
  const filled = name === 'play' || name === 'stop';
  s.append(svg('path', { d: P[name], fill: filled ? 'currentColor' : 'none', stroke: filled ? 'none' : 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  return s;
}

// Swap a button's label and icon in place (Play <-> Stop).
export function setBtn(b, label, ico) {
  const span = b.querySelector('span');
  if (span) span.textContent = label;
  const old = b.querySelector('svg.icon');
  if (old && ico) old.replaceWith(icon(ico, 20));
}

export function btn(label, onclick, { cls = '', ico, id, title, disabled } = {}) {
  return h('button', { type: 'button', class: 'btn ' + cls, onclick, id, title, 'aria-label': title, disabled }, ico ? icon(ico, 20) : null, label ? h('span', label) : null);
}
