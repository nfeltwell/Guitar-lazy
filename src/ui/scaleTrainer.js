// Scale practice: shows the order to play a position in, which finger to use, and plays along.
import { h, btn, seg, setBtn } from './dom.js';
import { neck, noteLabel, legend } from './fretboard.js';
import * as A from '../audio.js';
import { scalePosition, SCALES, usesFlats, fretMidi } from '../theory.js';

export const PATTERNS = {
  updown: { name: 'Up & down', how: 'Lowest note to highest, then back down. Learn the shape first.' },
  threes: { name: 'In 3s', how: '1-2-3, 2-3-4, 3-4-5… up, then the same coming down. Breaks the "just running up and down" habit.' },
  fours: { name: 'In 4s', how: '1-2-3-4, 2-3-4-5… Makes the shape feel like music, not a ladder.' },
  thirds: { name: 'Thirds', how: 'Skip a note each time: 1-3, 2-4, 3-5… This is where melodies come from.' },
};

// Build the playing order from the ascending notes of a position.
export function scaleSequence(asc, pattern) {
  const up = [];
  const down = [];
  const rev = asc.slice().reverse();
  if (pattern === 'threes' || pattern === 'fours') {
    const g = pattern === 'threes' ? 3 : 4;
    for (let i = 0; i + g <= asc.length; i++) up.push(...asc.slice(i, i + g).map((n, k) => ({ ...n, i: asc.indexOf(n), group: k === 0 })));
    for (let i = 0; i + g <= rev.length; i++) down.push(...rev.slice(i, i + g).map((n, k) => ({ ...n, i: asc.indexOf(n), group: k === 0 })));
    return [...up, ...down];
  }
  if (pattern === 'thirds') {
    for (let i = 0; i + 2 < asc.length; i++) up.push({ ...asc[i], i, group: true }, { ...asc[i + 2], i: i + 2 });
    for (let i = 0; i + 2 < rev.length; i++) down.push({ ...rev[i], i: asc.indexOf(rev[i]), group: true }, { ...rev[i + 2], i: asc.indexOf(rev[i + 2]) });
    return [...up, ...down];
  }
  return [...asc.map((n, i) => ({ ...n, i })), ...rev.slice(1).map((n) => ({ ...n, i: asc.indexOf(n) }))];
}

// One finger per fret from the lowest fretted note of the position; the pinky stretches for a fifth fret.
export function fingerFor(asc) {
  const fretted = asc.filter((n) => n.f > 0).map((n) => n.f);
  const base = fretted.length ? Math.min(...fretted) : 1;
  const map = new Map();
  for (const n of asc) map.set(n.s + ':' + n.f, n.f === 0 ? 0 : Math.max(1, Math.min(4, n.f - base + 1)));
  return map;
}

const STRINGS = ['low E', 'A', 'D', 'G', 'B', 'high e'];

export function scaleTrainer({ key, scaleId, position, getBpm, onBpm, rootPc }) {
  const flats = usesFlats(key);
  const asc = scalePosition(rootPc, scaleId, position);
  const fingers = fingerFor(asc);
  const fs = asc.map((n) => n.f);
  const from = Math.max(0, Math.min(...fs) - 1);
  const to = Math.max(from + 4, Math.max(...fs) + 1);
  let pattern = 'updown';
  let labels = 'order';
  let mode = null; // 'play' | 'step'
  let idx = -1;
  let speed = false;
  let seq = scaleSequence(asc, pattern);
  const wrap = h('div.nk-wrap');
  const readout = h('div.readout', { 'aria-live': 'polite' });
  let board = null;
  const kindOf = (n) => (n.degree === '1' ? 'root' : n.degree === '3' || n.degree === 'b3' ? 'third' : n.degree === '5' ? 'fifth' : n.degree === 'b5' ? 'blue' : 'scale');
  const labelOf = (n, i) => (labels === 'order' ? i + 1 : labels === 'finger' ? fingers.get(n.s + ':' + n.f) || 'o' : labels === 'degree' ? n.degree : noteLabel(n.s, n.f, flats));
  const draw = () => {
    board = neck({ from: from === 0 ? 0 : from, to, dots: asc.map((n, i) => ({ s: n.s, f: n.f, kind: kindOf(n), label: labelOf(n, i) })), label: `${key} ${SCALES[scaleId].name} position ${position + 1}`, focus: from });
    wrap.replaceChildren(board);
    show();
  };
  const show = () => {
    if (idx < 0) {
      readout.replaceChildren(h('span.big', `${asc.length} notes`), h('span', `${PATTERNS[pattern].how} Numbers on the dots are the order going up.`));
      board?.highlight(seq[0] ? [{ ...seq[0], next: true }] : []);
      return;
    }
    const n = seq[idx % seq.length];
    const nx = seq[(idx + 1) % seq.length];
    board.highlight([{ s: n.s, f: n.f }, { s: nx.s, f: nx.f, next: true }]);
    const fi = fingers.get(n.s + ':' + n.f);
    readout.replaceChildren(h('span.big', `${(idx % seq.length) + 1}/${seq.length}`), h('span', `${STRINGS[n.s]} string · fret ${n.f} · ${fi ? 'finger ' + fi : 'open'} · ${n.degree === '1' ? 'root' : n.degree}`));
  };
  const labelsSeg = h('div');
  const patSeg = h('div');
  const drawSegs = () => {
    patSeg.replaceChildren(seg(Object.entries(PATTERNS).map(([v, p]) => ({ value: v, label: p.name })), pattern, (v) => {
      pattern = v;
      seq = scaleSequence(asc, pattern);
      stop();
      drawSegs();
      show();
    }, { label: 'Order', id: 'st-pattern', wide: true }));
    labelsSeg.replaceChildren(seg([{ value: 'order', label: 'Order' }, { value: 'finger', label: 'Finger' }, { value: 'degree', label: '1 2 3' }, { value: 'note', label: 'C D E' }], labels, (v) => {
      labels = v;
      drawSegs();
      draw();
    }, { label: 'Dot labels', id: 'st-labels', wide: true }));
  };
  const playB = btn('Play along', () => (mode === 'play' ? stop() : play()), { cls: 'primary', ico: 'play', id: 'st-play' });
  const stepB = btn('Step by step', () => {
    if (mode !== 'step') {
      stop();
      mode = 'step';
      idx = -1;
      stepB.classList.add('on');
      nextB.hidden = false;
      backB.hidden = false;
    }
    step(1);
  }, { cls: 'quiet', id: 'st-step' });
  const nextB = btn('Next note', () => step(1), { cls: 'primary big', id: 'st-next' });
  const backB = btn('Back', () => step(-1), { cls: 'ghost small' });
  nextB.hidden = true;
  backB.hidden = true;
  const speedB = btn('Speed trainer: off', () => {
    speed = !speed;
    speedB.classList.toggle('on', speed);
    setBtn(speedB, speed ? 'Speed trainer: on' : 'Speed trainer: off');
  }, { cls: 'quiet small', id: 'st-speed' });
  function step(d) {
    idx = Math.max(0, idx + d);
    const n = seq[idx % seq.length];
    A.pluck(fretMidi(n.s, n.f), A.now(), { vel: 0.65, dur: 0.9 });
    show();
  }
  function stop() {
    A.stopAll();
    mode = null;
    idx = -1;
    playB.classList.remove('on');
    stepB.classList.remove('on');
    setBtn(playB, 'Play along', 'play');
    nextB.hidden = true;
    backB.hidden = true;
    show();
  }
  function play() {
    stop();
    mode = 'play';
    playB.classList.add('on');
    setBtn(playB, 'Stop', 'stop');
    const bpm = getBpm();
    const triplet = pattern === 'threes';
    const per = triplet ? 3 : 2; // notes per beat
    const countIn = 4 * per;
    const notes = seq.map((n) => [n.s, n.f, 1 / per]);
    // one bar of count-in clicks, then the run
    const events = [...Array(countIn).fill(null), ...notes];
    const loop = new A.Loop({
      bpm,
      stepsPerBeat: per,
      length: events.length,
      loop: true,
      onStep: (i, t) => {
        if (i % per === 0) A.click(t, i === 0 || i === countIn);
        const e = events[i];
        if (e) A.pluck(fretMidi(e[0], e[1]), t, { vel: 0.55, dur: (60 / bpm / per) * 0.95 });
        if (speed && i === events.length - 1) {
          loop.setBpm(loop.bpm + 4);
          onBpm && onBpm(loop.bpm);
        }
      },
      onVisual: (i) => {
        if (mode !== 'play') return;
        if (i < countIn) {
          idx = -1;
          readout.replaceChildren(h('span.big', String(4 - Math.floor(i / per))), h('span', 'Count in… start on the first lit note.'));
          board.highlight([{ ...seq[0], next: true }]);
        } else {
          idx = i - countIn;
          show();
        }
      },
    });
    A.own(loop);
  }
  drawSegs();
  draw();
  const el = h(
    'div.trainer.stack',
    patSeg,
    readout,
    wrap,
    h('div.row', playB, stepB, speedB),
    h('div.row', nextB, backB),
    labelsSeg,
    legend(scaleId === 'blues' ? ['root', 'third', 'fifth', 'scale', 'blue'] : ['root', 'third', 'fifth', 'scale']),
    h('details.small', h('summary', 'How to practise a scale (when you’re rubbish at them)'), h('ol.small', { style: { margin: '8px 0 0', paddingLeft: '20px' } }, h('li', 'Step by step first. Say the number or the degree out loud as you play each note.'), h('li', 'One finger per fret. The finger numbers are on the dots; switch the labels to Finger.'), h('li', 'Alternate picking: down, up, down, up, even across strings.'), h('li', 'Play along slowly. Clean and even beats fast and messy. Speed trainer adds 4 bpm after each clean pass.'), h('li', 'Once it’s in your hands, switch to In 3s or Thirds. That’s when it starts sounding like music.'))),
  );
  el.stop = stop;
  return el;
}
