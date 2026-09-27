// Moves: ways to get from one chord to the next that make the change sound deliberate.
// Every move is generated from theory for the actual shapes you play, then rendered as tab + playback.
import { pc, noteName, usesFlats, parseChord, chordTones, fretMidi, TUNING, SCALES } from './theory.js';
import { shapeFor, roleStrings, SHAPES, DIATONIC_ROMAN } from './content.js';

export const MOVE_TYPES = {
  walk: { name: 'Bass walk', tag: 'walk', how: 'Stop strumming for a beat or two and let your thumb walk the bass notes of the scale into the next chord’s root. The chord shape can stay held until the last moment.' },
  approach: { name: 'Chromatic approach', tag: 'approach', how: 'One note a half step below the next chord’s root, on the last beat. It is not in the key, which is why it pulls so hard.' },
  inversion: { name: 'Inversion bridge', tag: 'inversion', how: 'Play a chord with a different note in the bass (a slash chord) so the bass line moves in steps instead of jumping.' },
  passing: { name: 'Passing chord', tag: 'passing', how: 'Slip one extra chord from the key in between, for the last two beats. It fills the gap between two chords that are far apart.' },
  secdom: { name: 'Borrowed pull', tag: 'dominant', how: 'Play the dominant 7th of the chord you are going to, just before it. It borrows one note from outside the key that leans into the target.' },
  sus: { name: 'Sus flick', tag: 'sus', how: 'Add a finger for the sus4 on beat 2 and lift it off on beat 3. The chord breathes before it moves on.' },
  cliche: { name: 'Line cliché', tag: 'cliché', how: 'Hold the chord and let one inner note slide down a half step at a time. Film-score drama with almost no hand movement.' },
  anchor: { name: 'Anchor voicings', tag: 'anchor', how: 'Swap both chords for versions that share the same top notes (ring and pinky on fret 3 of the B and e strings). Only the bass moves, so the change sounds joined up.' },
  fill: { name: 'Melodic fill', tag: 'fill', how: 'On the last two beats, run four notes down the top strings and land on the next chord’s top note. The listener hears a tune, not a chord change.' },
};

const BASS_LO = 40;
const BASS_HI = 57;

function scaleOf(key) {
  return SCALES.major.steps.map((s) => (s + pc(key)) % 12);
}
const inScale = (key, m) => scaleOf(key).includes(((m % 12) + 12) % 12);
const bassMidi = (shape) => {
  const s = shape.frets.findIndex((f) => f >= 0);
  return fretMidi(s, shape.frets[s]);
};
const topMidi = (shape) => {
  let s = 5;
  while (s >= 0 && shape.frets[s] < 0) s--;
  return fretMidi(s, shape.frets[s]);
};

// Where to play a bass note: lowest string, frets 0-4, preferring to stay near the previous note.
export function bassPos(m, prev) {
  const opts = [];
  for (let s = 0; s <= 3; s++) {
    const f = m - TUNING[s];
    if (f >= 0 && f <= 4) opts.push({ s, f });
  }
  if (!opts.length) return null;
  if (prev) opts.sort((a, b) => Math.abs(a.s - prev.s) * 2 + a.f - (Math.abs(b.s - prev.s) * 2 + b.f));
  return opts[0];
}

// Where to play a melody note on the top strings, open position.
function topPos(m) {
  for (const s of [5, 4, 3]) {
    const f = m - TUNING[s];
    if (f >= 0 && f <= 4) return { s, f };
  }
  return null;
}

function scaleWalk(key, from, to) {
  // Scale notes strictly between two MIDI notes, in order of travel.
  const out = [];
  const dir = Math.sign(to - from);
  if (!dir) return out;
  for (let m = from + dir; m !== to; m += dir) if (inScale(key, m)) out.push(m);
  return out;
}

function scaleNeighbours(key, m, dir, n) {
  // The n scale notes next to m, going away from it in direction dir (returned in playing order toward m).
  const out = [];
  let x = m;
  while (out.length < n) {
    x += dir;
    if (x < BASS_LO || x > BASS_HI + 10) break;
    if (inScale(key, x)) out.push(x);
  }
  return out.reverse();
}

// ---------------------------------------------------------------------------
// Events: {t (beats), dur, kind: 'bass'|'treble'|'full'|'note', shape, s, f, tech}. Bars are 4/4.
function boomChick(shape, t0, beats) {
  const r = roleStrings(shape.frets);
  const ev = [];
  for (let b = 0; b < beats; b++) {
    const t = t0 + b;
    if (b % 2 === 0) ev.push({ t, dur: 1, kind: 'bass', shape, s: b % 4 === 0 ? r.B : r.A });
    else ev.push({ t, dur: 1, kind: 'treble', shape });
  }
  return ev;
}

function landing(shape, t0) {
  return [{ t: t0, dur: 4, kind: 'full', shape }];
}

function named(sym) {
  const s = shapeFor(sym);
  return s ? { ...s, sym: s.sym || sym, label: sym.replace('(anchor)', '') } : null;
}

function bassNotes(midis, t0, prevPos) {
  let prev = prevPos;
  return midis.map((m, i) => {
    const p = bassPos(m, prev);
    prev = p;
    return p ? { t: t0 + i, dur: 1, kind: 'note', s: p.s, f: p.f } : null;
  });
}

function make(type, key, from, to, chords, events, extra = {}) {
  const beats = Math.max(...events.map((e) => e.t + e.dur));
  return { id: `${type}:${key}:${from}>${to}${extra.variant ? ':' + extra.variant : ''}`, type, name: extra.name || MOVE_TYPES[type].name, why: extra.why || '', key, from, to, chords, events, beats, chromatic: !!extra.chromatic };
}

// All the moves from chord X to chord Y in a key.
export function generateMoves(key, X, Y) {
  const sx = named(X);
  const sy = named(Y);
  if (!sx || !sy || X === Y) return [];
  const flats = usesFlats(key);
  const bx = bassMidi(sx);
  const by = bassMidi(sy);
  const yRoot = parseChord(sy.sym).root;
  const nn = (m) => noteName(m % 12, flats);
  const moves = [];
  const base = (beats) => boomChick(sx, 0, beats);
  const lab = (x) => x.label || x.sym;

  // 1. Bass walks: the scale notes between the two roots, ending on beat 4.
  const direct = scaleWalk(key, bx, by);
  if (direct.length >= 1) {
    const walk = direct.slice(-3);
    const notes = bassNotes(walk, 4 - walk.length, { s: sx.frets.findIndex((f) => f >= 0) });
    if (notes.every(Boolean)) {
      const up = by > bx;
      moves.push(make('walk', key, X, Y, [lab(sx), lab(sy)], [...base(4 - walk.length), ...notes, ...landing(sy, 4)], { variant: 'direct', name: `Walk ${up ? 'up' : 'down'} into ${lab(sy)}`, why: `Bass ${[nn(bx), ...walk.map(nn)].join(' ')} and land on ${nn(by)}. Each step is a note of ${key} major.` }));
    }
  }
  // The other way round: approach the same root from the opposite side.
  const otherDir = by > bx ? 1 : -1; // come from above if the direct walk went up, and vice versa
  const around = scaleNeighbours(key, by, otherDir, 3).filter((m) => m >= BASS_LO && m <= BASS_HI);
  if (around.length >= 2 && around[0] !== bx) {
    const notes = bassNotes(around, 4 - around.length);
    if (notes.every(Boolean))
      moves.push(make('walk', key, X, Y, [lab(sx), lab(sy)], [...base(4 - around.length), ...notes, ...landing(sy, 4)], { variant: 'around', name: `Walk ${otherDir > 0 ? 'down' : 'up'} into ${lab(sy)}`, why: `Come at ${nn(by)} from ${otherDir > 0 ? 'above' : 'below'}: ${around.map(nn).join(' ')}. Same target, opposite direction.` }));
  }

  // 2. Chromatic approach from a half step below.
  const below = by - 1;
  if (below >= BASS_LO && !inScale(key, below)) {
    const p = bassPos(below);
    if (p) moves.push(make('approach', key, X, Y, [lab(sx), lab(sy)], [...base(3), { t: 3, dur: 1, kind: 'note', s: p.s, f: p.f }, ...landing(sy, 4)], { chromatic: true, name: `Half-step into ${lab(sy)}`, why: `${nn(below)} is not in ${key} major. Played on beat 4 it leans straight into ${nn(by)}.` }));
  }

  // 3. Inversion bridge: a slash chord whose bass sits one scale step before Y's root.
  const bridgeBass = [...new Set([scaleNeighbours(key, by, by > bx ? -1 : 1, 1)[0], scaleNeighbours(key, by, -1, 1)[0], scaleNeighbours(key, by, 1, 1)[0]])].filter((m) => m != null);
  for (const p of bridgeBass) {
    const pName = nn(p);
    const candidates = [];
    if (chordTones(sx.sym).includes(p % 12)) candidates.push(`${sx.sym}/${pName}`);
    for (const d of DIATONIC_ROMAN(key)) if (d !== sx.sym && d !== sy.sym && chordTones(d).includes(p % 12)) candidates.push(parseChord(d).root === p % 12 ? d : `${d}/${pName}`);
    const pick = candidates.map((c) => ({ c, sh: SHAPES[c] ? named(c) : null })).find((x) => x.sh && bassMidi(x.sh) % 12 === p % 12);
    if (pick && !moves.some((m) => m.type === 'inversion' && m.chords[1] === pick.c)) {
      moves.push(make('inversion', key, X, Y, [lab(sx), pick.c, lab(sy)], [...base(2), ...boomChick(pick.sh, 2, 2), ...landing(sy, 4)], { variant: pick.c, name: `Through ${pick.c}`, why: `The bass goes ${nn(bx)} → ${pName} → ${nn(by)} in steps while the chords do the work.` }));
    }
  }

  // 4. Passing chord from the key: the chord whose root is one scale step either side of Y's root.
  for (const side of [-1, 1]) {
    const stepRoot = scaleNeighbours(key, yRoot + 48, side, 1)[0];
    if (stepRoot == null) continue;
    const d = DIATONIC_ROMAN(key).find((c) => parseChord(c).root === stepRoot % 12);
    const sh = d && d !== sx.sym && d !== sy.sym ? named(d) : null;
    if (sh && ['', 'm'].includes(parseChord(d).quality) && !moves.some((m) => m.type === 'passing' && m.chords[1] === d))
      moves.push(make('passing', key, X, Y, [lab(sx), d, lab(sy)], [...base(2), ...boomChick(sh, 2, 2), ...landing(sy, 4)], { variant: d, name: `Pass through ${d}`, why: `${d} is in the key and its root sits a step ${side < 0 ? 'below' : 'above'} ${lab(sy)}’s, so the change slides instead of jumping.` }));
  }

  // 5. Secondary dominant: the V7 of the target.
  const v7 = noteName((yRoot + 7) % 12, flats) + '7';
  const vsh = named(v7);
  if (vsh && v7 !== sx.sym) {
    const lead = (yRoot + 11) % 12; // the leading tone inside the V7
    moves.push(make('secdom', key, X, Y, [lab(sx), v7, lab(sy)], [...base(2), ...boomChick(vsh, 2, 2), ...landing(sy, 4)], { chromatic: !inScale(key, lead), name: `${v7} pulls into ${lab(sy)}`, why: `${v7} is the dominant of ${lab(sy)}. Its ${noteName(lead, flats)} leans a half step up into ${noteName(yRoot, flats)}.` }));
  }

  // 6. Sus flick on the first chord.
  const susSym = sx.sym.replace(/(maj7|m7|7|m)?$/, '') + 'sus4';
  const susSh = SHAPES[susSym] && parseChord(sx.sym).quality === '' ? named(susSym) : null;
  if (susSh) {
    const r = roleStrings(sx.frets);
    moves.push(make('sus', key, X, Y, [lab(sx), susSym, lab(sy)], [{ t: 0, dur: 1, kind: 'bass', shape: sx, s: r.B }, { t: 1, dur: 1, kind: 'treble', shape: susSh }, { t: 2, dur: 1, kind: 'bass', shape: sx, s: r.A }, { t: 3, dur: 1, kind: 'treble', shape: sx }, ...landing(sy, 4)], { name: `Sus flick on ${lab(sx)}`, why: `${susSym} on beat 2, back to ${lab(sx)} on beat 3. The chord breathes before it moves.` }));
  }

  // 7. Line cliché: one inner voice slides down in half steps.
  const q = parseChord(sx.sym);
  const root = noteName(q.root, flats);
  const cliche = q.quality === 'm' ? [sx.sym, root + 'mmaj7', root + 'm7', root + 'm6'] : q.quality === '' ? [sx.sym, root + 'aug', root + '6', root + '7'] : null;
  const clicheShape = (c, i) => (i > 0 && SHAPES[c + '(open)'] ? { ...SHAPES[c + '(open)'], sym: c, label: c } : named(c));
  if (cliche && cliche.slice(1).every((c) => SHAPES[c] || SHAPES[c + '(open)'])) {
    const shapes = cliche.map(clicheShape);
    moves.push(make('cliche', key, X, Y, [...cliche, lab(sy)], [...shapes.flatMap((sh, i) => boomChick(sh, i * 2, 2)), ...landing(sy, 8)], { chromatic: true, name: `Line cliché on ${lab(sx)}`, why: q.quality === 'm' ? `Inside ${root} minor, the root slides ${root} → ${noteName(q.root + 11, flats)} → ${noteName(q.root + 10, flats)} → ${noteName(q.root + 9, flats)}. The rest of the chord stays put.` : `The 5th climbs ${noteName(q.root + 7, flats)} → ${noteName(q.root + 8, flats)} → ${noteName(q.root + 9, flats)} → ${noteName(q.root + 10, flats)} inside the chord, then resolves.` }));
  }

  // 8. Anchor voicings (G-family keys).
  const ANCH = { G: 'G(anchor)', C: 'Cadd9', D: 'Dsus4(anchor)', Em: 'Em7', A: 'A7sus4' };
  if (ANCH[sx.sym] && ANCH[sy.sym]) {
    const ax = named(ANCH[sx.sym]);
    const ay = named(ANCH[sy.sym]);
    moves.push(make('anchor', key, X, Y, [lab(ax), lab(ay)], [...boomChick(ax, 0, 4), ...landing(ay, 4)], { name: `Anchor: ${lab(ax)} to ${lab(ay)}`, why: 'Ring and pinky stay on fret 3 of the B and e strings for both chords. Only your first two fingers move.' }));
  }

  // 9. Melodic fill on the top strings, landing on Y's top note.
  const target = topMidi(sy);
  for (const dirF of [1, -1]) {
    const run = scaleNeighbours(key, target, dirF, 4);
    const pos = run.map(topPos);
    if (pos.every(Boolean) && run.length === 4) {
      const notes = run.map((m, i) => {
        const p = pos[i];
        const prev = pos[i - 1];
        const tech = prev && prev.s === p.s && prev.f > p.f && p.f >= 0 && i % 2 === 1 ? 'p' : prev && prev.s === p.s && prev.f < p.f && i % 2 === 1 ? 'h' : undefined;
        return { t: 2 + i * 0.5, dur: 0.5, kind: 'note', s: p.s, f: p.f, tech };
      });
      const r = roleStrings(sx.frets);
      moves.push(make('fill', key, X, Y, [lab(sx), lab(sy)], [{ t: 0, dur: 1, kind: 'bass', shape: sx, s: r.B }, { t: 1, dur: 1, kind: 'treble', shape: sx }, ...notes, ...landing(sy, 4)], { variant: dirF > 0 ? 'down' : 'up', name: `Fill ${dirF > 0 ? 'down' : 'up'} into ${lab(sy)}`, why: `${run.map(nn).join(' ')} → ${nn(target)}, the top note of ${lab(sy)}. Melody over the change.` }));
      break;
    }
  }
  return moves;
}

// A named move by spec, for curriculum items: {key, from, to, type, variant?}
export function moveBySpec(spec) {
  const all = generateMoves(spec.key, spec.from, spec.to).filter((m) => m.type === spec.type);
  return (spec.variant ? all.find((m) => m.id.endsWith(':' + spec.variant)) : null) || all[0] || null;
}

// The same change with no move, for comparison.
export function plainChange(key, X, Y) {
  const sx = named(X);
  const sy = named(Y);
  if (!sx || !sy) return null;
  return make('walk', key, X, Y, [X, Y], [...boomChick(sx, 0, 4), ...landing(sy, 4)], { name: 'Plain change', why: '' });
}

// Flatten a move to eighth-note columns for tab: [{notes:[{s,f,tech}], chordIdx}]
export function moveColumns(move) {
  const n = Math.round(move.beats * 2);
  const cols = Array.from({ length: n }, (_, i) => ({ notes: [], mark: i % 2 === 0 ? String(((i / 2) % 4) + 1) : '&' }));
  for (const e of move.events) {
    const i = Math.round(e.t * 2);
    if (i >= n) continue;
    cols[i].notes.push(...eventNotes(e));
  }
  return cols;
}

export function eventNotes(e) {
  if (e.kind === 'note') return [{ s: e.s, f: e.f, tech: e.tech }];
  const fr = e.shape.frets;
  if (e.kind === 'bass') return fr[e.s] >= 0 ? [{ s: e.s, f: fr[e.s] }] : [];
  if (e.kind === 'treble') return [3, 4, 5].filter((s) => fr[s] >= 0).map((s) => ({ s, f: fr[s] }));
  return fr.map((f, s) => ({ s, f })).filter((x) => x.f >= 0);
}

// The chord shapes a move uses, in order, deduplicated.
export function moveShapes(move) {
  const seen = new Map();
  for (const e of move.events) if (e.shape && !seen.has(e.shape.sym + e.shape.frets)) seen.set(e.shape.sym + e.shape.frets, e.shape);
  return [...seen.values()];
}

// Common pairs worth knowing in a key: I-IV, I-V, I-vi, vi-IV, IV-V, V-I...
export function suggestedPairs(key) {
  const d = DIATONIC_ROMAN(key);
  return [
    [d[0], d[3]],
    [d[0], d[5]],
    [d[0], d[4]],
    [d[4], d[0]],
    [d[3], d[0]],
    [d[5], d[3]],
    [d[3], d[4]],
    [d[0], d[2]],
  ];
}

