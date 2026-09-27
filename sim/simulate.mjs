// Simulate months of lazy practice to tune the scheduler and calibrate the countdown.
// Usage: node sim/simulate.mjs [--write]   (--write regenerates src/calibration.js and docs/SIMULATION.md)
import { writeFileSync, mkdirSync } from 'node:fs';
import { ITEMS, MILESTONES, PLACEMENT } from '../src/content.js';
import { PARAMS, isLocked, hasTempo, ratingFromScore } from '../src/srs.js';
import { plan, findItem } from '../src/planner.js';
import { createState, applyPlacement, rateItem, logMinutes } from '../src/state.js';
import { forecast, milestoneStatus, currentMilestoneIdx } from '../src/progress.js';
import { CAL } from '../src/calibration.js';

const DAYS = 180;
const LEARNERS = 24;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KIND_DIFF = { pick: 1.25, strum: 0.8, barre: 1.15, scale: 1.0, notes: 0.9, lick: 0.85, melody: 0.95, prog: 0.7, write: 1.0, ear: 0.9, move: 0.95, piece: 1.2 };
const sig = (x) => 1 / (1 + Math.exp(-x));

// The learner: hidden skill per item that grows with practice and fades with time.
function makeLearner(seed, profile) {
  const r = rng(seed);
  const hidden = {};
  const get = (item) => {
    if (!hidden[item.id]) {
      const d = KIND_DIFF[item.kind] * Math.exp((r() - 0.5) * 0.5) * profile.difficulty;
      const start = hasTempo(item) ? (item.bpm[0] / item.bpm[1]) * (0.85 + r() * 0.2) : 0.35 + r() * 0.2;
      hidden[item.id] = { d, c: start, floor: start * 0.9, S: 3, last: null };
    }
    return hidden[item.id];
  };
  const attempt = (item, st, day) => {
    const h = get(item);
    const gap = h.last == null ? 0 : day - h.last;
    const ceff = h.floor + (h.c - h.floor) * Math.exp(-gap / h.S);
    let rating;
    let margin;
    if (hasTempo(item)) {
      const f = st.bpm / item.bpm[1];
      margin = ceff - f;
      const pClean = sig(margin / 0.04);
      const pMiss = sig((-margin - 0.1) / 0.04);
      const x = r();
      rating = x < pClean ? 'clean' : x < pClean + (1 - pClean) * (1 - pMiss) ? 'sloppy' : 'miss';
    } else {
      margin = ceff - 0.85;
      rating = ratingFromScore(Math.min(1, ceff + (r() - 0.5) * 0.2));
    }
    // Learning is fastest right at the edge of ability.
    const lr = (0.1 / h.d) * (1 + 0.8 * Math.exp(-Math.abs(margin) / 0.06));
    h.c = ceff + lr * (1.15 - ceff);
    // Every rep consolidates; spaced clean reps consolidate most (the spacing effect).
    const spacing = Math.min(1.5, gap / h.S);
    h.S *= rating === 'miss' ? 1.1 : rating === 'sloppy' ? 1.3 + 0.3 * spacing : 1.5 + 0.8 * spacing;
    // Motor skills are sticky: you never lose more than ~0.15 of what you once had.
    h.floor = Math.max(h.floor, h.c - 0.15);
    h.last = day;
    return rating;
  };
  return { attempt, r };
}

const PROFILES = {
  // Matches what the user described: 20-30 min most days (or every couple of days), long at weekends.
  you: { pPractice: 0.65, lengths: [[10, 0.1], [20, 0.4], [30, 0.5]], weekend: { p: 0.85, lengths: [[30, 0.2], [45, 0.4], [60, 0.4]] }, pHandsFree: 0.2, difficulty: 1.0 },
  lazy: { pPractice: 0.6, lengths: [[2, 0.25], [5, 0.35], [10, 0.28], [20, 0.12]], pHandsFree: 0.2, difficulty: 1.0 },
  steady: { pPractice: 0.85, lengths: [[5, 0.3], [10, 0.5], [20, 0.2]], pHandsFree: 0.4, difficulty: 1.0 },
};

function pickLen(r, lengths) {
  let x = r();
  for (const [m, p] of lengths) if ((x -= p) <= 0) return m;
  return lengths[lengths.length - 1][0];
}

function runOne(seed, profileName, opts = {}, DAYS = 180) {
  const profile = PROFILES[profileName];
  const L = makeLearner(seed, profile);
  const r = L.r;
  let state = createState(0);
  state.settings.dailyMins = profileName === 'you' ? 20 : 6;
  const answers = Object.fromEntries(PLACEMENT.ask.map((a) => [a.id, a.default]));
  state = applyPlacement(state, answers, {}, 0);
  const firstRep = {};
  const lockRep = {};
  const repCount = {};
  const lockDay = {};
  let minsTotal = 0;
  let minsLearning = 0;
  const milestoneDay = {};
  const checkpoints = [];
  for (let day = 0; day < DAYS; day++) {
    // Forecast checkpoint every 15 days: predicted days to the next milestone.
    if (day % 15 === 0 && day > 0) {
      const idx = currentMilestoneIdx(state);
      if (!milestoneStatus(state)[idx].done) checkpoints.push({ day, idx, predicted: forecast(state, day).days });
    }
    const sessions = [];
    const weekend = profile.weekend && day % 7 >= 5;
    const pP = weekend ? profile.weekend.p : profile.pPractice;
    if (r() < pP) sessions.push({ minutes: pickLen(r, weekend ? profile.weekend.lengths : profile.lengths), handsFree: false });
    if (r() < profile.pHandsFree) sessions.push({ minutes: 5, handsFree: true });
    for (const sess of sessions) {
      const ms = milestoneStatus(state);
      const cur = ms.find((m) => !m.done) || ms[ms.length - 1];
      const milestoneIds = new Set(MILESTONES.slice(0, cur.idx + 1).flatMap((m) => m.items));
      const steps = plan(state, { minutes: sess.minutes, day, milestoneIds, handsFree: sess.handsFree, opts });
      for (const step of steps) {
        if (step.type === 'playout') {
          state = logMinutes(state, day, 'create', step.mins);
          minsTotal += step.mins;
          continue;
        }
        if (step.type !== 'item') continue;
        const item = findItem(state, step.id);
        const before = state.items[item.id];
        const wasLocked = isLocked(before);
        const rating = L.attempt(item, before || { bpm: item.bpm[0] }, day);
        state = rateItem(state, item, rating, day);
        state = logMinutes(state, day, item.track, step.mins);
        minsTotal += step.mins;
        repCount[item.id] = (repCount[item.id] || 0) + 1;
        if (!before) firstRep[item.id] = day;
        if (!wasLocked) minsLearning += item.mins;
        if (!wasLocked && isLocked(state.items[item.id]) && !(item.id in lockRep)) {
          lockRep[item.id] = repCount[item.id];
          lockDay[item.id] = day;
        }
      }
    }
    milestoneStatus(state).forEach((m) => {
      if (m.done && !(m.id in milestoneDay)) milestoneDay[m.id] = day;
    });
  }
  // Resolve checkpoints: when was that milestone actually reached?
  const cps = checkpoints.map((c) => {
    const actual = milestoneDay[MILESTONES[c.idx].id];
    return { ...c, actual: actual == null ? null : actual - c.day };
  });
  const lockedCount = ITEMS.filter((it) => isLocked(state.items[it.id]) && !state.items[it.id].skipped).length;
  return { lockRep, lockedCount, minsTotal, minsLearning, milestoneDay, cps, state };
}

function runMany(profileName, opts, days = 180, n = LEARNERS) {
  const runs = [];
  for (let i = 0; i < n; i++) runs.push(runOne(1000 + i * 7919, profileName, opts, days));
  return runs;
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function summarise(runs) {
  const locked = mean(runs.map((r) => r.lockedCount));
  const mins = mean(runs.map((r) => r.minsTotal));
  const m = Object.fromEntries(
    MILESTONES.map((ms) => {
      const days = runs.map((r) => r.milestoneDay[ms.id]).filter((d) => d != null);
      return [ms.id, { reached: days.length / runs.length, day: days.length ? Math.round(mean(days)) : null }];
    }),
  );
  return { locked, mins, perHour: locked / (mins / 60), m };
}

function calibrate(runs) {
  const byKind = {};
  for (const r of runs)
    for (const [id, reps] of Object.entries(r.lockRep)) {
      const k = ITEMS.find((i) => i.id === id).kind;
      (byKind[k] ||= []).push(reps);
    }
  const repsToLock = {};
  for (const k of Object.keys(CAL.repsToLock)) repsToLock[k] = byKind[k] ? Math.round(mean(byKind[k]) * 10) / 10 : CAL.repsToLock[k];
  const overhead = Math.round((mean(runs.map((r) => r.minsTotal)) / mean(runs.map((r) => r.minsLearning))) * 100) / 100;
  return { repsToLock, overhead };
}

function forecastError(runs) {
  const pairs = runs.flatMap((r) => r.cps).filter((c) => c.actual != null && isFinite(c.predicted) && c.actual > 5);
  if (!pairs.length) return { n: 0 };
  const ratios = pairs.map((p) => p.predicted / p.actual);
  ratios.sort((a, b) => a - b);
  return { n: pairs.length, median: ratios[Math.floor(ratios.length / 2)], p25: ratios[Math.floor(ratios.length * 0.25)], p75: ratios[Math.floor(ratios.length * 0.75)] };
}

// ---------------------------------------------------------------------------
const write = process.argv.includes('--write');
const out = [];
const log = (s = '') => {
  console.log(s);
  out.push(s);
};

log('# Simulation report');
log('');
log(`${LEARNERS} simulated learners × ${DAYS} days. Profile "you": practises on 65% of weekdays for 10-30 min and 85% of weekend days for 30-60 min; hands-free ear on 20% of days. Cross-checked against a "lazy" profile (60% of days, 2-20 min).`);
log('');
log('## 1. Scheduler variants');
log('');
log('| Variant | Items locked in | Minutes practised | Locked per hour | Goal milestone (m4) reached | Day reached |');
log('|---|---|---|---|---|---|');
const variants = [
  ['Chosen: lapse→30%, long-gap bonus, backlog throttle, shakiest first, pace-adaptive cap', {}, {}],
  ['Fixed work-in-progress cap 8', { wipCap: 8 }, {}],
  ['Lapse resets to zero', {}, { lapseFactor: 0 }],
  ['Lapse keeps 60%', {}, { lapseFactor: 0.6 }],
  ['No long-gap bonus', {}, { longGapBonus: 0 }],
  ['No backlog throttle', { throttle: false }, {}],
  ['Due-date order (not shakiest first)', { shakiestFirst: false }, {}],
  ['Tempo steps of 5%', {}, { tempoUp: 0.05 }],
  ['Tempo steps of 15%', {}, { tempoUp: 0.15 }],
  ['Fixed work-in-progress cap 16', { wipCap: 16 }, {}],
  ['No work-in-progress cap', { wipCap: 999 }, {}],
];
const saved = { ...PARAMS };
let chosenRuns;
for (const [label, opts, params] of variants) {
  Object.assign(PARAMS, saved, params);
  const runs = runMany('you', opts);
  if (!chosenRuns) chosenRuns = runs;
  const s = summarise(runs);
  log(`| ${label} | ${s.locked.toFixed(1)} | ${Math.round(s.mins)} | ${s.perHour.toFixed(2)} | ${Math.round(s.m.m4.reached * 100)}% | ${s.m.m4.day ?? '—'} |`);
}
Object.assign(PARAMS, saved);

log('');
log('## 2. Calibration (365-day runs, so later milestones are reached often enough to check)');
const calRuns = runMany('you', {}, 365);
const before = forecastError(calRuns);
const cal = calibrate(calRuns);
log('');
log('Reps to lock in, by kind (measured): ' + Object.entries(cal.repsToLock).map(([k, v]) => `${k} ${v}`).join(', '));
log(`Overhead (reviews of locked items, intros and play-outs per learning minute): ${cal.overhead}`);
log('');
log(`Forecast accuracy with the previous calibration: predicted/actual median ${before.median?.toFixed(2)} (IQR ${before.p25?.toFixed(2)}–${before.p75?.toFixed(2)}, n=${before.n})`);

Object.assign(CAL, cal, { fudge: 1 });
const mid = forecastError(runMany('you', {}, 365));
log(`After measuring reps per kind: median ${mid.median?.toFixed(2)} (IQR ${mid.p25?.toFixed(2)}–${mid.p75?.toFixed(2)}, n=${mid.n})`);
// The remaining gap (items outside the milestone share the minutes, ear waits on dead time) is one measured factor.
cal.fudge = Math.round((1 / mid.median) * 100) / 100;
CAL.fudge = cal.fudge;
log(`Correction factor applied to all countdowns: ×${cal.fudge}`);
const afterRuns = runMany('you', {}, 365);
const after = forecastError(afterRuns);
log(`Forecast accuracy after recalibration: predicted/actual median ${after.median?.toFixed(2)} (IQR ${after.p25?.toFixed(2)}–${after.p75?.toFixed(2)}, n=${after.n})`);

const steadyRuns = runMany('lazy', {}, 365);
{
  const a = summarise(runMany('lazy', {}));
  const b = summarise(runMany('lazy', { wipCap: 16 }));
  log(`Lazy learner, 180 days: adaptive cap locks ${a.locked.toFixed(1)} items, a fixed cap of 16 locks ${b.locked.toFixed(1)}.`);
}
const steady = forecastError(steadyRuns);
const ss = summarise(steadyRuns);
log(`Cross-check on a "lazy" learner (60% of days, 2-20 min): median ${steady.median?.toFixed(2)} (IQR ${steady.p25?.toFixed(2)}–${steady.p75?.toFixed(2)}, n=${steady.n}); goal milestone reached by ${Math.round(ss.m.m4.reached * 100)}% on day ${ss.m.m4.day ?? '—'}`);
log('');
log('## 3. Milestones at your pace over a year (after calibration)');
log('');
const sa = summarise(afterRuns);
log('| Milestone | Reached within 365 days | Average day |');
log('|---|---|---|');
for (const ms of MILESTONES) log(`| ${ms.name} | ${Math.round(sa.m[ms.id].reached * 100)}% | ${sa.m[ms.id].day ?? '—'} |`);

if (write) {
  const file = `// Generated by sim/simulate.mjs. Do not edit by hand; run \`npm run sim -- --write\` to regenerate.
export const CAL = ${JSON.stringify({ ...cal, generated: new Date().toISOString().slice(0, 10), forecastMedianRatio: after.median ? Math.round(after.median * 100) / 100 : null }, null, 2)};
`;
  writeFileSync(new URL('../src/calibration.js', import.meta.url), file);
  mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../docs/SIMULATION.md', import.meta.url), out.join('\n') + '\n');
  console.log('\nWrote src/calibration.js and docs/SIMULATION.md');
}
if (process.argv.includes('--debug')) {
  const r = runOne(1000, 'lazy', {});
  for (const [id, st] of Object.entries(r.state.items)) if (!st.skipped) console.log(id, st.reps, st.bpm, st.clean.join('/'), st.ivl, st.hist.map((h) => h[1]).join(''));
}
