// App state shape and pure updates (no DOM, no storage) so the simulator and tests share them.
import { ITEM_BY_ID, PLACEMENT } from './content.js';
import { newState, rate, skipState } from './srs.js';

export const STATE_VERSION = 1;

export function createState(day) {
  return {
    v: STATE_VERSION,
    created: day,
    settings: { theme: 'auto', lastLen: 20, dailyMins: 20, handsFreePerWeek: 0, voice: true },
    placement: { done: false, answers: {} },
    items: {},
    songs: [],
    ideas: [],
    log: {}, // day -> { hands, neck, ear, create, outside } minutes
    recordings: [],
    coach: null,
    seenCheats: [],
    custom: {},
    sessions: 0,
  };
}

export function applyPlacement(state, answers, tested, day) {
  const s = { ...state, items: { ...state.items }, placement: { done: true, answers } };
  for (const [area, level] of Object.entries(answers)) {
    if (level !== 'solid') continue;
    for (const id of PLACEMENT.skip[area] || []) s.items[id] = skipState(ITEM_BY_ID[id], day);
  }
  // Tested items: clean = skip, sloppy = start near target, couldn't = leave for the planner.
  for (const [id, rating] of Object.entries(tested || {})) {
    const item = ITEM_BY_ID[id];
    if (!item) continue;
    if (rating === 'clean') s.items[id] = skipState(item, day);
    else if (rating === 'sloppy') {
      const st = rate(newState(item, day), item, 'sloppy', day);
      if (item.bpm[1]) st.bpm = Math.round((item.bpm[0] + item.bpm[1]) / 2);
      s.items[id] = st;
    } else if (rating === 'miss') delete s.items[id];
  }
  return s;
}

export function logMinutes(state, day, track, mins) {
  const log = { ...state.log };
  const e = { ...(log[day] || {}) };
  e[track] = Math.round(((e[track] || 0) + mins) * 10) / 10;
  log[day] = e;
  return { ...state, log };
}

export function rateItem(state, item, rating, day) {
  const prev = state.items[item.id] || newState(item, day);
  return { ...state, items: { ...state.items, [item.id]: rate(prev, item, rating, day) } };
}

// Keep the stored document small: old log days beyond a year are summarised away.
export function compact(state, day) {
  const log = {};
  for (const [d, e] of Object.entries(state.log || {})) if (Number(d) > day - 400) log[d] = e;
  return { ...state, log };
}

export function migrate(raw, day) {
  if (!raw || typeof raw !== 'object' || raw.v !== STATE_VERSION) return createState(day);
  const base = createState(day);
  return { ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) } };
}
