// You: the path, the honest countdown and its levers, history, recordings, repertoire, AI extras, library, settings.
import { h, btn, seg, select, field, toast, svg, icon } from './dom.js';
import { itemCard, songCard } from './items.js';
import { trackBars } from './today.js';
import { tab } from './fretboard.js';
import * as A from '../audio.js';
import { ITEMS, MILESTONES, TRACKS, ITEM_BY_ID } from '../content.js';
import { forecast, levers, milestoneStatus, paceFor, formatDuration, formatMinutes, streak, currentMilestoneIdx } from '../progress.js';
import { isLocked, newState, rate, hasTempo } from '../srs.js';
import { logMinutes, createState } from '../state.js';
import { allItems, findItem, prereqsMet } from '../planner.js';
import { getSample, generateLick, coachAdvice, aiErrorText } from '../ai.js';
import { CAL } from '../calibration.js';
import { SCALES } from '../theory.js';

let view = { practise: null, confirmReset: false };

export function render(root, ctx) {
  if (view.practise) return renderPractise(root, ctx);
  const state = ctx.state;
  const day = ctx.day;
  root.append(
    h(
      'div.stack-lg',
      h('div.stack', h('h1', 'You'), h('p.muted', 'The path, the numbers and the settings.')),
      pathSection(state, day),
      countdownSection(state, day),
      h('section.sect', h('h2', 'Ear'), h('p.small.muted', 'Quizzes and the hands-free mode for walks and commutes.'), btn('Open ear training', () => ctx.go('ear'), { cls: 'quiet', ico: 'headphones', id: 'you-ear' })),
      historySection(state, day),
      recordingSection(ctx),
      songsSection(ctx),
      aiSection(ctx),
      librarySection(ctx),
      settingsSection(ctx),
    ),
  );
}

function pathSection(state, day) {
  const ms = milestoneStatus(state);
  const cur = currentMilestoneIdx(state);
  const goalIdx = MILESTONES.findIndex((m) => m.isGoal);
  const goalF = forecast(state, day, goalIdx);
  return h(
    'section.sect',
    { 'aria-label': 'Milestones' },
    h('h2', 'The path'),
    h('p.small', `Your goal, ${MILESTONES[goalIdx].name}: ${formatMinutes(goalF.totalMinutes)} of practice, about ${formatDuration(goalF.days)} at your pace.`),
    h(
      'div.stack',
      ms.map((m, i) =>
        h(
          'div.ms',
          { class: (m.done ? 'done ' : '') + (i === cur && !m.done ? 'current ' : '') + (m.isGoal ? 'goal' : '') },
          h('div.ms-mark', m.done ? '✓' : String(i + 1).padStart(2, '0')),
          h('div', h('h3', m.name), h('p.small.muted', m.goal), h('div.mini-bar', h('span', { style: { width: (m.locked / m.total) * 100 + '%' } })), h('div.small.muted.mono', `${m.locked}/${m.total} locked in`)),
        ),
      ),
    ),
  );
}

function countdownSection(state, day) {
  const lv = levers(state, day);
  const pace = paceFor(state, day);
  const f = lv.now;
  const guitarPace = pace.pace.hands + pace.pace.neck + pace.pace.create;
  return h(
    'section.sect',
    { 'aria-label': 'Countdown' },
    h('h2', 'Countdown'),
    h('p', `${formatMinutes(f.totalMinutes)} left, about ${formatDuration(f.days)}. Each track counts down separately; the slowest sets the date.`),
    trackBars(f),
    h('p.small.muted', pace.assumed ? `Pace: using the ${state.settings.dailyMins || 20} min a day you told me, until there are two weeks of real history.` : `Pace: ${Math.round(guitarPace)} min a day with the guitar and ${Math.round(pace.pace.ear)} min of ear work, averaged over the last ${pace.span} days.`),
    h('h2', 'Levers'),
    h('div', lv.options.map((o) => h('div.lever', h('span', o.label), h('b', o.saved > 0.5 && isFinite(o.saved) ? formatDuration(o.days) + ' instead' : isFinite(f.days) ? 'no change' : formatDuration(o.days))))),
    h('p.small', h('b', 'The honest bit. '), 'Locking items in gets your hands ready. It won’t make you a songwriter on its own. That happens when you noodle with no app open, learn songs you love by ear, and play for people. The countdown only counts what the app can check.'),
    h('p.small.muted', `How it’s estimated: every item needs a measured number of reps to lock in (for example ${CAL.repsToLock.pick} for a picking pattern), plus review overhead, checked against a year of simulated practice by players like you. The median prediction was right on; half landed between two-thirds and one-and-a-half times the real time. Your own history replaces the assumptions after two weeks.`),
  );
}

function historySection(state, day) {
  const days = 14;
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = day - i;
    const e = state.log[d] || {};
    const total = Object.values(e).reduce((a, b) => a + b, 0);
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({ d, total, date });
  }
  const max = Math.max(30, ...data.map((x) => x.total));
  const W = 320;
  const H = 110;
  const pad = { l: 26, r: 4, t: 8, b: 18 };
  const bw = (W - pad.l - pad.r) / days;
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'hist', role: 'img', 'aria-label': 'Minutes practised per day, last 14 days' });
  const ticks = max > 60 ? [0, 30, 60, 90].filter((t) => t <= max) : [0, 15, 30].filter((t) => t <= max);
  for (const t of ticks) {
    chart.append(svg('line', { x1: pad.l, x2: W - pad.r, y1: y(t), y2: y(t), class: 'hist-grid' }));
    chart.append(svg('text', { x: pad.l - 4, y: y(t) + 3, 'text-anchor': 'end', class: 'hist-axis' }, String(t)));
  }
  data.forEach((x, i) => {
    const x0 = pad.l + i * bw + 1;
    const hgt = Math.max(0, y(0) - y(x.total));
    const g = svg('g', { class: 'hist-bar' + (i === days - 1 ? ' today' : '') });
    g.append(svg('title', {}, `${x.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}: ${Math.round(x.total)} min`));
    g.append(svg('rect', { x: x0 - 1, y: pad.t, width: bw, height: H - pad.t - pad.b, class: 'hist-hit' }));
    if (hgt > 0) g.append(svg('path', { d: barPath(x0, y(x.total), bw - 2, hgt), class: 'hist-fill' }));
    chart.append(g);
    if (i % 2 === 1 || i === days - 1) chart.append(svg('text', { x: x0 + (bw - 2) / 2, y: H - 5, 'text-anchor': 'middle', class: 'hist-axis' }, i === days - 1 ? 'today' : x.date.toLocaleDateString('en-GB', { weekday: 'narrow' })));
  });
  const st = streak(state, day);
  const total = data.reduce((a, b) => a + b.total, 0);
  return h(
    'section.sect',
    h('div.row.between', h('h2', 'Last two weeks'), h('span.small.mono', `${Math.round(total)} min`)),
    chart,
    h('p.small.muted', `${st.last7} of the last 7 days. Streak ${st.streak}, and a single day off never breaks it. Minutes include practice you logged from elsewhere.`),
    h(
      'details.small',
      h('summary', 'Table view'),
      h('table.small', { style: { width: '100%', borderCollapse: 'collapse' } }, h('tbody', data.map((x) => h('tr', h('td', x.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })), h('td.mono', { style: { textAlign: 'right' } }, Math.round(x.total) + ' min'))))),
    ),
  );
}

function dateOfDay(d, today) {
  const date = new Date();
  date.setDate(date.getDate() - (today - d));
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function barPath(x, yTop, w, hgt) {
  const r = Math.min(4, w / 2, hgt);
  return `M${x},${yTop + hgt}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yTop + hgt}Z`;
}

function recordingSection(ctx) {
  const state = ctx.state;
  const recs = state.recordings || [];
  const last = recs[0];
  const dueRec = !last || ctx.day - last.day >= 7;
  const note = h('input', { type: 'text', id: 'rec-note', placeholder: 'What did you play? What sounds better?', 'aria-label': 'Recording note', maxlength: 160 });
  const fileIn = h('input', { type: 'file', accept: 'video/*,audio/*', id: 'rec-file', 'aria-label': 'Recording file', hidden: true });
  const uploadRow = h('div.row', { hidden: true });
  let assets = null;
  const c = window.claude;
  if (c && typeof c.use === 'function')
    c.use('assets').then((a) => {
      assets = a;
      uploadRow.hidden = !a;
    }).catch(() => {});
  const save = async (file) => {
    let assetId = null;
    if (file) {
      if (file.size > 20 * 1024 * 1024) return toast('Over 20 MB. Trim it or record at a lower resolution.');
      toast('Uploading…');
      try {
        const res = await assets.upload(file);
        assetId = res.id;
      } catch (e) {
        return toast(e && e.code === 'unsupported_type' ? 'That file type isn’t accepted here. Record a short video instead.' : 'Upload failed. Your note is saved without the file.');
      }
    }
    ctx.update((s) => ({ ...s, recordings: [{ day: ctx.day, note: note.value.trim(), assetId, type: file?.type || null }, ...(s.recordings || [])].slice(0, 80) }));
    toast('Logged. Listen back to an old one sometime.');
    ctx.rerender();
  };
  fileIn.addEventListener('change', () => fileIn.files[0] && save(fileIn.files[0]));
  uploadRow.append(btn('Attach a short video', () => fileIn.click(), { cls: 'quiet small', ico: 'mic' }), h('span.small.muted', 'Up to 20 MB, about 30 seconds.'), fileIn);
  return h(
    'section.sect',
    { 'aria-label': 'Weekly recording' },
    h('div.row.between', h('h2', 'Weekly recording'), dueRec ? h('span.pill.new', 'Due') : h('span.pill', `next in ${7 - (ctx.day - last.day)} days`)),
    h('p.small', 'Once a week, record one minute of anything: a song, a pattern, a noodle over your latest idea. Hearing week 1 next to week 8 is the best motivation there is.'),
    h('p.small.muted', 'Use your phone’s camera or voice memos. This page can’t reach the microphone, so it keeps the log and, where the file is small enough, the video.'),
    h('div.row.nowrap', h('div.grow', note), btn('Log it', () => save(null), { cls: 'primary', id: 'rec-log' })),
    uploadRow,
    recs.length
      ? h(
          'div.list',
          recs.slice(0, 6).map((r) =>
            h(
              'div.li',
              h('div.grow', h('div.small.mono', dateOfDay(r.day, ctx.day)), r.note ? h('div', r.note) : null, r.assetId ? (r.type && r.type.startsWith('audio') ? h('audio', { controls: true, src: '/_blob/' + r.assetId, preload: 'none', style: { width: '100%' } }) : h('video', { controls: true, src: '/_blob/' + r.assetId, preload: 'none', playsinline: true, style: { width: '100%', borderRadius: '10px' } })) : null),
            ),
          ),
        )
      : null,
  );
}

function songsSection(ctx) {
  const songs = ctx.state.songs || [];
  const form = h('div.stack', { hidden: true });
  const inputs = {
    title: h('input', { type: 'text', id: 'song-title', placeholder: 'Song title', maxlength: 80 }),
    artist: h('input', { type: 'text', id: 'song-artist', placeholder: 'Artist', maxlength: 80 }),
    key: h('input', { type: 'text', id: 'song-key', placeholder: 'Key / capo, e.g. capo 2, G shapes', maxlength: 60 }),
    chords: h('input', { type: 'text', id: 'song-chords', placeholder: 'Chords, e.g. G D Em C', maxlength: 160 }),
  };
  form.append(
    h('div.fields', field('Title', inputs.title), field('Artist', inputs.artist)),
    field('Key / capo', inputs.key),
    field('Chords', inputs.chords),
    btn('Add to repertoire', () => {
      const title = inputs.title.value.trim();
      if (!title) return toast('Give it a title.');
      const s = { id: 's' + Date.now().toString(36), title, artist: inputs.artist.value.trim(), key: inputs.key.value.trim(), chords: inputs.chords.value.trim(), state: { ...newState({ id: 'song', bpm: [0, 0] }, ctx.day), s: 'review', ivl: 3, reps: 1, last: ctx.day, due: ctx.day + 3 } };
      ctx.update((st) => ({ ...st, songs: [s, ...(st.songs || [])] }));
      toast('Added. It comes back in a few days so it doesn’t fade.');
      ctx.rerender();
    }, { cls: 'primary', id: 'song-add' }),
  );
  return h(
    'section.sect',
    { 'aria-label': 'Repertoire' },
    h('div.row.between', h('h2', 'Repertoire'), btn('Add a song', () => (form.hidden = !form.hidden), { cls: 'quiet small', ico: 'plus', id: 'song-toggle' })),
    h('p.small.muted', 'Songs you already play come back on a spaced schedule, a quick run-through inside a session, so they don’t fade.'),
    form,
    songs.length
      ? h(
          'div.list',
          songs.map((s) =>
            h(
              'div.li',
              h('div.grow', h('div', h('b', s.title), s.artist ? ' · ' + s.artist : ''), h('div.small.muted', s.state && s.state.due <= ctx.day ? 'Due for a run-through' : `Next run-through in ${Math.max(1, (s.state?.due || ctx.day) - ctx.day)} days`)),
              btn('Play now', () => ((view.practise = { song: s.id }), ctx.rerender()), { cls: 'quiet small' }),
              btn('', () => {
                ctx.update((st) => ({ ...st, songs: st.songs.filter((x) => x.id !== s.id) }));
                ctx.rerender();
              }, { cls: 'ghost small icon-only', ico: 'trash', title: 'Remove ' + s.title }),
            ),
          ),
        )
      : h('p.small', 'Add the songs you can already play and sing. Four or five is plenty to start.'),
  );
}

function aiSection(ctx) {
  const sec = h('section.sect', { 'aria-label': 'AI extras', hidden: true });
  getSample().then((s) => (sec.hidden = !s));
  // Coach
  const ask = h('textarea', { id: 'coach-text', placeholder: 'What felt hard lately? e.g. "my thumb speeds up when the fingers come in"', 'aria-label': 'What felt hard' });
  const coachOut = h('div.small.ai-out', { 'aria-live': 'polite' });
  let ctl = null;
  const coachB = btn('Adjust my plan', async () => {
    if (!ask.value.trim()) return toast('Say what felt hard first.');
    ctl?.abort();
    ctl = new AbortController();
    coachOut.textContent = 'Thinking…';
    coachB.disabled = true;
    try {
      const inProg = allItems(ctx.state).filter((it) => ctx.state.items[it.id] && !isLocked(ctx.state.items[it.id]));
      const summary = inProg.map((it) => `${it.id}: ${it.title}${hasTempo(it) ? ` ${ctx.state.items[it.id].bpm}/${it.bpm[1]}` : ''}`).join('; ') || 'none yet';
      const adv = await coachAdvice(ask.value, summary, { signal: ctl.signal });
      ctx.update((s) => {
        const items = { ...s.items };
        for (const id of adv.slower) {
          const it = findItem(s, id);
          if (it && items[id] && hasTempo(it)) items[id] = { ...items[id], bpm: Math.max(it.bpm[0], Math.round(items[id].bpm * 0.88)), due: ctx.day };
        }
        return { ...s, items, coach: adv.focus ? { focus: adv.focus, until: ctx.day + 7, note: adv.message } : s.coach };
      });
      const changes = [adv.focus ? `Focus on ${TRACKS[adv.focus].name} for the next week.` : null, adv.slower.length ? `Slowed down: ${adv.slower.map((id) => findItem(ctx.state, id)?.title).filter(Boolean).join(', ')}.` : null].filter(Boolean);
      coachOut.textContent = adv.message + (changes.length ? '\n\n' + changes.join(' ') : '');
    } catch (e) {
      coachOut.textContent = aiErrorText(e);
    }
    coachB.disabled = false;
  }, { cls: 'primary', ico: 'spark', id: 'coach-go' });
  // Lick generator
  let lk = { key: 'A', scale: 'minPent', style: 'indie folk, like Bon Iver and The Smiths' };
  const lickOut = h('div.stack');
  const genB = btn('Write me a lick', async () => {
    lickOut.replaceChildren(h('p.small.muted', 'Writing…'));
    genB.disabled = true;
    try {
      const res = await generateLick({ key: lk.key, scaleId: lk.scale, style: lk.style, level: 'knows open and E-shape barre chords, new to scales' });
      const cols = res.notes.map((n) => ({ notes: [{ s: n[0], f: n[1], tech: { h: 'h', p: 'p', s: '/', b: 'b' }[n[3]] || '' }] }));
      const t = tab(cols, { label: res.name });
      lickOut.replaceChildren(
        h('h3', res.name),
        res.tip ? h('p.small', res.tip) : null,
        h('div.tab-wrap', t),
        h('div.row', btn('Hear it', () => A.playTab(res.notes, 84, { onNote: (i) => t.playhead(i), onEnd: () => t.playhead(-1) }), { cls: 'quiet', ico: 'play' }), btn('Add to my practice', () => {
          const id = 'ai-' + Date.now().toString(36);
          const item = { id, kind: 'lick', track: 'create', title: res.name, bpm: [60, 100], mins: 1, data: { name: res.name, key: lk.key, scale: lk.scale, n: res.notes, use: res.tip }, ai: true };
          ctx.update((s) => ({ ...s, custom: { ...(s.custom || {}), [id]: item } }));
          toast('Added. It joins your sessions like any other lick.');
        }, { cls: 'primary' })),
      );
    } catch (e) {
      lickOut.replaceChildren(h('p.small', e && e.code ? aiErrorText(e) : e.message || 'That didn’t work. Try again.'));
    }
    genB.disabled = false;
  }, { cls: 'quiet', ico: 'spark', id: 'lick-go' });
  sec.append(
    h('h2', 'AI extras'),
    h('h3', 'Practice coach'),
    h('p.small.muted', 'Tell it what felt hard. It can slow items down and point next week’s sessions at one track.'),
    ask,
    coachB,
    coachOut,
    h('hr.rule'),
    h('h3', 'Lick generator'),
    h('p.small.muted', 'New licks in your style, checked note by note against the scale before they reach you.'),
    h(
      'div.fields',
      field('Key', select(['C', 'G', 'D', 'A', 'E', 'F', 'B'], lk.key, (v) => (lk.key = v), { id: 'lick-key' })),
      field('Scale', select(['minPent', 'majPent', 'major', 'minor', 'blues', 'dorian', 'mixolydian'].map((id) => ({ value: id, label: SCALES[id].name })), lk.scale, (v) => (lk.scale = v), { id: 'lick-scale' })),
      field('Style', select(['indie folk, like Bon Iver and The Smiths', 'britpop, like Oasis and The Libertines', 'dreamy 1975-style pop', 'moody Radiohead-style', 'blues rock'], lk.style, (v) => (lk.style = v), { id: 'lick-style' })),
    ),
    genB,
    lickOut,
    h('p.small.muted', 'Song harmony explanations live on each song’s card in a session.'),
  );
  return sec;
}

function librarySection(ctx) {
  const state = ctx.state;
  const groups = Object.keys(TRACKS).map((t) => {
    const items = allItems(state).filter((it) => it.track === t);
    return h(
      'details',
      h('summary', `${TRACKS[t].name} · ${items.filter((it) => isLocked(state.items[it.id])).length}/${items.length} locked in`),
      h(
        'div.list',
        items.map((it) => {
          const st = state.items[it.id];
          const status = isLocked(st) ? 'Locked in' : st ? (hasTempo(it) ? `${st.bpm}/${it.bpm[1]} bpm · ${st.clean.length}/3 days` : `${st.clean.length}/3 days`) : prereqsMet(state, it) ? 'Not started' : 'Unlocks later';
          return h('div.li', h('div.grow', h('div', it.title, it.ai ? h('span.pill', { style: { marginLeft: '6px' } }, 'AI') : null), h('div.small.muted', status)), btn('Practise', () => ((view.practise = { item: it.id }), ctx.rerender()), { cls: 'quiet small' }));
        }),
      ),
    );
  });
  return h('section.sect', { 'aria-label': 'Library' }, h('h2', 'Library'), h('p.small.muted', 'Everything the app teaches. Practise anything out of order whenever you fancy it. It still counts.'), ...groups);
}

function settingsSection(ctx) {
  const s = ctx.state.settings;
  const themeHolder = h('div');
  const drawTheme = () =>
    themeHolder.replaceChildren(
      seg([{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], ctx.state.settings.theme, (v) => {
        ctx.update((st) => ({ ...st, settings: { ...st.settings, theme: v } }));
        ctx.applyTheme();
        drawTheme();
      }, { label: 'Theme', id: 'theme' }),
    );
  drawTheme();
  const dailyHolder = h('div');
  const drawDaily = () =>
    dailyHolder.replaceChildren(
      seg([10, 20, 30, 45].map((m) => ({ value: m, label: m + ' min' })), ctx.state.settings.dailyMins || 20, (v) => {
        ctx.update((st) => ({ ...st, settings: { ...st.settings, dailyMins: v } }));
        drawDaily();
      }, { label: 'Typical daily practice', id: 'daily' }),
    );
  drawDaily();
  const importBox = h('textarea', { id: 'import-text', placeholder: 'Paste a backup here', hidden: true, 'aria-label': 'Backup text' });
  const resetRow = h('div.row');
  const drawReset = () =>
    resetRow.replaceChildren(
      view.confirmReset
        ? h('div.row', h('span.small', 'Delete all progress?'), btn('Yes, start over', () => {
            ctx.store.set(createState(ctx.day));
            view.confirmReset = false;
            toast('Fresh start.');
            ctx.go('today');
          }, { cls: 'small', id: 'reset-yes' }), btn('Keep it', () => ((view.confirmReset = false), drawReset()), { cls: 'ghost small' }))
        : btn('Reset progress', () => ((view.confirmReset = true), drawReset()), { cls: 'ghost small', id: 'reset' }),
    );
  drawReset();
  return h(
    'section.sect',
    { 'aria-label': 'Settings' },
    h('h2', 'Settings'),
    field('Theme', themeHolder),
    field('Typical day with the guitar', dailyHolder),
    h('div.row', btn(s.voice === false ? 'Spoken prompts: off' : 'Spoken prompts: on', () => {
      ctx.update((st) => ({ ...st, settings: { ...st.settings, voice: st.settings.voice === false } }));
      ctx.rerender();
    }, { cls: 'quiet small', id: 'voice' }), btn('Redo placement check', () => ctx.go('placement'), { cls: 'quiet small' })),
    h('div.row', btn('Copy backup', async () => {
      const text = ctx.store.exportJSON();
      try {
        await navigator.clipboard.writeText(text);
        toast('Backup copied. Paste it into a note somewhere safe.');
      } catch {
        importBox.hidden = false;
        importBox.value = text;
        importBox.select();
        toast('Select all and copy the text below.');
      }
    }, { cls: 'quiet small' }), btn('Restore backup', () => {
      if (importBox.hidden) {
        importBox.hidden = false;
        importBox.value = '';
        return importBox.focus();
      }
      try {
        ctx.store.importJSON(importBox.value);
        toast('Restored.');
        ctx.go('today');
      } catch (e) {
        toast(e.message || 'That doesn’t look like a backup.');
      }
    }, { cls: 'quiet small', id: 'restore' })),
    importBox,
    h('p.small.muted', h('span.sync', { class: ctx.store.status() }, ctx.store.status() === 'synced' ? 'Synced to your Claude account' : ctx.store.status() === 'syncing' ? 'Saving…' : 'Saved on this device only')),
    resetRow,
  );
}

function renderPractise(root, ctx) {
  const back = btn('Back', () => {
    A.stopAll();
    view.practise = null;
    ctx.rerender();
  }, { cls: 'ghost small', ico: 'back', id: 'back' });
  if (view.practise.song) {
    const song = ctx.state.songs.find((s) => s.id === view.practise.song);
    if (!song) return ((view.practise = null), render(root, ctx));
    root.append(h('div.stack-lg', back, songCard(song, {
      onRate: (r) => {
        ctx.update((s) => logMinutes({ ...s, songs: s.songs.map((x) => (x.id === song.id ? { ...x, state: rate(x.state || newState({ id: x.id, bpm: [0, 0] }, ctx.day), { id: x.id, bpm: [0, 0] }, r, ctx.day) } : x)) }, ctx.day, 'hands', 2.5));
        view.practise = null;
        toast('Logged.');
        ctx.rerender();
      },
    })));
    return;
  }
  const item = findItem(ctx.state, view.practise.item);
  const st = ctx.state.items[item.id];
  const variant = item.data.keys ? { key: item.data.keys[(st?.reps || 0) % item.data.keys.length] } : {};
  root.append(
    h('div.stack-lg', back, itemCard(item, st, variant, {
      ctx,
      isNew: !st,
      onRate: (r, bpmOverride) => {
        ctx.update((s) => {
          let prev = s.items[item.id] || newState(item, ctx.day);
          if (bpmOverride) prev = { ...prev, bpm: bpmOverride };
          let out = { ...s, items: { ...s.items, [item.id]: rate(prev, item, r, ctx.day) } };
          if (item.cheat && !out.seenCheats.includes(item.cheat)) out = { ...out, seenCheats: [...out.seenCheats, item.cheat] };
          return logMinutes(out, ctx.day, item.track, item.mins);
        });
        view.practise = null;
        toast('Logged.');
        ctx.rerender();
      },
    })),
  );
}

export function cleanup() {
  A.stopAll();
}
