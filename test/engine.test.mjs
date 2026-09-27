import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scalePosition, identifyChord, findVoicings, shapeMatches, capoFor, pc } from '../src/theory.js';
import { romanChord, progressionChords, ITEM_BY_ID, ITEMS } from '../src/content.js';
import { rate, newState, isLocked, skipState, ratingFromScore, PARAMS } from '../src/srs.js';
import { plan, wipCapFor } from '../src/planner.js';
import { forecast, streak, levers, remainingMinutes } from '../src/progress.js';
import { createState, applyPlacement, logMinutes } from '../src/state.js';
import { CAL } from '../src/calibration.js';

const fmt = (notes) => notes.map((n) => n.s + ':' + n.f).join(' ');

test('minor pentatonic box 1 in A is the classic fret-5 box', () => {
  assert.equal(fmt(scalePosition(pc('A'), 'minPent', 0)), '0:5 0:8 1:5 1:7 2:5 2:7 3:5 3:7 4:5 4:8 5:5 5:8');
});

test('major scale three-notes-per-string stays in G', () => {
  const g = [7, 9, 11, 0, 2, 4, 6];
  for (const n of scalePosition(pc('G'), 'major', 0)) assert.ok(g.includes(n.midi % 12));
});

test('chord naming recognises common shapes', () => {
  assert.equal(identifyChord([-1, 3, 2, 0, 1, 0])[0].name, 'C');
  assert.equal(identifyChord([3, 2, 0, 0, 0, 3])[0].name, 'G');
  assert.equal(identifyChord([0, 2, 2, 0, 0, 0])[0].name, 'Em');
  assert.equal(identifyChord([-1, 3, 2, 0, 0, 0])[0].name, 'Cmaj7');
  assert.equal(identifyChord([-1, 2, 0, 0, 0, 3])[0].name, 'G/B');
});

test('every voicing the chord finder returns really spells the chord', () => {
  for (const sym of ['C', 'G', 'D', 'Am', 'F#m', 'Bb', 'Cmaj7', 'Em7', 'Dsus2', 'E7', 'Asus4', 'Cadd9']) {
    const vs = findVoicings(sym);
    assert.ok(vs.length >= 3, sym + ' has few voicings');
    for (const v of vs) assert.ok(shapeMatches(v.frets, sym).ok, sym + ' ' + v.frets.join(','));
  }
});

test('Roman numerals resolve correctly, including borrowed chords', () => {
  assert.deepEqual(progressionChords('four', 'G'), ['G', 'D', 'Em', 'C']);
  assert.deepEqual(progressionChords('britpop', 'D'), ['D', 'C', 'G', 'D']);
  assert.deepEqual(progressionChords('creep', 'G'), ['G', 'B', 'C', 'Cm']);
  assert.deepEqual(progressionChords('descent', 'C'), ['C', 'G/B', 'Am', 'F']);
  assert.equal(romanChord('F', 'IV'), 'Bb');
  assert.equal(romanChord('C', 'iii7'), 'Em7');
});

test('capo suggestions use open shapes', () => {
  assert.deepEqual(capoFor('Bb')[0], { shapes: 'A', capo: 1 });
  assert.ok(capoFor('A').some((o) => o.shapes === 'G' && o.capo === 2));
});

// ---------------------------------------------------------------------------
const pick = ITEM_BY_ID['pk-travis'];

test('clean speeds up, a miss slows down, sloppy holds', () => {
  let st = newState(pick, 0);
  st = rate(st, pick, 'clean', 0);
  assert.ok(st.bpm > pick.bpm[0]);
  const b = st.bpm;
  assert.equal(rate(st, pick, 'sloppy', 1).bpm, b);
  assert.ok(rate(st, pick, 'miss', 1).bpm < b);
});

test('locked in = clean at target tempo on 3 separate days', () => {
  let st = { ...newState(pick, 0), bpm: pick.bpm[1] };
  st = rate(st, pick, 'clean', 10);
  st = rate(st, pick, 'clean', 10); // same day counts once
  assert.equal(st.clean.length, 1);
  st = rate(st, pick, 'clean', 12);
  assert.ok(!isLocked(st));
  st = rate(st, pick, 'clean', 15);
  assert.ok(isLocked(st));
});

test('clean below target tempo never counts toward lock-in', () => {
  let st = newState(pick, 0);
  for (let d = 0; d < 3; d++) st = { ...rate({ ...st, bpm: pick.bpm[0] }, pick, 'clean', d * 3), bpm: pick.bpm[0] };
  assert.equal(st.clean.length, 0);
});

test('a forgotten item keeps 30% of its gap instead of restarting', () => {
  const st = { ...newState(pick, 0), s: 'review', ivl: 20, reps: 5, last: 0 };
  const after = rate(st, pick, 'miss', 20);
  assert.equal(after.ivl, Math.round(20 * PARAMS.lapseFactor));
});

test('a clean rep after a long overdue gap earns a bigger jump', () => {
  const base = { ...newState(pick, 0), s: 'review', ivl: 10, reps: 5, last: 0, bpm: pick.bpm[1] };
  const onTime = rate(base, pick, 'clean', 10);
  const late = rate(base, pick, 'clean', 25);
  assert.ok(late.ivl > onTime.ivl);
});

test('quiz scores map to ratings', () => {
  assert.equal(ratingFromScore(7 / 8), 'clean');
  assert.equal(ratingFromScore(5 / 8), 'sloppy');
  assert.equal(ratingFromScore(2 / 8), 'miss');
});

// ---------------------------------------------------------------------------
function withItems(ids, day, extra = {}) {
  const s = createState(0);
  for (const id of ids) s.items[id] = { ...newState(ITEM_BY_ID[id], 0), reps: 3, last: day - 3, due: day, ivl: 3, s: 'review', ...extra };
  return s;
}

test('a two-minute sprint with reviews due adds nothing new', () => {
  const s = withItems(['pk-thumb', 'pk-travis'], 10);
  const steps = plan(s, { minutes: 2, day: 10 });
  assert.ok(steps.every((x) => !x.isNew));
  assert.ok(steps.length >= 1);
});

test('a pile of reviews holds back new material', () => {
  const ids = ITEMS.filter((i) => i.kind !== 'ear').slice(0, 20).map((i) => i.id);
  const s = withItems(ids, 10);
  const steps = plan(s, { minutes: 10, day: 10, opts: { wipCap: 99 } });
  assert.equal(steps.filter((x) => x.isNew).length, 0);
});

test('shakiest item comes first', () => {
  const s = withItems(['pk-thumb', 'st-faithful'], 10);
  s.items['st-faithful'] = { ...s.items['st-faithful'], lapses: 3, hist: [[9, 'm', 70], [8, 'm', 70]] };
  const steps = plan(s, { minutes: 10, day: 10 });
  assert.equal(steps[0].id, 'st-faithful');
});

test('sessions of five minutes or more end with a play-out minute', () => {
  const s = createState(0);
  const steps = plan(s, { minutes: 20, day: 0 });
  assert.equal(steps[steps.length - 1].type, 'playout');
  assert.ok(steps.some((x) => x.isNew));
});

test('hands-free sessions contain only ear items', () => {
  const s = createState(0);
  const steps = plan(s, { minutes: 10, day: 0, handsFree: true });
  for (const st of steps) assert.equal(ITEM_BY_ID[st.id].kind, 'ear');
});

test('the work-in-progress cap scales with practice time', () => {
  const lazy = createState(0);
  lazy.settings.dailyMins = 5;
  const keen = createState(0);
  keen.settings.dailyMins = 30;
  assert.ok(wipCapFor(lazy, 0) < wipCapFor(keen, 0));
});

test('placement skips what you already play and keeps the rest', () => {
  const s = applyPlacement(createState(0), { ebarre: 'solid', pick: 'some' }, { 'pk-travis': 'clean', 'ch-abarre': 'miss' }, 0);
  assert.ok(isLocked(s.items['ch-ebarre']));
  assert.ok(isLocked(s.items['pk-travis']));
  assert.equal(s.items['ch-abarre'], undefined);
  assert.equal(s.items['pk-thumb'], undefined);
});

// ---------------------------------------------------------------------------
test('countdown: minutes left shrink as items lock, slowest track sets the date', () => {
  const s = createState(0);
  const f0 = forecast(s, 0);
  assert.ok(f0.totalMinutes > 0 && isFinite(f0.days));
  assert.ok(f0.tracks.some((t) => t.id === f0.slowest.id));
  const s2 = { ...s, items: { ...s.items, 'pk-thumb': skipState(ITEM_BY_ID['pk-thumb'], 0) } };
  assert.ok(forecast(s2, 0).totalMinutes < f0.totalMinutes);
  assert.ok(f0.days >= Math.max(...f0.tracks.filter((t) => t.id === 'ear').map((t) => t.days)) - 1e-9);
});

test('levers never make the date later', () => {
  const lv = levers(createState(0), 0);
  for (const o of lv.options) assert.ok(o.days <= lv.now.days + 1e-9);
});

test('remaining minutes use the simulation calibration', () => {
  const it = ITEM_BY_ID['pk-travis'];
  assert.equal(remainingMinutes(it, undefined), CAL.repsToLock.pick * it.mins * CAL.overhead * (CAL.fudge ?? 1));
});

test('calibration was checked against the simulation', () => {
  assert.ok(CAL.forecastMedianRatio >= 0.8 && CAL.forecastMedianRatio <= 1.25, 'forecast median ratio ' + CAL.forecastMedianRatio);
});

test('streak forgives a single missed day', () => {
  let s = createState(0);
  for (const d of [1, 2, 4, 5, 7]) s = logMinutes(s, d, 'hands', 10);
  assert.equal(streak(s, 7).streak, 5);
  s = logMinutes(createState(0), 1, 'hands', 10);
  assert.equal(streak(s, 5).streak, 0);
});
