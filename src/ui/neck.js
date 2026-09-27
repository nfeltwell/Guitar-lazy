// Neck: scales by position, chords in every position, name-that-chord, note map, reference tuner.
import { h, btn, seg, select, field, toast } from './dom.js';
import { fretboard, shapeWindow, noteLabel } from './fretboard.js';
import * as A from '../audio.js';
import { SCALES, CHORDS, SHARPS, FLATS, pc, noteName, usesFlats, scalePosition, allScaleNotes, findVoicings, identifyChord, fretMidi, TUNING } from '../theory.js';
import { SHAPES } from '../content.js';

let ui = { mode: 'scales', key: 'A', scale: 'minPent', pos: 0, labels: 'degree', root: 'C', quality: '', frets: [-1, -1, -1, -1, -1, -1], naturals: true };
const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const QUALS = ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', 'add9', '6', 'm6', '5', 'dim', 'aug', '7sus4', 'madd9', 'm7b5'];

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
  root.append(h('div.stack-lg', h('div.stack', h('h1', 'The neck'), h('p.muted', 'Everything on the fretboard. Scroll sideways for the whole neck.')), modeHolder, body));
}

function scales(body) {
  const sc = SCALES[ui.scale];
  const nPos = sc.steps.length <= 6 ? 5 : 7;
  if (ui.pos >= nPos) ui.pos = 0;
  const keyPc = pc(ui.key);
  const flats = usesFlats(ui.key) || ui.key.includes('b');
  const all = allScaleNotes(keyPc, ui.scale, 15);
  const box = ui.pos >= 0 ? scalePosition(keyPc, ui.scale, ui.pos) : null;
  const inBox = (n) => !box || box.some((b) => b.s === n.s && b.f === n.f);
  const dots = all.map((n) => ({ s: n.s, f: n.f, kind: !inBox(n) ? 'dim' : n.degree === '1' ? 'root' : n.degree === 'b5' ? 'blue' : 'scale', label: ui.labels === 'degree' ? n.degree : noteLabel(n.s, n.f, flats) }));
  const wrap = h('div.fb-wrap.full', fretboard({ from: 0, to: 15, dots, label: `${ui.key} ${sc.name}` }));
  const posOpts = [{ value: -1, label: 'All' }, ...Array.from({ length: nPos }, (_, i) => ({ value: i, label: String(i + 1) }))];
  body.append(
    h(
      'div.fields',
      field('Key', select(ROOTS, ui.key, (v) => ((ui.key = v), rerender(body, scales)), { id: 'sc-key' })),
      field('Scale', select(Object.entries(SCALES).map(([id, s]) => ({ value: id, label: s.name })), ui.scale, (v) => ((ui.scale = v), rerender(body, scales)), { id: 'sc-scale' })),
    ),
    h('div.row', h('span.small.muted', 'Position'), seg(posOpts, ui.pos, (v) => ((ui.pos = v), rerender(body, scales)), { label: 'Position', id: 'sc-pos' })),
    h('div.row', seg([{ value: 'degree', label: '1 2 3' }, { value: 'note', label: 'C D E' }], ui.labels, (v) => ((ui.labels = v), rerender(body, scales)), { label: 'Labels' })),
    wrap,
    h('div.legend', h('span', h('i', { style: { background: 'var(--fb-root)' } }), 'root'), h('span', h('i', { style: { background: 'var(--fb-scale)' } }), 'scale note'), ui.scale === 'blues' ? h('span', h('i', { style: { background: 'var(--fb-blue)' } }), 'blue note') : null, box ? h('span', 'faded = other positions') : null),
    box
      ? h('div.row', btn('Play this position', () => A.playTab([...box, ...box.slice(0, -1).reverse()].map((n) => [n.s, n.f, 0.5]), 96, { onNote: () => {} }), { cls: 'quiet', ico: 'play' }))
      : null,
    h('p.small.muted', ui.scale === 'minPent' ? 'Tip: these are the same notes as the major pentatonic three frets higher. A minor pentatonic = C major pentatonic.' : ui.scale === 'majPent' ? 'Tip: major pentatonic sounds sweet over major chords. It uses the minor pentatonic shapes started three frets lower: G major pentatonic = E minor pentatonic.' : 'Tip: start and end on the teal roots. Anything in between is fair game.'),
  );
  requestAnimationFrame(() => {
    if (box) {
      const f = Math.min(...box.map((n) => n.f));
      wrap.scrollLeft = Math.max(0, (f - 1) * 46 * (wrap.firstChild.getBoundingClientRect().width / wrap.firstChild.viewBox.baseVal.width) - 20);
    }
  });
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
  list.forEach((v, i) => {
    const cell = h('button.shape-cell', { type: 'button', 'aria-label': `Play ${sym}, ${v.label}`, onclick: () => {
      grid.querySelectorAll('.shape-cell').forEach((c) => c.classList.remove('on'));
      cell.classList.add('on');
      A.strumShape(v.frets, A.now(), { spread: 0.03 });
    } }, h('div.nm', h('span', sym), h('span.small.muted', v.label)), shapeWindow({ frets: v.frets, fingers: v.fingers, sym }, { sym }));
    grid.append(cell);
  });
  body.append(
    h(
      'div.fields',
      field('Root', select(ROOTS, ui.root, (v) => ((ui.root = v), rerender(body, chords)), { id: 'ch-root' })),
      field('Type', select(QUALS.map((q) => ({ value: q, label: q === '' ? 'major' : q === 'm' ? 'minor' : q })), ui.quality, (v) => ((ui.quality = v), rerender(body, chords)), { id: 'ch-qual' })),
    ),
    h('div.row.between', h('span.chord-name', sym), h('span.small.muted', CHORDS[ui.quality].name)),
    list.length ? grid : h('p.muted', 'No comfortable voicing found for that one. Try another root.'),
    h('p.small.muted', 'Tap a shape to hear it. Teal dots are roots, numbers are fingers. "E shape" and "A shape" mean the barre shapes you already know, moved up the neck.'),
  );
}

function name(body) {
  const f = ui.frets;
  const flats = false;
  const names = identifyChord(f, flats);
  const dots = [];
  const muted = [];
  f.forEach((x, s) => (x < 0 ? muted.push(s) : dots.push({ s, f: x, kind: 'tone', label: noteLabel(s, x, flats) })));
  const board = fretboard({ from: 0, to: 12, dots, muted, onTap: (s, fr) => {
    ui.frets = ui.frets.map((v, i) => (i === s ? (v === fr ? -1 : fr) : v));
    rerender(body, name);
  }, label: 'Tap frets to build a chord' });
  body.append(
    h('p', 'Found a shape you like while noodling? Tap it in. Tap a fret again to lift it. The left edge is the open string.'),
    h('div.fb-wrap.full', board),
    h('div.card.stack', h('div.eyebrow', 'You are holding'), names.length ? h('div.chord-name', { id: 'chord-id' }, names[0].name) : h('div.muted', { id: 'chord-id' }, dots.length < 2 ? 'Tap at least two strings.' : 'Not a chord I have a name for. Probably still sounds nice.'), names.length > 1 ? h('p.small.muted', 'Also: ' + names.slice(1).map((n) => n.name).join(', ')) : null),
    h('div.row', btn('Strum it', () => A.strumShape(f, A.now(), { spread: 0.03 }), { cls: 'primary', ico: 'play', disabled: !dots.length }), btn('Clear', () => ((ui.frets = [-1, -1, -1, -1, -1, -1]), rerender(body, name)), { cls: 'quiet' }), btn('Open strings', () => ((ui.frets = [0, 0, 0, 0, 0, 0]), rerender(body, name)), { cls: 'ghost small' })),
  );
}

function notes(body) {
  const dots = [];
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= 12; f++) {
      const n = noteName(fretMidi(s, f) % 12);
      if (ui.naturals && n.includes('#')) continue;
      dots.push({ s, f, kind: n === 'C' ? 'root' : 'scale', label: n });
    }
  body.append(
    h('div.row', seg([{ value: true, label: 'Natural notes' }, { value: false, label: 'All notes' }], ui.naturals, (v) => ((ui.naturals = v), rerender(body, notes)), { label: 'Which notes' })),
    h('div.fb-wrap.full', fretboard({ from: 0, to: 12, dots, label: 'Every note on the neck' })),
    h('p.small', h('b', 'Landmarks: '), 'string 6 has G at 3, A at 5, B at 7, C at 8, D at 10. String 5 has C at 3, D at 5, E at 7, F at 8, G at 10. Everything repeats at fret 12. C is teal so you can see the pattern.'),
    h('p.small.muted', 'Quizzes on this live in your sessions and lock in like everything else.'),
  );
}

function tune(body) {
  const strings = [0, 1, 2, 3, 4, 5];
  body.append(
    h('p', 'Tap a string to hear its reference note, then tune until the beating wobble stops.'),
    h('div.answers', strings.map((s) => btn(['E (6th, low)', 'A (5th)', 'D (4th)', 'G (3rd)', 'B (2nd)', 'e (1st, high)'][s], () => {
      const t = A.now();
      for (let k = 0; k < 3; k++) A.pluck(TUNING[s], t + k * 1.4, { vel: 0.7, dur: 1.3 });
    }, { cls: 'quiet', id: 'tune-' + s }))),
    h('p.small.muted.card', 'No listening tuner here, honestly: pages inside Claude are not allowed to use the phone’s microphone, so the app cannot hear you. That is also why your timing is self-rated. Use your phone’s tuner app, or tune by ear against these notes.'),
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
