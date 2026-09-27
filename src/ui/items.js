// The practice card: one playable item, played now, then rated.
import { h, btn, icon, seg, toast } from './dom.js';
import { fretboard, shapeWindow, tab, strumRow, noteLabel } from './fretboard.js';
import { mascot } from './mascot.js';
import * as A from '../audio.js';
import { CHEATS, PICKS, STRUMS, LICKS, MELODIES, PROGRESSIONS, TRACKS, shapeFor, barreShape, progressionChords, romanChord, SPARKLE } from '../content.js';
import { pc, noteName, usesFlats, scalePosition, SCALES, INTERVALS, CHORDS, capoFor, transposeSym, fretMidi, TUNING } from '../theory.js';
import { hasTempo, isLocked, ratingFromScore } from '../srs.js';
import { explainHarmony, getSample, aiErrorText } from '../ai.js';

const FINGER = { B: 'p', A: 'p', '3': 'i', '2': 'm', '1': 'a' };

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const rand = (a) => a[Math.floor(Math.random() * a.length)];

export function cheatBlock(id, open) {
  const c = CHEATS[id];
  if (!c) return null;
  const inner = [h('p', c.body), c.tip ? h('p.small', h('b', 'Try: '), c.tip) : null];
  if (open) return h('div.cheat.stack', h('div.eyebrow', 'Cheat code'), h('h3', c.title), ...inner);
  return h('details.cheat', h('summary', 'Cheat code: ' + c.title), h('div.stack', { style: { marginTop: '8px' } }, ...inner));
}

// Tempo box with −/+ and a metronome that follows it.
function tempoBox(item, st, onChange) {
  let bpm = st ? st.bpm : item.bpm[0];
  const val = h('span.bpm', { 'aria-live': 'polite' }, String(bpm));
  const set = (b) => {
    bpm = Math.max(30, Math.min(220, b));
    val.textContent = String(bpm);
    onChange(bpm);
  };
  const dots = h('div.beat-dots', { 'aria-hidden': 'true' }, [0, 1, 2, 3].map((i) => h('span', { class: i === 0 ? 'first' : '' })));
  const box = h(
    'div.card.flat.stack',
    h(
      'div.tempo',
      btn('', () => set(bpm - 4), { cls: 'quiet icon-only', ico: 'minus', title: 'Slower' }),
      h('div', val, h('div.target.mono', 'bpm · target ', item.bpm[1])),
      btn('', () => set(bpm + 4), { cls: 'quiet icon-only', ico: 'plus', title: 'Faster' }),
      h('div.grow'),
      dots,
    ),
  );
  box.beat = (i) => {
    dots.querySelectorAll('span').forEach((d, j) => d.classList.toggle('on', j === i % 4));
  };
  box.get = () => bpm;
  return box;
}

function rateRow(onRate, labels = ['Clean', 'Sloppy', 'Couldn’t'], subs = ['at this tempo', 'got through it', 'fell apart']) {
  return h(
    'div.rate',
    h('button.r-clean', { type: 'button', onclick: () => onRate('clean') }, labels[0], h('small', subs[0])),
    h('button.r-sloppy', { type: 'button', onclick: () => onRate('sloppy') }, labels[1], h('small', subs[1])),
    h('button.r-miss', { type: 'button', onclick: () => onRate('miss') }, labels[2], h('small', subs[2])),
  );
}

// Play / metronome toggles, shared by most kinds.
function transport({ onPlay, onMetro, playLabel = 'Hear it' }) {
  let mode = null;
  const playB = btn(playLabel, () => toggle('play'), { cls: 'primary', ico: 'play', id: 'hear' });
  const metB = btn('Metronome', () => toggle('metro'), { cls: 'quiet', ico: 'metro', id: 'metro' });
  function toggle(m) {
    A.stopAll();
    if (mode === m) {
      mode = null;
    } else {
      mode = m;
      if (m === 'play') onPlay();
      else onMetro();
    }
    playB.classList.toggle('on', mode === 'play');
    metB.classList.toggle('on', mode === 'metro');
    playB.querySelector('span').textContent = mode === 'play' ? 'Stop' : playLabel;
  }
  const row = h('div.row', playB, onMetro ? metB : null);
  row.reset = () => {
    mode = null;
    playB.classList.remove('on');
    metB.classList.remove('on');
    playB.querySelector('span').textContent = playLabel;
  };
  row.restart = () => {
    if (mode) {
      const m = mode;
      mode = null;
      toggle(m);
    }
  };
  return row;
}

function chordChips(chords, cur = -1) {
  const wrap = h('div.chips', { 'aria-label': 'Chords' });
  chords.forEach((c, i) => wrap.append(h('span.chip', { class: i === cur ? 'on' : '', 'data-i': i }, typeof c === 'object' ? c.sym : c)));
  wrap.set = (i) => wrap.querySelectorAll('.chip').forEach((el, j) => el.classList.toggle('on', j === i));
  return wrap;
}

function shapeGrid(shapes, labels = []) {
  const grid = h('div.shape-grid');
  shapes.forEach((sh, i) => {
    if (!sh) return;
    grid.append(h('div.shape-cell', { 'data-i': i }, h('div.nm', h('span', sh.sym), h('span.small.muted', labels[i] || '')), shapeWindow(sh, { sym: sh.sym })));
  });
  grid.set = (i) => grid.querySelectorAll('.shape-cell').forEach((el) => el.classList.toggle('on', Number(el.dataset.i) === i));
  return grid;
}

// ---------------------------------------------------------------------------
export function itemCard(item, st, variant, { onRate, ctx, isNew, compactHeader } = {}) {
  const seen = ctx && ctx.state.seenCheats.includes(item.cheat);
  const header = h(
    'div.stack',
    h('div.row', h('span.pill.accent', TRACKS[item.track].short), isNew ? h('span.pill.new', 'New') : null, isLocked(st) ? h('span.pill.locked', 'Locked in') : null, st && st.clean.length && !isLocked(st) ? h('span.pill', st.clean.length + '/3 clean days') : null),
    h(compactHeader ? 'h3' : 'h2', item.title),
  );
  const body = h('div.stack-lg');
  const card = h('div.stack-lg', header);
  if (item.cheat) card.append(cheatBlock(item.cheat, !seen && isNew));
  if (isNew) card.append(h('p.small.muted', 'Quick check straight away: listen once, then play it through at this tempo and rate it honestly. It comes back when it needs to.'));
  card.append(body);
  let bpmOverride = null;
  const rate = (r) => {
    A.stopAll();
    onRate && onRate(r, bpmOverride);
  };
  const render = RENDER[item.kind] || renderGeneric;
  render(body, item, st, variant || {}, {
    rate,
    setBpm: (b) => (bpmOverride = b),
    ctx,
  });
  card.cleanup = () => A.stopAll();
  return card;
}

const RENDER = {
  pick(body, item, st, v, api) {
    const d = item.data;
    const pat = PICKS[d.pattern];
    const chords = d.chords;
    const { steps, perBar } = A.pickSteps(chords, d.pattern, { sparkle: d.sparkle, melodyTop: d.melodyTop });
    let bpm = st ? st.bpm : item.bpm[0];
    const chips = chordChips(chords, 0);
    const boardWrap = h('div.fb-wrap');
    let curChord = -1;
    let board = null;
    const showChord = (i, frets, sym) => {
      if (i === curChord && board && board.dataset.frets === String(frets)) return;
      curChord = i;
      const shape = { frets, fingers: shapeFor(sym)?.fingers, sym };
      board = shapeWindow(shape, { sym, compact: false });
      board.dataset.frets = String(frets);
      boardWrap.replaceChildren(board);
      chips.set(i);
    };
    showChord(0, steps[0].frets, steps[0].sym);
    const cols = steps.map((s) => ({ notes: s.notes.map((n) => ({ s: n.s, f: n.f })), mark: s.slot % 2 === 0 ? String(s.slot / 2 + 1) : '&' }));
    const t = tab(cols, { label: pat.name + ' tab', beatEvery: perBar });
    const tempo = tempoBox(item, st, (b) => {
      bpm = b;
      api.setBpm(b);
      tr.restart();
    });
    const tr = transport({
      onPlay: () =>
        A.playPick(chords, d.pattern, bpm, {
          sparkle: d.sparkle,
          melodyTop: d.melodyTop,
          click: true,
          onStep: (step, i) => {
            showChord(step.chordIdx, step.frets, step.sym);
            board.highlight(step.notes.map((n) => ({ s: n.s, f: n.f, label: FINGER[n.role] })));
            t.playhead(i);
            if (step.slot % 2 === 0) tempo.beat(step.slot / 2);
          },
        }),
      onMetro: () => A.metronome(bpm, pat.meter === 3 ? 3 : 4, (i) => tempo.beat(i)),
    });
    body.append(
      h('p', h('b', pat.name + '. '), pat.feel),
      chips,
      boardWrap,
      h('div.legend', h('span', h('b', 'p'), ' thumb'), h('span', h('b', 'i'), ' index · G'), h('span', h('b', 'm'), ' middle · B'), h('span', h('b', 'a'), ' ring · e'), d.sparkle ? h('span', 'Second half of each bar = sparkle chord') : null),
      h('div.tab-wrap', t),
      tempo,
      tr,
      rateRow(api.rate),
    );
  },

  strum(body, item, st, v, api) {
    const d = item.data;
    const pat = STRUMS[d.pattern];
    let bpm = st ? st.bpm : item.bpm[0];
    const chips = chordChips(d.chords, 0);
    const row = strumRow(pat.slots);
    const shapes = d.chords.map((c) => {
      const s = shapeFor(c);
      return s ? { ...s, sym: c.replace('(anchor)', '') } : null;
    });
    const grid = shapeGrid(shapes, d.chords.map((c) => (c.includes('anchor') ? 'anchor' : '')));
    const tempo = tempoBox(item, st, (b) => {
      bpm = b;
      api.setBpm(b);
      tr.restart();
    });
    const tr = transport({
      onPlay: () =>
        A.playStrum(d.chords, d.pattern, bpm, {
          click: true,
          onStep: (s, i) => {
            row.playhead(s.slot);
            chips.set(s.chordIdx);
            grid.set(s.chordIdx);
            const spb = pat.slots.length === 16 ? 4 : pat.slots.length === 6 ? 3 : 2;
            if (s.slot % spb === 0) tempo.beat(s.slot / spb);
          },
        }),
      onMetro: () => A.metronome(bpm, pat.slots.length === 6 ? 2 : 4, (i) => tempo.beat(i)),
    });
    body.append(h('p', h('b', pat.name + '. '), pat.feel), chips, row, grid, tempo, tr, rateRow(api.rate));
  },

  barre(body, item, st, v, api) {
    const d = item.data;
    const rot = v.rotate || 0;
    const order = d.chords.slice(rot).concat(d.chords.slice(0, rot));
    const shapes = order.map((c, i) => {
      const fam = d.family === 'mix' ? (i % 2 ? 'A' : 'E') : d.family;
      const s = barreShape(c, fam) || barreShape(c, fam === 'A' ? 'E' : 'A');
      return s ? { ...s, sym: c } : null;
    });
    let bpm = st ? st.bpm : item.bpm[0];
    const labels = shapes.map((s) => (s ? s.family + ' shape, fret ' + s.barre : ''));
    const grid = shapeGrid(shapes, labels);
    const tempo = tempoBox(item, st, (b) => {
      bpm = b;
      api.setBpm(b);
      tr.restart();
    });
    const tr = transport({
      onPlay: () =>
        A.playStrum(
          shapes.filter(Boolean).map((s) => ({ sym: s.sym, frets: s.frets })),
          'quarters',
          bpm,
          { click: true, onStep: (s) => (grid.set(s.chordIdx), s.slot % 2 === 0 && tempo.beat(s.slot / 2)) },
        ),
      onMetro: () => A.metronome(bpm, 4, (i) => tempo.beat(i)),
    });
    body.append(h('p', 'One bar each, four down-strums, change on beat 1. Find the root on string ', d.family === 'A' ? '5' : d.family === 'E' ? '6' : '6 or 5', ' first, then drop the shape on it.'), grid, tempo, tr, rateRow(api.rate));
  },

  scale(body, item, st, v, api) {
    const d = item.data;
    const key = v.key || d.keys[0];
    const notes = scalePosition(pc(key), d.scale, d.position);
    const fs = notes.map((n) => n.f);
    const from = Math.max(0, Math.min(...fs) - 1);
    const to = Math.max(from + 5, Math.max(...fs) + 1);
    let labels = 'degree';
    let bpm = st ? st.bpm : item.bpm[0];
    const wrap = h('div.fb-wrap');
    const flats = usesFlats(key);
    const draw = () => {
      const b = fretboard({
        from: from === 0 ? 0 : from,
        to,
        dots: notes.map((n) => ({ s: n.s, f: n.f, kind: n.degree === '1' ? 'root' : n.degree === 'b5' ? 'blue' : 'scale', label: labels === 'degree' ? n.degree : noteLabel(n.s, n.f, flats) })),
        label: `${key} ${SCALES[d.scale].name} position ${d.position + 1}`,
      });
      wrap.replaceChildren(b);
      return b;
    };
    let board = draw();
    const run = [...notes, ...notes.slice(0, -1).reverse()].map((n) => [n.s, n.f, 0.5]);
    const tempo = tempoBox(item, st, (b) => {
      bpm = b;
      api.setBpm(b);
      tr.restart();
    });
    const tr = transport({
      onPlay: () => A.playTab(run, bpm, { loop: true, click: true, onNote: (i) => board.highlight([{ s: run[i][0], f: run[i][1] }]) }),
      onMetro: () => A.metronome(bpm, 4, (i) => tempo.beat(i)),
    });
    const labelSeg = h('div');
    const drawSeg = () =>
      labelSeg.replaceChildren(
        seg([{ value: 'degree', label: '1 2 3' }, { value: 'note', label: 'C D E' }], labels, (x) => {
          labels = x;
          board = draw();
          drawSeg();
        }, { label: 'Labels' }),
      );
    drawSeg();
    const minorish = ['minPent', 'blues', 'minor', 'dorian'].includes(d.scale);
    body.append(
      h('div.row.between', h('div', h('div.eyebrow', 'Today’s key'), h('div.chord-name', key + (minorish ? ' minor' : ' major'))), labelSeg),
      h('p.small', h('b', SCALES[d.scale].name + ', position ' + (d.position + 1) + '. '), 'Teal = root.'),
      wrap,
      h('p.small.muted', 'Up and back down in eighth notes, alternate picking. Keys rotate each time so the shape moves around the neck.'),
      tempo,
      tr,
      rateRow(api.rate),
    );
  },

  notes(body, item, st, v, api) {
    const d = item.data;
    const TOTAL = 8;
    let q = 0;
    let right = 0;
    let target = null;
    const ask = h('div.quiz-q', { 'aria-live': 'polite' });
    const fb = h('p.small.muted', ' ');
    const wrap = h('div.fb-wrap');
    const next = () => {
      if (q >= TOTAL) return finish();
      const s = rand(d.strings);
      const f = Math.floor(Math.random() * (d.maxFret + 1));
      target = { s, pcv: fretMidi(s, f) % 12 };
      ask.textContent = `Find ${noteName(target.pcv)} on the ${['low E', 'A', 'D', 'G', 'B', 'high e'][s]} string`;
      draw([]);
    };
    const draw = (dots) => wrap.replaceChildren(fretboard({ from: 0, to: 12, dots, onTap: tap, label: 'Tap the fretboard' }));
    const tap = (s, f) => {
      if (!target) return;
      const ok = s === target.s && fretMidi(s, f) % 12 === target.pcv;
      if (ok) right++;
      const correct = [];
      for (let k = 0; k <= 12; k++) if (fretMidi(target.s, k) % 12 === target.pcv) correct.push({ s: target.s, f: k, kind: 'root', label: noteName(target.pcv) });
      draw([...correct, ...(ok ? [] : [{ s, f, kind: 'ghost', label: noteLabel(s, f) }])]);
      fb.textContent = ok ? 'Yes.' : `That was ${noteLabel(s, f)}. ${noteName(target.pcv)} is at fret ${correct.map((c) => c.f).join(' and ')}.`;
      target = null;
      q++;
      setTimeout(next, ok ? 650 : 1500);
    };
    const finish = () => {
      const frac = right / TOTAL;
      const r = ratingFromScore(frac);
      body.replaceChildren(h('div.stack', h('div.quiz-q', `${right} of ${TOTAL}`), h('p', r === 'clean' ? 'Locked for today.' : r === 'sloppy' ? 'Getting there. It will come back soon.' : 'This one needs more reps. It will come back tomorrow.'), btn('Next', () => api.rate(r), { cls: 'primary big' })));
    };
    body.append(ask, wrap, fb, h('p.small.muted', 'Tap a fret. Eight questions, scored automatically.'));
    next();
  },

  lick(body, item, st, v, api) {
    const lk = item.data.lick ? LICKS[item.data.lick] : item.data;
    tabItem(body, item, st, api, lk, { byEar: false });
  },

  melody(body, item, st, v, api) {
    tabItem(body, item, st, api, MELODIES[item.data.melody], { byEar: true });
  },

  prog(body, item, st, v, api) {
    const d = item.data;
    const P = PROGRESSIONS[d.prog];
    const key = v.key || d.keys[0];
    let chords = progressionChords(d.prog, key);
    let capoNote = null;
    if (d.capo) {
      const opt = capoFor(key)[0];
      if (opt && opt.capo > 0) {
        chords = chords.map((c) => transposeSym(c, -opt.capo));
        capoNote = `Capo ${opt.capo}, play ${opt.shapes} shapes. Sounds in ${key}.`;
      }
    }
    let bpm = st ? st.bpm : item.bpm[0];
    const shapes = chords.map((c) => {
      const s = shapeFor(c);
      return s ? { ...s, sym: c } : null;
    });
    const grid = shapeGrid(shapes, P.rn);
    const tempo = tempoBox(item, st, (b) => {
      bpm = b;
      api.setBpm(b);
      tr.restart();
    });
    const tr = transport({
      onPlay: () => A.playBacking(chords, 'folk', bpm, { drums: true, onChord: (i) => grid.set(i) }),
      onMetro: () => A.metronome(bpm, 4, (i) => tempo.beat(i)),
      playLabel: 'Play along',
    });
    body.append(
      h('div', h('div.eyebrow', 'Key of ' + key), h('p', h('b', P.rn.join(' – ')), ' · ', P.vibe)),
      capoNote ? h('p.card.warm', capoNote) : null,
      grid,
      h('p.small.muted', 'Play the loop with any picking pattern or strum you like. Clean = no gaps at the changes.'),
      tempo,
      tr,
      rateRow(api.rate),
    );
  },

  write(body, item, st, v, api) {
    const go = api.ctx ? api.ctx.go : () => {};
    body.append(
      h('p.card.tint', item.data.prompt),
      h('div.row', btn('Chord builder', () => go('pick'), { cls: 'quiet', ico: 'pick' }), btn('Jam', () => go('jam'), { cls: 'quiet', ico: 'jam' })),
      h('p.small.muted', 'Take as long as you like. The session waits here.'),
      rateRow(api.rate, ['Did it', 'Half did it', 'Not today'], ['felt like music', 'got something', 'skip for now']),
    );
  },

  ear(body, item, st, v, api) {
    earQuiz(body, item, api);
  },
};

function renderGeneric(body, item, st, v, api) {
  body.append(h('p', item.title), rateRow(api.rate));
}

function tabItem(body, item, st, api, lk, { byEar }) {
  const notes = lk.n || lk.notes;
  let bpm = st ? st.bpm : item.bpm[0];
  const fs = notes.map((n) => n[1]);
  const from = Math.max(0, Math.min(...fs) - 1);
  const to = Math.max(from + 4, Math.max(...fs) + 1);
  const flats = usesFlats(lk.key);
  const keyPc = pc(lk.key);
  const boardWrap = h('div.fb-wrap');
  const board = fretboard({ from: from <= 1 ? 0 : from, to, dots: notes.map((n) => ({ s: n[0], f: n[1], kind: fretMidi(n[0], n[1]) % 12 === keyPc ? 'root' : 'scale', label: noteLabel(n[0], n[1], flats) })), label: lk.name });
  boardWrap.append(board);
  let pos = 0;
  const cols = notes.map((n) => {
    const m = { h: 'h', p: 'p', s: '/', b: 'b' }[n[3]] || '';
    const c = { notes: [{ s: n[0], f: n[1], tech: m }], mark: Number.isInteger(pos) ? String((pos % 4) + 1) : '' };
    pos += n[2];
    return c;
  });
  const t = tab(cols, { label: lk.name + ' tab' });
  const tabWrap = h('div.tab-wrap', t);
  const tempo = tempoBox(item, st, (b) => {
    bpm = b;
    api.setBpm(b);
    tr.restart();
  });
  const tr = transport({
    onPlay: () =>
      A.playTab(notes, bpm, {
        loop: true,
        click: true,
        onNote: (i) => {
          t.playhead(i);
          board.highlight([{ s: notes[i][0], f: notes[i][1] }]);
        },
      }),
    onMetro: () => A.metronome(bpm, 4, (i) => tempo.beat(i)),
  });
  if (byEar) {
    boardWrap.hidden = true;
    tabWrap.hidden = true;
    const reveal = btn('Show me the tab', () => {
      boardWrap.hidden = false;
      tabWrap.hidden = false;
      reveal.remove();
    }, { cls: 'quiet', ico: 'eye' });
    const firstString = ['low E', 'A', 'D', 'G', 'B', 'high e'][notes[0][0]];
    body.append(h('p', lk.use), h('p.card.tint', `Listen, hum it, then find it. Hint: the first note is ${noteLabel(notes[0][0], notes[0][1], flats)} on the ${firstString} string.`), reveal);
  } else body.append(h('p', lk.use || lk.tip || ''));
  body.append(boardWrap, tabWrap, h('p.small.muted', 'Letters above the tab: h hammer-on, p pull-off, / slide, b bend up a whole step.'), tempo, tr, rateRow(api.rate));
}

// ---------------------------------------------------------------------------
// Ear quizzes (also used by hands-free mode for the question bank).
export function earQuestion(item) {
  const d = item.data;
  if (d.type === 'interval') {
    const semis = rand(d.set);
    const root = 50 + Math.floor(Math.random() * 10);
    return {
      prompt: 'Which interval?',
      play: () => A.playInterval(root, semis),
      answer: INTERVALS.find((x) => x.semis === semis).name,
      options: d.set.map((s) => INTERVALS.find((x) => x.semis === s).name),
      reveal: INTERVALS.find((x) => x.semis === semis).hint,
    };
  }
  if (d.type === 'quality') {
    const q = rand(d.set);
    const root = 45 + Math.floor(Math.random() * 8);
    const nm = (x) => (x === '' ? 'major' : x === 'm' ? 'minor' : CHORDS[x].name);
    return { prompt: 'What kind of chord?', play: () => A.playChordQuality(root, q), answer: nm(q), options: d.set.map(nm), reveal: q === 'm' ? 'Minor: darker, sadder.' : q === '' ? 'Major: bright, settled.' : '' };
  }
  if (d.type === 'prog') {
    const id = rand(d.set);
    const key = rand(['G', 'C', 'D', 'A']);
    const chords = progressionChords(id, key);
    const label = (x) => PROGRESSIONS[x].name + ' (' + PROGRESSIONS[x].rn.join('–') + ')';
    return { prompt: 'Which progression?', play: () => (A.playProgression(chords, 100), (chords.length * 4 * 60 * 1000) / 100), stop: true, answer: label(id), options: d.set.map(label), reveal: 'In ' + key + ': ' + chords.join(' ') };
  }
  if (d.type === 'degree') {
    const key = rand(['G', 'C', 'D', 'A', 'E']);
    const rn = rand(d.set);
    const chord = romanChord(key, rn);
    return {
      prompt: 'Home chord, then which chord?',
      play: () => {
        const t = A.now();
        A.playChordOnce(romanChord(key, 'I'), t);
        A.playChordOnce(chord, t + 1.2);
        return 2600;
      },
      answer: rn,
      options: d.set,
      reveal: `In ${key}, ${rn} is ${chord}.`,
    };
  }
  if (d.type === 'sing') {
    const id = rand(d.set);
    const lk = LICKS[id];
    return { prompt: 'Hear it. Sing it back.', play: () => (A.playTab(lk.n, 80), (lk.n.reduce((a, n) => a + n[2], 0) * 60 * 1000) / 80 + 400), answer: null, options: [], reveal: lk.name + ': ' + lk.use, sing: true, lick: lk };
  }
  return null;
}

function earQuiz(body, item, api) {
  const TOTAL = item.data.type === 'sing' ? 3 : 6;
  let q = 0;
  let right = 0;
  let cur = null;
  const stage = h('div.stack');
  body.append(stage);
  const next = () => {
    if (q >= TOTAL) return finish();
    cur = earQuestion(item);
    const replay = btn('Play again', () => {
      A.stopAll();
      cur.play();
    }, { cls: 'quiet', ico: 'play' });
    const answers = h('div.answers');
    const fb = h('p.small', { 'aria-live': 'polite' }, ' ');
    if (cur.sing) {
      stage.replaceChildren(h('div.eyebrow', `Question ${q + 1} of ${TOTAL}`), h('div.quiz-q', cur.prompt), replay, h('p.small.muted', 'Sing or hum it straight back. Then check yourself against the reveal.'), btn('Reveal', () => {
        fb.textContent = cur.reveal;
        answers.replaceChildren(btn('Got it', () => { right++; q++; next(); }, { cls: 'quiet' }), btn('Not quite', () => { q++; next(); }, { cls: 'quiet' }));
      }, { cls: 'quiet', ico: 'eye' }), fb, answers);
    } else {
      for (const o of shuffle([...new Set(cur.options)])) {
        const b = h('button.btn', { type: 'button' }, o);
        b.addEventListener('click', () => {
          if (b.parentElement.dataset.done) return;
          b.parentElement.dataset.done = '1';
          A.stopAll();
          const ok = o === cur.answer;
          if (ok) right++;
          b.classList.add(ok ? 'right' : 'wrong');
          if (!ok) [...answers.children].find((x) => x.textContent === cur.answer)?.classList.add('right');
          fb.textContent = (ok ? 'Yes. ' : 'It was ' + cur.answer + '. ') + (cur.reveal || '');
          q++;
          answers.after(btn(q >= TOTAL ? 'See score' : 'Next question', next, { cls: 'primary' }));
        });
        answers.append(b);
      }
      stage.replaceChildren(h('div.eyebrow', `Question ${q + 1} of ${TOTAL}`), h('div.quiz-q', cur.prompt), replay, answers, fb);
    }
    A.stopAll();
    cur.play();
  };
  const finish = () => {
    const r = ratingFromScore(right / TOTAL);
    stage.replaceChildren(h('div.quiz-q', `${right} of ${TOTAL}`), h('p', r === 'clean' ? 'Your ear is getting it.' : 'It comes back soon. Ears learn by repetition, not effort.'), btn('Next', () => api.rate(r), { cls: 'primary big' }));
  };
  stage.append(h('p', 'Headphones help. Six quick questions, scored automatically.'), btn('Start', next, { cls: 'primary big', ico: 'play' }));
}

// ---------------------------------------------------------------------------
export function songCard(song, { onRate }) {
  const out = h('div.ai-out');
  let ctl = null;
  const aiBtn = btn('Explain the harmony', async () => {
    ctl?.abort();
    ctl = new AbortController();
    out.textContent = 'Thinking…';
    try {
      await explainHarmony(song, { signal: ctl.signal, onText: ({ text }) => (out.textContent = text) });
    } catch (e) {
      out.textContent = e.text || aiErrorText(e);
    }
  }, { cls: 'quiet', ico: 'spark' });
  aiBtn.hidden = true;
  getSample().then((s) => (aiBtn.hidden = !s));
  return h(
    'div.stack-lg',
    h('div.stack', h('div.row', h('span.pill.accent', 'Repertoire')), h('h2', song.title), song.artist ? h('p.muted', song.artist) : null),
    song.key ? h('p', h('b', 'Key / capo: '), song.key) : null,
    song.chords ? h('p.mono', song.chords) : null,
    song.notes ? h('p.small.muted', song.notes) : null,
    h('p', 'Play it through once, start to finish, no stopping. That keeps it alive.'),
    aiBtn,
    out,
    rateRow(onRate, ['Clean', 'Rough', 'Forgot it'], ['all the way', 'stumbled', 'needs relearning']),
  );
}

// The last minute of every session: free playing over a loop.
export function playoutCard(step, { onDone }) {
  const chords = step.chords || progressionChords(step.prog, step.key);
  const now = h('span.now', chords[0]);
  const next = h('span.next', 'then ' + chords[1 % chords.length]);
  const key = step.key || 'G';
  const kp = pc(key);
  const pent = scalePosition((kp + 9) % 12, 'minPent', 0); // relative-minor box = major pentatonic of the key
  const wrap = h('div.fb-wrap');
  const drawBoard = (sym) => {
    const tones = (() => {
      try {
        return CHORDS[sym.replace(/^[A-G][#b]?/, '').split('/')[0]]?.tones.map((t) => (pc(sym) + t) % 12) || [];
      } catch {
        return [];
      }
    })();
    const fs = pent.map((n) => n.f);
    wrap.replaceChildren(fretboard({ from: Math.max(0, Math.min(...fs) - 1) || 0, to: Math.max(...fs) + 1, dots: pent.map((n) => ({ s: n.s, f: n.f, kind: tones.includes(fretMidi(n.s, n.f) % 12) ? 'tone' : 'scale', label: noteLabel(n.s, n.f, usesFlats(key)) })), label: 'Notes that fit' }));
  };
  drawBoard(chords[0]);
  const playB = btn('Start the loop', () => {
    if (playB.classList.contains('on')) {
      A.stopAll();
      playB.classList.remove('on');
      playB.querySelector('span').textContent = 'Start the loop';
      return;
    }
    playB.classList.add('on');
    playB.querySelector('span').textContent = 'Stop';
    A.playBacking(chords, step.pattern === 'travis' || step.pattern === 'pinch' ? 'folk' : 'ballad', 84, {
      onChord: (i, sym) => {
        now.textContent = sym;
        next.textContent = 'then ' + chords[(i + 1) % chords.length];
        drawBoard(sym);
      },
    });
  }, { cls: 'primary', ico: 'loop' });
  return h(
    'div.stack-lg',
    h('div.stack', h('div.row', mascot('hi', 44), h('div', h('div.eyebrow', 'Play it out'), h('h2', 'One minute, anything goes'))), h('p', `Loop: ${step.name || 'your idea'} in ${key}. Strum, pick, hum or noodle on the lit notes. Amber dots are the current chord’s notes: land on one when the chord changes. Mumbling counts.`)),
    h('div.current-chord', now, next),
    wrap,
    h('div.row', playB),
    btn('Done', () => {
      A.stopAll();
      onDone();
    }, { cls: 'big quiet', ico: 'check' }),
  );
}
