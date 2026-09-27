// Ear: quick quizzes, plus a hands-free spoken mode for walks and commutes.
import { h, btn, seg } from './dom.js';
import { itemCard, earQuestion } from './items.js';
import * as A from '../audio.js';
import { ITEMS, ITEM_BY_ID, LICKS } from '../content.js';
import { plan, prereqsMet } from '../planner.js';
import { isLocked, rate, newState } from '../srs.js';
import { logMinutes } from '../state.js';

let hf = { mins: 10, running: false, ctl: null };
let practising = null;

export function render(root, ctx, params) {
  if (practising) return renderPractice(root, ctx);
  const earItems = ITEMS.filter((i) => i.kind === 'ear');
  const list = h('div.list');
  for (const it of earItems) {
    const st = ctx.state.items[it.id];
    const open = st || prereqsMet(ctx.state, it);
    list.append(
      h(
        'div.li',
        h('div.grow', h('div', it.title), h('div.small.muted', isLocked(st) ? 'Locked in' : st ? `${st.clean.length}/3 clean days` : open ? 'Ready' : 'Unlocks later')),
        open ? btn('Quiz', () => ((practising = it.id), ctx.rerender()), { cls: 'quiet small' }) : null,
      ),
    );
  }
  const minsHolder = h('div');
  const drawMins = () => minsHolder.replaceChildren(seg([5, 10, 20].map((m) => ({ value: m, label: m + ' min' })), hf.mins, (v) => ((hf.mins = v), drawMins()), { label: 'Hands-free length', id: 'hf-len' }));
  drawMins();
  const stage = h('div.hf-stage', { hidden: true });
  const startB = btn('Start hands-free', () => startHandsFree(ctx, stage, startB), { cls: 'primary big', ico: 'headphones', id: 'hf-start' });
  root.append(
    h(
      'div.stack-lg',
      h('div.stack', btn('Back', () => ctx.go('today'), { cls: 'ghost small', ico: 'back' }), h('h1', 'Ear'), h('p.muted', 'For dead time: walks, the bus, washing up. No guitar needed. Licks you sing now come back later with the guitar in hand.')),
      h('section.sect', h('h2', 'Hands-free'), h('p.small.muted', 'Like a course on tape. It says the question, plays the sound, pauses while you answer out loud, then tells you. Headphones in, phone in pocket.'), minsHolder, startB, stage, A.canSpeak() ? null : h('p.small.muted', 'This browser has no voice, so prompts appear as captions only.')),
      h('section.sect', h('h2', 'Quizzes'), list),
    ),
  );
  if (params && params.handsFree && !hf.running) {
    params.handsFree = false;
    startB.focus();
  }
}

function renderPractice(root, ctx) {
  const item = ITEM_BY_ID[practising];
  const card = itemCard(item, ctx.state.items[item.id], {}, {
    ctx,
    onRate: (r) => {
      ctx.update((s) => logMinutes({ ...s, items: { ...s.items, [item.id]: rate(s.items[item.id] || newState(item, ctx.day), item, r, ctx.day) } }, ctx.day, 'ear', item.mins));
      practising = null;
      ctx.rerender();
    },
  });
  root.append(h('div.stack-lg', btn('Back', () => ((practising = null), A.stopAll(), ctx.rerender()), { cls: 'ghost small', ico: 'back' }), card));
}

async function startHandsFree(ctx, stage, startB) {
  if (hf.running) {
    hf.ctl?.abort();
    A.stopAll();
    return;
  }
  const steps = plan(ctx.state, { minutes: hf.mins, day: ctx.day, handsFree: true }).filter((s) => s.type === 'item');
  let items = steps.map((s) => ITEM_BY_ID[s.id]).filter((i) => i && i.kind === 'ear');
  if (!items.length) items = [ITEM_BY_ID['ear-int1'], ITEM_BY_ID['ear-q1']];
  hf.running = true;
  hf.ctl = new AbortController();
  const signal = hf.ctl.signal;
  startB.querySelector('span').textContent = 'Stop';
  startB.classList.add('on');
  stage.hidden = false;
  const said = h('div.said', { 'aria-live': 'polite' });
  const sub = h('p.small.muted');
  stage.replaceChildren(said, sub);
  const say = async (text) => {
    said.textContent = text;
    if (ctx.state.settings.voice !== false) await A.speak(text);
    else await A.sleep(600 + text.length * 45, signal);
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
  };
  A.keepAwake(true);
  const started = Date.now();
  const heard = new Set();
  const perItem = Math.max(3, Math.round((hf.mins * 60) / 25 / items.length));
  try {
    await say('Hands-free ear training. Answer out loud.');
    for (let round = 0; Date.now() - started < hf.mins * 60000; round++) {
      const item = items[round % items.length];
      sub.textContent = item.title;
      await say(item.title + '.');
      for (let k = 0; k < perItem && Date.now() - started < hf.mins * 60000; k++) {
        const q = earQuestion(item);
        if (q.sing) {
          await say('Listen.');
          await A.sleep(q.play(), signal);
          await say('Sing it back.');
          await A.sleep(4000, signal);
          await say('Once more.');
          await A.sleep(q.play(), signal);
          const id = Object.entries(LICKS).find(([, v]) => v === q.lick)?.[0];
          if (id) heard.add(id);
          await say('Remember it. You will find it on the guitar later.');
        } else {
          await say(q.prompt);
          const ms = q.play();
          await A.sleep(ms, signal);
          if (q.stop) A.stopAll();
          await A.sleep(3200, signal);
          await say(q.answer + '. ' + (q.reveal || ''));
        }
        await A.sleep(500, signal);
      }
    }
    await say('That’s your time. Nice one.');
  } catch {
    /* stopped */
  }
  A.stopAll();
  A.keepAwake(false);
  hf.running = false;
  startB.querySelector('span').textContent = 'Start hands-free';
  startB.classList.remove('on');
  const mins = Math.max(1, Math.round((Date.now() - started) / 60000));
  // Hands-free answers are spoken, so the app cannot mark them. You rate the session.
  const finish = (r) => {
    ctx.update((s) => {
      let out = logMinutes(s, ctx.day, 'ear', mins);
      const itemsState = { ...out.items };
      for (const it of items) itemsState[it.id] = rate(itemsState[it.id] || newState(it, ctx.day), it, r, ctx.day);
      // Licks you sang come back with the guitar tomorrow.
      for (const lid of heard) {
        const li = ITEMS.find((x) => x.kind === 'lick' && x.data.lick === lid);
        if (li && itemsState[li.id]) itemsState[li.id] = { ...itemsState[li.id], due: Math.min(itemsState[li.id].due, ctx.day + 1) };
      }
      return { ...out, items: itemsState };
    });
    stage.replaceChildren(h('p', 'Logged ' + mins + ' min.' + (heard.size ? ' The licks you sang are queued for your next guitar session.' : '')));
  };
  stage.replaceChildren(
    h('div.said', 'How did you do?'),
    h('p.small.muted', 'You answered out loud, so only you know.'),
    h('div.rate', h('button.r-clean', { type: 'button', onclick: () => finish('clean') }, 'Mostly right'), h('button.r-sloppy', { type: 'button', onclick: () => finish('sloppy') }, 'About half'), h('button.r-miss', { type: 'button', onclick: () => finish('miss') }, 'Mostly wrong')),
  );
}

export function cleanup() {
  if (hf.running) hf.ctl?.abort();
  A.stopAll();
}
