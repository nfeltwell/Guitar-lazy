// Moves: pick two chords, get the ways to connect them so it sounds like a song, not a chord chart.
import { h, btn, seg, toast, field } from './dom.js';
import { moveView } from './items.js';
import * as A from '../audio.js';
import { generateMoves, plainChange, suggestedPairs, moveBySpec, MOVE_TYPES } from '../moves.js';
import { romanChord, ITEMS } from '../content.js';
import { prettyChord } from '../theory.js';

const KEYS = ['C', 'G', 'D', 'A', 'E'];
const NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'bVII'];
let ui = { key: 'G', from: 'G', to: 'C', bpm: 76, only: 'all' };

export function render(root, ctx) {
  const chordsIn = (k) => NUMERALS.map((rn) => ({ rn, sym: romanChord(k, rn) }));
  if (!chordsIn(ui.key).some((c) => c.sym === ui.from)) ui.from = romanChord(ui.key, 'I');
  if (!chordsIn(ui.key).some((c) => c.sym === ui.to)) ui.to = romanChord(ui.key, 'IV');
  const redo = () => {
    A.stopAll();
    root.replaceChildren();
    render(root, ctx);
  };
  const chipRow = (which) =>
    h(
      'div.chips',
      { id: 'mv-' + which },
      chordsIn(ui.key).map((c) => h('button.chip', { type: 'button', class: (ui[which] === c.sym ? 'on ' : '') + (c.rn === 'bVII' ? 'borrowed' : ''), onclick: () => ((ui[which] = c.sym), redo()) }, prettyChord(c.sym), h('span.rn', c.rn.replace('b', '♭')))),
    );
  const loop = ctx.state.settings.pickLab?.chords || [];
  const loopPairs = loop.map((c, i) => [c, loop[(i + 1) % loop.length]]).filter(([a, b]) => a !== b).slice(0, 6);
  const pairChips = (pairs, key) =>
    h('div.chips', pairs.map(([a, b]) => h('button.chip', { type: 'button', class: ui.from === a && ui.to === b ? 'on' : '', onclick: () => ((ui.key = key || ui.key), (ui.from = a), (ui.to = b), redo()) }, prettyChord(a), h('span.rn', '→'), prettyChord(b))));
  const moves = generateMoves(ui.key, ui.from, ui.to);
  const types = [...new Set(moves.map((m) => m.type))];
  const shown = moves.filter((m) => ui.only === 'all' || m.type === ui.only);
  const plain = plainChange(ui.key, ui.from, ui.to);
  const bpmLabel = h('span.mono', String(ui.bpm));
  // Map each course item to the exact move it resolves to, so variants (walk up vs walk down) stay distinct.
  const curriculum = new Map(ITEMS.filter((i) => i.kind === 'move' && i.data.key === ui.key).map((i) => [moveBySpec(i.data)?.id, i]));
  const list = h('div');
  for (const mv of shown) {
    const inCourse = curriculum.get(mv.id);
    const custom = Object.values(ctx.state.custom || {}).find((c) => c.kind === 'move' && c.moveId === mv.id);
    list.append(
      h(
        'section.move',
        h('div.row.between', h('h3', mv.name), h('span.tag', MOVE_TYPES[mv.type].tag)),
        moveView(mv, { getBpm: () => ui.bpm, plain }),
        inCourse
          ? h('p.label', 'In your course: ' + inCourse.title)
          : custom
            ? h('p.label', 'In your practice')
            : btn('Practise this', () => {
                const id = 'mv-' + Date.now().toString(36);
                const item = { id, kind: 'move', track: 'create', title: `${mv.name} (${mv.key})`, bpm: [60, 100], mins: 1.5, moveId: mv.id, data: { key: mv.key, from: mv.from, to: mv.to, type: mv.type, variant: mv.id.split(':')[3] } };
                ctx.update((s) => ({ ...s, custom: { ...(s.custom || {}), [id]: item } }));
                toast('Added. It comes up in your sessions now.');
                redo();
              }, { cls: 'quiet small', ico: 'plus' }),
      ),
    );
  }
  root.append(
    h(
      'div.stack-lg',
      h('div.stack', h('h1', 'Moves'), h('p.muted', 'Pick two chords. Here’s how to get between them so it sounds like a song.')),
      h('section.stack', h('div.label', 'key'), seg(KEYS, ui.key, (k) => ((ui.key = k), redo()), { id: 'mv-key', label: 'Key', wide: true }), h('div.label', 'from'), chipRow('from'), h('div.label', 'to'), chipRow('to')),
      h('section.stack', h('div.label', 'worth knowing in ' + ui.key), pairChips(suggestedPairs(ui.key)), loopPairs.length ? [h('div.label', 'from your Pick lab loop'), pairChips(loopPairs, ctx.state.settings.pickLab?.key)] : null),
      field('tempo', h('div.row.nowrap', h('input', { type: 'range', min: 50, max: 130, step: 2, value: ui.bpm, id: 'mv-bpm', 'aria-label': 'Tempo', oninput: (e) => ((ui.bpm = Number(e.target.value)), (bpmLabel.textContent = e.target.value)) }), bpmLabel)),
      h(
        'section.sect',
        h('div.sect-head', h('h2', `${prettyChord(ui.from)} → ${prettyChord(ui.to)}`), h('span.label', `${moves.length} moves`)),
        types.length > 1 ? seg([{ value: 'all', label: 'All' }, ...types.map((t) => ({ value: t, label: MOVE_TYPES[t].tag }))], ui.only, (v) => ((ui.only = v), redo()), { id: 'mv-filter', label: 'Kind of move' }) : null,
        shown.length ? list : h('p.muted', 'Nothing for these two. Try another pair.'),
      ),
      h('section.sect', h('h2', 'The toolkit'), h('div.list', Object.values(MOVE_TYPES).map((t) => h('div.li', h('div', h('h3', t.name), h('p.small.muted', t.how)))))),
    ),
  );
  if (!types.includes(ui.only) && ui.only !== 'all') ui.only = 'all';
}

export function cleanup() {
  A.stopAll();
}
