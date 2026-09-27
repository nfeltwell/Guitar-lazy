// Fretboard, chord windows and tab, drawn as SVG. High e on top, like tab.
import { svg, h } from './dom.js';
import { fretMidi, noteName, parseChord } from '../theory.js';

const FW = 46; // fret width
const SG = 21; // string gap
const TOP = 14;
const LEFT = 28;
const INLAYS = [3, 5, 7, 9, 15, 17];

function yOf(s) {
  return TOP + (5 - s) * SG;
}

// dots: [{s, f, label, kind: 'root'|'tone'|'scale'|'ghost'|'finger'|'blue'}]
export function fretboard({ from = 0, to = 12, dots = [], muted = [], onTap, label = 'Fretboard', showNumbers = true, compact = false } = {}) {
  const frets = to - from + (from === 0 ? 0 : 1);
  const width = LEFT + frets * FW + 8;
  const height = TOP * 2 + SG * 5 + (showNumbers ? 16 : 0);
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'fb' + (compact ? ' fb-compact' : ''), role: 'img', 'aria-label': label });
  const xLine = (k) => LEFT + (k - (from === 0 ? 0 : from - 1)) * FW; // x of fret wire k
  const xCenter = (f) => (f === 0 ? LEFT / 2 : xLine(f) - FW / 2);
  // wood
  root.append(svg('rect', { x: LEFT, y: TOP - 6, width: width - LEFT - 8, height: SG * 5 + 12, rx: 3, class: 'fb-wood' }));
  // inlays
  for (let f = Math.max(1, from); f <= to; f++) {
    if (INLAYS.includes(f)) root.append(svg('circle', { cx: xCenter(f), cy: TOP + SG * 2.5, r: 4.5, class: 'fb-inlay' }));
    if (f === 12) {
      root.append(svg('circle', { cx: xCenter(f), cy: TOP + SG * 1.5, r: 4.5, class: 'fb-inlay' }));
      root.append(svg('circle', { cx: xCenter(f), cy: TOP + SG * 3.5, r: 4.5, class: 'fb-inlay' }));
    }
  }
  // frets
  const firstWire = from === 0 ? 0 : from - 1;
  for (let k = firstWire; k <= to; k++) {
    const isNut = k === 0;
    root.append(svg('line', { x1: xLine(k), x2: xLine(k), y1: TOP - 6, y2: TOP + SG * 5 + 6, class: isNut ? 'fb-nut' : 'fb-fret' }));
  }
  // strings
  for (let s = 0; s < 6; s++) {
    root.append(svg('line', { x1: LEFT, x2: width - 8, y1: yOf(s), y2: yOf(s), class: 'fb-string', 'stroke-width': 0.8 + (6 - s) * 0.28, 'data-s': s }));
  }
  // fret numbers
  if (showNumbers)
    for (let f = Math.max(1, from); f <= to; f++) {
      if (INLAYS.includes(f) || f === 12 || f === from || f === 1)
        root.append(svg('text', { x: xCenter(f), y: height - 3, class: 'fb-num', 'text-anchor': 'middle' }, String(f)));
    }
  // muted markers
  for (const s of muted) root.append(svg('text', { x: LEFT / 2, y: yOf(s) + 4, class: 'fb-mute', 'text-anchor': 'middle' }, '×'));
  // dots
  const dotLayer = svg('g', { class: 'fb-dots' });
  for (const d of dots) {
    if (d.f < from && d.f !== 0) continue;
    if (d.f > to) continue;
    const g = svg('g', { class: 'fb-dot k-' + (d.kind || 'scale') + (d.f === 0 ? ' open' : ''), 'data-s': d.s, 'data-f': d.f });
    const r = d.f === 0 ? 7.5 : 9.5;
    g.append(svg('circle', { cx: xCenter(d.f), cy: yOf(d.s), r }));
    if (d.label != null) g.append(svg('text', { x: xCenter(d.f), y: yOf(d.s) + 3.6, 'text-anchor': 'middle' }, String(d.label)));
    dotLayer.append(g);
  }
  root.append(dotLayer);
  const hits = svg('g', { class: 'fb-hits' });
  root.append(hits);
  // tap targets
  if (onTap) {
    const tapLayer = svg('g', { class: 'fb-taps' });
    for (let s = 0; s < 6; s++)
      for (let f = from === 0 ? 0 : from; f <= to; f++) {
        const x0 = f === 0 ? 0 : xLine(f) - FW;
        const w = f === 0 ? LEFT : FW;
        const r = svg('rect', { x: x0, y: yOf(s) - SG / 2, width: w, height: SG, class: 'fb-tap', tabindex: -1 });
        r.addEventListener('click', () => onTap(s, f));
        tapLayer.append(r);
      }
    root.append(tapLayer);
  }
  // Animate plucked notes: pass [{s,f}].
  root.highlight = (notes) => {
    while (hits.firstChild) hits.firstChild.remove();
    root.querySelectorAll('.fb-string.on').forEach((l) => l.classList.remove('on'));
    for (const n of notes || []) {
      root.querySelector(`.fb-string[data-s="${n.s}"]`)?.classList.add('on');
      if (n.f < from && n.f !== 0) continue;
      const c = svg('circle', { cx: xCenter(n.f), cy: yOf(n.s), r: 12.5, class: 'fb-hit' });
      hits.append(c);
      if (n.label) hits.append(svg('text', { x: xCenter(n.f), y: yOf(n.s) + 3.8, 'text-anchor': 'middle', class: 'fb-hit-label' }, n.label));
    }
  };
  root.xCenter = xCenter;
  return root;
}

// A chord shape in a small window. Finger numbers inside dots, roots marked.
export function shapeWindow(shape, { sym, label, fingers = true, compact = true } = {}) {
  const frets = shape.frets;
  const fretted = frets.filter((f) => f > 0);
  const max = fretted.length ? Math.max(...fretted) : 0;
  const min = fretted.length ? Math.min(...fretted) : 0;
  const from = max <= 4 ? 0 : min;
  const to = from === 0 ? Math.max(4, max) : from + Math.max(3, max - min);
  let rootPc = null;
  try {
    rootPc = parseChord(sym || shape.sym).root;
  } catch {
    rootPc = null;
  }
  const dots = [];
  const muted = [];
  frets.forEach((f, s) => {
    if (f < 0) return muted.push(s);
    const isRoot = rootPc != null && fretMidi(s, f) % 12 === rootPc;
    const fi = shape.fingers ? shape.fingers[s] : 0;
    dots.push({ s, f, kind: isRoot ? 'root' : 'tone', label: fingers && f > 0 && fi ? fi : f === 0 ? '' : '' });
  });
  const el = fretboard({ from, to, dots, muted, label: label || `${sym || shape.sym} chord shape`, compact, showNumbers: from > 0 });
  el.classList.add('fb-shape');
  return el;
}

// Tab. columns: [{notes:[{s,f,tech}], mark?}] -> SVG with a movable playhead.
export function tab(columns, { label = 'Tab', beatEvery = 0 } = {}) {
  const CW = 24;
  const width = 22 + columns.length * CW + 10;
  const height = 12 + 5 * 13 + 14;
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'tab', role: 'img', 'aria-label': label, width: Math.max(width, 200) });
  const y = (s) => 12 + (5 - s) * 13;
  const head = svg('rect', { x: -40, y: 4, width: CW - 2, height: 5 * 13 + 16, rx: 5, class: 'tab-head' });
  root.append(head);
  ['e', 'B', 'G', 'D', 'A', 'E'].forEach((n, i) => {
    root.append(svg('text', { x: 4, y: 12 + i * 13 + 4, class: 'tab-str' }, n));
    root.append(svg('line', { x1: 16, x2: width - 4, y1: 12 + i * 13, y2: 12 + i * 13, class: 'tab-line' }));
  });
  columns.forEach((col, i) => {
    const x = 22 + i * CW + CW / 2;
    if (beatEvery && i % beatEvery === 0 && i > 0) root.append(svg('line', { x1: x - CW / 2, x2: x - CW / 2, y1: 12, y2: 12 + 5 * 13, class: 'tab-bar' }));
    for (const n of col.notes) {
      root.append(svg('rect', { x: x - 8, y: y(n.s) - 6, width: 16, height: 12, class: 'tab-bg' }));
      root.append(svg('text', { x, y: y(n.s) + 4, 'text-anchor': 'middle', class: 'tab-num' }, String(n.f)));
      if (n.tech) root.append(svg('text', { x: x - 10, y: y(n.s) - 6, class: 'tab-tech' }, n.tech));
    }
    if (col.mark) root.append(svg('text', { x, y: height - 2, 'text-anchor': 'middle', class: 'tab-mark' }, col.mark));
  });
  root.playhead = (i) => {
    head.setAttribute('x', i == null || i < 0 ? -40 : 22 + i * CW + 1);
  };
  return root;
}

// Strum pattern row: arrows over counts.
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
