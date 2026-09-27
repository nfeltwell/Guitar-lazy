// The neck, drawn by hand: pencil strings and frets with a slight wobble, coloured-pencil note dots.
// Vertical like a chord book: nut at the top, low E on the left.
// The wobble is seeded from each line's position, so the same drawing comes out the same every time.
import { svg, h } from './dom.js';
import { fretMidi, noteName, parseChord } from '../theory.js';

const SG = 40; // string spacing
const LEFT = 46; // room for fret numbers
const RIGHT = 16;
const OPEN = 28; // row above the nut for open/muted markers
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const FINGER_ROW = 30;

// ---------------------------------------------------------------------------
// Sketch primitives
function rng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
const seedOf = (...n) => n.reduce((a, b) => (Math.imul(a, 31) + Math.round(b * 7)) | 0, 17);
const f1 = (n) => n.toFixed(1);

export function wobblyPath(x1, y1, x2, y2, amp = 0.9, seed) {
  const r = rng(seed ?? seedOf(x1, y1, x2, y2));
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const segs = Math.max(1, Math.round(len / 70));
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  let d = `M${f1(x1 + (r() - 0.5) * amp)},${f1(y1 + (r() - 0.5) * amp)}`;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const tm = (i - 0.5) / segs;
    const off = (r() - 0.5) * 2 * amp;
    const cx = x1 + (x2 - x1) * tm + nx * off;
    const cy = y1 + (y2 - y1) * tm + ny * off;
    const ex = x1 + (x2 - x1) * t + (r() - 0.5) * amp * 0.5;
    const ey = y1 + (y2 - y1) * t + (r() - 0.5) * amp * 0.5;
    d += ` Q${f1(cx)},${f1(cy)} ${f1(ex)},${f1(ey)}`;
  }
  return d;
}

// A pencil stroke: one firm pass plus a lighter second pass, slightly off.
export function pencil(x1, y1, x2, y2, cls, { amp = 0.9, width, second = true } = {}) {
  const g = svg('g', { class: cls });
  const seed = seedOf(x1, y1, x2, y2);
  g.append(svg('path', { d: wobblyPath(x1, y1, x2, y2, amp, seed), 'stroke-width': width }));
  if (second) g.append(svg('path', { d: wobblyPath(x1 + 0.4, y1 + 0.3, x2 - 0.3, y2 + 0.4, amp * 1.2, seed + 99), 'stroke-width': width ? width * 0.55 : undefined, class: 'p2' }));
  return g;
}

// A hand-drawn circle: slightly lumpy, ends overlap a little like a real pen loop.
export function blobPath(cx, cy, r, seed, { open = false } = {}) {
  const rand = rng(seed);
  const n = 9;
  const pts = [];
  for (let i = 0; i <= n + (open ? 1 : 0); i++) {
    const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.15 - 0.4;
    const rr = r * (1 + (rand() - 0.5) * 0.12);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  let d = `M${f1((pts[0][0] + pts[1][0]) / 2)},${f1((pts[0][1] + pts[1][1]) / 2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${f1(pts[i][0])},${f1(pts[i][1])} ${f1(mx)},${f1(my)}`;
  }
  return open ? d : d + 'Z';
}

function crossPath(cx, cy, r, seed) {
  return wobblyPath(cx - r, cy - r, cx + r, cy + r, 0.8, seed) + ' ' + wobblyPath(cx + r, cy - r, cx - r, cy + r, 0.8, seed + 5);
}

// Colour class for a note relative to a chord (or key) root.
export function degreeKind(midi, rootPc, quality = '') {
  const iv = (((midi - rootPc) % 12) + 12) % 12;
  if (iv === 0) return 'root';
  if (iv === 3 || iv === 4) return 'third';
  if (iv === 7 || (iv === 6 && /dim|b5/.test(quality)) || (iv === 8 && quality === 'aug')) return 'fifth';
  return 'ext';
}

// dots: [{s, f, label, kind: root|third|fifth|ext|scale|blue|dim|ghost}]
export function neck({ from = 0, to = 12, dots = [], muted = [], onTap, label = 'Fretboard', fh = 38, pickRow = false, box = false, stringNames = true } = {}) {
  const base = from === 0 ? 0 : from - 1;
  const frets = to - base;
  const top = OPEN;
  const width = LEFT + SG * 5 + RIGHT;
  const height = top + frets * fh + (pickRow ? FINGER_ROW + 6 : 8) + (stringNames && !box ? 16 : 0);
  const x = (s) => LEFT + s * SG;
  const yWire = (k) => top + (k - base) * fh;
  const yCenter = (f) => (f === 0 ? top - OPEN / 2 + 2 : yWire(f) - fh / 2);
  const bx0 = x(0) - SG / 2 + 6;
  const bx1 = x(5) + SG / 2 - 6;
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'nk' + (box ? ' nk-box' : ' nk-long'), role: 'img', 'aria-label': label });
  // a light pencil wash for the board, drawn as a slightly uneven quad
  const wr = rng(seedOf(from, to, fh));
  const j = () => (wr() - 0.5) * 2;
  root.append(svg('path', { d: `M${f1(bx0 + j())},${top} L${f1(bx1 + j())},${top} L${f1(bx1 + j())},${f1(yWire(to) + j())} L${f1(bx0 + j())},${f1(yWire(to) + j())} Z`, class: 'nk-wash' }));
  for (let f = Math.max(1, from); f <= to; f++) {
    const cy = yCenter(f);
    const inl = (cx) => svg('path', { d: blobPath(cx, cy, 3.4, seedOf(cx, cy)), class: 'nk-inlay' });
    if (f % 12 === 0) root.append(inl(x(1.5)), inl(x(3.5)));
    else if (INLAYS.includes(f)) root.append(inl(x(2.5)));
  }
  for (let k = base; k <= to; k++) {
    if (k === 0) {
      root.append(pencil(bx0 - 2, yWire(0) - 1.5, bx1 + 2, yWire(0) - 1.5, 'nk-nut', { width: 3.6, amp: 0.7 }));
      root.append(pencil(bx0 - 1, yWire(0) + 2.5, bx1 + 1, yWire(0) + 2.5, 'nk-nut', { width: 1.4, amp: 0.7, second: false }));
    } else root.append(pencil(bx0, yWire(k), bx1, yWire(k), 'nk-fret', { amp: 0.8 }));
  }
  for (let s = 0; s < 6; s++) {
    const g = pencil(x(s), top - 1, x(s), yWire(to) + 2, 'nk-string', { width: 2.1 - s * 0.24, amp: 1.1 });
    g.dataset.s = s;
    root.append(g);
  }
  for (let f = Math.max(1, from); f <= to; f++)
    if (f === from || INLAYS.includes(f) || f % 12 === 0) root.append(svg('text', { x: LEFT - SG / 2 - 4, y: yCenter(f) + 5, 'text-anchor': 'end', class: 'nk-num' }, String(f)));
  for (const s of muted) root.append(svg('path', { d: crossPath(x(s), top - 13, 4.5, seedOf(s, 77)), class: 'nk-mute' }));
  const hl = svg('g', { class: 'nk-hl' }); // highlighter goes under the dots
  root.append(hl);
  const dotLayer = svg('g');
  for (const d of dots) {
    if ((d.f < from && d.f !== 0) || d.f > to) continue;
    const cx = x(d.s);
    const cy = yCenter(d.f);
    const seed = seedOf(d.s, d.f, cx);
    const g = svg('g', { class: `nk-dot k-${d.kind || 'scale'}${d.f === 0 ? ' open' : ''}`, 'data-s': d.s, 'data-f': d.f });
    const r = d.f === 0 ? 7.5 : Math.min(13.5, fh / 2 - 3.5);
    if (d.f !== 0) g.append(svg('path', { d: blobPath(cx + 0.6, cy + 0.5, r - 0.4, seed + 3), class: 'fill' }));
    g.append(svg('path', { d: blobPath(cx, cy, r, seed, { open: true }), class: 'line' }));
    if (d.label != null && d.label !== '' && d.f !== 0) g.append(svg('text', { x: cx, y: cy + 5, 'text-anchor': 'middle' }, String(d.label)));
    dotLayer.append(g);
  }
  root.append(dotLayer);
  if (stringNames && !box) ['E', 'A', 'D', 'G', 'B', 'e'].forEach((n, s) => root.append(svg('text', { x: x(s), y: height - 3, 'text-anchor': 'middle', class: 'nk-sname' }, n)));
  const rings = svg('g', { class: 'nk-rings' }); // red pen goes on top
  root.append(rings);
  const pickY = yWire(to) + FINGER_ROW / 2 + 8;
  if (onTap) {
    const taps = svg('g');
    for (let s = 0; s < 6; s++)
      for (let f = from === 0 ? 0 : from; f <= to; f++) {
        const r = svg('rect', { x: x(s) - SG / 2, y: f === 0 ? 0 : yWire(f) - fh, width: SG, height: f === 0 ? OPEN : fh, class: 'nk-tap' });
        r.addEventListener('click', () => onTap(s, f));
        taps.append(r);
      }
    root.append(taps);
  }
  // Show what's being played: highlighter under the note, red pen ring around it,
  // the string itself inked in, and the picking finger written underneath.
  // Notes with next:true get a dashed pencil ring (what comes next).
  root.highlight = (notes) => {
    hl.replaceChildren();
    rings.replaceChildren();
    root.querySelectorAll('.nk-string.on').forEach((l) => l.classList.remove('on'));
    for (const n of notes || []) {
      if (n.s == null || n.s < 0) continue;
      const cx = x(n.s);
      const cy = yCenter(n.f);
      const visible = !(n.f < from && n.f !== 0) && n.f <= to;
      if (n.next) {
        if (visible) rings.append(svg('path', { d: blobPath(cx, cy, Math.min(17, fh / 2), seedOf(cx, cy, 5), { open: true }), class: 'nk-next' }));
        continue;
      }
      root.querySelector(`.nk-string[data-s="${n.s}"]`)?.classList.add('on');
      if (visible) {
        hl.append(svg('path', { d: blobPath(cx, cy, Math.min(19, fh / 2 + 2), seedOf(cx, cy, 1)), class: 'nk-hl-blob' }));
        rings.append(svg('path', { d: blobPath(cx, cy, Math.min(17, fh / 2), seedOf(cx, cy, 2), { open: true }), class: 'nk-ring' }));
      }
      if (pickRow && n.label) {
        hl.append(svg('path', { d: blobPath(cx, pickY - 3, 12, seedOf(cx, 9)), class: 'nk-hl-blob' }));
        rings.append(svg('text', { x: cx, y: pickY + 3, 'text-anchor': 'middle', class: 'nk-pick' }, n.label));
      }
    }
  };
  return root;
}

function windowFor(frets) {
  const fretted = frets.filter((f) => f > 0);
  const max = fretted.length ? Math.max(...fretted) : 0;
  const min = fretted.length ? Math.min(...fretted) : 0;
  const from = max <= 4 ? 0 : min;
  const to = from === 0 ? Math.max(4, max) : from + Math.max(3, max - min);
  return { from, to };
}

function boxDots(shape, sym, labels) {
  let c = null;
  try {
    c = parseChord(sym || shape.sym);
  } catch {
    c = null;
  }
  const dots = [];
  const muted = [];
  shape.frets.forEach((f, s) => {
    if (f < 0) return muted.push(s);
    const m = fretMidi(s, f);
    const fi = shape.fingers ? shape.fingers[s] : 0;
    const lab = labels === 'finger' ? (f > 0 && fi ? fi : '') : labels === 'note' ? noteName(m % 12) : '';
    dots.push({ s, f, kind: c ? degreeKind(m, c.root, c.quality) : 'scale', label: lab });
  });
  return { dots, muted };
}

// A chord box: a short window of the neck with finger numbers and degree colours.
export function chordBox(shape, { sym, labels = 'finger', label } = {}) {
  const { from, to } = windowFor(shape.frets);
  const { dots, muted } = boxDots(shape, sym, labels);
  return neck({ from, to, dots, muted, label: label || `${sym || shape.sym} chord`, fh: 40, box: true });
}

// Chord box with a pick row underneath, for "pick this, then this".
export function pickBox(shape, { sym } = {}) {
  const { from, to } = windowFor(shape.frets);
  const { dots, muted } = boxDots(shape, sym, 'finger');
  return neck({ from, to, dots, muted, label: `${sym || shape.sym}: pick the lit string`, fh: 40, box: true, pickRow: true });
}

// Tab, typed like a tab sheet on pencil lines. columns: [{notes:[{s,f,tech}], mark}]
export function tab(columns, { label = 'Tab', beatEvery = 0 } = {}) {
  const CW = 24;
  const width = 22 + columns.length * CW + 10;
  const height = 12 + 5 * 13 + 16;
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'tab', role: 'img', 'aria-label': label, width: Math.max(width, 200) });
  const y = (s) => 12 + (5 - s) * 13;
  const head = svg('path', { d: '', class: 'tab-head' });
  ['e', 'B', 'G', 'D', 'A', 'E'].forEach((n, i) => {
    root.append(svg('text', { x: 3, y: 12 + i * 13 + 4, class: 'tab-str' }, n));
    root.append(pencil(16, 12 + i * 13, width - 4, 12 + i * 13, 'tab-line', { amp: 0.6, second: false }));
  });
  columns.forEach((col, i) => {
    const cx = 22 + i * CW + CW / 2;
    if (beatEvery && i % beatEvery === 0 && i > 0) root.append(pencil(cx - CW / 2, 11, cx - CW / 2, 12 + 5 * 13 + 1, 'tab-bar', { amp: 0.5, second: false }));
    for (const n of col.notes) {
      root.append(svg('rect', { x: cx - 7.5, y: y(n.s) - 6, width: 15, height: 12, class: 'tab-bg' }));
      root.append(svg('text', { x: cx, y: y(n.s) + 4, 'text-anchor': 'middle', class: 'tab-num' }, String(n.f)));
      if (n.tech) root.append(svg('text', { x: cx - 10, y: y(n.s) - 6, class: 'tab-tech' }, n.tech));
    }
    if (col.mark) root.append(svg('text', { x: cx, y: height - 2, 'text-anchor': 'middle', class: 'tab-mark' }, col.mark));
  });
  root.append(head); // on top, blended like a real highlighter over ink
  // The playhead is a highlighter swipe over the column.
  root.playhead = (i) => {
    if (i == null || i < 0) return head.setAttribute('d', '');
    const x0 = 22 + i * CW + 1;
    const r = rng(i + 3);
    const w = CW - 2;
    const b = 12 + 5 * 13 + 6;
    head.setAttribute('d', `M${f1(x0 + r() * 2)},${f1(4 + r() * 2)} L${f1(x0 + w - r() * 2)},${f1(3 + r() * 2)} L${f1(x0 + w - r() * 2)},${f1(b - r() * 2)} L${f1(x0 + r() * 2)},${f1(b + r())} Z`);
  };
  return root;
}

// Strum pattern row: hand-drawn arrows over counts.
export function strumRow(slots, { label = 'Strum pattern' } = {}) {
  const n = slots.length;
  const counts = n === 16 ? ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a'] : n === 6 ? ['1', '&', 'a', '2', '&', 'a'] : ['1', '&', '2', '&', '3', '&', '4', '&'];
  const row = h('div.strum', { role: 'img', 'aria-label': label + ': ' + slots.split('').join(' ') });
  [...slots].forEach((c, i) => {
    const glyph = c === 'D' ? '↓' : c === 'U' ? '↑' : c === 'X' ? '×' : '·';
    row.append(h('div.strum-cell', { 'data-i': i, class: c === '.' ? 'rest' : c === 'X' ? 'chuck' : '' }, h('span.strum-glyph', glyph), h('span.strum-count', counts[i] || '')));
  });
  row.playhead = (i) => {
    row.querySelectorAll('.strum-cell.on').forEach((x) => x.classList.remove('on'));
    if (i != null && i >= 0) row.querySelector(`[data-i="${i}"]`)?.classList.add('on');
  };
  return row;
}

export function noteLabel(s, f, flats) {
  return noteName(fretMidi(s, f) % 12, flats);
}

// Legend for the note colours, drawn as little pencil dots.
export function legend(kinds = ['root', 'third', 'fifth', 'ext']) {
  const names = { root: 'root', third: '3rd', fifth: '5th', ext: '7th, 6th, 9th, sus', scale: 'other scale note', blue: 'blue note', dim: 'other positions' };
  return h(
    'div.legend',
    kinds.map((k) => {
      const dot = svg('svg', { viewBox: '0 0 16 16', width: 14, height: 14, class: 'nk-dot k-' + k, 'aria-hidden': 'true' });
      dot.append(svg('path', { d: blobPath(8.3, 8.3, 5.6, seedOf(k.length, 3)), class: 'fill' }), svg('path', { d: blobPath(8, 8, 6, seedOf(k.length, 4), { open: true }), class: 'line' }));
      return h('span', dot, names[k]);
    }),
  );
}

// A hand-drawn rule as a CSS background (used between sections).
export function ruleDataUri(color) {
  const d = wobblyPath(1, 3, 399, 3.5, 1.4, 4242);
  const svgText = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 7' preserveAspectRatio='none'><path d='${d}' fill='none' stroke='${color}' stroke-width='1.6' stroke-linecap='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svgText)}")`;
}
