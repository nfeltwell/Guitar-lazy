// Pick lab: build a chord sequence, choose a pattern, watch which string to pick next. Save ideas.
import { h, btn, seg, select, icon, toast, field, setBtn } from './dom.js';
import { pickBox, tab, strumRow } from './fretboard.js';
import { pickColumns, pieceView, cheatBlock } from './items.js';
import * as A from '../audio.js';
import { PICKS, STRUMS, PROGRESSIONS, SPARKLE, PIECES, shapeFor, romanChord, progressionChords } from '../content.js';
import { DIATONIC_MAJOR, BORROWED, capoFor, pc, parseChord, prettyChord } from '../theory.js';

const KEYS = ['C', 'G', 'D', 'A', 'E', 'F'];
const FINGER = { B: 'p', A: 'p', F: 'p', '3': 'i', '2': 'm', '1': 'a' };
// What usually sounds good next, by numeral.
const NEXT = { I: ['IV', 'V', 'vi', 'bVII'], ii: ['V', 'IV'], iii: ['vi', 'IV'], IV: ['I', 'V', 'iv'], V: ['I', 'vi', 'IV'], vi: ['IV', 'ii', 'V'], bVII: ['IV', 'I'], iv: ['I'], bVI: ['bVII', 'V'], III: ['IV', 'vi'], II: ['IV', 'V'] };

let lab = null;
function initLab(ctx) {
  const saved = ctx.state.settings.pickLab;
  lab = saved ? { ...saved } : { key: 'G', chords: progressionChords('four', 'G'), pattern: 'travis', bpm: 76, sparkle: false, melodyTop: false };
}

function numeralOf(key, sym) {
  for (const d of [...DIATONIC_MAJOR, ...BORROWED]) if (romanChord(key, d.rn) === sym) return d.rn;
  return null;
}

let view = 'loop';
let pieceBpm = 66;

function modeSeg(root, ctx) {
  return seg([{ value: 'loop', label: 'Build a loop' }, { value: 'pieces', label: 'Fingerstyle pieces' }], view, (v) => {
    A.stopAll();
    view = v;
    root.replaceChildren();
    render(root, ctx);
  }, { label: 'Pick lab mode', id: 'pick-mode', wide: true });
}

function renderPieces(root, ctx) {
  const bpmLabel = h('span.mono', String(pieceBpm));
  const list = h('div');
  const views = [];
  for (const [id, p] of Object.entries(PIECES)) {
    const v = pieceView(p, { getBpm: () => pieceBpm });
    views.push(v);
    list.append(h('section.sect', { id: 'piece-' + id }, h('div.sect-head', h('h2', p.name), h('span.label', p.key + (p.scale === 'minor' ? ' minor' : ' major') + (p.meter === 3 ? ' · 3/4' : ''))), cheatBlock(p.technique, false), v));
  }
  root.append(
    h(
      'div.stack-lg',
      h('div.stack', h('h1', 'Pick lab'), modeSeg(root, ctx), h('p.muted', 'Short pieces, each built on one fingerpicking idea: let-it-ring arpeggios, shapes over open-string drones, crosspicking, hammer-ons, bass with a melody on top. The jangly, ringing sound of British indie guitar is mostly these tricks.')),
      h('div.field', h('span.field-label', 'tempo'), h('div.row.nowrap', h('input', { type: 'range', min: 40, max: 120, step: 2, value: pieceBpm, id: 'piece-bpm', 'aria-label': 'Tempo', oninput: (e) => ((pieceBpm = Number(e.target.value)), (bpmLabel.textContent = e.target.value)), onchange: () => views.forEach((v) => v.restart()) }), bpmLabel)),
      list,
    ),
  );
}

export function render(root, ctx) {
  if (!lab) initLab(ctx);
  if (view === 'pieces') return renderPieces(root, ctx);
  let playing = false;
  const persist = () => ctx.update((s) => ({ ...s, settings: { ...s.settings, pickLab: { ...lab } } }));
  const isStrum = () => !!STRUMS[lab.pattern];

  const keyHolder = h('div');
  const palette = h('div.stack');
  const progRow = h('div.chips', { id: 'prog-row', 'aria-label': 'Your progression' });
  const suggest = h('div.small.muted');
  const capo = h('p.small.muted');
  const stageChord = h('span.now', '');
  const stageNext = h('span.next', '');
  const boardWrap = h('div.nk-wrap');
  const tabWrap = h('div.tab-wrap');
  let board = null;
  let tabEl = null;
  let curShapeKey = '';

  const drawKey = () => keyHolder.replaceChildren(seg(KEYS, lab.key, (k) => {
    const shift = (pc(k) - pc(lab.key) + 12) % 12;
    // Keep the same numerals when changing key.
    const rns = lab.chords.map((c) => numeralOf(lab.key, c));
    lab.key = k;
    lab.chords = rns.every(Boolean) ? rns.map((rn) => romanChord(k, rn)) : lab.chords;
    void shift;
    refresh();
  }, { label: 'Key', id: 'key' }));

  const drawPalette = () => {
    const chip = (d, borrowed) => {
      const sym = romanChord(lab.key, d.rn);
      return h('button.chip', { type: 'button', class: borrowed ? 'borrowed' : '', title: d.why || '', onclick: () => add(sym) }, prettyChord(sym), h('span.rn', d.rn.replace('b', '♭')));
    };
    palette.replaceChildren(
      h('div.chips', DIATONIC_MAJOR.map((d) => chip(d, false))),
      h('div.chips', BORROWED.map((d) => chip(d, true))),
      h('p.small.muted', 'Top row: the six chords that live in ', lab.key, '. Dashed: borrowed chords, the ones that make it sound like a record.'),
    );
  };

  const add = (sym) => {
    if (lab.chords.length >= 8) return toast('Eight chords is plenty. Remove one first.');
    lab.chords = [...lab.chords, sym];
    refresh();
  };

  const drawProg = () => {
    progRow.replaceChildren(
      ...lab.chords.map((c, i) =>
        h('button.chip.on', { type: 'button', 'data-i': i, 'aria-label': `Remove ${prettyChord(c)}`, onclick: () => {
          lab.chords = lab.chords.filter((_, j) => j !== i);
          refresh();
        } }, prettyChord(c), h('span.rn', (numeralOf(lab.key, c) || '').replace('b', '♭')), icon('close', 14)),
      ),
    );
    if (!lab.chords.length) progRow.append(h('span.small.muted', 'Tap chords above to build a loop.'));
    const last = lab.chords[lab.chords.length - 1];
    const rn = last && numeralOf(lab.key, last);
    const nexts = rn && NEXT[rn] ? NEXT[rn].map((r) => romanChord(lab.key, r)) : [];
    suggest.replaceChildren(...(nexts.length ? [h('span.label', 'sounds nice next')] : []), ...nexts.map((s) => h('button.chip', { type: 'button', onclick: () => add(s) }, prettyChord(s))));
    suggest.className = 'row';
    const c = capoFor(lab.key)[0];
    capo.textContent = c && c.capo > 0 ? `Tip: capo ${c.capo} with ${c.shapes} shapes also gives you ${lab.key}.` : '';
  };

  const showChord = (sym, frets, notes) => {
    const k = sym + frets;
    if (k !== curShapeKey) {
      curShapeKey = k;
      board = pickBox({ frets, fingers: shapeFor(sym)?.fingers, sym }, { sym });
      boardWrap.replaceChildren(board);
    }
    if (notes && board) board.highlight(notes);
  };

  const drawStage = () => {
    const chords = lab.chords;
    if (!chords.length) {
      boardWrap.replaceChildren();
      tabWrap.replaceChildren();
      stageChord.textContent = '';
      return;
    }
    stageChord.textContent = prettyChord(chords[0]);
    stageNext.textContent = chords.length > 1 ? 'then ' + chords[1] : '';
    if (isStrum()) {
      tabEl = strumRow(STRUMS[lab.pattern].slots);
      const sh = shapeFor(chords[0]);
      if (sh) showChord(chords[0], sh.frets);
    } else {
      const { steps, perBar } = A.pickSteps(chords, lab.pattern, { sparkle: lab.sparkle, melodyTop: lab.melodyTop, key: pc(lab.key) });
      tabEl = tab(pickColumns(steps), { beatEvery: perBar, label: 'Pattern tab' });
      if (steps[0]) showChord(steps[0].sym, steps[0].frets);
    }
    tabWrap.replaceChildren(tabEl);
  };

  const patternSel = select(
    [...Object.entries(PICKS).map(([id, p]) => ({ value: id, label: 'Pick: ' + p.name })), ...Object.entries(STRUMS).map(([id, p]) => ({ value: id, label: 'Strum: ' + p.name }))],
    lab.pattern,
    (v) => {
      lab.pattern = v;
      refresh();
    },
    { id: 'pattern', label: 'Pattern' },
  );
  const feel = h('p.small.muted');
  const presetSel = select([{ value: '', label: 'Load a classic…' }, ...Object.entries(PROGRESSIONS).filter(([id]) => id !== 'blues').map(([id, p]) => ({ value: id, label: p.name + ' (' + p.rn.join(' ') + ')' }))], '', (v) => {
    if (!v) return;
    lab.chords = progressionChords(v, lab.key);
    presetSel.value = '';
    refresh();
    toast(PROGRESSIONS[v].vibe);
  }, { id: 'preset', label: 'Load a classic progression' });
  const bpmLabel = h('span.mono', String(lab.bpm));
  const bpmInput = h('input', { type: 'range', min: 40, max: 150, step: 2, value: lab.bpm, id: 'bpm', 'aria-label': 'Tempo', oninput: (e) => {
    lab.bpm = Number(e.target.value);
    bpmLabel.textContent = String(lab.bpm);
  }, onchange: () => {
    persist();
    if (playing) play();
  } });
  const sparkleB = btn('Sparkle chords', () => {
    lab.sparkle = !lab.sparkle;
    refresh();
  }, { cls: 'quiet small', ico: 'spark', id: 'sparkle' });
  const melodyB = btn('Melody on top', () => {
    lab.melodyTop = !lab.melodyTop;
    refresh();
  }, { cls: 'quiet small', id: 'melody' });
  const playB = btn('Play', () => (playing ? stop() : play()), { cls: 'primary', ico: 'play', id: 'lab-play' });

  function play() {
    if (!lab.chords.length) return toast('Add some chords first.');
    playing = true;
    playB.classList.add('on');
    setBtn(playB, 'Stop', 'stop');
    const onStep = (step, i) => {
      stageChord.textContent = prettyChord(step.sym);
      stageNext.textContent = lab.chords.length > 1 ? 'then ' + lab.chords[(step.chordIdx + 1) % lab.chords.length] : '';
      progRow.querySelectorAll('.chip').forEach((c, j) => c.classList.toggle('playing', j === step.chordIdx));
      if (isStrum()) {
        showChord(step.sym, step.frets);
        tabEl.playhead(step.slot);
      } else {
        showChord(step.sym, step.frets, step.notes.filter((n) => !n.mute).map((n) => ({ s: n.s, f: n.f, label: FINGER[n.role] })));
        tabEl.playhead(i);
      }
    };
    if (isStrum()) A.playStrum(lab.chords, lab.pattern, lab.bpm, { onStep });
    else A.playPick(lab.chords, lab.pattern, lab.bpm, { sparkle: lab.sparkle, melodyTop: lab.melodyTop, key: pc(lab.key), onStep });
  }
  function stop() {
    playing = false;
    A.stopAll();
    playB.classList.remove('on');
    setBtn(playB, 'Play', 'play');
    progRow.querySelectorAll('.chip').forEach((c) => c.classList.remove('playing'));
  }

  const ideaName = h('input', { type: 'text', id: 'idea-name', placeholder: 'Name this idea', 'aria-label': 'Idea name', maxlength: 40 });
  const ideasList = h('div.list');
  const drawIdeas = () => {
    const ideas = ctx.state.ideas || [];
    ideasList.replaceChildren(
      ...(ideas.length
        ? ideas.map((idea) =>
            h(
              'div.li',
              h('div.grow', h('div', h('b', idea.name)), h('div.small.muted.mono', idea.key + ': ' + idea.chords.join(' ') + ' · ' + (PICKS[idea.pattern] || STRUMS[idea.pattern])?.name)),
              btn('Load', () => {
                stop();
                Object.assign(lab, { key: idea.key, chords: idea.chords, pattern: idea.pattern, bpm: idea.bpm || lab.bpm, sparkle: !!idea.sparkle, melodyTop: !!idea.melodyTop });
                bpmInput.value = lab.bpm;
                bpmLabel.textContent = lab.bpm;
                patternSel.value = lab.pattern;
                refresh();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }, { cls: 'quiet small' }),
              btn('', () => {
                ctx.update((s) => ({ ...s, ideas: s.ideas.filter((x) => x.id !== idea.id) }));
                drawIdeas();
              }, { cls: 'ghost small icon-only', ico: 'trash', title: 'Delete idea' }),
            ),
          )
        : [h('p.small.muted', 'Nothing saved yet. Your saved loops also turn up at the end of sessions, for the play-out minute.')]),
    );
  };

  function refresh() {
    stop();
    curShapeKey = '';
    drawKey();
    drawPalette();
    drawProg();
    drawStage();
    const p = PICKS[lab.pattern] || STRUMS[lab.pattern];
    feel.textContent = p.feel;
    sparkleB.classList.toggle('on', lab.sparkle);
    melodyB.classList.toggle('on', lab.melodyTop);
    sparkleB.hidden = isStrum();
    melodyB.hidden = isStrum();
    persist();
  }

  root.append(
    h(
      'div.stack-lg',
      h('div.stack', h('h1', 'Pick lab'), modeSeg(root, ctx), h('p.muted', 'Build a loop, choose a pattern, and follow the lit string. The letter under it is the finger: p thumb, i index, m middle, a ring.')),
      h('section.stack', h('div.label', 'key'), keyHolder, palette),
      h('section.sect', h('div.sect-head', h('h2', 'Your loop'), presetSel), progRow, suggest, capo),
      h('section.sect', h('div.fields', field('pattern', patternSel), field('tempo', h('div.row.nowrap', bpmInput, bpmLabel))), feel, h('div.row', sparkleB, melodyB)),
      h('section.panel.stack', h('div.current-chord', stageChord, stageNext), boardWrap, tabWrap, h('div.row', playB)),
      h('section.sect', h('h2', 'Save it'), h('div.row.nowrap', h('div.grow', ideaName), btn('Save idea', () => {
        if (!lab.chords.length) return toast('Add some chords first.');
        const name = ideaName.value.trim() || `Idea ${(ctx.state.ideas || []).length + 1}`;
        ctx.update((s) => ({ ...s, ideas: [{ id: 'i' + Date.now().toString(36), name, key: lab.key, chords: lab.chords, pattern: lab.pattern, bpm: lab.bpm, sparkle: lab.sparkle, melodyTop: lab.melodyTop, created: ctx.day }, ...(s.ideas || [])].slice(0, 60) }));
        ideaName.value = '';
        toast('Saved. It will turn up in your play-outs.');
        drawIdeas();
      }, { cls: 'primary', ico: 'save', id: 'save-idea' })), ideasList),
    ),
  );
  refresh();
  drawIdeas();
}

export function cleanup() {
  A.stopAll();
}
