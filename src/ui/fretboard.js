// The neck, drawn vertically like a chord book: nut at the top, low E on the left.
// Notes are coloured by what they are: root, 3rd, 5th, extension, or other scale note.
import { svg, h } from './dom.js';
import { fretMidi, noteName, parseChord } from '../theory.js';

const SG = 40; // string spacing
const LEFT = 46; // room for fret numbers
const RIGHT = 16;
const OPEN = 26; // row above the nut for open/muted markers
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const FINGER_ROW = 26;

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
  const base = from === 0 ? 0 : from - 1; // the wire at the top edge
  const frets = to - base;
  const top = OPEN;
  const width = LEFT + SG * 5 + RIGHT;
  const height = top + frets * fh + (pickRow ? FINGER_ROW + 6 : 8) + (stringNames && !box ? 14 : 0);
  const x = (s) => LEFT + s * SG;
  const yWire = (k) => top + (k - base) * fh;
  const yCenter = (f) => (f === 0 ? top - OPEN / 2 + 2 : yWire(f) - fh / 2);
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'nk' + (box ? ' nk-box' : ' nk-long'), role: 'img', 'aria-label': label });
  root.append(svg('rect', { x: x(0) - SG / 2 + 4, y: top, width: SG * 5 + SG - 8, height: frets * fh, class: 'nk-wood' }));
  for (let f = Math.max(1, from); f <= to; f++) {
    const cy = yCenter(f);
    if (f % 12 === 0) {
      root.append(svg('circle', { cx: x(1.5), cy, r: 4, class: 'nk-inlay' }));
      root.append(svg('circle', { cx: x(3.5), cy, r: 4, class: 'nk-inlay' }));
    } else if (INLAYS.includes(f)) root.append(svg('circle', { cx: x(2.5), cy, r: 4, class: 'nk-inlay' }));
  }
  for (let k = base; k <= to; k++) root.append(svg('line', { x1: x(0) - SG / 2 + 4, x2: x(5) + SG / 2 - 4, y1: yWire(k), y2: yWire(k), class: k === 0 ? 'nk-nut' : 'nk-fret' }));
  for (let s = 0; s < 6; s++) root.append(svg('line', { x1: x(s), x2: x(s), y1: top, y2: top + frets * fh, class: 'nk-string', 'data-s': s, 'stroke-width': 2.4 - s * 0.3 }));
  for (let f = Math.max(1, from); f <= to; f++)
    if (f === from || INLAYS.includes(f) || f % 12 === 0) root.append(svg('text', { x: LEFT - SG / 2 - 2, y: yCenter(f) + 4, 'text-anchor': 'end', class: 'nk-num' }, String(f)));
  for (const s of muted) root.append(svg('text', { x: x(s), y: top - 8, 'text-anchor': 'middle', class: 'nk-mute' }, '×'));
  const dotLayer = svg('g');
  for (const d of dots) {
    if ((d.f < from && d.f !== 0) || d.f > to) continue;
    const g = svg('g', { class: `nk-dot k-${d.kind || 'scale'}${d.f === 0 ? ' open' : ''}`, 'data-s': d.s, 'data-f': d.f });
    g.append(svg('circle', { cx: x(d.s), cy: yCenter(d.f), r: d.f === 0 ? 8 : Math.min(14, fh / 2 - 3) }));
    if (d.label != null && d.label !== '' && d.f !== 0) g.append(svg('text', { x: x(d.s), y: yCenter(d.f) + 4, 'text-anchor': 'middle' }, String(d.label)));
    dotLayer.append(g);
  }
  root.append(dotLayer);
  if (stringNames && !box) ['E', 'A', 'D', 'G', 'B', 'e'].forEach((n, s) => root.append(svg('text', { x: x(s), y: height - 3, 'text-anchor': 'middle', class: 'nk-sname' }, n)));
  const hits = svg('g', { class: 'nk-hits' });
  root.append(hits);
  const pickY = top + frets * fh + FINGER_ROW / 2 + 6;
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
  // Light up what is being played: string column + finger letter in the pick row.
  root.highlight = (notes) => {
    while (hits.firstChild) hits.firstChild.remove();
    root.querySelectorAll('.nk-string.on').forEach((l) => l.classList.remove('on'));
    for (const n of notes || []) {
      if (n.s == null || n.s < 0) continue;
      root.querySelector(`.nk-string[data-s="${n.s}"]`)?.classList.add('on');
      if (!(n.f < from && n.f !== 0) && n.f <= to) hits.append(svg('circle', { cx: x(n.s), cy: yCenter(n.f), r: Math.min(17, fh / 2), class: 'nk-hit' }));
      if (pickRow && n.label) {
        hits.append(svg('rect', { x: x(n.s) - 13, y: pickY - 12, width: 26, height: 22, rx: 3, class: 'nk-pick-bg' }));
        hits.append(svg('text', { x: x(n.s), y: pickY + 4, 'text-anchor': 'middle', class: 'nk-pick' }, n.label));
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

// Tab (horizontal, like every tab book). columns: [{notes:[{s,f,tech}], mark}]
export function tab(columns, { label = 'Tab', beatEvery = 0 } = {}) {
  const CW = 24;
  const width = 22 + columns.length * CW + 10;
  const height = 12 + 5 * 13 + 14;
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'tab', role: 'img', 'aria-label': label, width: Math.max(width, 200) });
  const y = (s) => 12 + (5 - s) * 13;
  const head = svg('rect', { x: -40, y: 4, width: CW - 2, height: 5 * 13 + 16, class: 'tab-head' });
  root.append(head);
  ['e', 'B', 'G', 'D', 'A', 'E'].forEach((n, i) => {
    root.append(svg('text', { x: 4, y: 12 + i * 13 + 4, class: 'tab-str' }, n));
    root.append(svg('line', { x1: 16, x2: width - 4, y1: 12 + i * 13, y2: 12 + i * 13, class: 'tab-line' }));
  });
  columns.forEach((col, i) => {
    const cx = 22 + i * CW + CW / 2;
    if (beatEvery && i % beatEvery === 0 && i > 0) root.append(svg('line', { x1: cx - CW / 2, x2: cx - CW / 2, y1: 12, y2: 12 + 5 * 13, class: 'tab-bar' }));
    for (const n of col.notes) {
      root.append(svg('rect', { x: cx - 8, y: y(n.s) - 6, width: 16, height: 12, class: 'tab-bg' }));
      root.append(svg('text', { x: cx, y: y(n.s) + 4, 'text-anchor': 'middle', class: 'tab-num' }, String(n.f)));
      if (n.tech) root.append(svg('text', { x: cx - 10, y: y(n.s) - 6, class: 'tab-tech' }, n.tech));
    }
    if (col.mark) root.append(svg('text', { x: cx, y: height - 2, 'text-anchor': 'middle', class: 'tab-mark' }, col.mark));
  });
  root.playhead = (i) => head.setAttribute('x', i == null || i < 0 ? -40 : 22 + i * CW + 1);
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

// Legend for the note colours.
export function legend(kinds = ['root', 'third', 'fifth', 'ext']) {
  const names = { root: 'root', third: '3rd', fifth: '5th', ext: '7th, 6th, 9th, sus', scale: 'other scale note', blue: 'blue note', dim: 'other positions' };
  return h('div.legend', kinds.map((k) => h('span', h('i', { class: 'sw k-' + k }), names[k])));
}
