// Content audit: every chord shape spells its chord, every lick stays in key, every item is reachable.
// Usage: node scripts/check-content.mjs   (exit code 1 on any problem)
import { SHAPES, BARRES, barreShape, SPARKLE, PICKS, STRUMS, PROGRESSIONS, LICKS, MELODIES, CHEATS, ITEMS, ITEM_BY_ID, MILESTONES, PLACEMENT, TRACKS, FRIENDLY_KEYS, romanChord, shapeFor, roleStrings } from '../src/content.js';
import { shapeMatches, fingersNeeded, shapeSpan, SCALES, pc, fretMidi, parseChord, noteName, DIATONIC_MAJOR, BORROWED, INTERVALS } from '../src/theory.js';
import { pickSteps, strumSteps } from '../src/audio.js';

export function audit() {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);

  // Chord shapes
  for (const [name, sh] of Object.entries(SHAPES)) {
    const sym = sh.sym || name;
    const m = shapeMatches(sh.frets, sym);
    if (!m.ok) err('shape ' + name, m.why);
    if (sh.frets.length !== 6 || sh.fingers.length !== 6) err('shape ' + name, 'needs 6 frets and 6 fingers');
    sh.frets.forEach((f, s) => {
      if (f > 0 && !(sh.fingers[s] >= 1 && sh.fingers[s] <= 4)) err('shape ' + name, `string ${6 - s} is fretted but has no finger`);
      if (f <= 0 && sh.fingers[s]) err('shape ' + name, `string ${6 - s} is open or muted but has a finger`);
    });
    if (fingersNeeded(sh.frets) > 4) err('shape ' + name, 'needs more than 4 fingers');
    if (shapeSpan(sh.frets) > 4) err('shape ' + name, 'stretch wider than 4 frets');
  }
  // Movable barres in all 12 keys
  for (const fam of Object.keys(BARRES))
    for (const q of Object.keys(BARRES[fam]).filter((k) => k !== 'root'))
      for (let r = 0; r < 12; r++) {
        const sym = noteName(r) + q;
        const b = barreShape(sym, fam);
        if (!b) {
          err('barre ' + fam + ' ' + sym, 'could not build');
          continue;
        }
        const m = shapeMatches(b.frets, sym);
        if (!m.ok) err('barre ' + fam + ' ' + sym, m.why + ' ' + b.frets.join(','));
        if (Math.max(...b.frets) > 17) err('barre ' + fam + ' ' + sym, 'off the neck');
      }
  // Sparkle alternates
  for (const [k, alts] of Object.entries(SPARKLE)) for (const a of alts) if (!SHAPES[a]) err('sparkle ' + k, a + ' has no shape');
  // Picking patterns
  const ROLES = new Set(['B', 'A', '1', '2', '3']);
  for (const [id, p] of Object.entries(PICKS)) {
    const want = { 4: 8, 6: 12, 3: 6 }[p.meter];
    if (p.slots.length !== want) err('pick ' + id, `meter ${p.meter} needs ${want} slots, has ${p.slots.length}`);
    for (const slot of p.slots) for (const r of slot) if (!ROLES.has(r)) err('pick ' + id, 'unknown role ' + r);
    if (!p.slots[0].includes('B') && id !== 'backward') err('pick ' + id, 'should start on the bass');
  }
  for (const [id, s] of Object.entries(STRUMS)) {
    if (![6, 8, 16].includes(s.slots.length)) err('strum ' + id, 'odd length');
    if (/[^DUX.]/.test(s.slots)) err('strum ' + id, 'bad characters');
  }
  // Progressions: every numeral resolves and is playable in every friendly key
  for (const [id, p] of Object.entries(PROGRESSIONS))
    for (const key of FRIENDLY_KEYS)
      for (const rn of p.rn) {
        let sym;
        try {
          sym = romanChord(key, rn);
          parseChord(sym);
        } catch (e) {
          err(`progression ${id} in ${key}`, `${rn}: ${e.message}`);
          continue;
        }
        const sh = shapeFor(sym);
        if (!sh) err(`progression ${id} in ${key}`, `${rn} = ${sym} has no playable shape`);
        else if (!shapeMatches(sh.frets, sh.sym || sym).ok) err(`progression ${id} in ${key}`, `${sym} shape is wrong`);
      }
  // Diatonic numerals really are diatonic
  for (const key of FRIENDLY_KEYS) {
    const scale = SCALES.major.steps.map((s) => (s + pc(key)) % 12);
    for (const d of DIATONIC_MAJOR) {
      const c = parseChord(romanChord(key, d.rn));
      const tones = (c.quality === 'm' ? [0, 3, 7] : [0, 4, 7]).map((t) => (c.root + t) % 12);
      if (tones.some((t) => !scale.includes(t))) err('numeral ' + d.rn + ' in ' + key, 'not diatonic');
    }
  }
  // Licks and melodies stay in key and in reach
  const checkTab = (kind, id, lk) => {
    const scale = SCALES[lk.scale].steps.map((s) => (s + pc(lk.key)) % 12);
    const n = lk.n || lk.notes;
    n.forEach(([s, f, beats, tech], i) => {
      if (!(s >= 0 && s <= 5 && f >= 0 && f <= 15)) err(`${kind} ${id} note ${i + 1}`, 'off the fretboard');
      if (!(beats > 0 && beats <= 4)) err(`${kind} ${id} note ${i + 1}`, 'bad duration');
      const midi = fretMidi(s, f) + (tech === 'b' ? 2 : 0);
      if (!scale.includes(fretMidi(s, f) % 12)) err(`${kind} ${id} note ${i + 1}`, `${noteName(fretMidi(s, f) % 12)} is not in ${lk.key} ${SCALES[lk.scale].name}`);
      if (tech === 'b' && !scale.includes(midi % 12)) err(`${kind} ${id} note ${i + 1}`, 'bend lands outside the scale');
      if ((tech === 'h' || tech === 'p') && i > 0 && n[i - 1][0] !== s) err(`${kind} ${id} note ${i + 1}`, 'hammer/pull must stay on the same string');
      if (tech === 'h' && i > 0 && n[i - 1][1] >= f) err(`${kind} ${id} note ${i + 1}`, 'hammer-on must go up');
      if (tech === 'p' && i > 0 && n[i - 1][1] <= f) err(`${kind} ${id} note ${i + 1}`, 'pull-off must go down');
    });
    const fretted = n.map((x) => x[1]).filter((f) => f > 0);
    if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 5) err(`${kind} ${id}`, 'spans more than one hand position');
  };
  for (const [id, lk] of Object.entries(LICKS)) checkTab('lick', id, lk);
  for (const [id, lk] of Object.entries(MELODIES)) checkTab('melody', id, lk);

  // Items
  const ids = new Set();
  const KINDS = new Set(['pick', 'strum', 'change', 'barre', 'scale', 'notes', 'lick', 'melody', 'prog', 'write', 'ear']);
  for (const it of ITEMS) {
    const w = 'item ' + it.id;
    if (ids.has(it.id)) err(w, 'duplicate id');
    ids.add(it.id);
    if (!KINDS.has(it.kind)) err(w, 'unknown kind');
    if (!TRACKS[it.track]) err(w, 'unknown track');
    if (!Array.isArray(it.bpm) || it.bpm.length !== 2 || (it.bpm[1] && it.bpm[0] >= it.bpm[1])) err(w, 'bpm must be [start, target] with start < target');
    if (!(it.mins > 0)) err(w, 'needs minutes per rep');
    if (it.cheat && !CHEATS[it.cheat]) err(w, 'unknown cheat ' + it.cheat);
    for (const p of it.prereq || []) if (!ITEM_BY_ID[p]) err(w, 'unknown prereq ' + p);
    const d = it.data;
    if (it.kind === 'pick') {
      if (!PICKS[d.pattern]) err(w, 'unknown pattern');
      else {
        for (const c of d.chords) if (!shapeFor(c)) err(w, 'no shape for ' + c);
        const { steps } = pickSteps(d.chords, d.pattern, { sparkle: d.sparkle, melodyTop: d.melodyTop });
        for (const st of steps)
          for (const n of st.notes) {
            if (n.s < 0 || n.s > 5) err(w, 'role maps off the strings');
            if (n.f < 0) err(w, `plucks a muted string on ${st.sym}`);
          }
        if (d.melodyTop) {
          const key = parseChord(d.chords[0]).root;
          const scale = SCALES.major.steps.map((x) => (x + key) % 12);
          for (const st of steps) for (const n of st.notes) if (!scale.includes(fretMidi(n.s, n.f) % 12)) err(w, `melody note ${noteName(fretMidi(n.s, n.f) % 12)} is out of key`);
        }
      }
    }
    if (it.kind === 'strum') {
      if (!STRUMS[d.pattern]) err(w, 'unknown strum');
      for (const c of d.chords) if (!shapeFor(c)) err(w, 'no shape for ' + c);
      strumSteps(d.chords, d.pattern);
    }
    if (it.kind === 'barre') for (const c of d.chords) if (!barreShape(c, d.family === 'mix' ? 'E' : d.family) && !barreShape(c, 'A')) err(w, 'no barre for ' + c);
    if (it.kind === 'scale') {
      if (!SCALES[d.scale]) err(w, 'unknown scale');
      for (const k of d.keys) pc(k);
    }
    if (it.kind === 'lick' && !LICKS[d.lick]) err(w, 'unknown lick');
    if (it.kind === 'melody' && !MELODIES[d.melody]) err(w, 'unknown melody');
    if (it.kind === 'prog' && !PROGRESSIONS[d.prog]) err(w, 'unknown progression');
    if (it.kind === 'ear') {
      if (d.type === 'interval') for (const s of d.set) if (!INTERVALS.find((x) => x.semis === s)) err(w, 'unknown interval ' + s);
      if (d.type === 'prog') for (const p of d.set) if (!PROGRESSIONS[p]) err(w, 'unknown progression ' + p);
      if (d.type === 'sing') for (const l of d.set) if (!LICKS[l]) err(w, 'unknown lick ' + l);
      if (d.type === 'degree') for (const r of d.set) if (![...DIATONIC_MAJOR, ...BORROWED].some((x) => x.rn === r)) err(w, 'unknown numeral ' + r);
    }
  }
  // Prerequisites: acyclic, so every item is reachable
  const state = {};
  const visit = (id, stack = []) => {
    if (state[id] === 2) return;
    if (state[id] === 1) return err('item ' + id, 'prerequisite cycle: ' + [...stack, id].join(' → '));
    state[id] = 1;
    for (const p of ITEM_BY_ID[id].prereq || []) visit(p, [...stack, id]);
    state[id] = 2;
  };
  ITEMS.forEach((it) => visit(it.id));
  // Milestones
  const where = {};
  MILESTONES.forEach((m, i) =>
    m.items.forEach((id) => {
      if (!ITEM_BY_ID[id]) return err('milestone ' + m.id, 'unknown item ' + id);
      if (id in where) err('milestone ' + m.id, id + ' is already in ' + MILESTONES[where[id]].id);
      where[id] = i;
    }),
  );
  MILESTONES.forEach((m, i) =>
    m.items.forEach((id) => {
      for (const p of ITEM_BY_ID[id]?.prereq || []) if (where[p] > i) err('milestone ' + m.id, `${id} needs ${p}, which belongs to a later milestone`);
    }),
  );
  if (MILESTONES.filter((m) => m.isGoal).length !== 1) err('milestones', 'exactly one goal milestone');
  // Placement
  for (const ids2 of Object.values(PLACEMENT.skip)) for (const id of ids2) if (!ITEM_BY_ID[id]) err('placement', 'unknown item ' + id);
  for (const id of PLACEMENT.tests) if (!ITEM_BY_ID[id]) err('placement', 'unknown test ' + id);
  // Every cheat code is used
  const used = new Set(ITEMS.map((i) => i.cheat).filter(Boolean));
  for (const id of Object.keys(CHEATS)) if (!used.has(id)) err('cheat ' + id, 'never shown');
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  globalThis.window = globalThis.window || {};
  const errors = audit();
  if (errors.length) {
    console.error(errors.map((e) => '✗ ' + e).join('\n'));
    console.error(`\n${errors.length} problem(s).`);
    process.exit(1);
  }
  console.log(`✓ Content audit passed: ${Object.keys(SHAPES).length} shapes, 12 keys × ${Object.values(BARRES).reduce((a, b) => a + Object.keys(b).length - 1, 0)} barre forms, ${Object.keys(PICKS).length} picking patterns, ${Object.keys(PROGRESSIONS).length} progressions × ${FRIENDLY_KEYS.length} keys, ${Object.keys(LICKS).length + Object.keys(MELODIES).length} licks/melodies, ${ITEMS.length} items, ${MILESTONES.length} milestones.`);
}
