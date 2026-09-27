// Builds today's session. One tap to start: the app decides what to practise.
import { ITEMS, ITEM_BY_ID, PROGRESSIONS, FRIENDLY_KEYS, PICKS } from './content.js';
import { isDue, isLocked, shakiness, retrievability } from './srs.js';
import { forecast, paceFor } from './progress.js';

// Work in progress: how many unfinished items may be on the go before new material waits.
// Tuned by simulation: 8 suits 5 min/day, 16 suits 20-30 min/day, so it scales with your real pace.
export function wipCapFor(state, day) {
  const p = paceFor(state, day).pace;
  const guitar = p.hands + p.neck + p.create;
  return Math.max(6, Math.min(16, Math.round(4 + guitar / 2)));
}

export const LENGTHS = [
  { mins: 2, label: 'Sprint', sub: '2 min' },
  { mins: 10, label: 'Quick', sub: '10 min' },
  { mins: 20, label: 'Usual', sub: '20 min' },
  { mins: 30, label: 'Proper', sub: '30 min' },
  { mins: 60, label: 'Weekend', sub: '60 min' },
];

export function allItems(state) {
  return [...ITEMS, ...Object.values(state.custom || {})];
}

export function findItem(state, id) {
  return ITEM_BY_ID[id] || (state.custom || {})[id] || null;
}

export function prereqsMet(state, item) {
  return (item.prereq || []).every((p) => {
    const st = state.items[p];
    return st && (st.reps >= 2 || isLocked(st));
  });
}

export function variantFor(item, st, day) {
  const reps = st ? st.reps : 0;
  const d = item.data || {};
  if (d.keys) return { key: d.keys[(reps + day) % d.keys.length] };
  if (item.kind === 'barre') return { rotate: (reps + day) % d.chords.length };
  return {};
}

// Order tracks by how far behind they are: the bottleneck first.
export function trackOrder(state, day) {
  const f = forecast(state, day);
  let order = [...f.tracks].sort((a, b) => b.minutes / Math.max(0.1, b.pace) - a.minutes / Math.max(0.1, a.pace)).map((t) => t.id);
  const focus = state.coach && state.coach.focus && state.coach.until >= day ? state.coach.focus : null;
  if (focus) order = [focus, ...order.filter((t) => t !== focus)];
  return order;
}

function newCandidates(state, track, milestoneIds) {
  const fresh = allItems(state).filter((it) => !state.items[it.id] && prereqsMet(state, it) && (!track || it.track === track));
  // Items belonging to the current (or earlier) milestone come first, then curriculum order.
  return fresh.sort((a, b) => (milestoneIds.has(b.id) ? 1 : 0) - (milestoneIds.has(a.id) ? 1 : 0));
}

export function plan(state, { minutes, day, milestoneIds = new Set(), handsFree = false, opts = {} }) {
  const { throttle = true, shakiestFirst = true } = opts;
  const wipCap = opts.wipCap ?? wipCapFor(state, day);
  const steps = [];
  let budget = minutes;
  const items = allItems(state);
  // Ear work belongs to dead time, but if it has been starved for a week and is the bottleneck, it joins the session.
  let earMins7 = 0;
  for (let d = day - 6; d <= day; d++) earMins7 += (state.log?.[d]?.ear || 0);
  const order0 = trackOrder(state, day);
  const earOk = handsFree || (order0[0] === 'ear' && (minutes >= 10 || earMins7 < 3));
  const EAR_IN_SESSION = 2;
  const due = items
    .filter((it) => isDue(state.items[it.id], day))
    .map((it) => ({ it, shake: shakiness(state.items[it.id], it, day) }))
    .sort((a, b) => (shakiestFirst ? b.shake - a.shake : state.items[a.it.id].due - state.items[b.it.id].due))
    .map((x) => x.it)
    // Ear items are for dead time; inside a guitar session only if nothing else is due.
    .filter((it) => it.kind !== 'ear' || earOk);
  const songsDue = (state.songs || []).filter((s) => isDue(s.state, day));
  const dueMins = due.reduce((a, it) => a + it.mins, 0) + songsDue.length * 2.5;

  // Backlog protection: when reviews pile up, new material waits.
  let newCap;
  if (minutes <= 2) newCap = due.length ? 0 : 1;
  else if (!throttle) newCap = Math.max(1, Math.floor(minutes / 5));
  else if (dueMins > minutes * 1.5) newCap = 0;
  else if (dueMins > minutes * 0.75) newCap = 1;
  else newCap = Math.max(1, Math.floor(minutes / 5));

  // Finish things before starting new ones: too many half-learned items and nothing ever locks in.
  const wip = items.filter((it) => state.items[it.id] && !isLocked(state.items[it.id]) && (handsFree ? it.kind === 'ear' : it.kind !== 'ear')).length;
  if (wip >= (handsFree ? Math.ceil(wipCap / 2) : wipCap)) newCap = Math.min(newCap, minutes >= 20 && wip < wipCap + 3 ? 1 : 0);

  const playout = minutes >= 5 ? 1 : 0;
  budget -= playout;

  const push = (step) => {
    steps.push(step);
    budget -= step.mins;
  };
  const earSteps = () => steps.filter((x) => x.type === 'item' && findItem(state, x.id)?.kind === 'ear').length;
  const addItem = (it, isNew) => {
    if (!handsFree && it.kind === 'ear' && earSteps() >= EAR_IN_SESSION) return;
    const st = state.items[it.id];
    push({ type: 'item', id: it.id, isNew, variant: variantFor(it, st, day), mins: isNew ? it.mins * 1.3 : it.mins });
  };

  // 1. Shakiest review first.
  const queue = [...due];
  if (queue.length && budget > 0) addItem(queue.shift(), false);

  // 2. New items from the slowest tracks, one per track.
  const order = order0.filter((t) => (handsFree ? t === 'ear' : t !== 'ear' || earOk));
  let added = 0;
  for (const t of [...order, ...order]) {
    if (added >= newCap || budget <= 0.5) break;
    const cand = newCandidates(state, t, milestoneIds).filter((c) => !steps.some((s) => s.id === c.id));
    if (!cand.length) continue;
    addItem(cand[0], true);
    added++;
  }

  // 3. The rest of the due reviews, then songs.
  while (queue.length && budget > 0.5) addItem(queue.shift(), false);
  for (const s of songsDue) {
    if (budget < 1.5 || handsFree) break;
    push({ type: 'song', id: s.id, mins: 2.5 });
  }

  // 4. Spare time: extra reps on the shakiest in-progress items that are not due yet.
  if (budget > 1) {
    const extra = items
      .filter((it) => state.items[it.id] && !isLocked(state.items[it.id]) && !steps.some((s) => s.id === it.id))
      .filter((it) => (handsFree ? it.kind === 'ear' : it.kind !== 'ear'))
      .sort((a, b) => retrievability(state.items[a.id], day) - retrievability(state.items[b.id], day));
    for (const it of extra) {
      if (budget <= 1) break;
      addItem(it, false);
    }
  }

  // 5. Nothing at all to do (everything locked): keep going with new material.
  if (!steps.length) {
    const cand = newCandidates(state, null, milestoneIds).filter((c) => (handsFree ? c.kind === 'ear' : c.kind !== 'ear'));
    if (cand.length) addItem(cand[0], true);
  }

  if (playout && !handsFree) steps.push({ type: 'playout', mins: 1, ...playoutFor(state, day) });
  return steps;
}

// Every session ends with a minute of free playing over a loop. Mumbling counts.
export function playoutFor(state, day) {
  const ideas = state.ideas || [];
  if (ideas.length && day % 2 === 0) {
    const idea = ideas[day % ideas.length];
    return { chords: idea.chords, key: idea.key, pattern: idea.pattern || 'travis', name: idea.name };
  }
  const progIds = ['folk', 'four', 'sadfour', 'britpop', 'fifties', 'mixo'];
  const prog = progIds[day % progIds.length];
  const key = FRIENDLY_KEYS[(day >> 1) % 3];
  const known = Object.keys(PICKS).filter((p) => state.items['pk-' + p] || p === 'travis');
  const pattern = known[day % known.length] || 'travis';
  return { prog, key, pattern, name: PROGRESSIONS[prog].name };
}
