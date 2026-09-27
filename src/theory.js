// Music theory core: notes, scales, chords, the fretboard, voicing search.
// Everything else (content audit, scale positions, chord finder) is derived from here.

export const TUNING = [40, 45, 50, 55, 59, 64]; // MIDI, index 0 = low E (string 6)
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

export function pc(name) {
  const m = /^([A-G])([#b]?)/.exec(name);
  if (!m) throw new Error('Bad note ' + name);
  let v = SHARPS.indexOf(m[1]);
  if (m[2] === '#') v += 1;
  if (m[2] === 'b') v -= 1;
  return (v + 12) % 12;
}

export function noteName(p, preferFlats = false) {
  return (preferFlats ? FLATS : SHARPS)[((p % 12) + 12) % 12];
}

export function usesFlats(keyName) {
  return FLAT_KEYS.has(keyName);
}

export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function fretMidi(string, fret) {
  return TUNING[string] + fret;
}

export const SCALES = {
  minPent: { name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10], degrees: ['1', 'b3', '4', '5', 'b7'] },
  majPent: { name: 'Major pentatonic', steps: [0, 2, 4, 7, 9], degrees: ['1', '2', '3', '5', '6'] },
  blues: { name: 'Blues', steps: [0, 3, 5, 6, 7, 10], degrees: ['1', 'b3', '4', 'b5', '5', 'b7'] },
  major: { name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'] },
  minor: { name: 'Natural minor', steps: [0, 2, 3, 5, 7, 8, 10], degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'] },
  dorian: { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'] },
  mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], degrees: ['1', '2', '3', '4', '5', '6', 'b7'] },
};

// Chord qualities. `opt` = tones that may be left out of a voicing.
export const CHORDS = {
  '': { name: 'major', tones: [0, 4, 7], opt: [7] },
  m: { name: 'minor', tones: [0, 3, 7], opt: [7] },
  '5': { name: 'power', tones: [0, 7], opt: [] },
  '7': { name: 'dominant 7', tones: [0, 4, 7, 10], opt: [7] },
  maj7: { name: 'major 7', tones: [0, 4, 7, 11], opt: [7] },
  m7: { name: 'minor 7', tones: [0, 3, 7, 10], opt: [7] },
  '6': { name: 'major 6', tones: [0, 4, 7, 9], opt: [7] },
  m6: { name: 'minor 6', tones: [0, 3, 7, 9], opt: [7] },
  sus2: { name: 'sus2', tones: [0, 2, 7], opt: [] },
  sus4: { name: 'sus4', tones: [0, 5, 7], opt: [] },
  add9: { name: 'add9', tones: [0, 4, 7, 2], opt: [7] },
  madd9: { name: 'minor add9', tones: [0, 3, 7, 2], opt: [7] },
  '7sus4': { name: '7sus4', tones: [0, 5, 7, 10], opt: [7] },
  maj9: { name: 'major 9', tones: [0, 4, 7, 11, 2], opt: [7] },
  m9: { name: 'minor 9', tones: [0, 3, 7, 10, 2], opt: [7] },
  dim: { name: 'diminished', tones: [0, 3, 6], opt: [] },
  aug: { name: 'augmented', tones: [0, 4, 8], opt: [] },
  m7b5: { name: 'half-diminished', tones: [0, 3, 6, 10], opt: [] },
};

// Parse "F#m7", "Cadd9", "G/B", "Bbmaj7".
export function parseChord(sym) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym.trim());
  if (!m) throw new Error('Bad chord ' + sym);
  const quality = m[2];
  if (!(quality in CHORDS)) throw new Error('Unknown chord quality "' + quality + '" in ' + sym);
  return { root: pc(m[1]), rootName: m[1], quality, bass: m[3] ? pc(m[3]) : null, bassName: m[3] || null };
}

export function chordTones(sym) {
  const c = parseChord(sym);
  return CHORDS[c.quality].tones.map((t) => (c.root + t) % 12);
}

// Frets array: 6 entries low E -> high e, -1 = muted.
export function shapeMidis(frets) {
  const out = [];
  frets.forEach((f, s) => {
    if (f >= 0) out.push(fretMidi(s, f));
  });
  return out;
}

export function shapePcs(frets) {
  return [...new Set(shapeMidis(frets).map((m) => m % 12))];
}

export function bassPc(frets) {
  const ms = shapeMidis(frets);
  return ms.length ? Math.min(...ms) % 12 : null;
}

// Does this shape really spell the chord? Used by the content audit.
export function shapeMatches(frets, sym) {
  const c = parseChord(sym);
  const q = CHORDS[c.quality];
  const want = q.tones.map((t) => (c.root + t) % 12);
  const have = shapePcs(frets);
  if (have.some((p) => !want.includes(p))) return { ok: false, why: 'contains a note outside ' + sym };
  const required = q.tones.filter((t) => !q.opt.includes(t)).map((t) => (c.root + t) % 12);
  const missing = required.filter((p) => !have.includes(p));
  if (missing.length) return { ok: false, why: 'missing ' + missing.map((p) => noteName(p)).join(', ') };
  const expectedBass = c.bass ?? c.root;
  if (bassPc(frets) !== expectedBass) return { ok: false, why: 'lowest note is ' + noteName(bassPc(frets)) + ', expected ' + noteName(expectedBass) };
  return { ok: true };
}

// Name the chord a set of frets makes. Returns best guesses, most likely first.
export function identifyChord(frets, preferFlats = false) {
  const have = shapePcs(frets);
  if (have.length < 2) return [];
  const bass = bassPc(frets);
  const results = [];
  for (let root = 0; root < 12; root++) {
    for (const [q, def] of Object.entries(CHORDS)) {
      const want = def.tones.map((t) => (root + t) % 12);
      if (have.some((p) => !want.includes(p))) continue;
      const required = def.tones.filter((t) => !def.opt.includes(t)).map((t) => (root + t) % 12);
      if (required.some((p) => !have.includes(p))) continue;
      let score = 0;
      if (bass === root) score += 10;
      score -= def.tones.length - have.length; // fewer omitted tones
      score -= ['dim', 'aug', 'm7b5', '7sus4', 'maj9', 'm9', 'm6', '6'].includes(q) ? 1 : 0;
      if (q === '' || q === 'm') score += 1;
      const name = noteName(root, preferFlats) + q + (bass !== root ? '/' + noteName(bass, preferFlats) : '');
      results.push({ name, score, root, quality: q });
    }
  }
  results.sort((a, b) => b.score - a.score);
  const seen = new Set();
  return results.filter((r) => (seen.has(r.name) ? false : seen.add(r.name))).slice(0, 4);
}

// How many fingers does a shape need, assuming a barre on the lowest fretted fret when useful.
export function fingersNeeded(frets) {
  const fretted = frets.map((f, s) => ({ f, s })).filter((x) => x.f > 0);
  if (!fretted.length) return 0;
  const minF = Math.min(...fretted.map((x) => x.f));
  const atMin = fretted.filter((x) => x.f === minF);
  const lowestAtMin = Math.min(...atMin.map((x) => x.s));
  // A barre needs every string from its lowest to string 1 not to be open or muted in between.
  const barreOk = atMin.length > 1 && frets.every((f, s) => s < lowestAtMin || f >= minF);
  const others = fretted.length - atMin.length;
  return barreOk ? others + 1 : fretted.length;
}

export function shapeSpan(frets) {
  const fretted = frets.filter((f) => f > 0);
  if (!fretted.length) return 0;
  return Math.max(...fretted) - Math.min(...fretted);
}

// Search the neck for playable voicings of a chord. Returns shapes sorted by position.
export function findVoicings(sym, { maxFret = 15, limit = 12 } = {}) {
  const c = parseChord(sym);
  const def = CHORDS[c.quality];
  const want = def.tones.map((t) => (c.root + t) % 12);
  const required = def.tones.filter((t) => !def.opt.includes(t)).map((t) => (c.root + t) % 12);
  const bassWant = c.bass ?? c.root;
  const found = [];
  for (let base = 0; base <= maxFret - 3; base++) {
    // options per string: muted, open (only if base is low), or a fret in [base, base+3]
    const opts = TUNING.map((open, s) => {
      const o = [-1];
      if (want.includes(open % 12)) o.push(0);
      for (let f = Math.max(1, base); f <= base + 3; f++) if (want.includes((open + f) % 12)) o.push(f);
      return o;
    });
    const cur = new Array(6);
    const walk = (s) => {
      if (s === 6) {
        const frets = cur.slice();
        const played = frets.filter((f) => f >= 0).length;
        if (played < Math.min(4, def.tones.length + 1) && !(def.tones.length <= 2 && played >= 2)) return;
        // no muted strings in the middle of the voicing
        const first = frets.findIndex((f) => f >= 0);
        const last = 5 - [...frets].reverse().findIndex((f) => f >= 0);
        for (let i = first; i <= last; i++) if (frets[i] < 0) return;
        if (last < 4 && played < 4) return;
        if (bassPc(frets) !== bassWant) return;
        const have = shapePcs(frets);
        if (required.some((p) => !have.includes(p))) return;
        if (fingersNeeded(frets) > 4) return;
        if (shapeSpan(frets) > 3) return;
        const hasOpen = frets.some((f) => f === 0);
        const fretted = frets.filter((f) => f > 0);
        if (hasOpen && fretted.length && Math.max(...fretted) > 4) return; // open strings only ring well with low shapes
        found.push(frets);
        return;
      }
      for (const f of opts[s]) {
        cur[s] = f;
        walk(s + 1);
      }
    };
    walk(0);
  }
  // Deduplicate and score
  const uniq = new Map();
  for (const f of found) uniq.set(f.join(','), f);
  const scored = [...uniq.values()].map((frets) => {
    const played = frets.filter((f) => f >= 0).length;
    const fretted = frets.filter((f) => f > 0);
    const pos = frets.some((f) => f === 0) || !fretted.length ? 0 : Math.min(...fretted);
    let score = played * 2 - fingersNeeded(frets) - shapeSpan(frets);
    if (frets[5] >= 0) score += 1; // top string rings out
    const have = shapePcs(frets);
    if (have.length === want.length) score += 1.5; // complete chord
    return { frets, pos, score };
  });
  // Keep the best voicing per position window
  const byPos = new Map();
  for (const v of scored) {
    const k = v.pos;
    if (!byPos.has(k) || byPos.get(k).score < v.score) byPos.set(k, v);
  }
  let list = [...byPos.values()].sort((a, b) => a.pos - b.pos);
  // Drop weak near-duplicates: within 1 fret of a better voicing
  list = list.filter((v, i) => {
    const near = list.filter((w, j) => j !== i && Math.abs(w.pos - v.pos) <= 1);
    return !near.some((w) => w.score > v.score + 1.5);
  });
  return list.slice(0, limit).map((v) => ({ frets: v.frets, pos: v.pos, label: cagedLabel(v.frets, c.root) }));
}

// Rough CAGED name: which open shape does this voicing resemble (by root string and layout)?
export function cagedLabel(frets, root) {
  const first = frets.findIndex((f) => f >= 0);
  const fretted = frets.filter((f) => f > 0);
  const pos = fretted.length ? Math.min(...fretted) : 0;
  const posName = pos === 0 || frets.some((f) => f === 0) ? 'open' : 'fret ' + pos;
  const rootString = STRING_NAMES[first];
  if (first === 0) {
    // root on 6th: E shape if root at lowest fret, G shape if root is highest fret on 6th
    return (frets[0] === pos || frets[0] === 0 ? 'E shape' : 'G shape') + ', ' + posName;
  }
  if (first === 1) return (frets[1] === pos || frets[1] === 0 ? 'A shape' : 'C shape') + ', ' + posName;
  if (first === 2) return 'D shape, ' + posName;
  return 'root on ' + rootString + ', ' + posName;
}

// Scale positions: walk up the neck N notes per string (2 = pentatonic boxes, 3 = 3-notes-per-string).
export function scalePosition(keyPc, scaleId, position) {
  const steps = SCALES[scaleId].steps;
  const nps = steps.length <= 6 ? 2 : 3;
  const scalePcs = steps.map((s) => (keyPc + s) % 12);
  // Start: the `position`-th scale tone (0-based) on the low E, lowest occurrence at fret >= 0.
  const startPc = scalePcs[position % steps.length];
  let fret = (startPc - TUNING[0] + 120) % 12;
  // In a 6-note scale (blues), use pentatonic box layout plus the blue note added.
  let midi = TUNING[0] + fret;
  const all = [];
  for (let s = 0; s < 6; s++) {
    const onString = [];
    // find next scale note >= midi that is playable on this string
    let m = midi;
    while (onString.length < nps) {
      if (scalePcs.includes(m % 12)) onString.push(m);
      m++;
    }
    for (const n of onString) all.push({ s, f: n - TUNING[s], midi: n });
    // next string starts at the next scale note above the last
    midi = onString[onString.length - 1] + 1;
    while (!scalePcs.includes(midi % 12)) midi++;
    if (midi - TUNING[s + 1 < 6 ? s + 1 : 5] < 0) midi = TUNING[s + 1 < 6 ? s + 1 : 5];
  }
  if (scaleId === 'blues') {
    // add the b5 wherever it falls inside the box span
    const minF = Math.min(...all.map((n) => n.f));
    const maxF = Math.max(...all.map((n) => n.f));
    const b5 = (keyPc + 6) % 12;
    for (let s = 0; s < 6; s++)
      for (let f = minF; f <= maxF; f++) if ((TUNING[s] + f) % 12 === b5 && !all.some((n) => n.s === s && n.f === f)) all.push({ s, f, midi: TUNING[s] + f });
  }
  // If the whole shape sits above fret 12, drop it an octave so it stays in reach.
  const lo = Math.min(...all.map((n) => n.f));
  const shift = lo >= 12 ? -12 : 0;
  return all
    .map((n) => ({ ...n, f: n.f + shift, midi: n.midi + shift, degree: SCALES[scaleId].degrees[SCALES[scaleId].steps.indexOf((n.midi - keyPc + 1200) % 12)] }))
    .sort((a, b) => a.midi - b.midi);
}

export function allScaleNotes(keyPc, scaleId, maxFret = 15) {
  const steps = SCALES[scaleId].steps;
  const out = [];
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= maxFret; f++) {
      const i = steps.indexOf((TUNING[s] + f - keyPc + 1200) % 12);
      if (i >= 0) out.push({ s, f, midi: TUNING[s] + f, degree: SCALES[scaleId].degrees[i] });
    }
  return out;
}

// Diatonic chords of a major key, plus the borrowed chords indie songwriting leans on.
export const DIATONIC_MAJOR = [
  { rn: 'I', off: 0, q: '' },
  { rn: 'ii', off: 2, q: 'm' },
  { rn: 'iii', off: 4, q: 'm' },
  { rn: 'IV', off: 5, q: '' },
  { rn: 'V', off: 7, q: '' },
  { rn: 'vi', off: 9, q: 'm' },
];
export const BORROWED = [
  { rn: 'bVII', off: 10, q: '', why: 'Borrowed from minor. The Oasis/Beatles "lift" chord.' },
  { rn: 'iv', off: 5, q: 'm', why: 'Minor four. Instant bittersweet (Radiohead, The Smiths).' },
  { rn: 'bVI', off: 8, q: '', why: 'Big, cinematic. Great before the V or back to I.' },
  { rn: 'III', off: 4, q: '', why: 'Major three. The "Creep" move: I - III - IV - iv.' },
  { rn: 'II', off: 2, q: '', why: 'Major two. Bright, pushes to V.' },
];

export function romanToChord(keyName, rn) {
  const key = pc(keyName);
  const flats = usesFlats(keyName);
  const all = [...DIATONIC_MAJOR, ...BORROWED];
  const d = all.find((x) => x.rn === rn);
  if (!d) throw new Error('Unknown numeral ' + rn);
  return noteName((key + d.off) % 12, flats) + d.q;
}

// Keys you can play with open chords, and the capo trick to get other keys.
export const OPEN_KEYS = ['C', 'G', 'D', 'A', 'E'];
export function capoFor(targetKey) {
  const t = pc(targetKey);
  const options = OPEN_KEYS.map((k) => ({ shapes: k, capo: (t - pc(k) + 12) % 12 })).filter((o) => o.capo <= 7);
  return options.sort((a, b) => a.capo - b.capo);
}

export function transposeSym(sym, semis, preferFlats = false) {
  const c = parseChord(sym);
  const r = noteName((c.root + semis + 12) % 12, preferFlats);
  const b = c.bass != null ? '/' + noteName((c.bass + semis + 12) % 12, preferFlats) : '';
  return r + c.quality + b;
}

export const INTERVALS = [
  { semis: 1, name: 'minor 2nd', hint: 'Jaws' },
  { semis: 2, name: 'major 2nd', hint: 'Happy Birthday (first two notes)' },
  { semis: 3, name: 'minor 3rd', hint: 'Smoke on the Water (first two)' },
  { semis: 4, name: 'major 3rd', hint: 'Kumbaya' },
  { semis: 5, name: 'perfect 4th', hint: 'Here Comes the Bride' },
  { semis: 6, name: 'tritone', hint: 'The Simpsons' },
  { semis: 7, name: 'perfect 5th', hint: 'Twinkle Twinkle' },
  { semis: 8, name: 'minor 6th', hint: 'The Entertainer (the jump up)' },
  { semis: 9, name: 'major 6th', hint: 'My Bonnie Lies Over the Ocean' },
  { semis: 10, name: 'minor 7th', hint: 'Somewhere (There’s a Place for Us)' },
  { semis: 11, name: 'major 7th', hint: 'Take On Me (chorus leap)' },
  { semis: 12, name: 'octave', hint: 'Somewhere Over the Rainbow' },
];
