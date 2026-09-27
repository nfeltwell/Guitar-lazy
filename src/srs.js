// Spaced repetition for playable items. A review = playing it now and rating it.
// "Locked in" = clean at target tempo on LOCK_DAYS separate days.

export const PARAMS = {
  lapseFactor: 0.3, // a miss keeps 30% of the old gap instead of starting over
  longGapBonus: 0.5, // up to +50% interval when a clean rep comes after an overdue gap
  easeStart: 2.3,
  easeMin: 1.3,
  easeMax: 3.0,
  tempoUp: 0.1, // clean -> +10% (at least 3 bpm), capped at target
  tempoDown: 0.1, // miss -> -10%
  sloppyDown: 0.0, // sloppy -> hold tempo
  lockDays: 3,
  lockedMinIvl: 7,
};

export const RATINGS = ['clean', 'sloppy', 'miss'];

export function dayNumber(date = new Date()) {
  // Local calendar day; 4am cutoff so a late-night session counts for "today".
  const d = new Date(date.getTime() - 4 * 3600 * 1000);
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

export function hasTempo(item) {
  return item.bpm && item.bpm[1] > 0;
}

export function newState(item, day) {
  return { s: 'learning', bpm: hasTempo(item) ? item.bpm[0] : 0, due: day, ivl: 0, ease: PARAMS.easeStart, reps: 0, lapses: 0, last: null, clean: [], hist: [] };
}

export function atTarget(st, item) {
  return !hasTempo(item) || st.bpm >= item.bpm[1];
}

export function isLocked(st) {
  return !!st && st.clean.length >= PARAMS.lockDays;
}

// Apply a rating. Returns a new state (does not mutate).
export function rate(prev, item, rating, day, P = PARAMS) {
  const st = { ...prev, clean: [...prev.clean], hist: [...prev.hist] };
  const gap = st.last == null ? 0 : day - st.last;
  const target = hasTempo(item) ? item.bpm[1] : 0;
  const wasAtTarget = atTarget(st, item);

  if (rating === 'clean') {
    if (wasAtTarget && !st.clean.includes(day)) st.clean.push(day);
    if (hasTempo(item)) st.bpm = Math.min(target, Math.round(st.bpm + Math.max(3, st.bpm * P.tempoUp)));
    if (st.ivl === 0) st.ivl = 1;
    else if (st.reps < 2 && st.s === 'learning') st.ivl = Math.max(2, st.ivl + 1);
    else {
      const overdue = st.ivl > 0 ? Math.max(0, gap - st.ivl) / st.ivl : 0;
      const bonus = 1 + P.longGapBonus * Math.min(1, overdue);
      st.ivl = Math.max(st.ivl + 1, Math.round(st.ivl * st.ease * bonus));
    }
    st.ease = Math.min(P.easeMax, st.ease + 0.05);
    // Not yet at target tempo: keep it coming back soon so the tempo can climb.
    if (hasTempo(item) && st.bpm < target) st.ivl = Math.min(st.ivl, 3);
  } else if (rating === 'sloppy') {
    if (hasTempo(item)) st.bpm = Math.max(item.bpm[0], Math.round(st.bpm * (1 - P.sloppyDown)));
    st.ivl = Math.max(1, Math.min(st.ivl, Math.round(st.ivl * 1.2)));
    st.ease = Math.max(P.easeMin, st.ease - 0.1);
  } else {
    if (hasTempo(item)) st.bpm = Math.max(Math.round(item.bpm[0] * 0.85), Math.round(st.bpm * (1 - P.tempoDown)));
    st.ivl = Math.max(1, Math.round(st.ivl * P.lapseFactor));
    st.ease = Math.max(P.easeMin, st.ease - 0.2);
    st.lapses += 1;
    // A miss on a locked item costs one clean day, so it has to be re-earned, not re-learned.
    if (st.clean.length >= P.lockDays) st.clean = st.clean.slice(1);
  }
  st.reps += 1;
  if (isLocked(st)) {
    st.s = 'review';
    st.ivl = Math.max(st.ivl, P.lockedMinIvl);
  } else if (st.reps >= 2 && st.ivl >= 3) st.s = 'review';
  st.last = day;
  st.due = day + st.ivl;
  st.hist.push([day, rating[0], st.bpm]);
  if (st.hist.length > 12) st.hist = st.hist.slice(-12);
  return st;
}

// Probability the item is still solid, a rough forgetting curve.
export function retrievability(st, day) {
  if (!st || st.last == null) return 0;
  const gap = Math.max(0, day - st.last);
  const stability = Math.max(1, st.ivl) * 1.5;
  return Math.exp(-gap / stability);
}

// Higher = shakier. Used to put the weakest items first.
export function shakiness(st, item, day) {
  let s = 1 - retrievability(st, day);
  s += Math.min(0.6, st.lapses * 0.15);
  const recent = st.hist.slice(-3);
  s += recent.filter((h) => h[1] === 'm').length * 0.3 + recent.filter((h) => h[1] === 's').length * 0.15;
  if (hasTempo(item)) s += 0.5 * (1 - st.bpm / item.bpm[1]);
  s += Math.max(0, day - st.due) * 0.02;
  return s;
}

export function isDue(st, day) {
  return !!st && st.due <= day;
}

// Rating from an auto-graded quiz score (fretboard notes, ear).
export function ratingFromScore(frac) {
  return frac >= 0.85 ? 'clean' : frac >= 0.6 ? 'sloppy' : 'miss';
}

// Skip an item already known (placement): lock it in with a long interval.
export function skipState(item, day) {
  const st = newState(item, day);
  st.bpm = hasTempo(item) ? item.bpm[1] : 0;
  st.clean = [day - 2, day - 1, day];
  st.s = 'review';
  st.ivl = 14;
  st.reps = 3;
  st.last = day;
  st.due = day + 7 + (item.id.length % 7); // spread the first check-ins out
  st.skipped = true;
  return st;
}
