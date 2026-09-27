// Milestones and the honest countdown: minutes left per track, the slowest track sets the date.
import { ITEMS, ITEM_BY_ID, MILESTONES, TRACKS } from './content.js';
import { isLocked, hasTempo, PARAMS } from './srs.js';
import { CAL } from './calibration.js';

export const TRACK_IDS = Object.keys(TRACKS);
// Until there is real history, use what you said: 20-30 min most days or every couple of days, longer at weekends.
// Averaged over the week that is about 20 min a day (settings.dailyMins overrides it).
export const DEFAULT_GUITAR_PACE = 20;
export const DEFAULT_SHARE = { hands: 0.36, neck: 0.26, create: 0.3, ear: 0.08 };

export function itemState(state, id) {
  return state.items[id];
}

export function remainingReps(item, st) {
  if (isLocked(st)) return 0;
  const base = CAL.repsToLock[item.kind] ?? 7;
  if (!st) return base;
  const p = hasTempo(item) ? Math.max(0, Math.min(1, (st.bpm - item.bpm[0]) / (item.bpm[1] - item.bpm[0]))) : Math.min(1, st.reps / base);
  const c = st.clean.length / PARAMS.lockDays;
  return Math.max(PARAMS.lockDays - st.clean.length, base * (1 - 0.5 * p - 0.5 * c));
}

export function remainingMinutes(item, st) {
  return remainingReps(item, st) * item.mins * CAL.overhead * (CAL.fudge ?? 1);
}

export function milestoneItems(idx) {
  // Cumulative: a milestone also needs everything before it.
  const ids = new Set();
  for (let i = 0; i <= idx; i++) MILESTONES[i].items.forEach((id) => ids.add(id));
  return [...ids].map((id) => ITEM_BY_ID[id]);
}

export function milestoneStatus(state) {
  return MILESTONES.map((m, idx) => {
    const own = m.items.map((id) => ITEM_BY_ID[id]);
    const locked = own.filter((it) => isLocked(state.items[it.id])).length;
    return { ...m, idx, total: own.length, locked, done: locked === own.length };
  });
}

export function currentMilestoneIdx(state) {
  const st = milestoneStatus(state);
  const i = st.findIndex((m) => !m.done);
  return i < 0 ? MILESTONES.length - 1 : i;
}

export function minutesLeftByTrack(state, idx) {
  const out = Object.fromEntries(TRACK_IDS.map((t) => [t, 0]));
  for (const item of milestoneItems(idx)) out[item.track] += remainingMinutes(item, state.items[item.id]);
  return out;
}

// Average minutes per day per track over the last `window` days (zeros included).
export function observedPace(state, today, window = 14) {
  const days = state.log || {};
  const firstDay = Math.min(today, ...Object.keys(days).map(Number));
  const span = Math.max(7, Math.min(window, today - firstDay + 1));
  const sum = Object.fromEntries(TRACK_IDS.map((t) => [t, 0]));
  let activeDays = 0;
  for (let d = today - span + 1; d <= today; d++) {
    const e = days[d];
    if (!e) continue;
    let any = false;
    for (const t of TRACK_IDS) {
      sum[t] += e[t] || 0;
      if (e[t]) any = true;
    }
    if (any) activeDays++;
  }
  const pace = Object.fromEntries(TRACK_IDS.map((t) => [t, sum[t] / span]));
  return { pace, activeDays, span, real: activeDays >= 3 };
}

export function paceFor(state, today) {
  const obs = observedPace(state, today);
  if (obs.real) return { ...obs, assumed: false };
  const daily = state.settings?.dailyMins || DEFAULT_GUITAR_PACE;
  const pace = Object.fromEntries(TRACK_IDS.map((t) => [t, daily * DEFAULT_SHARE[t]]));
  const hf = (state.settings?.handsFreePerWeek || 0) / 7;
  pace.ear += hf;
  return { pace, activeDays: obs.activeDays, span: obs.span, assumed: true };
}

// The countdown: per-track days, the slowest sets the date.
export function forecast(state, today, idx = currentMilestoneIdx(state), paceOverride) {
  const left = minutesLeftByTrack(state, idx);
  const p = paceOverride || paceFor(state, today).pace;
  // The planner steers guitar time toward the slowest guitar track, so guitar tracks share one pool.
  const guitarTracks = ['hands', 'neck', 'create'];
  const guitarLeft = guitarTracks.reduce((a, t) => a + left[t], 0);
  const guitarPace = guitarTracks.reduce((a, t) => a + p[t], 0);
  const tracks = TRACK_IDS.map((t) => {
    const pace = p[t];
    const days = left[t] <= 0.01 ? 0 : pace > 0 ? left[t] / pace : Infinity;
    return { id: t, name: TRACKS[t].name, minutes: left[t], pace, days };
  });
  const guitarDays = guitarLeft <= 0.01 ? 0 : guitarPace > 0 ? guitarLeft / guitarPace : Infinity;
  const ear = tracks.find((t) => t.id === 'ear');
  const days = Math.max(guitarDays, ear.days);
  const slowest = [...tracks].sort((a, b) => b.days - a.days)[0];
  return { idx, milestone: MILESTONES[idx], left, tracks, guitarDays, days, slowest, totalMinutes: Object.values(left).reduce((a, b) => a + b, 0) };
}

// "Pull a lever" alternatives, each recomputed through the same forecast.
export function levers(state, today) {
  const base = paceFor(state, today).pace;
  const idx = currentMilestoneIdx(state);
  const now = forecast(state, today, idx, base);
  const variants = [
    { label: '+10 min hands-free ear training, 3 days a week', change: (p) => ({ ...p, ear: p.ear + 30 / 7 }) },
    { label: '+5 min with the guitar every day', change: (p) => scaleGuitar(p, 5) },
    { label: 'One 20-minute session at the weekend', change: (p) => scaleGuitar(p, 20 / 7) },
  ];
  return {
    now,
    options: variants.map((v) => {
      const f = forecast(state, today, idx, v.change(base));
      return { label: v.label, days: f.days, saved: now.days - f.days };
    }),
  };
}

function scaleGuitar(p, extraPerDay) {
  const g = p.hands + p.neck + p.create;
  const out = { ...p };
  for (const t of ['hands', 'neck', 'create']) out[t] = p[t] + extraPerDay * (g > 0 ? p[t] / g : 1 / 3);
  return out;
}

export function formatDuration(days) {
  if (!isFinite(days)) return 'never at this pace';
  if (days < 1) return 'today';
  if (days < 14) return Math.ceil(days) + ' days';
  if (days < 70) return Math.round(days / 7) + ' weeks';
  return Math.round(days / 30.4) + ' months';
}

export function formatMinutes(m) {
  if (m < 60) return Math.round(m) + ' min';
  const h = m / 60;
  return (h < 10 ? h.toFixed(1) : Math.round(h)) + ' hours';
}

// Forgiving streak: one missed day in a row never breaks it.
export function streak(state, today) {
  const days = state.log || {};
  const active = (d) => {
    const e = days[d];
    return e && Object.values(e).some((v) => v > 0);
  };
  let s = 0;
  let d = active(today) ? today : today - 1;
  let misses = 0;
  while (d > today - 400) {
    if (active(d)) {
      s++;
      misses = 0;
    } else {
      misses++;
      if (misses > 1) break;
    }
    d--;
  }
  let last7 = 0;
  for (let i = 0; i < 7; i++) if (active(today - i)) last7++;
  return { streak: s, last7 };
}

export function itemsInProgress(state) {
  return ITEMS.filter((it) => state.items[it.id] && !isLocked(state.items[it.id]));
}
