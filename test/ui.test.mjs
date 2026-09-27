// Screen tests at phone size with Playwright (uses the preinstalled Chromium).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
let chromium = null;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright']) {
  try {
    ({ chromium } = require(p));
    break;
  } catch {
    /* try next */
  }
}
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'file://' + join(ROOT, 'dist', 'index.html');
const SHOTS = join(ROOT, 'test-results');
const skip = !chromium || !existsSync(join(ROOT, 'dist', 'index.html')) ? 'Playwright or dist/index.html missing (run npm run build)' : false;

let browser;
before(async () => {
  if (skip) return;
  mkdirSync(SHOTS, { recursive: true });
  browser = await chromium.launch();
});
after(async () => browser && browser.close());

// Fake the Claude page runtime: account db, user id, AI sampling.
const FAKE_CLAUDE = `
  window.__dbWrites = [];
  window.__docs = {};
  const doc = (path) => ({
    get: async () => ({ exists: path in window.__docs, data: () => window.__docs[path] }),
    set: async (d) => { window.__docs[path] = JSON.parse(JSON.stringify(d)); window.__dbWrites.push(path); },
  });
  const sample = async (input, opts) => { const t = 'This song sits in G. The chords are I, V, vi and IV.'; opts && opts.onText && opts.onText({ text: t, delta: t }); return { text: t, truncated: false }; };
  sample.json = async (input) => input.includes('guitar licks')
    ? { name: 'Test lick', tip: 'Let it ring.', notes: [[4,5,0.5],[4,8,0.5],[5,5,1],[5,6,1],[3,7,1,'b']] }
    : { message: 'Slow the thumb down and count out loud.', focus: 'hands', slower: ['pk-thumb'] };
  window.claude = { use: async (name) => name === 'db' ? { doc } : name === 'user' ? { id: async () => 'u_test' } : name === 'sample' ? sample : name === 'assets' ? null : null };
`;

async function open({ width = 390, height = 844, dark = false, fake = false, state } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
  if (fake) await ctx.addInitScript(FAKE_CLAUDE);
  if (state) await ctx.addInitScript(`localStorage.setItem('guitar-lazy-state-v1', ${JSON.stringify(JSON.stringify(state))})`);
  // Fonts come from Google; block them so tests run offline.
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/ERR_FAILED|fonts|net::/.test(m.text()) && errors.push(m.text()));
  await page.goto(PAGE);
  await page.waitForSelector('#main h1');
  return { page, ctx, errors };
}

async function noHorizontalScroll(page, where) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw + 1, `${where}: page scrolls sideways (${sw} > ${cw})`);
}

const TABS = ['today', 'neck', 'pick', 'moves', 'jam', 'you'];

for (const [w, h] of [[390, 844], [360, 740]])
  for (const dark of [false, true])
    test(`every tab renders cleanly at ${w}px, ${dark ? 'dark' : 'light'}`, { skip }, async () => {
      const { page, ctx, errors } = await open({ width: w, height: h, dark });
      for (const t of TABS) {
        await page.click('#tab-' + t);
        await page.waitForTimeout(120);
        await noHorizontalScroll(page, t);
        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const lum = bg.match(/\d+/g).slice(0, 3).reduce((a, b) => a + Number(b), 0) / 3;
        assert.ok(dark ? lum < 60 : lum > 200, `${t}: body background ${bg} does not match the theme`);
        await page.screenshot({ path: join(SHOTS, `${t}-${w}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      }
      // Neck sub-modes
      await page.click('#tab-neck');
      for (const m of ['Chords', 'Name it', 'Notes', 'Tune', 'Scales']) {
        await page.click(`#neck-mode button:has-text("${m}")`);
        await noHorizontalScroll(page, 'neck ' + m);
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    });

test('placement check skips what you already play', { skip }, async () => {
  const { page, ctx, errors } = await open();
  await page.click('#placement-go');
  await page.click('#pl-next');
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(80);
    if (await page.locator('.r-clean').count()) await page.click('.r-clean');
    else await page.click('#pl-skip');
  }
  await page.waitForSelector('#pl-done');
  const text = await page.textContent('#main');
  assert.match(text, /Skipping \d+ things/);
  await page.click('#pl-done');
  await page.waitForSelector('#start');
  assert.equal(await page.locator('#placement-go').count(), 0);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('guitar-lazy-state-v1')));
  assert.ok(st.placement.done);
  assert.ok(st.items['pk-travis'] && st.items['pk-travis'].skipped);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a full session runs from Start to "Done. Go live your life."', { skip }, async () => {
  const { page, ctx, errors } = await open();
  await page.click('#len button:has-text("10 min")');
  await page.click('#start');
  for (let guard = 0; guard < 40; guard++) {
    await page.waitForTimeout(60);
    if (await page.locator('text=Done. Go live your life.').count()) break;
    await noHorizontalScroll(page, 'session step ' + guard);
    if (await page.locator('#hear').count()) {
      await page.click('#hear');
      await page.waitForTimeout(250);
      await page.click('#hear');
    }
    if (await page.locator('.r-clean').count()) await page.click('.r-clean');
    else if (await page.locator('#skip').count()) await page.click('#skip');
    else await page.click('button:has-text("Done")');
  }
  await page.waitForSelector('text=Done. Go live your life.');
  await page.screenshot({ path: join(SHOTS, 'done.png'), fullPage: true });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('guitar-lazy-state-v1')));
  assert.ok(Object.keys(st.items).length >= 1, 'ratings were saved');
  assert.ok(Object.values(st.log).length >= 1, 'minutes were logged');
  await page.click('#done-home');
  await page.waitForSelector('#start');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('pick lab: build a loop, play it, save it as an idea', { skip }, async () => {
  const { page, ctx, errors } = await open();
  await page.click('#tab-pick');
  const before = await page.locator('#prog-row .chip').count();
  await page.click('.chips >> nth=0 >> .chip >> nth=5'); // vi
  assert.equal(await page.locator('#prog-row .chip').count(), before + 1);
  await page.click('#lab-play');
  await page.waitForSelector('.nk-ring', { timeout: 3000 });
  await page.screenshot({ path: join(SHOTS, 'pick-playing.png') });
  await page.click('#lab-play');
  await page.selectOption('#pattern', 'faithful');
  await page.fill('#idea-name', 'Test idea');
  await page.click('#save-idea');
  assert.match(await page.textContent('#main'), /Test idea/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('moves: every connection plays, and one can be added to practice', { skip }, async () => {
  const { page, ctx, errors } = await open();
  await page.click('#tab-moves');
  await page.click('#mv-key button:has-text("C")');
  await page.click('#mv-from button:has-text("C") >> nth=0');
  await page.click('#mv-to button:has-text("Am")');
  const text = await page.textContent('#main');
  assert.match(text, /G\/B/, 'offers the C – G/B – Am walk-down');
  assert.match(text, /E7/, 'offers the E7 secondary dominant');
  const plays = page.locator('button:has-text("Play the move")');
  assert.ok((await plays.count()) >= 5);
  await plays.nth(0).click();
  await page.waitForTimeout(400);
  await plays.nth(0).click();
  await noHorizontalScroll(page, 'moves');
  const adds = page.locator('button:has-text("Practise this")');
  if (await adds.count()) {
    await adds.nth(0).click();
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('guitar-lazy-state-v1')));
    assert.equal(Object.values(st.custom).filter((c) => c.kind === 'move').length, 1);
  }
  await page.screenshot({ path: join(SHOTS, 'moves-C-Am.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('neck: scale practice shows the order and steps through it', { skip }, async () => {
  const { page, ctx, errors } = await open();
  await page.click('#tab-neck');
  await page.click('#sc-view button:has-text("Practise it")');
  assert.match(await page.textContent('.readout'), /12 notes/);
  await page.click('#st-step');
  assert.match(await page.textContent('.readout'), /^1\/23/);
  await page.click('#st-next');
  assert.match(await page.textContent('.readout'), /^2\/23/);
  assert.ok((await page.locator('.nk-ring').count()) >= 1, 'current note is ringed');
  assert.ok((await page.locator('.nk-next').count()) >= 1, 'next note is marked');
  await page.click('#st-pattern button:has-text("In 3s")');
  await page.click('#st-play');
  await page.waitForTimeout(300);
  assert.match(await page.textContent('.readout'), /Count in|\d+\//);
  await page.click('#st-play');
  await noHorizontalScroll(page, 'scale trainer');
  await page.screenshot({ path: join(SHOTS, 'scale-trainer.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('pick lab: fingerstyle pieces play with the string lit', { skip }, async () => {
  const { page, ctx, errors } = await open();
  await page.click('#tab-pick');
  await page.click('#pick-mode button:has-text("Fingerstyle pieces")');
  assert.ok((await page.locator('section[id^="piece-"]').count()) >= 8);
  await page.click('#piece-drone button:has-text("Play")');
  await page.waitForSelector('#piece-drone .nk-ring', { timeout: 3000 });
  await page.screenshot({ path: join(SHOTS, 'pieces.png') });
  await page.click('#piece-drone button:has-text("Stop")');
  await noHorizontalScroll(page, 'pieces');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('neck: runs sideways like a guitar and scrolls to the chosen position', { skip }, async () => {
  const { page, ctx, errors } = await open();
  await page.click('#tab-neck');
  const dims = await page.evaluate(() => {
    const svg = document.querySelector('.nk-wrap svg');
    const vb = svg.viewBox.baseVal;
    const wrap = svg.closest('.nk-wrap');
    return { vbW: vb.width, vbH: vb.height, scrollW: wrap.scrollWidth, clientW: wrap.clientWidth };
  });
  assert.ok(dims.vbW > dims.vbH * 3, 'the neck is drawn horizontally');
  assert.ok(dims.scrollW > dims.clientW, 'the whole neck scrolls sideways');
  await noHorizontalScroll(page, 'neck');
  await page.click('#sc-pos button:has-text("3")');
  await page.waitForTimeout(200);
  const left = await page.evaluate(() => document.querySelector('.nk-wrap').scrollLeft);
  assert.ok(left > 100, 'scrolled along to position 3 (' + left + ')');
  await page.screenshot({ path: join(SHOTS, 'neck-horizontal.png') });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('neck: tapping a C shape names it C', { skip }, async () => {
  const { page, ctx, errors } = await open();
  await page.click('#tab-neck');
  await page.click('#neck-mode button:has-text("Name it")');
  const tap = async (s, f) => page.locator('.nk-tap').nth(s * 13 + f).click({ force: true });
  await tap(1, 3);
  await tap(2, 2);
  await tap(3, 0);
  await tap(4, 1);
  await tap(5, 0);
  assert.equal((await page.textContent('#chord-id')).trim(), 'C');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('ear quiz scores itself', { skip }, async () => {
  const { page, ctx, errors } = await open();
  await page.click('#go-ear');
  await page.click('button:has-text("Quiz") >> nth=0');
  await page.click('button:has-text("Start")');
  for (let i = 0; i < 6; i++) {
    await page.click('.answers button >> nth=0');
    await page.click(i < 5 ? 'button:has-text("Next question")' : 'button:has-text("See score")');
  }
  assert.match(await page.textContent('#main'), /\d of 6/);
  await page.click('button:has-text("Next")');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('guitar-lazy-state-v1')));
  assert.ok(st.items['ear-int1']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('you: add a song to the repertoire', { skip }, async () => {
  const { page, ctx, errors } = await open();
  await page.click('#tab-you');
  await page.click('#song-toggle');
  await page.fill('#song-title', 'There Is a Light That Never Goes Out');
  await page.fill('#song-chords', 'F G Am C');
  await page.click('#song-add');
  assert.match(await page.textContent('#main'), /Never Goes Out/);
  await page.click('button:has-text("Play now")');
  await page.click('.r-clean');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('guitar-lazy-state-v1')));
  assert.equal(st.songs.length, 1);
  assert.equal(st.songs[0].state.reps, 2);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('progress syncs to the Claude account and AI extras validate their output', { skip }, async () => {
  const { page, ctx, errors } = await open({ fake: true });
  await page.click('#go-ear');
  await page.click('button:has-text("Quiz") >> nth=0');
  await page.click('button:has-text("Start")');
  for (let i = 0; i < 6; i++) {
    await page.click('.answers button >> nth=0');
    await page.click(i < 5 ? 'button:has-text("Next question")' : 'button:has-text("See score")');
  }
  await page.click('button:has-text("Next")');
  await page.waitForFunction(() => window.__dbWrites.length > 0, null, { timeout: 5000 });
  const saved = await page.evaluate(() => window.__docs['data/users/u_test/state']);
  assert.ok(saved.state.items['ear-int1'], 'account copy has the rating');
  // AI lick: the out-of-scale note (B string fret 6 = F in A minor pentatonic) must be thrown away.
  await page.click('#tab-you');
  await page.waitForSelector('#lick-go');
  await page.click('#lick-go');
  await page.waitForSelector('text=Test lick');
  const tabText = await page.locator('.tab').last().textContent();
  assert.ok(!/6/.test(tabText.replace(/[eBGDAE]/g, '')), 'out-of-key note was removed');
  await page.click('button:has-text("Add to my practice")');
  // Coach
  await page.fill('#coach-text', 'My thumb speeds up');
  await page.click('#coach-go');
  await page.waitForSelector('text=Slow the thumb down');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('guitar-lazy-state-v1')));
  assert.equal(Object.values(st.custom).length, 1);
  assert.equal(st.coach.focus, 'hands');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a newer copy in the account replaces this device’s copy', { skip }, async () => {
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctxB.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctxB.addInitScript(FAKE_CLAUDE + `window.__docs['data/users/u_test/state'] = { updatedAt: Date.now() + 100000, state: { v: 1, created: 0, updatedAt: Date.now() + 100000, settings: { theme: 'auto', lastLen: 20, dailyMins: 30 }, placement: { done: true, answers: {} }, items: {}, songs: [{ id: 's1', title: 'From another phone', state: null }], ideas: [], log: {}, recordings: [], seenCheats: [], custom: {} } };`);
  const page = await ctxB.newPage();
  await page.goto(PAGE);
  await page.waitForSelector('#start');
  await page.waitForFunction(() => document.querySelector('#placement-go') === null, null, { timeout: 5000 });
  await page.click('#tab-you');
  assert.match(await page.textContent('#main'), /From another phone/);
  await ctxB.close();
});
