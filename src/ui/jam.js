// Jam: backing tracks to improvise over, with the current chord's notes lit on the neck.
import { h, btn, seg, select, field } from './dom.js';
import { fretboard, noteLabel } from './fretboard.js';
import * as A from '../audio.js';
import { PROGRESSIONS, progressionChords } from '../content.js';
import { pc, usesFlats, allScaleNotes, chordTones, fretMidi, SCALES } from '../theory.js';

let jam = { source: 'mixo', key: 'A', style: 'britpop', bpm: 92, scale: 'auto' };
const KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb'];

function chordsFor(ctx) {
  if (jam.source.startsWith('idea:')) {
    const idea = (ctx.state.ideas || []).find((i) => 'idea:' + i.id === jam.source);
    if (idea) return { chords: idea.chords, key: idea.key, name: idea.name };
    jam.source = 'mixo';
  }
  return { chords: progressionChords(jam.source, jam.key), key: jam.key, name: PROGRESSIONS[jam.source].name };
}

function scaleFor(src) {
  if (jam.scale !== 'auto') return jam.scale;
  if (jam.source === 'blues') return 'blues';
  if (jam.source === 'mixo' || jam.source === 'britpop') return 'mixolydian';
  return 'majPent';
}

export function render(root, ctx) {
  let playing = false;
  const { chords, key, name } = chordsFor(ctx);
  const scaleId = scaleFor();
  const flats = usesFlats(key);
  const now = h('span.now', chords[0]);
  const next = h('span.next', chords.length > 1 ? 'then ' + chords[1] : '');
  const wrap = h('div.fb-wrap.full');
  const drawBoard = (sym) => {
    const tones = chordTones(sym);
    const dots = allScaleNotes(pc(key), scaleId, 15).map((n) => ({ s: n.s, f: n.f, kind: tones.includes(fretMidi(n.s, n.f) % 12) ? (fretMidi(n.s, n.f) % 12 === tones[0] ? 'root' : 'tone') : 'scale', label: noteLabel(n.s, n.f, flats) }));
    const sl = wrap.scrollLeft;
    wrap.replaceChildren(fretboard({ from: 0, to: 15, dots, label: `${SCALES[scaleId].name} in ${key}, ${sym} notes lit` }));
    wrap.scrollLeft = sl;
  };
  drawBoard(chords[0]);
  const playB = btn('Play', () => {
    if (playing) {
      A.stopAll();
      playing = false;
      playB.classList.remove('on');
      playB.querySelector('span').textContent = 'Play';
      return;
    }
    playing = true;
    playB.classList.add('on');
    playB.querySelector('span').textContent = 'Stop';
    A.playBacking(chords, jam.style, jam.bpm, {
      onChord: (i, sym) => {
        now.textContent = sym;
        next.textContent = chords.length > 1 ? 'then ' + chords[(i + 1) % chords.length] : '';
        drawBoard(sym);
      },
    });
  }, { cls: 'primary big', ico: 'play', id: 'jam-play' });
  const ideas = (ctx.state.ideas || []).map((i) => ({ value: 'idea:' + i.id, label: 'Your idea: ' + i.name }));
  const redo = () => {
    A.stopAll();
    root.replaceChildren();
    render(root, ctx);
  };
  const bpmLabel = h('span.mono', String(jam.bpm));
  root.append(
    h(
      'div.stack-lg',
      h('div.stack', h('h1', 'Jam'), h('p.muted', 'Backing tracks to noodle over. The neck shows notes that fit; amber and teal are the current chord. Land on one of those when the chord changes.')),
      h(
        'div.fields',
        field('Loop', select([...Object.entries(PROGRESSIONS).map(([id, p]) => ({ value: id, label: p.name + ' (' + p.rn.join(' ') + ')' })), ...ideas], jam.source, (v) => ((jam.source = v), redo()), { id: 'jam-src' })),
        field('Key', select(KEYS, jam.source.startsWith('idea:') ? key : jam.key, (v) => ((jam.key = v), redo()), { id: 'jam-key' })),
        field('Feel', select(Object.entries(A.BACKING_STYLES).map(([id, s]) => ({ value: id, label: s.name })), jam.style, (v) => ((jam.style = v), redo()), { id: 'jam-style' })),
        field('Notes shown', select([{ value: 'auto', label: 'Best fit' }, { value: 'majPent', label: 'Major pentatonic' }, { value: 'minPent', label: 'Minor pentatonic' }, { value: 'major', label: 'Major scale' }, { value: 'mixolydian', label: 'Mixolydian' }, { value: 'blues', label: 'Blues' }], jam.scale, (v) => ((jam.scale = v), redo()), { id: 'jam-scale' })),
      ),
      field('Tempo', h('div.row.nowrap', h('input', { type: 'range', min: 60, max: 150, step: 2, value: jam.bpm, id: 'jam-bpm', 'aria-label': 'Tempo', oninput: (e) => ((jam.bpm = Number(e.target.value)), (bpmLabel.textContent = e.target.value)), onchange: () => playing && redo() }), bpmLabel)),
      h('section.card.raised.stack', h('div.eyebrow', name + ' · ' + SCALES[scaleId].name + ' in ' + key), h('div.current-chord', now, next), wrap, h('div.legend', h('span', h('i', { style: { background: 'var(--fb-root)' } }), 'chord root'), h('span', h('i', { style: { background: 'var(--fb-tone)' } }), 'chord note'), h('span', h('i', { style: { background: 'var(--fb-scale)' } }), 'fits the key'))),
      playB,
      h('section.stack', h('div.eyebrow', 'Ideas to try'), h('ul.small', { style: { margin: 0, paddingLeft: '18px' } }, h('li', 'Play only the amber notes for one pass. It already sounds like a melody.'), h('li', 'Pick one string and stay on it. Limits make you musical.'), h('li', 'Leave gaps. Two notes and a rest beats twelve notes in a row.'), h('li', 'Hum a phrase first, then find it.'))),
    ),
  );
}

export function cleanup() {
  A.stopAll();
}
