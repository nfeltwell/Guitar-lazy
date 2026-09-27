// Today: one tap to start. Countdown to the next milestone, the slowest track called out.
import { h, btn, seg, toast } from './dom.js';
import { LENGTHS, plan, findItem } from '../planner.js';
import { forecast, paceFor, streak, formatDuration, formatMinutes, milestoneStatus } from '../progress.js';
import { MILESTONES } from '../content.js';
import { logMinutes } from '../state.js';

function dayPart() {
  const d = new Date();
  const hr = d.getHours();
  return { day: d.toLocaleDateString('en-GB', { weekday: 'long' }), part: hr < 5 ? 'night' : hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : hr < 22 ? 'evening' : 'night', date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) };
}

function compact(mins) {
  if (mins < 60) return Math.max(1, Math.round(mins)) + 'm';
  const hrs = mins / 60;
  return (hrs < 10 ? hrs.toFixed(1).replace(/\.0$/, '') : Math.round(hrs)) + 'h';
}

export function trackBars(f) {
  const max = Math.max(1, ...f.tracks.map((t) => (t.days === Infinity ? 0 : t.days)));
  const slow = f.slowest.id;
  return h(
    'div.tracks',
    f.tracks.map((t) =>
      h(
        'div.trk',
        { class: t.id === slow && t.minutes > 0 ? 'slowest' : '' },
        h('span.trk-name', t.name),
        h('div.bar', { role: 'img', 'aria-label': `${t.name}: ${formatMinutes(t.minutes)} left` }, h('span', { style: { width: Math.max(1.5, Math.min(100, ((t.days === Infinity ? max : t.days) / max) * 100)) + '%' } })),
        h('span.mono', t.minutes < 1 ? 'done' : formatMinutes(t.minutes)),
      ),
    ),
  );
}

export function render(root, ctx) {
  const state = ctx.state;
  const day = ctx.day;
  const f = forecast(state, day);
  const pace = paceFor(state, day);
  const ms = milestoneStatus(state);
  const goalIdx = MILESTONES.findIndex((m) => m.isGoal);
  const st = streak(state, day);
  const dp = dayPart();
  let len = state.settings.lastLen || 20;
  const lenSeg = h('div');
  const preview = h('div.list', { id: 'preview' });
  const drawLen = () => {
    lenSeg.replaceChildren(
      seg(LENGTHS.map((l) => ({ value: l.mins, label: l.sub })), len, (v) => {
        len = v;
        drawLen();
      }, { label: 'Session length', id: 'len', wide: true }),
    );
    const steps = plan(state, { minutes: len, day, milestoneIds: new Set(MILESTONES.slice(0, f.idx + 1).flatMap((m) => m.items)) });
    const rows = steps.filter((s) => s.type !== 'playout').slice(0, 5);
    preview.replaceChildren(
      ...rows.map((s) => {
        const it = s.type === 'item' ? findItem(state, s.id) : null;
        const song = s.type === 'song' ? (state.songs || []).find((x) => x.id === s.id) : null;
        return h('div.li', h('span.grow', it ? it.title : song ? song.title : ''), h('span.label', s.isNew ? 'new' : s.type === 'song' ? 'song' : 'review'));
      }),
      steps.length > rows.length + 1 ? h('div.li', h('span.label.grow', `+ ${steps.length - rows.length - 1} more, then a minute of free play`)) : h('div.li', h('span.label.grow', 'then a minute of free play')),
    );
  };
  drawLen();

  const slowName = f.slowest.minutes > 0 ? f.slowest.name : null;
  const countdown = h(
    'section.sect.countdown',
    { 'aria-label': 'Countdown' },
    h('div.sect-head', h('span.label', 'next milestone'), h('span.label', `${ms[f.idx].locked}/${ms[f.idx].total} locked in`)),
    h('h2', f.milestone.name),
    h('p.small.muted', f.milestone.goal),
    h('div.row', { style: { alignItems: 'flex-end', gap: '14px' } }, h('span.num', compact(f.totalMinutes)), h('p.small', { style: { paddingBottom: '6px' } }, 'of practice left.', h('br'), isFinite(f.days) ? `About ${formatDuration(f.days)} at ${pace.assumed ? (state.settings.dailyMins || 20) + ' min a day' : 'your recent pace'}.` : 'At your current pace this never finishes.')),
    trackBars(f),
    h('p.small.muted', slowName ? `${slowName} is the slowest, so it sets the date. Sessions lean towards it.` : 'Everything is on track.', f.idx < goalIdx ? ` Your goal, ${MILESTONES[goalIdx].name}, is milestone ${goalIdx + 1} of ${MILESTONES.length}.` : ''),
  );

  const outside = h('div.stack', { hidden: true });
  const logOut = (mins) => {
    ctx.update((s) => logMinutes(s, day, 'outside', mins));
    toast(`Logged ${mins} min. Streak kept.`);
    ctx.rerender();
  };
  outside.append(
    h('p.small.muted', 'Played songs, jammed, watched a lesson? Log it and your streak keeps going. The countdown only moves when items lock in, so it stays honest.'),
    h('div.row', [15, 30, 60, 120].map((m) => btn(m + ' min', () => logOut(m), { cls: 'quiet small' }))),
  );

  root.append(
    h(
      'div.stack-lg',
      h('header.stack', { style: { gap: '6px' } }, h('div.label', `${dp.date} · ${dp.part}`), h('h1', dp.day), h('p.small.muted', st.last7 ? `${st.last7} of the last 7 days${st.streak > 1 ? ` · ${st.streak}-day streak` : ''}. A day off never breaks it.` : 'Pick it up, get decent, go play.')),
      !state.placement.done
        ? h('section.panel.stack', h('h3', 'You’re not starting from zero'), h('p.small', 'Three minutes: say what you can do, play five things, and the app skips what you already have.'), btn('Placement check', () => ctx.go('placement'), { cls: 'primary', id: 'placement-go' }))
        : null,
      h('section.stack', { 'aria-label': 'Start a session' }, h('div.label', 'how long have you got'), lenSeg, btn('Start', () => {
        ctx.update((s) => ({ ...s, settings: { ...s.settings, lastLen: len } }));
        ctx.go('session', { minutes: len, fresh: true });
      }, { cls: 'primary big', ico: 'play', id: 'start' }), preview),
      countdown,
      h(
        'section.sect',
        h('div.row', btn('Hands-free ear training', () => ctx.go('ear', { handsFree: true }), { cls: 'quiet', ico: 'headphones', id: 'go-ear' }), btn('Log practice', () => (outside.hidden = !outside.hidden), { cls: 'ghost small', id: 'log-out' })),
        outside,
      ),
    ),
  );
}
