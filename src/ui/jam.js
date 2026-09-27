// Jam: backing tracks to improvise over, with the current chord's notes lit on the neck.
import { h, btn, select, field, setBtn } from './dom.js';
import { neck, noteLabel, legend, degreeKind } from './fretboard.js';
import * as A from '../audio.js';
import { PROGRESSIONS, progressionChords } from '../content.js';
import { pc, usesFlats, allScaleNotes, fretMidi, SCALES, parseChord, CHORDS, prettyChord } from '../theory.js';

let jam = { source: 'mixo', key: 'A', style: 'britpop', bpm: 92, scale: 'auto', top: 12 };
const KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb'];

function chordsFor(ctx) {
  if (jam.source.startsWith('idea:')) {
    const idea = (ctx.state.ideas || []).find((i) => 'idea:' + i.id === jam.source);
    if (idea) return { chords: idea.chords, key: idea.key, name: idea.name };
    jam.source = 'mixo';
  }
  return { chords: progressionChords(jam.source, jam.key), key: jam.key, name: PROGRESSIONS[jam.source].name };
}

function scaleFor() {
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
  const now = h('span.now', prettyChord(chords[0]));
  const next = h('span.next', chords.length > 1 ? 'next ' + prettyChord(chords[1]) : '');
  const wrap = h('div.nk-wrap');
  const drawBoard = (sym) => {
    const c = parseChord(sym);
    const tones = CHORDS[c.quality].tones.map((t) => (c.root + t) % 12);
    const dots = allScaleNotes(pc(key), scaleId, jam.top).map((n) => ({ s: n.s, f: n.f, kind: tones.includes(fretMidi(n.s, n.f) % 12) ? degreeKind(fretMidi(n.s, n.f), c.root, c.quality) : 'scale', label: noteLabel(n.s, n.f, flats) }));
    // Chord tones outside the scale (a borrowed chord) are shown too, so you can land on them.
    for (let s = 0; s < 6; s++)
      for (let f = 0; f <= jam.top; f++) {
        const m = fretMidi(s, f);
        if (tones.includes(m % 12) && !dots.some((d) => d.s === s && d.f === f)) dots.push({ s, f, kind: degreeKind(m, c.root, c.quality), label: noteLabel(s, f, flats) });
      }
    wrap.replaceChildren(neck({ from: 0, to: jam.top, dots, fh: 34, label: `${SCALES[scaleId].name} in ${key}, ${sym} notes lit` }));
  };
  drawBoard(chords[0]);
  const playB = btn('Play', () => {
    if (playing) {
      A.stopAll();
      playing = false;
      playB.classList.remove('on');
      setBtn(playB, 'Play', 'play');
      return;
    }
    playing = true;
    playB.classList.add('on');
    setBtn(playB, 'Stop', 'stop');
    A.playBacking(chords, jam.style, jam.bpm, {
      onChord: (i, sym) => {
        now.textContent = prettyChord(sym);
        next.textContent = chords.length > 1 ? 'next ' + prettyChord(chords[(i + 1) % chords.length]) : '';
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
      h('div.stack', h('h1', 'Jam'), h('p.muted', 'A backing band to noodle over. The neck shows every note that fits; the current chord’s notes light up in colour as it changes. Land on a coloured note when the chord changes.')),
      h(
        'div.fields',
        field('loop', select([...Object.entries(PROGRESSIONS).map(([id, p]) => ({ value: id, label: p.name + ' (' + p.rn.join(' ').replace(/b/g, '♭') + ')' })), ...ideas], jam.source, (v) => ((jam.source = v), redo()), { id: 'jam-src' })),
        field('key', select(KEYS, jam.source.startsWith('idea:') ? key : jam.key, (v) => ((jam.key = v), redo()), { id: 'jam-key' })),
        field('feel', select(Object.entries(A.BACKING_STYLES).map(([id, s]) => ({ value: id, label: s.name })), jam.style, (v) => ((jam.style = v), redo()), { id: 'jam-style' })),
        field('notes shown', select([{ value: 'auto', label: 'Best fit' }, { value: 'majPent', label: 'Major pentatonic' }, { value: 'minPent', label: 'Minor pentatonic' }, { value: 'major', label: 'Major scale' }, { value: 'mixolydian', label: 'Mixolydian' }, { value: 'blues', label: 'Blues' }], jam.scale, (v) => ((jam.scale = v), redo()), { id: 'jam-scale' })),
      ),
      field('tempo', h('div.row.nowrap', h('input', { type: 'range', min: 60, max: 150, step: 2, value: jam.bpm, id: 'jam-bpm', 'aria-label': 'Tempo', oninput: (e) => ((jam.bpm = Number(e.target.value)), (bpmLabel.textContent = e.target.value)), onchange: () => playing && redo() }), bpmLabel)),
      playB,
      h('section.panel.stack', h('div.row.between', h('div.current-chord', now, next), h('span.label', SCALES[scaleId].name.toLowerCase() + ' · ' + key)), legend(['root', 'third', 'fifth', 'ext', 'scale']), wrap),
      h('section.sect', h('h2', 'Things to try'), h('ul.small', { style: { margin: 0, paddingLeft: '18px' } }, h('li', 'One pass playing only the coloured notes. It already sounds like a melody.'), h('li', 'Stay on one string. Limits make you musical.'), h('li', 'Leave gaps. Two notes and a rest beats twelve in a row.'), h('li', 'Hum a phrase first, then find it.'))),
      h('p.label', name),
    ),
  );
}

export function cleanup() {
  A.stopAll();
}
