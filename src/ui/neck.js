// Neck: every scale up and down the whole neck, chords in every position, name-that-chord, note map, reference tones.
import { h, btn, seg, select, field } from './dom.js';
import { neck, chordBox, noteLabel, legend, degreeKind } from './fretboard.js';
import { scaleKind } from './items.js';
import { scaleTrainer, SPEEDS } from './scaleTrainer.js';
import * as A from '../audio.js';
import { SCALES, CHORDS, pc, noteName, usesFlats, scalePosition, allScaleNotes, findVoicings, identifyChord, fretMidi, TUNING, prettyChord } from '../theory.js';
import { SHAPES } from '../content.js';

let ui = { mode: 'scales', view: 'look', speed: 'slow', key: 'A', scale: 'minPent', pos: -1, labels: 'degree', overlay: 'none', root: 'C', quality: '', frets: [-1, -1, -1, -1, -1, -1], naturals: true };
const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const QUALS = ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', 'add9', '6', 'm6', '5', 'dim', 'aug', '7sus4', 'madd9', 'm7b5'];
const PARENT = { majPent: 'major', minPent: 'minor', blues: 'minor' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export function render(root, ctx) {
  const modeHolder = h('div');
  const body = h('div.stack-lg');
  const drawMode = () =>
    modeHolder.replaceChildren(
      seg([{ value: 'scales', label: 'Scales' }, { value: 'chords', label: 'Chords' }, { value: 'name', label: 'Name it' }, { value: 'notes', label: 'Notes' }, { value: 'tune', label: 'Tune' }], ui.mode, (m) => {
        A.stopAll();
        ui.mode = m;
        drawMode();
        draw();
      }, { label: 'Mode', id: 'neck-mode', wide: true }),
    );
  const draw = () => {
    body.replaceChildren();
    ({ scales, chords, name, notes, tune })[ui.mode](body);
  };
  drawMode();
  draw();
  root.append(h('div.stack-lg', h('div.stack', h('h1', 'The neck'), h('p.muted', 'Swipe along the neck. High e on top, like tab.')), modeHolder, body));
}

// Triads built on the scale's degrees (pentatonics borrow from their parent scale).
function overlayChords(keyPc, scaleId) {
  const steps = SCALES[PARENT[scaleId] || scaleId].steps;
  if (steps.length !== 7) return [];
  return [0, 3, 4, 5].map((d) => {
    const r = steps[d];
    const third = (steps[(d + 2) % 7] - r + 12) % 12;
    const fifth = (steps[(d + 4) % 7] - r + 12) % 12;
    const q = third === 3 ? (fifth === 6 ? 'dim' : 'm') : '';
    const rn = q === '' ? ROMAN[d] : ROMAN[d].toLowerCase() + (q === 'dim' ? '°' : '');
    const rootPc = (keyPc + r) % 12;
    return { id: rn, rootPc, q, sym: noteName(rootPc, usesFlats(noteName(keyPc))) + q, tones: [0, third, fifth].map((t) => (rootPc + t) % 12) };
  });
}

function scales(body) {
  const sc = SCALES[ui.scale];
  const nPos = sc.steps.length <= 6 ? 5 : 7;
  if (ui.pos >= nPos) ui.pos = -1;
  const viewSeg = field('what to do', seg([{ value: 'look', label: 'Look at it' }, { value: 'practise', label: 'Practise it' }], ui.view, (v) => {
    ui.view = v;
    if (v === 'practise' && ui.pos < 0) ui.pos = 0;
    rerender(body, scales);
  }, { label: 'Look or practise', id: 'sc-view', wide: true }));
  if (ui.view === 'practise') {
    if (ui.pos < 0) ui.pos = 0;
    const trainer = scaleTrainer({ key: ui.key, scaleId: ui.scale, position: ui.pos, rootPc: pc(ui.key), getBpm: () => SPEEDS[ui.speed] });
    const speedSeg = h('div');
    const drawSpeed = () => speedSeg.replaceChildren(seg([{ value: 'slow', label: 'Slow' }, { value: 'medium', label: 'Medium' }, { value: 'fast', label: 'Fast' }], ui.speed, (v) => ((ui.speed = v), drawSpeed()), { label: 'Play-along speed', id: 'sc-speed', wide: true }));
    drawSpeed();
    body.append(
      viewSeg,
      h('div.fields', field('key', select(ROOTS, ui.key, (v) => ((ui.key = v), rerender(body, scales)), { id: 'sc-key' })), field('scale', select(Object.entries(SCALES).map(([id, s]) => ({ value: id, label: s.name })), ui.scale, (v) => ((ui.scale = v), rerender(body, scales)), { id: 'sc-scale' }))),
      field('position', seg(Array.from({ length: nPos }, (_, i) => ({ value: i, label: String(i + 1) })), ui.pos, (v) => ((ui.pos = v), rerender(body, scales)), { label: 'Position', id: 'sc-pos', wide: true })),
      trainer,
      field('play-along speed', speedSeg),
    );
    return;
  }
  const keyPc = pc(ui.key);
  const flats = usesFlats(ui.key) || ui.key.includes('b');
  const all = allScaleNotes(keyPc, ui.scale, 17);
  const box = ui.pos >= 0 ? scalePosition(keyPc, ui.scale, ui.pos) : null;
  const inBox = (n) => !box || box.some((b) => b.s === n.s && b.f === n.f);
  const chordsHere = overlayChords(keyPc, ui.scale);
  const ov = chordsHere.find((c) => c.id === ui.overlay);
  if (!ov) ui.overlay = 'none';
  const dots = all.map((n) => {
    let kind = scaleKind(n.degree);
    if (ov) kind = ov.tones.includes(n.midi % 12) ? degreeKind(n.midi, ov.rootPc, ov.q) : 'scale';
    if (!inBox(n)) kind = 'dim';
    return { s: n.s, f: n.f, kind, label: ui.labels === 'degree' ? n.degree : noteLabel(n.s, n.f, flats) };
  });
  const board = neck({ from: 0, to: 17, dots, label: `${ui.key} ${sc.name}, whole neck`, focus: box ? Math.max(0, Math.min(...box.map((n) => n.f)) - 1) : 0, onTap: (s, f) => A.pluck(fretMidi(s, f), A.now(), { vel: 0.7 }) });
  const posOpts = [{ value: -1, label: 'All' }, ...Array.from({ length: nPos }, (_, i) => ({ value: i, label: String(i + 1) }))];
  const span = box ? `frets ${Math.min(...box.map((n) => n.f))}–${Math.max(...box.map((n) => n.f))}` : 'every note, frets 0–17';
  body.append(
    viewSeg,
    h('div.fields', field('key', select(ROOTS, ui.key, (v) => ((ui.key = v), rerender(body, scales)), { id: 'sc-key' })), field('scale', select(Object.entries(SCALES).map(([id, s]) => ({ value: id, label: s.name })), ui.scale, (v) => ((ui.scale = v), rerender(body, scales)), { id: 'sc-scale' }))),
    h('div.nk-wrap', board),
    legend(ui.scale === 'blues' && !ov ? ['root', 'third', 'fifth', 'scale', 'blue'] : ['root', 'third', 'fifth', 'scale']),
    field('position', seg(posOpts, ui.pos, (v) => ((ui.pos = v), rerender(body, scales)), { label: 'Position', id: 'sc-pos', wide: true })),
    chordsHere.length ? field('show a chord inside the scale', seg([{ value: 'none', label: 'Scale' }, ...chordsHere.map((c) => ({ value: c.id, label: c.id }))], ui.overlay, (v) => ((ui.overlay = v), rerender(body, scales)), { label: 'Chord overlay', id: 'sc-ov', wide: true })) : null,
    h('div.row.between', h('span.label', `${ui.key} ${sc.name.toLowerCase()} · ${span}${ov ? ` · ${prettyChord(ov.sym)} lit` : ''}`), seg([{ value: 'degree', label: '1 2 3' }, { value: 'note', label: 'C D E' }], ui.labels, (v) => ((ui.labels = v), rerender(body, scales)), { label: 'Labels' })),
    box ? h('div.row', btn('Practise this position', () => ((ui.view = 'practise'), rerender(body, scales)), { cls: 'primary', ico: 'play', id: 'sc-play' })) : h('p.small.muted', 'Tap a dot to hear it. Pick a position to focus on one hand shape.'),
    h(
      'p.small.muted',
      ui.scale === 'minPent'
        ? 'Same notes as the major pentatonic three frets higher: A minor pentatonic = C major pentatonic. Each position overlaps the next, so you can slide between them along one string.'
        : ui.scale === 'majPent'
          ? 'Major pentatonic sounds sweet over major chords. It uses the minor pentatonic shapes started three frets lower: G major pentatonic = E minor pentatonic.'
          : 'Start and end on an orange root. Try the chord overlay: over a C chord, aim for the C chord’s notes and the scale around them is the path between.',
    ),
  );
}

function chords(body) {
  const sym = ui.root + ui.quality;
  let voicings = [];
  try {
    voicings = findVoicings(sym, { limit: 10 });
  } catch {
    voicings = [];
  }
  const curated = SHAPES[sym] ? [{ frets: SHAPES[sym].frets, fingers: SHAPES[sym].fingers, label: 'the usual one' }] : [];
  const list = [...curated, ...voicings.filter((v) => !curated.some((c) => c.frets.join() === v.frets.join()))];
  const grid = h('div.shape-grid');
  list.forEach((v) => {
    const cell = h('button.shape-cell', { type: 'button', 'aria-label': `Play ${sym}, ${v.label}`, onclick: () => {
      grid.querySelectorAll('.shape-cell').forEach((c) => c.classList.remove('on'));
      cell.classList.add('on');
      A.strumShape(v.frets, A.now(), { spread: 0.03 });
    } }, h('div.nm', h('span', prettyChord(sym)), h('span.small', v.label)), chordBox({ frets: v.frets, fingers: v.fingers, sym }, { sym }));
    grid.append(cell);
  });
  body.append(
    h('div.fields', field('root', select(ROOTS, ui.root, (v) => ((ui.root = v), rerender(body, chords)), { id: 'ch-root' })), field('type', select(QUALS.map((q) => ({ value: q, label: q === '' ? 'major' : q === 'm' ? 'minor' : q })), ui.quality, (v) => ((ui.quality = v), rerender(body, chords)), { id: 'ch-qual' }))),
    h('div.row.between', h('span.chord-name', prettyChord(sym)), h('span.label', CHORDS[ui.quality].name + ' · ' + list.length + ' shapes')),
    legend(),
    list.length ? grid : h('p.muted', 'No comfortable voicing found. Try another root.'),
    h('p.small.muted', 'Ordered from the nut up the neck. Tap a shape to hear it. Numbers are fingers. "E shape" and "A shape" are the barre shapes you know, moved up.'),
  );
}

function name(body) {
  const f = ui.frets;
  const names = identifyChord(f, false);
  const dots = [];
  const muted = [];
  const top = names[0];
  f.forEach((x, s) => {
    if (x < 0) return muted.push(s);
    dots.push({ s, f: x, kind: top ? degreeKind(fretMidi(s, x), top.root, top.quality) : 'scale', label: noteLabel(s, x) });
  });
  const board = neck({ from: 0, to: 12, dots, muted, fh: 34, onTap: (s, fr) => {
    ui.frets = ui.frets.map((v, i) => (i === s ? (v === fr ? -1 : fr) : v));
    rerender(body, name);
  }, label: 'Tap frets to build a chord' });
  body.append(
    h('p', 'Found a shape you like while noodling? Tap it in. Tap a fret again to lift it. Tap above the nut for an open string.'),
    h('div.sect', h('span.label', 'you are holding'), names.length ? h('div.chord-name', { id: 'chord-id' }, prettyChord(names[0].name)) : h('div.muted', { id: 'chord-id' }, dots.length < 2 ? 'Tap at least two strings.' : 'No name for that one. It might still sound good.'), names.length > 1 ? h('p.small.muted', 'Also: ' + names.slice(1).map((n) => prettyChord(n.name)).join(', ')) : null),
    h('div.row', btn('Strum it', () => A.strumShape(f, A.now(), { spread: 0.03 }), { cls: 'primary', ico: 'play', disabled: !dots.length }), btn('Clear', () => ((ui.frets = [-1, -1, -1, -1, -1, -1]), rerender(body, name)), { cls: 'quiet' }), btn('All open', () => ((ui.frets = [0, 0, 0, 0, 0, 0]), rerender(body, name)), { cls: 'ghost small' })),
    h('div.nk-wrap', board),
  );
}

function notes(body) {
  const dots = [];
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= 12; f++) {
      const n = noteName(fretMidi(s, f) % 12);
      if (ui.naturals && n.includes('#')) continue;
      dots.push({ s, f, kind: n === 'C' ? 'root' : n === 'E' || n === 'A' ? 'fifth' : 'scale', label: n });
    }
  body.append(
    h('div.row', seg([{ value: true, label: 'Naturals' }, { value: false, label: 'All notes' }], ui.naturals, (v) => ((ui.naturals = v), rerender(body, notes)), { label: 'Which notes' })),
    h('p.small', h('b', 'Landmarks. '), 'String 6: G at 3, A at 5, B at 7, C at 8, D at 10. String 5: C at 3, D at 5, E at 7, F at 8, G at 10. Everything repeats at fret 12. C is orange and A and E are blue so the pattern jumps out.'),
    h('div.nk-wrap', neck({ from: 0, to: 12, dots, fh: 34, label: 'Every note on the neck', onTap: (s, f) => A.pluck(fretMidi(s, f), A.now(), { vel: 0.7 }) })),
  );
}

function tune(body) {
  body.append(
    h('p', 'Tap a string to hear its note three times, then tune until the wobble between the two sounds stops.'),
    h('div.answers', [0, 1, 2, 3, 4, 5].map((s) => btn(['6 · low E', '5 · A', '4 · D', '3 · G', '2 · B', '1 · high e'][s], () => {
      const t = A.now();
      for (let k = 0; k < 3; k++) A.pluck(TUNING[s], t + k * 1.4, { vel: 0.7, dur: 1.3 });
    }, { cls: 'quiet', id: 'tune-' + s }))),
    h('p.small.muted', 'There’s no listening tuner, because pages inside Claude can’t use the microphone. That’s also why timing is self-rated. Use your phone’s tuner app, or tune by ear against these.'),
  );
}

function rerender(body, fn) {
  A.stopAll();
  body.replaceChildren();
  fn(body);
}

export function cleanup() {
  A.stopAll();
}
