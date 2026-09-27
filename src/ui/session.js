// The session runner: steps from the planner, one card at a time, then "Done. Go live your life."
import { h, btn, icon, toast } from './dom.js';
import { itemCard, songCard, playoutCard } from './items.js';
import { plan, findItem } from '../planner.js';
import { forecast, streak, formatDuration, formatMinutes, milestoneStatus } from '../progress.js';
import { rate, newState, isLocked } from '../srs.js';
import { logMinutes } from '../state.js';
import { MILESTONES } from '../content.js';
import { stopAll } from '../audio.js';

let session = null;

export function start(ctx, { minutes, handsFree = false }) {
  const state = ctx.state;
  const f = forecast(state, ctx.day);
  const milestoneIds = new Set(MILESTONES.slice(0, f.idx + 1).flatMap((m) => m.items));
  session = { steps: plan(state, { minutes, day: ctx.day, milestoneIds, handsFree }), i: 0, minutes, before: f, beforeMs: milestoneStatus(state), spent: 0, locked: [], started: Date.now() };
  return session;
}

export function render(root, ctx, params) {
  if (!session || params.fresh || (params.minutes && session.minutes !== params.minutes && session.i === 0)) start(ctx, params);
  params.fresh = false;
  if (session.i >= session.steps.length) return renderDone(root, ctx);
  const step = session.steps[session.i];
  const dots = h('div.progress-dots', { 'aria-hidden': 'true' }, session.steps.map((_, j) => h('span', { class: j < session.i ? 'done' : j === session.i ? 'cur' : '' })));
  const top = h(
    'div.row.between.nowrap',
    h('div.grow.stack', { style: { gap: '6px' } }, h('div.small.muted', `Step ${session.i + 1} of ${session.steps.length} · ${session.minutes} min session`), dots),
    btn('', () => endEarly(ctx), { cls: 'ghost icon-only', ico: 'close', title: 'End session' }),
  );
  const advance = (mins) => {
    session.spent += mins;
    session.i++;
    ctx.rerender();
    window.scrollTo({ top: 0 });
  };
  let card;
  if (step.type === 'item') {
    const item = findItem(ctx.state, step.id);
    if (!item) return advance(0);
    const st = ctx.state.items[item.id];
    card = itemCard(item, st, step.variant, {
      ctx,
      isNew: step.isNew,
      onRate: (r, bpmOverride) => {
        ctx.update((s) => {
          let prev = s.items[item.id] || newState(item, ctx.day);
          if (bpmOverride) prev = { ...prev, bpm: bpmOverride };
          const was = isLocked(prev);
          const next = rate(prev, item, r, ctx.day);
          if (!was && isLocked(next)) session.locked.push(item.title);
          let out = { ...s, items: { ...s.items, [item.id]: next } };
          if (item.cheat && !out.seenCheats.includes(item.cheat)) out = { ...out, seenCheats: [...out.seenCheats, item.cheat] };
          return logMinutes(out, ctx.day, item.track, step.mins);
        });
        if (session.locked.includes(item.title)) toast(`Locked in: ${item.title}`);
        advance(step.mins);
      },
    });
  } else if (step.type === 'song') {
    const song = (ctx.state.songs || []).find((s) => s.id === step.id);
    if (!song) return advance(0);
    card = songCard(song, {
      onRate: (r) => {
        ctx.update((s) => {
          const songs = s.songs.map((x) => (x.id === song.id ? { ...x, state: rate(x.state || newState({ id: x.id, bpm: [0, 0] }, ctx.day), { id: x.id, bpm: [0, 0] }, r, ctx.day) } : x));
          return logMinutes({ ...s, songs }, ctx.day, 'hands', step.mins);
        });
        advance(step.mins);
      },
    });
  } else {
    card = playoutCard(step, {
      onDone: () => {
        ctx.update((s) => logMinutes(s, ctx.day, 'create', step.mins));
        advance(step.mins);
      },
    });
  }
  const skip = step.type === 'item' ? btn('Skip this one', () => advance(0), { cls: 'ghost small', id: 'skip' }) : null;
  root.append(h('div.stack-lg', top, card, skip));
}

function endEarly(ctx) {
  stopAll();
  if (!session) return ctx.go('today');
  session.i = session.steps.length;
  ctx.rerender();
}

function renderDone(root, ctx) {
  stopAll();
  const s = session;
  const state = ctx.state;
  const after = forecast(state, ctx.day);
  const st = streak(state, ctx.day);
  const msNow = milestoneStatus(state);
  const reached = msNow.filter((m, i) => m.done && !s.beforeMs[i].done);
  const saved = s.before.idx === after.idx ? s.before.totalMinutes - after.totalMinutes : null;
  const lines = [];
  if (reached.length) lines.push(h('p.panel', h('b', 'Milestone reached: ' + reached.map((m) => m.name).join(', ') + '. '), 'That one is real. Go and play it for someone.'));
  if (s.locked.length) lines.push(h('p', h('b', 'Locked in today: '), s.locked.join(', '), '.'));
  if (saved != null && saved > 0.5) lines.push(h('p', `${after.milestone.name} is ${formatMinutes(saved)} closer. About ${formatDuration(after.days)} to go at this pace.`));
  else lines.push(h('p', `${after.milestone.name}: about ${formatDuration(after.days)} to go at this pace.`));
  const honest = [
    'The app gets your hands ready. Playing actual songs, badly, with people, gets you the rest.',
    'Now pick up the guitar without the app and noodle for five minutes. That is where writing happens.',
    'Sessions alone will not make you sound like a record. Copying records will. Try one by ear this week.',
  ][ctx.day % 3];
  root.append(
    h(
      'div.stack-lg',
      h('div.done-hero', h('div.label', 'session complete'), h('h1', 'Done. ', h('span', 'Go live your life.')), h('p.mono.small.muted', `${Math.max(1, Math.round(s.spent))} min${st.last7 ? ` · ${st.last7} of the last 7 days` : ''}`)),
      h('section.sect', ...lines, h('p.small.muted', honest)),
      h('div.row', btn('Back to today', () => {
        session = null;
        ctx.go('today');
      }, { cls: 'primary', id: 'done-home' }), btn('Another 10 minutes', () => {
        session = null;
        ctx.go('session', { minutes: 10, fresh: true });
      }, { cls: 'quiet' })),
    ),
  );
}

export function reset() {
  session = null;
}
