// Everything the app teaches. Shapes, licks and melodies here are audited by scripts/check-content.mjs.
import { pc, parseChord, noteName, usesFlats, SCALES, TUNING } from './theory.js';

// ---------------------------------------------------------------------------
// Chord shapes. frets: low E -> high e, -1 muted. fingers: 0 open/none, 1-4, T thumb.
export const SHAPES = {
  C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  Cadd9: { frets: [-1, 3, 2, 0, 3, 3], fingers: [0, 2, 1, 0, 3, 4], note: 'Britpop anchor: ring + pinky stay on the 3rd fret.' },
  Cmaj7: { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  'C/G': { frets: [3, 3, 2, 0, 1, 0], fingers: [4, 3, 2, 0, 1, 0] },
  G: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  'G(anchor)': { sym: 'G', frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4], note: 'G with the anchor: B and e strings at fret 3.' },
  'G/B': { frets: [-1, 2, 0, 0, 0, 3], fingers: [0, 1, 0, 0, 0, 3] },
  G6: { frets: [3, 2, 0, 0, 0, 0], fingers: [2, 1, 0, 0, 0, 0] },
  // Slash chords for walk-downs: the bass note steps down while the chord stays put.
  'D/F#': { frets: [2, 0, 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3] },
  'A/C#': { frets: [-1, 4, 2, 2, 2, 0], fingers: [0, 4, 1, 2, 3, 0] },
  'E/G#': { frets: [4, 2, 2, 1, 0, 0], fingers: [4, 2, 3, 1, 0, 0] },
  'B/D#': { frets: [-1, 6, 4, 4, 4, -1], fingers: [0, 4, 1, 2, 3, 0] },
  'C/E': { frets: [0, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  'Am/G': { frets: [3, 0, 2, 2, 1, 0], fingers: [4, 0, 2, 3, 1, 0] },
  'G/F#': { frets: [2, -1, 0, 0, 0, 3], fingers: [1, 0, 0, 0, 0, 4] },
  'Em/D': { frets: [-1, -1, 0, 0, 0, 0], fingers: [0, 0, 0, 0, 0, 0] },
  'F/C': { frets: [-1, 3, 3, 2, 1, 1], fingers: [0, 3, 4, 2, 1, 1] },
  // Dominant 7ths for passing chords (secondary dominants).
  G7: { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  C7: { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  Gsus4: { frets: [3, -1, 0, 0, 1, 3], fingers: [2, 0, 0, 0, 1, 3] },
  Gmaj7: { frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1] },
  Emaj7: { frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
  D7sus4: { frets: [-1, -1, 0, 2, 1, 3], fingers: [0, 0, 0, 2, 1, 4] },
  E7sus4: { frets: [0, 2, 0, 2, 0, 0], fingers: [0, 2, 0, 3, 0, 0] },
  // Line clichés: one inner note slides down a semitone at a time.
  Ammaj7: { frets: [-1, 0, 2, 1, 1, 0], fingers: [0, 0, 3, 1, 2, 0] },
  Am6: { frets: [-1, 0, 2, 2, 1, 2], fingers: [0, 0, 2, 3, 1, 4] },
  Emmaj7: { frets: [0, 2, 1, 0, 0, 0], fingers: [0, 2, 1, 0, 0, 0] },
  Em6: { frets: [0, 2, 2, 0, 2, 0], fingers: [0, 1, 2, 0, 3, 0] },
  Dmmaj7: { frets: [-1, -1, 0, 2, 2, 1], fingers: [0, 0, 0, 2, 3, 1] },
  Dm7: { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  Dm6: { frets: [-1, -1, 0, 2, 0, 1], fingers: [0, 0, 0, 2, 0, 1] },
  Daug: { frets: [-1, -1, 0, 3, 3, 2], fingers: [0, 0, 0, 2, 3, 1] },
  D6: { frets: [-1, -1, 0, 2, 0, 2], fingers: [0, 0, 0, 1, 0, 2] },
  Aaug: { frets: [-1, 0, 3, 2, 2, 1], fingers: [0, 0, 4, 2, 3, 1] },
  A6: { frets: [-1, 0, 2, 2, 2, 2], fingers: [0, 0, 1, 1, 1, 1] },
  D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  Dsus2: { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
  Dsus4: { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
  'Dsus4(anchor)': { sym: 'Dsus4', frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },
  Dmaj7: { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1] },
  D7: { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  A: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  Asus2: { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  Asus4: { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
  A7sus4: { frets: [-1, 0, 2, 0, 3, 3], fingers: [0, 0, 1, 0, 3, 4], note: 'Anchor fingers again: fret 3 on B and e.' },
  Amaj7: { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
  A7: { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  Am7: { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  Esus4: { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
  E7: { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Em7: { frets: [0, 2, 2, 0, 3, 3], fingers: [0, 1, 2, 0, 3, 4], note: 'The anchor Em7: sounds huge strummed.' },
  Em9: { frets: [0, 2, 0, 0, 0, 2], fingers: [0, 2, 0, 0, 0, 3] },
  'Em7(open)': { sym: 'Em7', frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  F: { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  Fmaj7: { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0], note: 'The lazy F. Sounds prettier than the barre anyway.' },
  Fsus2: { frets: [-1, -1, 3, 0, 1, 1], fingers: [0, 0, 3, 0, 1, 1] },
  Bm: { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1] },
  B7: { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  Bb: { frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 3, 3, 3, 1] },
};

// Movable barre shapes (offsets from the barre fret n). Root on string 6 (E shapes) or 5 (A shapes).
export const BARRES = {
  E: { root: 0, '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], maj7: [0, -1, 1, 1, 0, -1], '5': [0, 2, 2, -1, -1, -1], sus4: [0, 2, 2, 2, 0, 0], '7sus4': [0, 2, 0, 2, 0, 0] },
  A: { root: 1, '': [-1, 0, 2, 2, 2, 0], m: [-1, 0, 2, 2, 1, 0], '7': [-1, 0, 2, 0, 2, 0], m7: [-1, 0, 2, 0, 1, 0], maj7: [-1, 0, 2, 1, 2, 0], sus2: [-1, 0, 2, 2, 0, 0], sus4: [-1, 0, 2, 2, 3, 0], '7sus4': [-1, 0, 2, 0, 3, 0], '5': [-1, 0, 2, 2, -1, -1] },
};

export function barreShape(sym, family) {
  const c = parseChord(sym);
  const fam = BARRES[family];
  const offs = fam[c.quality];
  if (!offs || c.bass != null) return null;
  const openPc = family === 'E' ? 4 : 9;
  let n = (c.root - openPc + 12) % 12;
  if (n === 0) n = 12;
  const frets = offs.map((o) => (o < 0 ? -1 : o + n));
  const fingers = offs.map((o) => (o < 0 ? 0 : o === 0 ? 1 : o + 1));
  return { frets, fingers, barre: n, family };
}

// Pick a shape for any chord symbol: curated open shape, else E/A barre, else null.
export function shapeFor(sym, prefer) {
  if (SHAPES[sym]) return { sym: SHAPES[sym].sym || sym, ...SHAPES[sym] };
  const e = barreShape(sym, 'E');
  const a = barreShape(sym, 'A');
  if (prefer === 'A' && a) return { sym, ...a };
  if (prefer === 'E' && e) return { sym, ...e };
  if (e && a) return e.barre <= a.barre ? { sym, ...e } : { sym, ...a };
  return e ? { sym, ...e } : a ? { sym, ...a } : null;
}

// "Sparkle" alternates: the lift-a-finger embellishments that make open chords sound like a record.
export const SPARKLE = {
  D: ['Dsus4', 'Dsus2'],
  A: ['Asus4', 'Asus2'],
  C: ['Cadd9', 'Cmaj7'],
  G: ['G(anchor)', 'Gsus4'],
  E: ['Esus4', 'E7'],
  Em: ['Em7', 'Em9'],
  Am: ['Asus2', 'Am7'],
  F: ['Fmaj7', 'Fsus2'],
  Fmaj7: ['Fsus2', 'F'],
  Dm: ['Dsus2', 'Dsus4'],
};

// ---------------------------------------------------------------------------
// Fingerpicking patterns. Each slot is one eighth note (or triplet eighth for 6/8 and 3/4).
// Roles: B bass (the chord's root string), A alternate bass, 3/2/1 = the G, B and e strings.
// Finger: thumb (p) plays B and A; i, m, a play 3, 2, 1.
export const PICKS = {
  thumb: { name: 'Thumb only', slots: [['B'], [], ['A'], [], ['B'], [], ['A'], []], meter: 4, feel: 'The engine. Thumb alternates, nothing else. Make it boring.' },
  boom: { name: 'Boom-chick', slots: [['B'], [], ['3', '2', '1'], [], ['A'], [], ['3', '2', '1'], []], meter: 4, feel: 'Thumb on the beat, three fingers pluck together on 2 and 4.' },
  travis: { name: 'Basic Travis', slots: [['B'], ['2'], ['A'], ['1'], ['B'], ['2'], ['A'], ['1']], meter: 4, feel: 'Thumb on every beat, fingers in the gaps. The folk sound.' },
  pinch: { name: 'Pinch Travis', slots: [['B', '1'], ['2'], ['A'], ['1'], ['B'], ['2'], ['A'], ['1']], meter: 4, feel: 'Pinch thumb and ring together on beat 1. Adds a downbeat sparkle.' },
  syncop: { name: 'Syncopated Travis', slots: [['B', '1'], ['2'], ['A'], ['1'], ['B'], ['2'], ['A', '1'], ['2']], meter: 4, feel: 'The pinch lands on the "and" before bar end. Pushes the groove forward.' },
  arp: { name: 'Arpeggio up', slots: [['B'], ['3'], ['2'], ['1'], ['A'], ['3'], ['2'], ['1']], meter: 4, feel: 'p-i-m-a, p-i-m-a. The Radiohead/indie ballad sound.' },
  arpUpDown: { name: 'Up and down', slots: [['B'], ['3'], ['2'], ['1'], ['2'], ['3'], ['A'], ['3'], ['2'], ['1'], ['2'], ['3']], meter: 6, feel: '6/8 rocking pattern. Sounds like a lullaby.' },
  forward: { name: 'Forward roll', slots: [['B'], ['2'], ['1'], ['A'], ['2'], ['1'], ['B'], ['2']], meter: 4, feel: '3+3+2 groupings. Rolls like water.' },
  backward: { name: 'Backward roll', slots: [['1'], ['2'], ['B'], ['1'], ['2'], ['A'], ['1'], ['2']], meter: 4, feel: 'Starts from the top. Great for intros.' },
  jangle: { name: 'Jangle', slots: [['B'], ['3'], ['1'], ['3'], ['2'], ['3'], ['1'], ['3']], meter: 4, feel: 'Keep the G string droning between notes. Johnny Marr territory.' },
  waltz: { name: 'Travis waltz', slots: [['B'], [], ['2', '1'], [], ['A'], ['2', '1']], meter: 3, feel: '3/4 time. One-two-three, one-two-three.' },
  thumbSwitch: { name: 'Travis, bass switch', slots: [['B'], ['2'], ['A'], ['1'], ['F'], ['2'], ['A'], ['1']], meter: 4, feel: 'Every other bass note jumps to the 5th of the chord (on C, the 6th string, fret 3). The Chet Atkins country-folk sound.' },
  doublePinch: { name: 'Double pinch', slots: [['B', '1'], ['2'], ['A', '1'], ['2'], ['B', '1'], ['2'], ['A', '1'], ['3']], meter: 4, feel: 'Pinch on every beat. Big and bright, good for a chorus.' },
  pinchRoll: { name: 'Pinch roll', slots: [['B', '1'], ['3'], ['2'], ['A'], ['1'], ['3'], ['2'], ['1']], meter: 4, feel: 'Pinch, then roll across the strings. Harp-like, Nick Drake territory.' },
  rolling: { name: 'Rolling arpeggio', slots: [['B'], ['3'], ['2'], ['1'], ['2'], ['3'], ['A'], ['3']], meter: 4, feel: 'p-i-m-a-m-i. Smooth and continuous, never stops moving.' },
  slap: { name: 'Thumb slap', slots: [['B'], ['2', '1'], ['X'], ['2', '1'], ['A'], ['2', '1'], ['X'], ['2']], meter: 4, feel: 'Slap the strings with the side of your thumb on 2 and 4. The snare lives in your hand. Singer-songwriter percussive.' },
  sixTravis: { name: '6/8 Travis', slots: [['B'], ['2'], ['1'], ['A'], ['2'], ['1'], ['B'], ['2'], ['1'], ['A'], ['2'], ['1']], meter: 6, feel: 'Travis in two big beats per bar. Folk ballads and waltzy indie.' },
  boomChucka: { name: 'Boom-chucka', slots: [['B'], [], ['3', '2', '1'], ['3', '2', '1'], ['A'], [], ['3', '2', '1'], ['3', '2', '1']], meter: 4, feel: 'Bass, then a down-up flick with the fingers. Carter Family style, very driving.' },
  clawPinch: { name: 'Pinch & brush', slots: [['B', '1'], [], ['A'], ['3', '2', '1'], ['B'], ['2'], ['A'], ['3', '2', '1']], meter: 4, feel: 'Thumb bass with finger brushes. The singer-songwriter hybrid.' },
};

// Map roles to strings for a shape: bass = lowest played string; alt = 2 strings up from string 6, else next string.
export function roleStrings(frets) {
  const b = frets.findIndex((f) => f >= 0);
  let a = b === 0 ? 2 : b + 1;
  if (frets[a] < 0) a = b + 1;
  return { B: b, A: Math.min(a, 3), '3': 3, '2': 4, '1': 5 };
}

// Bass switch: the 5th of the chord on a lower string (C: 6th string fret 3). Falls back to the alternate bass.
export function switchBass(frets) {
  const b = frets.findIndex((f) => f >= 0);
  const fifth = (TUNING[b] + frets[b] + 7) % 12;
  for (let s = b - 1; s >= 0; s--) for (let f = 0; f <= 3; f++) if ((TUNING[s] + f) % 12 === fifth) return { s, f };
  const r = roleStrings(frets);
  return { s: r.A, f: frets[r.A] };
}

// Strumming patterns: 8 or 16 slots. D down, U up, X muted chuck, '.' miss (hand still moves).
export const STRUMS = {
  quarters: { name: 'Four downs', slots: 'D.D.D.D.', feel: 'The Libertines starter kit. Loose wrist.' },
  eighths: { name: 'Driving eighths', slots: 'DDDDDDDD', feel: 'All downstrokes. Royston Club energy. Palm-mute to taste.' },
  faithful: { name: 'Old faithful', slots: 'D.DU.UDU', feel: 'Down, down-up, up-down-up. Fits most songs ever written.' },
  push: { name: 'The push', slots: 'D.DU.U.U', feel: 'Leaves beat 4 hanging so the next chord arrives early.' },
  chuck: { name: 'Chuck', slots: 'D.XU.UXU', feel: 'Mute the strings with your palm on 2 and 4. Instant snare.' },
  sixeight: { name: '6/8 sway', slots: 'D.DUDU', feel: 'Two big beats per bar. Ballads and waltzy indie.' },
  britpop: { name: 'Britpop 16ths', slots: 'D.DUD.DUD.DUDUDU', feel: 'Arm never stops. Accent the downs. Oasis-shaped.' },
  funk: { name: 'Muted sixteenths', slots: 'DUXUDXDUXUDUXUDU', feel: 'Scratchy 16ths with chucks. 1975 funk-pop.' },
};

// ---------------------------------------------------------------------------
// Progressions in Roman numerals (resolved per key by romanChord below).
export const PROGRESSIONS = {
  four: { name: 'The four chords', rn: ['I', 'V', 'vi', 'IV'], vibe: 'Every pop song. Warm and familiar.' },
  sadfour: { name: 'Sad four', rn: ['vi', 'IV', 'I', 'V'], vibe: 'Same chords starting on the minor. Instantly wistful.' },
  britpop: { name: 'Britpop lift', rn: ['I', 'bVII', 'IV', 'I'], vibe: 'The flat seven. Swagger. Oasis, Beatles.' },
  creep: { name: 'Major three', rn: ['I', 'III', 'IV', 'iv'], vibe: 'Radiohead’s bittersweet move. Major three, then IV turns minor.' },
  bittersweet: { name: 'Bittersweet four', rn: ['I', 'IV', 'iv', 'I'], vibe: 'The IV goes minor. Sounds like remembering something.' },
  fifties: { name: 'Jangle loop', rn: ['I', 'vi', 'IV', 'V'], vibe: 'Doo-wop bones. With ringing strings it goes full Smiths.' },
  royal: { name: 'Dreamy lift', rn: ['IVmaj7', 'V', 'iii7', 'vi'], vibe: 'Starts away from home. Floaty 1975 energy.' },
  folk: { name: 'Folk turnaround', rn: ['I', 'IV', 'I', 'V'], vibe: 'Campfire simple. Great for learning a pattern.' },
  minorloop: { name: 'Minor epic', rn: ['vi', 'V', 'IV', 'V'], vibe: 'Stadium indie. Walks down from the minor and back up.' },
  descent: { name: 'Walk-down', rn: ['I', 'V/7', 'vi', 'IV'], vibe: 'Bass steps down a note at a time. Pure songwriter.' },
  mixo: { name: 'Two-chord vamp', rn: ['I', 'bVII'], vibe: 'Two chords, forever. Perfect for noodling over.' },
  anchor: { name: 'Anchor loop', rn: ['vi7', 'I', 'Vsus4', 'II7sus4'], vibe: 'Ring and pinky never move. The big britpop acoustic sound.' },
  andalusian: { name: 'Spanish descent', rn: ['vi', 'V', 'IV', 'III'], vibe: 'Steps down to a major III. Dark, dramatic, flamenco-ish.' },
  canon: { name: 'The Canon', rn: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'], vibe: 'Pachelbel. The bass walks down in steps; half of all wedding songs.' },
  epic: { name: 'Epic lift', rn: ['bVI', 'bVII', 'I'], vibe: 'Two borrowed chords climbing home. Instant stadium ending.' },
  dream: { name: 'Dream vamp', rn: ['Imaj7', 'IVmaj7'], vibe: 'Two major 7ths rocking back and forth. Floaty and unresolved.' },
  circle: { name: 'Circle home', rn: ['vi', 'ii', 'V', 'I'], vibe: 'Each chord falls a fifth to the next. Pulls you home every time.' },
  twofive: { name: 'Soft jazz', rn: ['ii7', 'V7', 'Imaj7'], vibe: 'The jazz cadence with open-chord shapes. Sounds expensive.' },
  blues: { name: '12-bar blues', rn: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'], vibe: 'Where soloing grew up.' },
};

const DEG = [0, 2, 4, 5, 7, 9, 11];
const RN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// "IVmaj7" in G -> "Cmaj7". "V/7" = V with the 7th degree of the key in the bass (G/B in C).
export function romanChord(keyName, token) {
  const key = pc(keyName);
  const flats = usesFlats(keyName) || /^b/.test(token);
  if (token === 'V/7') {
    return noteName(key + 7, flats) + '/' + noteName(key + 11, flats);
  }
  const m = /^(b?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(token);
  if (!m) throw new Error('Bad numeral ' + token);
  const upper = m[2] === m[2].toUpperCase();
  const deg = RN.indexOf(m[2].toUpperCase());
  const root = (key + DEG[deg] - (m[1] ? 1 : 0) + 12) % 12;
  let q = m[3];
  if (!upper) q = q === '' ? 'm' : q === '7' ? 'm7' : q.startsWith('m') ? q : 'm' + q;
  return noteName(root, flats) + q;
}

export function DIATONIC_ROMAN(key) {
  return ['I', 'ii', 'iii', 'IV', 'V', 'vi'].map((rn) => romanChord(key, rn));
}

export function progressionChords(progId, keyName) {
  return PROGRESSIONS[progId].rn.map((t) => romanChord(keyName, t));
}

// Keys that work with open chords, so progressions stay in lazy territory.
export const FRIENDLY_KEYS = ['G', 'C', 'D', 'A', 'E'];

// ---------------------------------------------------------------------------
// Licks and melodies as tab. n: [string(0=low E), fret, beats, technique?]
// technique: h hammer-on, p pull-off, s slide into, b bend up a whole step.
export const LICKS = {
  walkupGC: { name: 'Walk-up G to C', key: 'G', scale: 'major', n: [[0, 3, 1], [1, 0, 1], [1, 2, 1], [1, 3, 1]], use: 'Bass notes that lead from G to C. Drop it in on beat 4.' },
  walkdownCAm: { name: 'Walk-down C to Am', key: 'C', scale: 'major', n: [[1, 3, 1], [1, 2, 1], [1, 0, 2]], use: 'C, then B, then A. The classic songwriter move.' },
  sparkleD: { name: 'D sparkle', key: 'D', scale: 'major', n: [[2, 0, 0.5], [5, 0, 0.5], [5, 2, 0.5, 'h'], [4, 3, 0.5], [5, 3, 0.5], [5, 2, 0.5, 'p'], [4, 3, 1]], use: 'Hammer onto the D chord from the open e. Every folk song ever.' },
  hammerC: { name: 'C hammer-on fill', key: 'C', scale: 'major', n: [[1, 3, 0.5], [2, 0, 0.5], [2, 2, 0.5, 'h'], [3, 0, 0.5], [4, 1, 1]], use: 'Hammer onto the D string inside a C chord.' },
  boxRun: { name: 'Box 1 run down', key: 'A', scale: 'minPent', n: [[5, 8, 0.5], [5, 5, 0.5], [4, 8, 0.5], [4, 5, 0.5], [3, 7, 0.5], [3, 5, 0.5], [2, 7, 0.5], [2, 5, 0.5]], use: 'The first thing everyone plays in box 1. Now you can too.' },
  bendCry: { name: 'The cry', key: 'A', scale: 'minPent', n: [[3, 7, 1, 'b'], [3, 7, 0.5], [4, 5, 0.5], [3, 7, 0.5], [3, 5, 0.5], [2, 7, 1]], use: 'Bend the G string up a whole step, let it back down, run home.' },
  majSweet: { name: 'Sweet major', key: 'G', scale: 'majPent', n: [[4, 3, 0.5], [4, 5, 0.5], [5, 3, 0.5], [5, 5, 0.5], [5, 3, 0.5], [4, 5, 0.5], [4, 3, 0.5], [3, 4, 0.5]], use: 'Major pentatonic on the top strings. Happy, not bluesy.' },
  slideHome: { name: 'Slide home', key: 'A', scale: 'minPent', n: [[3, 5, 0.5], [3, 7, 0.5, 's'], [4, 5, 1], [4, 8, 0.5], [4, 5, 0.5], [3, 7, 1]], use: 'Slide the G string from 5 to 7, then circle round the root.' },
  doubleHammer: { name: 'Hammer triplets', key: 'E', scale: 'minPent', n: [[3, 0, 0.33], [3, 2, 0.33, 'h'], [2, 2, 0.34], [2, 0, 0.33], [2, 2, 0.33, 'h'], [1, 2, 0.34], [1, 0, 1]], use: 'Open E minor pentatonic. Free-sounding runs with no fretting stretch.' },
  targetFill: { name: 'Chord-tone fill', key: 'G', scale: 'major', n: [[4, 0, 0.5], [4, 1, 0.5], [4, 3, 0.5], [5, 0, 0.5], [5, 3, 2]], use: 'B, C, D, E, G. Ends on the root, so it lands wherever G comes back.' },
};

export const MELODIES = {
  twinkle: { name: 'Twinkle Twinkle', key: 'C', scale: 'major', n: [[1, 3, 1], [1, 3, 1], [3, 0, 1], [3, 0, 1], [3, 2, 1], [3, 2, 1], [3, 0, 2], [2, 3, 1], [2, 3, 1], [2, 2, 1], [2, 2, 1], [2, 0, 1], [2, 0, 1], [1, 3, 2]], use: 'Learn it by ear first. The first melody that feels like a melody.' },
  ode: { name: 'Ode to Joy', key: 'C', scale: 'major', n: [[5, 0, 1], [5, 0, 1], [5, 1, 1], [5, 3, 1], [5, 3, 1], [5, 1, 1], [5, 0, 1], [4, 3, 1], [4, 1, 1], [4, 1, 1], [4, 3, 1], [5, 0, 1], [5, 0, 1.5], [4, 3, 0.5], [4, 3, 2]], use: 'Almost all steps, no leaps. Great first ear-to-fretboard test.' },
  grace: { name: 'Amazing Grace', key: 'G', scale: 'major', n: [[2, 0, 1], [3, 0, 2], [4, 0, 0.5], [3, 0, 0.5], [4, 0, 2], [3, 2, 1], [3, 0, 2], [2, 2, 1], [2, 0, 2], [2, 0, 1], [3, 0, 2], [4, 0, 0.5], [3, 0, 0.5], [4, 0, 2], [3, 2, 1], [4, 3, 3]], use: 'Waltz time. Sing it while you find it.' },
};

// ---------------------------------------------------------------------------
// Cheat codes: the minimum theory, each unlocking something playable.
export const CHEATS = {
  thumb: { title: 'Your thumb is the drummer', body: 'In Travis picking the thumb never stops. It alternates between two bass strings on every beat while the fingers add notes in between. Get the thumb on autopilot first. Everything else hangs off it.', tip: 'Say "boom, boom, boom, boom" out loud while your thumb plays. If you can talk, it is automatic.' },
  pima: { title: 'p, i, m, a', body: 'Thumb (p) plays the bass strings. Index (i) takes the G string, middle (m) the B, ring (a) the high e. One finger per string means you never have to think about which finger to use.', tip: 'Rest your pinky on the guitar top below the high e. It anchors the hand.' },
  sparkle: { title: 'Sparkle chords', body: 'Lift a finger or add one to an open chord and you get sus2, sus4, add9 or maj7. Flicking between the plain chord and its sparkle version, mid-bar, is 80% of why fingerpicked indie sounds pretty.', tip: 'D chord: add your pinky on e3 (Dsus4), or lift your middle finger (Dsus2).' },
  anchor: { title: 'The anchor fingers', body: 'Keep your ring and pinky planted on fret 3 of the B and e strings and move only the bass notes: G, Cadd9, Dsus4, Em7, A7sus4. The top notes drone, so the changes all sound joined up. That is the britpop acoustic sound.', tip: 'Try Em7 → G → Dsus4 → A7sus4, strumming the britpop 16ths.' },
  numbers: { title: 'Numbers, not letters', body: 'Songs are chord numbers, not chord names. In G: G is I, Am is ii, Bm is iii, C is IV, D is V, Em is vi. Learn a progression as numbers and you can play it in any key, or put a capo on and sing it anywhere.', tip: 'Capital = major, lower case = minor. I, IV, V are major; ii, iii, vi are minor.' },
  fourchords: { title: 'The four chords', body: 'I–V–vi–IV powers thousands of songs. Start it on the vi and it sounds sad (vi–IV–I–V). Same four chords, different mood, just by moving where you start.', tip: 'In G: G D Em C. Sad version: Em C G D.' },
  borrowed: { title: 'Borrowed chords', body: 'Steal one chord from the minor key and your progression grows up. The flat seven (F in G major) gives swagger. The minor four (Cm in G) gives heartbreak. The major three (B in G) is the Radiohead twist.', tip: 'In G: G – F – C – G is the britpop lift. G – C – Cm – G is the bittersweet one.' },
  capo: { title: 'The capo is a key changer', body: 'Keep playing the open shapes you know. The capo moves them up. Capo 2 with G shapes gives the key of A. Want a song in B♭? Capo 3 with G shapes. The shapes stay easy, only the key changes.', tip: 'Capo number = how many semitones up from the key of your shapes.' },
  barres: { title: 'Barre shapes are movable', body: 'An E-shape barre has its root on string 6. An A-shape barre has its root on string 5. Find the root note on that string, drop the shape there, done. Two shapes give you every major and minor chord.', tip: 'Bb: string 5, fret 1 (A shape). F#m: string 6, fret 2 (E minor shape).' },
  neckmap: { title: 'The neck map', body: 'Learn just the low E string: E (open), G (3), A (5), B (7), C (8), D (10), E (12). The A string is the same trick: A (open), C (3), D (5), E (7), F (8), G (10). Fill in the gaps with sharps and flats and every other note is a short hop away.', tip: 'Frets 3, 5, 7 and 12 have dots. Use them as landmarks.' },
  octaves: { title: 'Octave shapes', body: 'Same note, one octave up: two strings higher, two frets higher (from strings 6 and 5). From the D and G strings, go two strings up and three frets higher, because the B string is tuned differently.', tip: 'A on string 6 fret 5 = A on string 4 fret 7.' },
  box1: { title: 'Box 1: the minor pentatonic', body: 'Five notes, two per string, in one hand position. Put your index finger on the root (A = string 6 fret 5) and everything fits under your fingers. Nearly every rock and blues solo lives here. Nothing you play in it sounds wrong over a minor progression.', tip: 'Root on string 6 tells you the key. Move the whole box to change key.' },
  relative: { title: 'Same box, happy version', body: 'Slide minor box 1 down three frets and it becomes the major pentatonic. It uses the same shape with a different home note. G major pentatonic = E minor box 1 = string 6, fret 0 to 3. Use it over major progressions and it sounds sweet, not bluesy.', tip: 'G major pentatonic = E minor box 1: open position, or the same shape at fret 12.' },
  tones: { title: 'Chord tones are home', body: 'When the chord changes, land on one of its notes (root, 3rd or 5th) and your noodling suddenly sounds like a melody. Between changes you can wander. Just land somewhere safe on the change.', tip: 'The Jam tab lights up the current chord’s notes. Aim for them on beat 1.' },
  topnote: { title: 'The top note is the melody', body: 'When you fingerpick, whatever you play on the high strings is the melody people hear. Keep the bass going and move one high note around the chord shape. Sparkle chords, hammer-ons and a scale note or two turn picking into a tune.', tip: 'Over a C chord, try the e string at 0, 1 and 3. Three notes, one melody.' },
  walks: { title: 'Bass walks', body: 'Between two chords, your thumb walks the bass up or down the scale into the next root: G, A, B, then C. Keep holding the chord shape if you can; only the bass moves. Put the walk on the last beats of the bar so the new chord lands on beat 1.', tip: 'Count it: G (1), strum (2), A (3), B (4), C lands on the next 1.' },
  slash: { title: 'Slash chords', body: 'G/B means a G chord with B as the lowest note. Slash chords let the bass move in steps while the chords change: C, G/B, Am is just the bass walking C, B, A. It sounds smooth because nothing jumps.', tip: 'G/B: take a normal G and play the A string at fret 2 as the lowest note.' },
  pull: { title: 'Borrowed pull (secondary dominants)', body: 'Any chord can be approached by its own 5th chord with a 7th on it. Going to Am? Play E7 first. Going to Em? B7. That chord borrows one note from outside the key, a half step below the target, and it pulls like a magnet.', tip: 'Find the target, count up five letters, make it a 7th chord: Am → E7, C → G7, F → C7.' },
  cliche: { title: 'The line cliché', body: 'Hold a chord and move just one note inside it down a half step at a time: Am, Am(maj7), Am7, Am6. The rest of the chord stays. It sounds like a film soundtrack and your hand barely moves.', tip: 'On Am, only your ring finger on the G string moves: fret 2, fret 1, open.' },
  approach: { title: 'Approach notes', body: 'The note a half step below any root leans into it, even if it is not in the key. Play it on the last beat before the chord change and the change sounds deliberate.', tip: 'Going to Am? Play G# (6th string, fret 4) on beat 4.' },
  legato: { title: 'Hammer-ons and pull-offs', body: 'Pick once, then make a second note with the fretting hand alone: slam a finger down (hammer-on) or flick it off (pull-off). Smooth, pretty, and it frees the picking hand.', tip: 'Open D string, hammer onto fret 2. Pick once, hear two notes.' },
};

// ---------------------------------------------------------------------------
// Tracks (the four countdowns) and the curriculum.
export const TRACKS = {
  hands: { name: 'Picking & rhythm', short: 'Hands' },
  neck: { name: 'Fretboard & scales', short: 'Neck' },
  ear: { name: 'Ear', short: 'Ear' },
  create: { name: 'Melody & moves', short: 'Moves' },
};

// kind: pick | strum | change | barre | scale | notes | lick | melody | prog | write | ear
// bpm: [start, target]. mins: rough minutes per rep. prereq: item ids. cheat: shown before first rep.
export const ITEMS = [
  // ---- Hands: fingerpicking first (the stated weak spot + want)
  { id: 'pk-thumb', kind: 'pick', track: 'hands', title: 'Thumb autopilot', cheat: 'thumb', bpm: [60, 100], mins: 1.5, data: { pattern: 'thumb', chords: ['C', 'G', 'Am', 'Em'] } },
  { id: 'pk-boom', kind: 'pick', track: 'hands', title: 'Boom-chick', cheat: 'pima', bpm: [60, 100], mins: 1.5, prereq: ['pk-thumb'], data: { pattern: 'boom', chords: ['G', 'C', 'D', 'G'] } },
  { id: 'pk-travis', kind: 'pick', track: 'hands', title: 'Basic Travis', bpm: [55, 95], mins: 2, prereq: ['pk-thumb'], data: { pattern: 'travis', chords: ['C', 'Am', 'F', 'G'] } },
  { id: 'pk-pinch', kind: 'pick', track: 'hands', title: 'Pinch Travis', bpm: [55, 95], mins: 2, prereq: ['pk-travis'], data: { pattern: 'pinch', chords: ['G', 'Em', 'C', 'D'] } },
  { id: 'pk-arp', kind: 'pick', track: 'hands', title: 'Arpeggio up', bpm: [60, 100], mins: 1.5, prereq: ['pk-thumb'], data: { pattern: 'arp', chords: ['Am', 'Fmaj7', 'C', 'G'] } },
  { id: 'pk-sparkle', kind: 'pick', track: 'hands', title: 'Travis with sparkle', cheat: 'sparkle', bpm: [55, 90], mins: 2, prereq: ['pk-travis'], data: { pattern: 'travis', chords: ['D', 'A', 'G', 'D'], sparkle: true } },
  { id: 'pk-syncop', kind: 'pick', track: 'hands', title: 'Syncopated Travis', bpm: [55, 90], mins: 2, prereq: ['pk-pinch'], data: { pattern: 'syncop', chords: ['C', 'G/B', 'Am', 'G'] } },
  { id: 'pk-updown', kind: 'pick', track: 'hands', title: '6/8 up and down', bpm: [50, 80], mins: 1.5, prereq: ['pk-arp'], data: { pattern: 'arpUpDown', chords: ['Em', 'C', 'G', 'D'] } },
  { id: 'pk-forward', kind: 'pick', track: 'hands', title: 'Forward roll', bpm: [55, 90], mins: 1.5, prereq: ['pk-travis'], data: { pattern: 'forward', chords: ['G', 'Cadd9', 'Em7', 'Dsus4'] } },
  { id: 'pk-jangle', kind: 'pick', track: 'hands', title: 'Jangle', bpm: [60, 105], mins: 1.5, prereq: ['pk-arp'], data: { pattern: 'jangle', chords: ['G', 'Em', 'C', 'D'] } },
  { id: 'pk-waltz', kind: 'pick', track: 'hands', title: 'Travis waltz', bpm: [60, 100], mins: 1.5, prereq: ['pk-boom'], data: { pattern: 'waltz', chords: ['G', 'C', 'G', 'D'] } },
  { id: 'pk-backward', kind: 'pick', track: 'hands', title: 'Backward roll', bpm: [55, 90], mins: 1.5, prereq: ['pk-forward'], data: { pattern: 'backward', chords: ['C', 'Am', 'Dm', 'G'] } },
  { id: 'pk-hybrid', kind: 'pick', track: 'hands', title: 'Pinch & brush', bpm: [60, 95], mins: 1.5, prereq: ['pk-pinch'], data: { pattern: 'clawPinch', chords: ['G', 'D', 'Em', 'C'] } },
  { id: 'pk-switch', kind: 'pick', track: 'hands', title: 'Travis with bass switch', bpm: [55, 95], mins: 2, prereq: ['pk-travis'], data: { pattern: 'thumbSwitch', chords: ['C', 'Am', 'D', 'G'] } },
  { id: 'pk-rolling', kind: 'pick', track: 'hands', title: 'Rolling arpeggio', bpm: [60, 100], mins: 1.5, prereq: ['pk-arp'], data: { pattern: 'rolling', chords: ['Cmaj7', 'Fmaj7', 'Am7', 'G'] } },
  { id: 'pk-pinchroll', kind: 'pick', track: 'hands', title: 'Pinch roll', bpm: [55, 90], mins: 1.5, prereq: ['pk-pinch'], data: { pattern: 'pinchRoll', chords: ['D', 'Dsus2', 'G', 'A'] } },
  { id: 'pk-slap', kind: 'pick', track: 'hands', title: 'Thumb slap', bpm: [60, 95], mins: 2, prereq: ['pk-boom'], data: { pattern: 'slap', chords: ['Em', 'C', 'G', 'D'] } },
  { id: 'pk-doublepinch', kind: 'pick', track: 'hands', title: 'Double pinch', bpm: [55, 90], mins: 1.5, prereq: ['pk-pinch'], data: { pattern: 'doublePinch', chords: ['G', 'C', 'Em', 'D'] } },
  { id: 'pk-sixtravis', kind: 'pick', track: 'hands', title: '6/8 Travis', bpm: [50, 80], mins: 1.5, prereq: ['pk-travis'], data: { pattern: 'sixTravis', chords: ['G', 'Em', 'C', 'D'] } },
  { id: 'pk-boomchucka', kind: 'pick', track: 'hands', title: 'Boom-chucka', bpm: [70, 110], mins: 1.5, prereq: ['pk-boom'], data: { pattern: 'boomChucka', chords: ['G', 'C', 'D', 'G'] } },
  // ---- Hands: strumming & changes
  { id: 'st-faithful', kind: 'strum', track: 'hands', title: 'Old faithful strum', bpm: [70, 110], mins: 1, data: { pattern: 'faithful', chords: ['G', 'D', 'Em', 'C'] } },
  { id: 'st-anchor', kind: 'strum', track: 'hands', title: 'Anchor chords', cheat: 'anchor', bpm: [70, 100], mins: 1.5, data: { pattern: 'britpop', chords: ['Em7', 'G(anchor)', 'Dsus4(anchor)', 'A7sus4'] } },
  { id: 'st-push', kind: 'strum', track: 'hands', title: 'The push', bpm: [70, 110], mins: 1, prereq: ['st-faithful'], data: { pattern: 'push', chords: ['C', 'G', 'Am', 'F'] } },
  { id: 'st-chuck', kind: 'strum', track: 'hands', title: 'Chuck strum', bpm: [70, 100], mins: 1.5, prereq: ['st-faithful'], data: { pattern: 'chuck', chords: ['Em', 'C', 'G', 'D'] } },
  { id: 'st-sixeight', kind: 'strum', track: 'hands', title: '6/8 sway', bpm: [50, 80], mins: 1, data: { pattern: 'sixeight', chords: ['C', 'Am', 'F', 'G'] } },
  { id: 'st-eighths', kind: 'strum', track: 'hands', title: 'Driving downstrokes', bpm: [100, 150], mins: 1, data: { pattern: 'eighths', chords: ['A', 'E', 'F#m', 'D'] } },
  { id: 'st-funk', kind: 'strum', track: 'hands', title: 'Muted sixteenths', bpm: [60, 95], mins: 1.5, prereq: ['st-chuck'], data: { pattern: 'funk', chords: ['Fmaj7', 'Em7', 'Dm', 'Cmaj7'] } },
  { id: 'ch-abarre', kind: 'barre', track: 'hands', title: 'A-shape barre', cheat: 'barres', bpm: [50, 90], mins: 1.5, data: { family: 'A', chords: ['C', 'D', 'Bb', 'Bm'] } },
  { id: 'ch-ebarre', kind: 'barre', track: 'hands', title: 'E-shape barre, anywhere', bpm: [60, 100], mins: 1, data: { family: 'E', chords: ['F', 'G', 'F#m', 'Am'] } },
  { id: 'ch-mixbarre', kind: 'barre', track: 'hands', title: 'E and A barres mixed', bpm: [50, 90], mins: 1.5, prereq: ['ch-abarre'], data: { family: 'mix', chords: ['F', 'Bb', 'C', 'Dm'] } },

  // ---- Neck: fretboard + scales
  { id: 'nt-e', kind: 'notes', track: 'neck', title: 'Notes on string 6', cheat: 'neckmap', bpm: [0, 0], mins: 1, data: { strings: [0], maxFret: 12 } },
  { id: 'nt-a', kind: 'notes', track: 'neck', title: 'Notes on string 5', bpm: [0, 0], mins: 1, prereq: ['nt-e'], data: { strings: [1], maxFret: 12 } },
  { id: 'nt-oct', kind: 'notes', track: 'neck', title: 'Octave hop (strings 6, 5, 4)', cheat: 'octaves', bpm: [0, 0], mins: 1, prereq: ['nt-a'], data: { strings: [0, 1, 2], maxFret: 12 } },
  { id: 'nt-all', kind: 'notes', track: 'neck', title: 'Any note, any string', bpm: [0, 0], mins: 1, prereq: ['nt-oct'], data: { strings: [0, 1, 2, 3, 4, 5], maxFret: 12 } },
  { id: 'sc-pent1', kind: 'scale', track: 'neck', title: 'Minor pentatonic, box 1', cheat: 'box1', bpm: [60, 120], mins: 1.5, data: { scale: 'minPent', position: 0, keys: ['A', 'E', 'G', 'D', 'C'] } },
  { id: 'sc-pent2', kind: 'scale', track: 'neck', title: 'Minor pentatonic, box 2', bpm: [60, 120], mins: 1.5, prereq: ['sc-pent1'], data: { scale: 'minPent', position: 1, keys: ['A', 'E', 'G', 'D'] } },
  { id: 'sc-maj-pent', kind: 'scale', track: 'neck', title: 'Major pentatonic (the happy box)', cheat: 'relative', bpm: [60, 120], mins: 1.5, prereq: ['sc-pent1'], data: { scale: 'majPent', position: 0, keys: ['G', 'C', 'D', 'A'] } },
  { id: 'sc-pent3', kind: 'scale', track: 'neck', title: 'Minor pentatonic, box 3', bpm: [60, 120], mins: 1.5, prereq: ['sc-pent2'], data: { scale: 'minPent', position: 2, keys: ['A', 'E', 'G'] } },
  { id: 'sc-major', kind: 'scale', track: 'neck', title: 'Major scale, position 1', bpm: [60, 110], mins: 1.5, prereq: ['sc-maj-pent'], data: { scale: 'major', position: 0, keys: ['G', 'C', 'A', 'F'] } },
  { id: 'sc-blues', kind: 'scale', track: 'neck', title: 'Blues scale, box 1', bpm: [60, 110], mins: 1.5, prereq: ['sc-pent2'], data: { scale: 'blues', position: 0, keys: ['A', 'E', 'G'] } },
  { id: 'sc-pent45', kind: 'scale', track: 'neck', title: 'Minor pentatonic, boxes 4 & 5', bpm: [60, 110], mins: 2, prereq: ['sc-pent3'], data: { scale: 'minPent', position: 3, keys: ['A', 'E', 'G'] } },
  { id: 'sc-dorian', kind: 'scale', track: 'neck', title: 'Dorian (the cool minor)', bpm: [60, 110], mins: 1.5, prereq: ['sc-major'], data: { scale: 'dorian', position: 0, keys: ['A', 'E', 'D'] } },

  // ---- Create: melody, fills, writing
  { id: 'lk-walkup', kind: 'move', track: 'create', title: 'Walk up G to C', cheat: 'walks', bpm: [60, 100], mins: 1, data: { key: 'G', from: 'G', to: 'C', type: 'walk', variant: 'direct' } },
  { id: 'lk-walkdown', kind: 'move', track: 'create', title: 'Walk down C to Am', bpm: [60, 100], mins: 1, data: { key: 'C', from: 'C', to: 'Am', type: 'walk', variant: 'direct' } },
  // ---- Moves: chaining chords so the changes sound deliberate
  { id: 'mv-walk-GEm', kind: 'move', track: 'create', title: 'Walk down G to Em', bpm: [60, 100], mins: 1, prereq: ['lk-walkup'], data: { key: 'G', from: 'G', to: 'Em', type: 'walk', variant: 'direct' } },
  { id: 'mv-walk-CG', kind: 'move', track: 'create', title: 'Walk down C to G', bpm: [60, 100], mins: 1, prereq: ['lk-walkdown'], data: { key: 'C', from: 'C', to: 'G', type: 'walk', variant: 'direct' } },
  { id: 'mv-walk-DG', kind: 'move', track: 'create', title: 'Walk down D to G', bpm: [60, 100], mins: 1, prereq: ['lk-walkup'], data: { key: 'G', from: 'D', to: 'G', type: 'walk', variant: 'direct' } },
  { id: 'mv-walkup-CAm', kind: 'move', track: 'create', title: 'Walk up into Am (E F G)', bpm: [60, 100], mins: 1, prereq: ['lk-walkdown'], data: { key: 'C', from: 'C', to: 'Am', type: 'walk', variant: 'around' } },
  { id: 'mv-walkup-DG', kind: 'move', track: 'create', title: 'Walk up D to G (E F#)', bpm: [60, 100], mins: 1, prereq: ['mv-walk-DG'], data: { key: 'G', from: 'D', to: 'G', type: 'walk', variant: 'around' } },
  { id: 'mv-inv-CAm', kind: 'move', track: 'create', title: 'C – G/B – Am', cheat: 'slash', bpm: [60, 100], mins: 1.5, prereq: ['lk-walkdown'], data: { key: 'C', from: 'C', to: 'Am', type: 'inversion', variant: 'G/B' } },
  { id: 'mv-inv-GC', kind: 'move', track: 'create', title: 'G – G/B – C', bpm: [60, 100], mins: 1.5, prereq: ['mv-inv-CAm'], data: { key: 'G', from: 'G', to: 'C', type: 'inversion', variant: 'G/B' } },
  { id: 'mv-inv-CF', kind: 'move', track: 'create', title: 'C – C/E – F', bpm: [60, 100], mins: 1.5, prereq: ['mv-inv-CAm'], data: { key: 'C', from: 'C', to: 'F', type: 'inversion', variant: 'C/E' } },
  { id: 'mv-inv-GEm', kind: 'move', track: 'create', title: 'G – D/F# – Em', bpm: [60, 100], mins: 1.5, prereq: ['mv-inv-GC'], data: { key: 'G', from: 'G', to: 'Em', type: 'inversion', variant: 'D/F#' } },
  { id: 'mv-sec-CAm', kind: 'move', track: 'create', title: 'C – E7 – Am', cheat: 'pull', bpm: [60, 100], mins: 1.5, prereq: ['lk-walkdown'], data: { key: 'C', from: 'C', to: 'Am', type: 'secdom' } },
  { id: 'mv-sec-GEm', kind: 'move', track: 'create', title: 'G – B7 – Em', bpm: [60, 100], mins: 1.5, prereq: ['mv-sec-CAm'], data: { key: 'G', from: 'G', to: 'Em', type: 'secdom' } },
  { id: 'mv-sec-CF', kind: 'move', track: 'create', title: 'C – C7 – F', bpm: [60, 100], mins: 1.5, prereq: ['mv-sec-CAm'], data: { key: 'C', from: 'C', to: 'F', type: 'secdom' } },
  { id: 'mv-appr-GAm', kind: 'move', track: 'create', title: 'Half-step into Am', cheat: 'approach', bpm: [60, 100], mins: 1, prereq: ['lk-walkdown'], data: { key: 'C', from: 'G', to: 'Am', type: 'approach' } },
  { id: 'mv-appr-CD', kind: 'move', track: 'create', title: 'Half-step into D', bpm: [60, 100], mins: 1, prereq: ['mv-appr-GAm'], data: { key: 'G', from: 'C', to: 'D', type: 'approach' } },
  { id: 'mv-sus-DG', kind: 'move', track: 'create', title: 'Sus flick, D to G', cheat: 'sparkle', bpm: [60, 100], mins: 1, prereq: ['pk-travis'], data: { key: 'G', from: 'D', to: 'G', type: 'sus' } },
  { id: 'mv-sus-AD', kind: 'move', track: 'create', title: 'Sus flick, A to D', bpm: [60, 100], mins: 1, prereq: ['mv-sus-DG'], data: { key: 'D', from: 'A', to: 'D', type: 'sus' } },
  { id: 'mv-cliche-Am', kind: 'move', track: 'create', title: 'Line cliché on Am', cheat: 'cliche', bpm: [55, 90], mins: 1.5, prereq: ['mv-inv-CAm'], data: { key: 'C', from: 'Am', to: 'F', type: 'cliche' } },
  { id: 'mv-cliche-D', kind: 'move', track: 'create', title: 'Line cliché on D', bpm: [55, 90], mins: 1.5, prereq: ['mv-cliche-Am'], data: { key: 'G', from: 'D', to: 'G', type: 'cliche' } },
  { id: 'mv-cliche-Em', kind: 'move', track: 'create', title: 'Line cliché on Em', bpm: [55, 90], mins: 1.5, prereq: ['mv-cliche-Am'], data: { key: 'G', from: 'Em', to: 'C', type: 'cliche' } },
  { id: 'mv-anchor-GC', kind: 'move', track: 'create', title: 'Anchor fingers, G to Cadd9', bpm: [60, 100], mins: 1, prereq: ['st-anchor'], data: { key: 'G', from: 'G', to: 'C', type: 'anchor' } },
  { id: 'mv-fill-GC', kind: 'move', track: 'create', title: 'Melodic fill into C', cheat: 'topnote', bpm: [55, 90], mins: 1.5, prereq: ['lk-walkup'], data: { key: 'G', from: 'G', to: 'C', type: 'fill' } },
  { id: 'mv-fill-DG', kind: 'move', track: 'create', title: 'Melodic fill into G', bpm: [55, 90], mins: 1.5, prereq: ['mv-fill-GC'], data: { key: 'G', from: 'D', to: 'G', type: 'fill' } },
  { id: 'mv-pass-CF', kind: 'move', track: 'create', title: 'Passing chord: C – Em – F', bpm: [60, 100], mins: 1.5, prereq: ['mv-inv-CF'], data: { key: 'C', from: 'C', to: 'F', type: 'passing', variant: 'Em' } },
  { id: 'lk-sparkleD', kind: 'lick', track: 'create', title: 'D sparkle hammer-on', cheat: 'legato', bpm: [60, 100], mins: 1, prereq: ['pk-travis'], data: { lick: 'sparkleD' } },
  { id: 'lk-hammerC', kind: 'lick', track: 'create', title: 'C hammer-on fill', bpm: [60, 100], mins: 1, prereq: ['lk-sparkleD'], data: { lick: 'hammerC' } },
  { id: 'ml-topnote', kind: 'pick', track: 'create', title: 'Top-note melody', cheat: 'topnote', bpm: [55, 85], mins: 2, prereq: ['pk-travis'], data: { pattern: 'pinch', chords: ['C', 'Cmaj7', 'Am', 'Am7'], melodyTop: true } },
  { id: 'ml-twinkle', kind: 'melody', track: 'create', title: 'Melody by ear: Twinkle', bpm: [60, 100], mins: 1.5, data: { melody: 'twinkle' } },
  { id: 'ml-ode', kind: 'melody', track: 'create', title: 'Melody by ear: Ode to Joy', bpm: [60, 100], mins: 1.5, prereq: ['ml-twinkle'], data: { melody: 'ode' } },
  { id: 'ml-grace', kind: 'melody', track: 'create', title: 'Melody by ear: Amazing Grace', bpm: [60, 95], mins: 1.5, prereq: ['ml-ode'], data: { melody: 'grace' } },
  { id: 'pr-four', kind: 'prog', track: 'create', title: 'Four chords in three keys', cheat: 'numbers', bpm: [60, 100], mins: 1.5, data: { prog: 'four', keys: ['G', 'C', 'D'] } },
  { id: 'pr-sad', kind: 'prog', track: 'create', title: 'Sad four', cheat: 'fourchords', bpm: [60, 100], mins: 1.5, prereq: ['pr-four'], data: { prog: 'sadfour', keys: ['G', 'C', 'D'] } },
  { id: 'pr-britpop', kind: 'prog', track: 'create', title: 'Britpop lift (flat seven)', cheat: 'borrowed', bpm: [70, 110], mins: 1.5, prereq: ['pr-four'], data: { prog: 'britpop', keys: ['G', 'D', 'A'] } },
  { id: 'pr-bitter', kind: 'prog', track: 'create', title: 'Bittersweet minor four', bpm: [60, 95], mins: 1.5, prereq: ['pr-britpop'], data: { prog: 'bittersweet', keys: ['G', 'C', 'D'] } },
  { id: 'pr-creep', kind: 'prog', track: 'create', title: 'Major-three move', bpm: [60, 95], mins: 1.5, prereq: ['pr-bitter', 'ch-abarre'], data: { prog: 'creep', keys: ['G', 'C'] } },
  { id: 'pr-capo', kind: 'prog', track: 'create', title: 'Capo key-change', cheat: 'capo', bpm: [60, 100], mins: 1.5, prereq: ['pr-four'], data: { prog: 'four', keys: ['A', 'Bb', 'B'], capo: true } },
  { id: 'pr-anchor', kind: 'prog', track: 'create', title: 'Anchor loop', bpm: [60, 100], mins: 1.5, prereq: ['st-anchor'], data: { prog: 'anchor', keys: ['G', 'C', 'D'] } },
  { id: 'pr-canon', kind: 'prog', track: 'create', title: 'The Canon', bpm: [60, 100], mins: 2, prereq: ['pr-four'], data: { prog: 'canon', keys: ['D', 'G', 'C'] } },
  { id: 'pr-andalusian', kind: 'prog', track: 'create', title: 'Spanish descent', bpm: [60, 100], mins: 1.5, prereq: ['pr-sad'], data: { prog: 'andalusian', keys: ['C', 'G', 'D'] } },
  { id: 'pr-epic', kind: 'prog', track: 'create', title: 'Epic lift (♭VI ♭VII I)', bpm: [60, 100], mins: 1.5, prereq: ['pr-britpop', 'ch-abarre'], data: { prog: 'epic', keys: ['G', 'C', 'D'] } },
  { id: 'pr-dream', kind: 'prog', track: 'create', title: 'Dream vamp (maj7s)', bpm: [60, 95], mins: 1.5, prereq: ['pk-arp'], data: { prog: 'dream', keys: ['C', 'G', 'D'] } },
  { id: 'pr-circle', kind: 'prog', track: 'create', title: 'Circle home', bpm: [60, 100], mins: 1.5, prereq: ['pr-four'], data: { prog: 'circle', keys: ['C', 'G', 'D'] } },
  { id: 'pr-twofive', kind: 'prog', track: 'create', title: 'Soft jazz (ii V I)', bpm: [60, 95], mins: 1.5, prereq: ['pr-circle'], data: { prog: 'twofive', keys: ['C', 'G', 'D'] } },
  { id: 'pr-royal', kind: 'prog', track: 'create', title: 'Dreamy maj7 lift', bpm: [60, 95], mins: 1.5, prereq: ['pr-sad', 'pk-arp'], data: { prog: 'royal', keys: ['C', 'G'] } },
  { id: 'wr-loop', kind: 'write', track: 'create', title: 'Write a 4-chord loop', bpm: [0, 0], mins: 3, prereq: ['pr-britpop'], data: { prompt: 'Pick a key. Choose four chords from the Pick tab builder, including one borrowed chord. Loop it with any picking pattern until it feels like a song. Save it as an idea.' } },
  { id: 'wr-melody', kind: 'write', track: 'create', title: 'Hum a melody, find it', bpm: [0, 0], mins: 3, prereq: ['wr-loop', 'ml-ode'], data: { prompt: 'Loop one of your saved ideas. Hum something over it. Find the first four notes of your hum on the B or e string. Keep them.' } },
  { id: 'wr-fill', kind: 'write', track: 'create', title: 'Fill the gap', bpm: [0, 0], mins: 3, prereq: ['lk-hammerC', 'wr-loop'], data: { prompt: 'Loop your idea. On the last beat before each chord change, drop in a walk or hammer-on fill instead of the pattern.' } },
  { id: 'lk-boxrun', kind: 'lick', track: 'create', title: 'Box 1 run', bpm: [60, 120], mins: 1, prereq: ['sc-pent1'], data: { lick: 'boxRun' } },
  { id: 'lk-bend', kind: 'lick', track: 'create', title: 'The cry (bend)', bpm: [60, 100], mins: 1.5, prereq: ['lk-boxrun'], data: { lick: 'bendCry' } },
  { id: 'lk-majsweet', kind: 'lick', track: 'create', title: 'Sweet major lick', bpm: [60, 110], mins: 1, prereq: ['sc-maj-pent'], data: { lick: 'majSweet' } },
  { id: 'lk-slide', kind: 'lick', track: 'create', title: 'Slide home', bpm: [60, 110], mins: 1, prereq: ['lk-boxrun'], data: { lick: 'slideHome' } },
  { id: 'lk-triplets', kind: 'lick', track: 'create', title: 'Open E hammer triplets', bpm: [50, 90], mins: 1, prereq: ['lk-sparkleD'], data: { lick: 'doubleHammer' } },
  { id: 'lk-target', kind: 'lick', track: 'create', title: 'Chord-tone fill', cheat: 'tones', bpm: [60, 100], mins: 1, prereq: ['sc-major'], data: { lick: 'targetFill' } },
  { id: 'wr-solo', kind: 'write', track: 'create', title: 'Solo on the jam', bpm: [0, 0], mins: 3, prereq: ['lk-bend', 'sc-pent2'], data: { prompt: 'Open Jam, pick the Two-chord vamp in A. Play 8 bars using only box 1 and 2. Land on a lit-up chord tone every time the chord changes.' } },

  // ---- Ear (auto-graded, also runs hands-free)
  { id: 'ear-int1', kind: 'ear', track: 'ear', title: 'Intervals: 3rds, 5th, octave', bpm: [0, 0], mins: 1, data: { type: 'interval', set: [3, 4, 7, 12] } },
  { id: 'ear-q1', kind: 'ear', track: 'ear', title: 'Major or minor chord', bpm: [0, 0], mins: 1, data: { type: 'quality', set: ['', 'm'] } },
  { id: 'ear-int2', kind: 'ear', track: 'ear', title: 'Intervals: add 2nds and 4th', bpm: [0, 0], mins: 1, prereq: ['ear-int1'], data: { type: 'interval', set: [2, 3, 4, 5, 7, 12] } },
  { id: 'ear-q2', kind: 'ear', track: 'ear', title: 'Sus, 7 and maj7 colours', bpm: [0, 0], mins: 1, prereq: ['ear-q1'], data: { type: 'quality', set: ['', 'm', '7', 'maj7', 'sus4'] } },
  { id: 'ear-prog1', kind: 'ear', track: 'ear', title: 'Hear the progression', bpm: [0, 0], mins: 1.5, prereq: ['ear-q1'], data: { type: 'prog', set: ['four', 'sadfour', 'britpop', 'folk'] } },
  { id: 'ear-int3', kind: 'ear', track: 'ear', title: 'All intervals', bpm: [0, 0], mins: 1, prereq: ['ear-int2'], data: { type: 'interval', set: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } },
  { id: 'ear-bass', kind: 'ear', track: 'ear', title: 'Find the bass note (I, IV, V, vi)', bpm: [0, 0], mins: 1, prereq: ['ear-prog1'], data: { type: 'degree', set: ['I', 'IV', 'V', 'vi'] } },
  { id: 'ear-prog2', kind: 'ear', track: 'ear', title: 'Borrowed-chord progressions', bpm: [0, 0], mins: 1.5, prereq: ['ear-prog1'], data: { type: 'prog', set: ['britpop', 'bittersweet', 'creep', 'fifties', 'sadfour'] } },
  { id: 'ear-sing', kind: 'ear', track: 'ear', title: 'Hear it, sing it (licks)', bpm: [0, 0], mins: 1.5, prereq: ['ear-int2'], data: { type: 'sing', set: ['walkupGC', 'walkdownCAm', 'majSweet', 'boxRun', 'targetFill'] } },
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// Milestones: named performance goals. The fourth is the stated goal.
export const MILESTONES = [
  {
    id: 'm1', name: 'Travis on autopilot', goal: 'Thumb alternates on its own while your fingers pick. Basic and pinch Travis over any open chords.',
    items: ['pk-thumb', 'pk-boom', 'pk-travis', 'pk-pinch', 'pk-arp', 'st-faithful', 'nt-e', 'ear-int1', 'ear-q1', 'lk-walkup', 'lk-walkdown', 'pr-four'],
  },
  {
    id: 'm2', name: 'Pretty chords', goal: 'Sparkle chords, anchor fingers, A-shape barres and the capo trick. Every progression you play sounds like a record.',
    items: ['pk-sparkle', 'st-anchor', 'ch-abarre', 'pk-forward', 'pk-jangle', 'st-push', 'pr-sad', 'pr-britpop', 'pr-capo', 'nt-a', 'ear-int2', 'ear-prog1', 'lk-sparkleD', 'ml-twinkle', 'pk-switch', 'pk-rolling', 'pr-anchor'],
  },
  {
    id: 'm2b', name: 'Smooth changes', goal: 'Walk the bass between chords, use slash chords and passing chords, and make every change sound deliberate instead of just switching shapes.',
    items: ['mv-walk-GEm', 'mv-walk-CG', 'mv-walk-DG', 'mv-walkup-CAm', 'mv-inv-CAm', 'mv-inv-GC', 'mv-inv-CF', 'mv-sec-CAm', 'mv-sec-GEm', 'mv-appr-GAm', 'mv-sus-DG', 'mv-cliche-Am', 'mv-fill-GC', 'pk-boomchucka', 'pr-canon'],
  },
  {
    id: 'm3', name: 'Know the neck', goal: 'Find any note on strings 6 and 5, jump octaves, and play minor and major pentatonic boxes in five keys.',
    items: ['nt-oct', 'sc-pent1', 'sc-pent2', 'sc-maj-pent', 'sc-major', 'lk-boxrun', 'pk-syncop', 'pk-updown', 'ch-mixbarre', 'ear-q2', 'ear-bass', 'ml-ode', 'pr-bitter'],
  },
  {
    id: 'm4', name: 'Noodle & write', goal: 'Pick up the guitar and fingerpick your own progression with a melody on top, fills between chords, and one borrowed chord.', isGoal: true,
    items: ['ml-topnote', 'lk-hammerC', 'lk-triplets', 'wr-loop', 'wr-melody', 'wr-fill', 'pr-creep', 'pr-royal', 'ml-grace', 'pk-hybrid', 'ear-prog2', 'ear-sing', 'lk-target', 'pk-slap', 'pk-pinchroll', 'mv-cliche-D', 'mv-sec-CF', 'mv-inv-GEm', 'mv-anchor-GC', 'pr-andalusian', 'pr-dream'],
  },
  {
    id: 'm5', name: 'Solo over a jam', goal: 'Improvise over a backing track in any key: three pentatonic boxes, bends, slides and landing on chord tones.',
    items: ['sc-pent3', 'sc-blues', 'sc-pent45', 'sc-dorian', 'lk-bend', 'lk-majsweet', 'lk-slide', 'wr-solo', 'nt-all', 'ear-int3', 'st-chuck', 'st-funk', 'pk-doublepinch', 'pk-sixtravis', 'mv-walkup-DG', 'mv-appr-CD', 'mv-sus-AD', 'mv-cliche-Em', 'mv-fill-DG', 'mv-pass-CF', 'pr-epic', 'pr-circle', 'pr-twofive'],
  },
];

// Placement check: self-report areas plus a few items to play. Answers pre-fill what the user told us.
export const PLACEMENT = {
  ask: [
    { id: 'open', q: 'Open chords (C, G, D, Am, Em, E, A…)', default: 'solid' },
    { id: 'ebarre', q: 'E-shape barre chords (F, G at fret 3…)', default: 'solid' },
    { id: 'abarre', q: 'A-shape barre chords (C at fret 3, B at fret 2…)', default: 'some' },
    { id: 'strum', q: 'Strumming while singing', default: 'solid' },
    { id: 'pick', q: 'Fingerpicking', default: 'some' },
    { id: 'scales', q: 'Scales and fretboard notes', default: 'none' },
    { id: 'lead', q: 'Riffs, fills and lead lines', default: 'some' },
  ],
  // Areas mapped to items. "solid" skips (locks) the listed skip items; tests confirm with a real rep.
  skip: {
    open: [],
    ebarre: ['ch-ebarre'],
    abarre: ['ch-abarre'],
    strum: ['st-faithful', 'st-eighths'],
    pick: ['pk-thumb', 'pk-boom'],
    scales: ['nt-e', 'sc-pent1'],
    lead: ['lk-walkup', 'lk-walkdown'],
  },
  tests: ['pk-travis', 'ch-abarre', 'nt-e', 'sc-pent1', 'st-push'],
};

export function scaleKeysFriendly(scaleId) {
  return SCALES[scaleId].steps.length;
}
