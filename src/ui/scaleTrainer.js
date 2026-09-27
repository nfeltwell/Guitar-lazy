// Scale practice, kept simple: the route is drawn on the neck, "Show me" animates it note by note,
// "Play along" does it at your speed. Everything technical lives under "More options".
import { h, btn, seg, setBtn } from './dom.js';
import { neck, noteLabel, legend } from './fretboard.js';
import * as A from '../audio.js';
import { scalePosition, SCALES, usesFlats, fretMidi } from '../theory.js';

export const PATTERNS = {
  updown: { name: 'Up & down', how: 'Lowest note to highest, then back down.' },
  threes: { name: 'In 3s', how: '1-2-3, 2-3-4, 3-4-5… up, then the same coming down.' },
  fours: { name: 'In 4s', how: '1-2-3-4, 2-3-4-5… and back down.' },
  thirds: { name: 'Thirds', how: 'Skip a note each time: 1-3, 2-4, 3-5… This is where melodies come from.' },
};

// Build the playing order from the ascending notes of a position.
export function scaleSequence(asc, pattern) {
  const up = [];
  const down = [];
  const rev = asc.slice().reverse();
  if (pattern === 'threes' || pattern === 'fours') {
    const g = pattern === 'threes' ? 3 : 4;
    for (let i = 0; i + g <= asc.length; i++) up.push(...asc.slice(i, i + g).map((n) => ({ ...n, i: asc.indexOf(n) })));
    for (let i = 0; i + g <= rev.length; i++) down.push(...rev.slice(i, i + g).map((n) => ({ ...n, i: asc.indexOf(n) })));
    return [...up, ...down];
  }
  if (pattern === 'thirds') {
    for (let i = 0; i + 2 < asc.length; i++) up.push({ ...asc[i], i }, { ...asc[i + 2], i: i + 2 });
    for (let i = 0; i + 2 < rev.length; i++) down.push({ ...rev[i], i: asc.indexOf(rev[i]) }, { ...rev[i + 2], i: asc.indexOf(rev[i + 2]) });
    return [...up, ...down];
  }
  return [...asc.map((n, i) => ({ ...n, i })), ...rev.slice(1).map((n) => ({ ...n, i: asc.indexOf(n) }))];
}

// One finger per fret from the lowest fretted note of the position; the little finger stretches for a fifth fret.
export function fingerFor(asc) {
  const fretted = asc.filter((n) => n.f > 0).map((n) => n.f);
  const base = fretted.length ? Math.min(...fretted) : 1;
  const map = new Map();
  for (const n of asc) map.set(n.s + ':' + n.f, n.f === 0 ? 0 : Math.max(1, Math.min(4, n.f - base + 1)));
  return map;
}

const STRING = ['low E string', 'A string', 'D string', 'G string', 'B string', 'high e string'];
const FINGER = ['open', 'first finger', 'second finger', 'third finger', 'little finger'];
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
export const SPEEDS = { slow: 50, medium: 70, fast: 92 };

export function scaleTrainer({ key, scaleId, position, getBpm, onBpm, rootPc }) {
  const flats = usesFlats(key);
  const asc = scalePosition(rootPc, scaleId, position);
  const fingers = fingerFor(asc);
  const fs = asc.map((n) => n.f);
  const from = Math.max(0, Math.min(...fs) - 1);
  const to = Math.max(from + 4, Math.max(...fs) + 1);
  let pattern = 'updown';
  let labels = 'order';
  let mode = null; // 'demo' | 'play' | 'step'
  let idx = -1;
  let speed = false;
  let seq = scaleSequence(asc, pattern);
  let route = null;
  let board = null;
  const wrap = h('div.nk-wrap');
  const say = h('p.say', { 'aria-live': 'polite' });
  const kindOf = (n) => (n.degree === '1' ? 'root' : n.degree === '3' || n.degree === 'b3' ? 'third' : n.degree === '5' ? 'fifth' : n.degree === 'b5' ? 'blue' : 'scale');
  const labelOf = (n, i) => (labels === 'order' ? i + 1 : labels === 'finger' ? fingers.get(n.s + ':' + n.f) || 'o' : labels === 'degree' ? n.degree : labels === 'note' ? noteLabel(n.s, n.f, flats) : '');
  const where = (n) => {
    const fi = fingers.get(n.s + ':' + n.f);
    return n.f === 0 ? `${STRING[n.s]}, open` : `${STRING[n.s]}, ${ordinal(n.f)} fret, ${FINGER[fi]}`;
  };
  const draw = () => {
    board = neck({ from: from === 0 ? 0 : from, to, dots: asc.map((n, i) => ({ s: n.s, f: n.f, kind: kindOf(n), label: labelOf(n, i) })), label: `${key} ${SCALES[scaleId].name} position ${position + 1}`, focus: from });
    wrap.replaceChildren(board);
    route = board.route(seq);
    rest();
  };
  const rest = () => {
    if (!board) return;
    route?.set(0);
    board.marker(seq[0], 0);
    say.replaceChildren(h('b', 'Start here: '), where(seq[0]), '. Follow the arrows.');
  };
  const at = (i, ms) => {
    idx = i;
    const n = seq[i % seq.length];
    board.marker(n, ms);
    route.set(i % seq.length);
    say.replaceChildren(h('b', `${(i % seq.length) + 1} of ${seq.length}: `), where(n));
  };

  const showB = btn('Show me', () => (mode === 'demo' ? stop() : demo()), { cls: 'primary', ico: 'play', id: 'st-show' });
  const playB = btn('Play along', () => (mode === 'play' ? stop() : play()), { cls: 'quiet', ico: 'play', id: 'st-play' });
  const nextB = btn('Next note', () => step(1), { cls: 'primary big', id: 'st-next' });
  const backB = btn('Back', () => step(-1), { cls: 'ghost small' });
  nextB.hidden = true;
  backB.hidden = true;

  function stop() {
    A.stopAll();
    mode = null;
    idx = -1;
    setBtn(showB, 'Show me', 'play');
    setBtn(playB, 'Play along', 'play');
    showB.classList.remove('on');
    playB.classList.remove('on');
    nextB.hidden = true;
    backB.hidden = true;
    rest();
  }

  // Slow demo: one note at a time with sound, the marker hops, the route inks in.
  function demo() {
    stop();
    mode = 'demo';
    showB.classList.add('on');
    setBtn(showB, 'Stop', 'stop');
    const beat = 60 / 64; // about one note a second
    const loop = new A.Loop({
      bpm: 64,
      stepsPerBeat: 1,
      length: seq.length + 1,
      loop: false,
      onStep: (i, t) => {
        const n = seq[i];
        if (n) A.pluck(fretMidi(n.s, n.f), t, { vel: 0.62, dur: beat * 0.95 });
      },
      onVisual: (i) => {
        if (mode !== 'demo') return;
        if (i < seq.length) at(i, 260);
      },
      onEnd: () => {
        if (mode !== 'demo') return;
        stop();
        say.replaceChildren(h('b', 'Your turn. '), 'Press Play along and play with it, or Show me again.');
      },
    });
    A.own(loop);
  }

  // Play along at your speed, after a count of four.
  function play() {
    stop();
    mode = 'play';
    playB.classList.add('on');
    setBtn(playB, 'Stop', 'stop');
    const bpm = getBpm();
    const per = pattern === 'threes' ? 3 : 2;
    const countIn = 4 * per;
    const events = [...Array(countIn).fill(null), ...seq];
    const loop = new A.Loop({
      bpm,
      stepsPerBeat: per,
      length: events.length,
      loop: true,
      onStep: (i, t) => {
        if (i % per === 0) A.click(t, i === 0 || i === countIn);
        const e = events[i];
        if (e) A.pluck(fretMidi(e.s, e.f), t, { vel: 0.55, dur: (60 / bpm / per) * 0.95 });
        if (speed && i === events.length - 1) {
          loop.setBpm(loop.bpm + 4);
          onBpm && onBpm(loop.bpm);
        }
      },
      onVisual: (i) => {
        if (mode !== 'play') return;
        if (i < countIn) {
          if (i % per === 0) {
            board.marker(seq[0], 0);
            route.set(0);
            say.replaceChildren(h('b', `${4 - i / per}… `), 'get ready on the ', where(seq[0]));
          }
        } else at(i - countIn, Math.min(140, (60000 / bpm / per) * 0.8));
      },
    });
    A.own(loop);
  }

  function step(d) {
    idx = Math.max(0, idx + d);
    const n = seq[idx % seq.length];
    A.pluck(fretMidi(n.s, n.f), A.now(), { vel: 0.65, dur: 0.9 });
    at(idx, 220);
  }

  // More options
  const patSeg = h('div');
  const labelsSeg = h('div');
  const drawSegs = () => {
    patSeg.replaceChildren(seg(Object.entries(PATTERNS).map(([v, p]) => ({ value: v, label: p.name })), pattern, (v) => {
      pattern = v;
      seq = scaleSequence(asc, pattern);
      stop();
      drawSegs();
      route = board.route(seq);
      rest();
    }, { label: 'Order', id: 'st-pattern', wide: true }));
    labelsSeg.replaceChildren(seg([{ value: 'order', label: 'Order' }, { value: 'finger', label: 'Finger' }, { value: 'note', label: 'C D E' }, { value: 'degree', label: '1 2 3' }], labels, (v) => {
      labels = v;
      drawSegs();
      draw();
    }, { label: 'Dot labels', id: 'st-labels', wide: true }));
  };
  const stepB = btn('Step through it myself', () => {
    stop();
    mode = 'step';
    nextB.hidden = false;
    backB.hidden = false;
    step(1);
  }, { cls: 'quiet small', id: 'st-step' });
  const speedB = btn('Speed up each lap: off', () => {
    speed = !speed;
    speedB.classList.toggle('on', speed);
    setBtn(speedB, speed ? 'Speed up each lap: on' : 'Speed up each lap: off');
  }, { cls: 'quiet small', id: 'st-speed' });
  drawSegs();
  draw();
  const more = h(
    'details.more',
    h('summary', 'More options'),
    h(
      'div.stack',
      { style: { marginTop: '10px' } },
      h('div.field', h('span.field-label', 'order'), patSeg),
      h('div.field', h('span.field-label', 'numbers on the dots'), labelsSeg),
      h('div.row', stepB, speedB),
      legend(scaleId === 'blues' ? ['root', 'third', 'fifth', 'scale', 'blue'] : ['root', 'third', 'fifth', 'scale']),
      h('ol.small', { style: { margin: 0, paddingLeft: '20px' } }, h('li', 'Watch Show me once or twice. Then Play along slowly.'), h('li', 'One finger per fret: first finger on the lowest fret of the shape.'), h('li', 'Pick down, up, down, up, even when you change string.'), h('li', 'Clean and slow beats fast and messy. When it’s easy, try In 3s.')),
    ),
  );
  const el = h('div.trainer.stack', h('div.row', showB, playB), say, wrap, h('div.row', nextB, backB), more);
  el.stop = stop;
  return el;
}
