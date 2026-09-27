// App shell: store, router, tab bar, theme.
import { createStore } from './store.js';
import { dayNumber } from './srs.js';
import { h, clear, icon } from './ui/dom.js';
import { stopAll } from './audio.js';
import { ruleDataUri } from './ui/fretboard.js';
import * as today from './ui/today.js';
import * as session from './ui/session.js';
import * as placement from './ui/placement.js';
import * as pick from './ui/pick.js';
import * as neck from './ui/neck.js';
import * as jam from './ui/jam.js';
import * as ear from './ui/ear.js';
import * as you from './ui/you.js';
import * as moves from './ui/movesTab.js';

const SCREENS = { today, session, placement, pick, neck, moves, jam, ear, you };
const TABS = [
  ['today', 'Today', 'today'],
  ['neck', 'Neck', 'neck'],
  ['pick', 'Pick', 'pick'],
  ['moves', 'Moves', 'moves'],
  ['jam', 'Jam', 'jam'],
  ['you', 'You', 'you'],
];
const TAB_OF = { session: 'today', placement: 'today', ear: 'today' };

export function boot(mount) {
  const day = dayNumber();
  const store = createStore(day);
  let route = { name: 'today', params: {} };
  const hash = (location.hash || '').slice(1);
  if (SCREENS[hash] && hash !== 'session') route = { name: hash, params: {} };

  // Shared drawing bits: pencil rules for section breaks, a wobble filter for icons, pencil hatching.
  document.documentElement.style.setProperty('--rule-l', ruleDataUri('#4e525a'));
  document.documentElement.style.setProperty('--rule-d', ruleDataUri('#8f8e86'));
  const defs = document.createElement('div');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  defs.innerHTML = '<svg width="0" height="0"><defs><filter id="pencil-wobble"><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter><pattern id="hatch-ink" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" stroke-width="1.5"/></pattern></defs></svg>';
  defs.style.color = 'var(--ink-2)';
  document.body.append(defs);
  const main = h('main#main', { tabindex: -1 });
  const nav = h('nav', { 'aria-label': 'Sections' });
  const bar = h('div.tabbar', nav);
  mount.append(main);
  document.body.append(bar);

  const ctx = {
    store,
    day,
    get state() {
      return store.get();
    },
    update: (fn) => store.update(fn),
    go(name, params = {}) {
      const prev = SCREENS[route.name];
      if (prev && prev.cleanup) prev.cleanup();
      stopAll();
      if (name === 'session' && params.fresh) session.reset();
      if (name === 'placement') placement.reset();
      route = { name, params };
      try {
        history.replaceState(null, '', name === 'session' ? '#today' : '#' + name);
      } catch {
        /* sandboxed history */
      }
      renderRoute();
      window.scrollTo({ top: 0 });
    },
    rerender: () => renderRoute(),
    applyTheme,
  };

  function applyTheme() {
    const t = store.get().settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else if (document.documentElement.dataset.appTheme) document.documentElement.removeAttribute('data-theme');
    document.documentElement.dataset.appTheme = t;
  }

  function drawTabs() {
    const active = TAB_OF[route.name] || route.name;
    clear(nav);
    for (const [id, label, ico] of TABS)
      nav.append(
        h('button', { type: 'button', 'aria-current': active === id ? 'page' : null, id: 'tab-' + id, onclick: () => {
          if (id === 'today' && route.name === 'session') return;
          ctx.go(id);
        } }, icon(ico, 22), h('span', label)),
      );
  }

  function renderRoute() {
    clear(main);
    try {
      SCREENS[route.name].render(main, ctx, route.params);
    } catch (e) {
      console.error(e);
      main.append(h('div.card.stack', h('h2', 'Something broke'), h('p.small.mono', String(e && e.message)), h('button.btn', { type: 'button', onclick: () => ctx.go('today') }, 'Back to today')));
    }
    drawTabs();
  }

  applyTheme();
  renderRoute();
  // Pull the account copy; if it is newer than this device's, redraw with it.
  store.connect(() => {
    if (route.name !== 'session') renderRoute();
  });
  window.__app = ctx;
  return ctx;
}
