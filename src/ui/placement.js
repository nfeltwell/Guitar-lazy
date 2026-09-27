// Placement check: say what you can do, prove a few items, skip what you already play.
import { h, btn, seg } from './dom.js';
import { itemCard } from './items.js';
import { PLACEMENT, ITEM_BY_ID } from '../content.js';
import { applyPlacement } from '../state.js';

let stage = null;

export function render(root, ctx) {
  if (!stage) stage = { step: 'ask', answers: Object.fromEntries(PLACEMENT.ask.map((a) => [a.id, ctx.state.placement.answers?.[a.id] || a.default])), daily: ctx.state.settings.dailyMins || 20, tested: {}, t: 0 };
  if (stage.step === 'ask') return renderAsk(root, ctx);
  if (stage.step === 'test') return renderTest(root, ctx);
  return renderSummary(root, ctx);
}

function renderAsk(root, ctx) {
  const rows = PLACEMENT.ask.map((a) => {
    const holder = h('div');
    const draw = () =>
      holder.replaceChildren(
        seg([{ value: 'none', label: 'Not yet' }, { value: 'some', label: 'A bit' }, { value: 'solid', label: 'Solid' }], stage.answers[a.id], (v) => {
          stage.answers[a.id] = v;
          draw();
        }, { label: a.q, id: 'pl-' + a.id }),
      );
    draw();
    return h('div.stack', { style: { gap: '6px' } }, h('div', a.q), holder);
  });
  const dailyHolder = h('div');
  const drawDaily = () =>
    dailyHolder.replaceChildren(
      seg([10, 20, 30, 45].map((m) => ({ value: m, label: m + ' min' })), stage.daily, (v) => {
        stage.daily = v;
        drawDaily();
      }, { label: 'Typical daily practice', id: 'pl-daily' }),
    );
  drawDaily();
  root.append(
    h(
      'div.stack-lg',
      h('div.stack', h('div.label', 'placement check · 1 of 3'), h('h1', 'What can you already do?'), h('p.muted', 'Filled in from what you told me. Change anything that’s off.')),
      h('section.sect.stack-lg', ...rows),
      h('section.sect', h('h3', 'On an average day, how long do you play?'), h('p.small.muted', 'Averaged over the week, including long weekends and days off. The countdown uses this until it has two weeks of your real history.'), dailyHolder),
      btn('Next: play a few things', () => {
        stage.step = 'test';
        ctx.rerender();
      }, { cls: 'primary big', id: 'pl-next' }),
    ),
  );
}

function renderTest(root, ctx) {
  const ids = PLACEMENT.tests;
  if (stage.t >= ids.length) {
    stage.step = 'summary';
    return render(root, ctx);
  }
  const item = ITEM_BY_ID[ids[stage.t]];
  const card = itemCard(item, null, item.data.keys ? { key: item.data.keys[0] } : {}, {
    ctx,
    compactHeader: true,
    onRate: (r) => {
      stage.tested[item.id] = r;
      stage.t++;
      ctx.rerender();
      window.scrollTo({ top: 0 });
    },
  });
  root.append(
    h(
      'div.stack-lg',
      h('div.stack', h('div.label', `placement check · 2 of 3 · test ${stage.t + 1} of ${ids.length}`), h('p.muted', 'Try it at the tempo shown. Clean means you could play it on a recording. Be honest: a wrong "clean" just skips something you need.')),
      card,
      btn('I haven’t learned this yet', () => {
        stage.tested[item.id] = 'miss';
        stage.t++;
        ctx.rerender();
      }, { cls: 'ghost small', id: 'pl-skip' }),
    ),
  );
}

function renderSummary(root, ctx) {
  const skipped = new Set();
  for (const [area, level] of Object.entries(stage.answers)) if (level === 'solid') (PLACEMENT.skip[area] || []).forEach((id) => skipped.add(id));
  for (const [id, r] of Object.entries(stage.tested)) if (r === 'clean') skipped.add(id);
  const names = [...skipped].map((id) => ITEM_BY_ID[id].title);
  root.append(
    h(
      'div.stack-lg',
      h('div.stack', h('div.label', 'placement check · 3 of 3'), h('h1', 'Here’s where you start'), h('p.muted', names.length ? `Skipping ${names.length} things you already play. They come back for a quick check in a week or two, in case.` : 'Nothing skipped. Day one starts from the top.')),
      names.length ? h('section.sect', h('ul', { style: { margin: 0, paddingLeft: '18px' } }, names.map((n) => h('li', n)))) : null,
      h('p', 'Your first sessions focus on fingerpicking and the fretboard, the two gaps you named. Theory shows up only when it unlocks something you can play.'),
      btn('Start playing', () => {
        ctx.update((s) => ({ ...applyPlacement(s, stage.answers, stage.tested, ctx.day), settings: { ...s.settings, dailyMins: stage.daily } }));
        stage = null;
        ctx.go('today');
      }, { cls: 'primary big', id: 'pl-done' }),
    ),
  );
}

export function reset() {
  stage = null;
}
