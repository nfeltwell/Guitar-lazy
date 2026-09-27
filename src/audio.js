// Sound: plucked-string synthesis (Karplus-Strong), metronome, drums, bass, loops and spoken prompts.
import { fretMidi, midiToFreq, parseChord, CHORDS, SCALES, TUNING } from './theory.js';
import { PICKS, STRUMS, roleStrings, shapeFor, SPARKLE } from './content.js';

let ctx = null;
let master = null;
let guitarBus = null;
const bufCache = new Map();

export function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    master.connect(comp);
    comp.connect(ctx.destination);
    // A little body resonance so the pluck sounds like wood, not a synth.
    guitarBus = ctx.createBiquadFilter();
    guitarBus.type = 'peaking';
    guitarBus.frequency.value = 210;
    guitarBus.gain.value = 5;
    guitarBus.Q.value = 1.2;
    guitarBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function now() {
  return audioCtx().currentTime;
}

// Karplus-Strong string. `bright` 0..1 controls the pick attack and decay colour.
function ksBuffer(midi, bright = 0.55, seconds = 2.4) {
  const key = midi + ':' + bright;
  if (bufCache.has(key)) return bufCache.get(key);
  const c = audioCtx();
  const sr = c.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = c.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const period = sr / midiToFreq(midi);
  const N = Math.max(2, Math.floor(period));
  const frac = period - N;
  const line = new Float32Array(N + 2);
  // Excitation: filtered noise burst, darker for lower `bright`.
  let lp = 0;
  const a = 0.15 + bright * 0.8;
  for (let i = 0; i < line.length; i++) {
    lp = lp + a * (Math.random() * 2 - 1 - lp);
    line[i] = lp;
  }
  const decay = 0.996 + Math.min(0.0035, (midi - 40) * 0.00004);
  const damp = 0.5 - bright * 0.03;
  let idx = 0;
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const cur = line[idx];
    const nextIdx = (idx + 1) % N;
    const next = line[nextIdx];
    // two-point average with fractional-delay tweak for tuning
    const v = decay * ((1 - damp) * cur + damp * next) * (1 - frac * 0.02) + prev * frac * 0.02;
    out[i] = cur;
    line[idx] = v;
    prev = cur;
    idx = nextIdx;
  }
  // Gentle fade to avoid a click at the end.
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  bufCache.set(key, buf);
  return buf;
}

// One plucked note. Optional glide (in semitones) for bends and slides.
export function pluck(midi, when = now(), { vel = 0.7, dur = 0, bright = 0.55, glide = 0, glideTime = 0.12, dest } = {}) {
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = ksBuffer(midi, bright);
  const g = c.createGain();
  g.gain.setValueAtTime(vel, when);
  if (glide) {
    src.playbackRate.setValueAtTime(1, when + 0.03);
    src.playbackRate.exponentialRampToValueAtTime(Math.pow(2, glide / 12), when + 0.03 + glideTime);
  }
  src.connect(g);
  g.connect(dest || guitarBus);
  src.start(when);
  if (dur) {
    g.gain.setValueAtTime(vel, when + dur);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur + 0.08);
    src.stop(when + dur + 0.1);
  }
  return src;
}

export function strumShape(frets, when = now(), { dir = 'down', vel = 0.55, spread = 0.012, dur = 0, mute = false } = {}) {
  const strings = frets.map((f, s) => ({ f, s })).filter((x) => x.f >= 0);
  const order = dir === 'up' ? strings.slice().reverse().slice(0, 4) : strings;
  order.forEach((x, i) => {
    if (mute) {
      noiseHit(when + i * 0.004, { vel: 0.18, hp: 900, len: 0.035 });
    } else pluck(fretMidi(x.s, x.f), when + i * spread, { vel: vel * (dir === 'up' ? 0.75 : 1), dur, bright: 0.6 });
  });
}

let noiseBuf = null;
function noise() {
  const c = audioCtx();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noiseHit(when, { vel = 0.4, hp = 5000, len = 0.05 } = {}) {
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = noise();
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(vel, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + len);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(when);
  src.stop(when + len + 0.02);
}

export function click(when, accent = false) {
  const c = audioCtx();
  const o = c.createOscillator();
  o.frequency.value = accent ? 1760 : 1180;
  const g = c.createGain();
  g.gain.setValueAtTime(accent ? 0.5 : 0.32, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
  o.connect(g);
  g.connect(master);
  o.start(when);
  o.stop(when + 0.05);
}

export function kick(when, vel = 0.9) {
  const c = audioCtx();
  const o = c.createOscillator();
  o.frequency.setValueAtTime(140, when);
  o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(vel, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
  o.connect(g);
  g.connect(master);
  o.start(when);
  o.stop(when + 0.32);
}

export function snare(when, vel = 0.5) {
  noiseHit(when, { vel, hp: 1400, len: 0.16 });
  const c = audioCtx();
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 190;
  const g = c.createGain();
  g.gain.setValueAtTime(vel * 0.5, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.08);
  o.connect(g);
  g.connect(master);
  o.start(when);
  o.stop(when + 0.1);
}

export function hat(when, vel = 0.18) {
  noiseHit(when, { vel, hp: 7500, len: 0.035 });
}

export function bass(midi, when, dur) {
  const c = audioCtx();
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = midiToFreq(midi);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 600;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.5, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.25, when + 0.15);
  g.gain.setValueAtTime(0.25, when + dur * 0.85);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(f);
  f.connect(g);
  g.connect(master);
  o.start(when);
  o.stop(when + dur + 0.02);
}

// ---------------------------------------------------------------------------
// A lookahead loop: steps are scheduled slightly ahead on the audio clock; visuals fire on time.
export class Loop {
  constructor({ bpm, stepsPerBeat = 2, length, onStep, onVisual, loop = true, onEnd }) {
    Object.assign(this, { bpm, stepsPerBeat, length, onStep, onVisual, loop, onEnd });
    this.timer = null;
    this.timeouts = new Set();
    this.running = false;
  }
  stepDur() {
    return 60 / this.bpm / this.stepsPerBeat;
  }
  start() {
    audioCtx();
    this.running = true;
    this.step = 0;
    this.next = now() + 0.08;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
    return this;
  }
  tick() {
    if (!this.running) return;
    while (this.next < now() + 0.12) {
      if (this.step >= this.length) {
        if (!this.loop) {
          const end = this.next;
          this.stop(false);
          const t = setTimeout(() => this.onEnd && this.onEnd(), Math.max(0, (end - now()) * 1000));
          this.timeouts.add(t);
          return;
        }
        this.step = 0;
      }
      const i = this.step;
      const t = this.next;
      this.onStep && this.onStep(i, t, this.stepDur());
      if (this.onVisual) {
        const to = setTimeout(() => {
          this.timeouts.delete(to);
          if (this.running || !this.loop) this.onVisual(i);
        }, Math.max(0, (t - now()) * 1000));
        this.timeouts.add(to);
      }
      this.next += this.stepDur();
      this.step++;
    }
  }
  setBpm(b) {
    this.bpm = b;
  }
  stop(clearVisuals = true) {
    this.running = false;
    clearInterval(this.timer);
    if (clearVisuals) {
      for (const t of this.timeouts) clearTimeout(t);
      this.timeouts.clear();
    }
  }
}

let current = null;
export function stopAll() {
  if (current) current.stop();
  current = null;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}
function own(loop) {
  stopAll();
  current = loop;
  return loop.start();
}

export function metronome(bpm, beatsPerBar = 4, onBeat) {
  return own(new Loop({ bpm, stepsPerBeat: 1, length: beatsPerBar, onStep: (i, t) => click(t, i === 0), onVisual: onBeat }));
}

// ---------------------------------------------------------------------------
// Turn a chord list + picking pattern into steps: [{notes:[{s,f}], chordIdx}]
// Move a note by `steps` scale degrees within a major key (for top-note melodies).
export function scaleStep(midi, keyPc, steps) {
  const scale = SCALES.major.steps.map((x) => (x + keyPc) % 12);
  let m = midi;
  let n = Math.abs(steps);
  while (n > 0) {
    m += Math.sign(steps);
    if (scale.includes(((m % 12) + 12) % 12)) n--;
  }
  return m;
}

// Turn a chord list + picking pattern into steps: [{notes:[{s,f}], chordIdx}]
export function pickSteps(chordSyms, patternId, { sparkle = false, barsPerChord = 1, melodyTop = false, key } = {}) {
  const pat = PICKS[patternId];
  const perBar = pat.slots.length;
  const keyPc = key != null ? key : chordSyms.length ? parseChord(shapeFor(chordSyms[0])?.sym || chordSyms[0]).root : 0;
  const MELODY = [0, 1, 0, -1, 2, 1];
  const steps = [];
  chordSyms.forEach((sym, ci) => {
    const base = shapeFor(sym);
    if (!base) return;
    for (let b = 0; b < barsPerChord; b++) {
      let topCount = 0;
      pat.slots.forEach((slot, si) => {
        // Sparkle: second half of the bar flicks to the embellished chord.
        let shape = base;
        const sp = SPARKLE[sym];
        if (sparkle && sp && si >= perBar / 2) shape = shapeFor(sp[(ci + b) % sp.length]) || base;
        const roles = roleStrings(shape.frets);
        const notes = slot.map((r) => ({ s: roles[r], f: shape.frets[roles[r]], role: r })).filter((n) => n.f >= 0);
        if (melodyTop) {
          // Top-note melody: the high e note walks to neighbouring scale notes and back.
          const n = notes.find((x) => x.role === '1');
          if (n) {
            const midi = scaleStep(fretMidi(n.s, n.f), keyPc, MELODY[(topCount + ci * 2) % MELODY.length]);
            const f = midi - TUNING[n.s];
            if (f >= 0 && f <= 7) n.f = f;
            topCount++;
          }
        }
        steps.push({ notes, chordIdx: ci, sym: shape.sym || sym, frets: shape.frets, slot: si });
      });
    }
  });
  const stepsPerBeat = pat.meter === 6 || pat.meter === 3 ? 2 : 2;
  return { steps, stepsPerBeat, perBar };
}

export function playPick(chordSyms, patternId, bpm, opts = {}) {
  const { steps, stepsPerBeat } = pickSteps(chordSyms, patternId, opts);
  return own(
    new Loop({
      bpm,
      stepsPerBeat,
      length: steps.length,
      loop: opts.loop !== false,
      onEnd: opts.onEnd,
      onStep: (i, t, d) => {
        steps[i].notes.forEach((n) => pluck(fretMidi(n.s, n.f), t, { vel: n.role === 'B' || n.role === 'A' ? 0.62 : 0.5, bright: n.role === 'B' || n.role === 'A' ? 0.35 : 0.6 }));
        if (opts.click && steps[i].slot % stepsPerBeat === 0) click(t, steps[i].slot === 0);
      },
      onVisual: (i) => opts.onStep && opts.onStep(steps[i], i),
    }),
  );
}

export function strumSteps(chordSyms, strumId) {
  const pat = STRUMS[strumId];
  const steps = [];
  chordSyms.forEach((sym, ci) => {
    // Accept a chord symbol or an explicit {sym, frets} shape (e.g. a specific barre).
    const shape = typeof sym === 'object' ? sym : shapeFor(sym);
    const name = typeof sym === 'object' ? sym.sym : sym;
    [...pat.slots].forEach((ch, si) => steps.push({ stroke: ch, chordIdx: ci, sym: shape?.sym || name, frets: shape?.frets, slot: si }));
  });
  const stepsPerBeat = pat.slots.length === 16 ? 4 : pat.slots.length === 6 ? 3 : 2;
  return { steps, stepsPerBeat, perBar: pat.slots.length };
}

export function playStrum(chordSyms, strumId, bpm, opts = {}) {
  const { steps, stepsPerBeat } = strumSteps(chordSyms, strumId);
  return own(
    new Loop({
      bpm,
      stepsPerBeat,
      length: steps.length,
      onStep: (i, t) => {
        const st = steps[i];
        if (!st.frets) return;
        const accent = st.slot % stepsPerBeat === 0;
        if (st.stroke === 'D') strumShape(st.frets, t, { dir: 'down', vel: accent ? 0.6 : 0.45 });
        if (st.stroke === 'U') strumShape(st.frets, t, { dir: 'up', vel: 0.38 });
        if (st.stroke === 'X') strumShape(st.frets, t, { mute: true });
        if (opts.click && accent) click(t, st.slot === 0);
      },
      onVisual: (i) => opts.onStep && opts.onStep(steps[i], i),
    }),
  );
}

// Tab playback for licks and melodies: n = [[s, f, beats, tech], ...]
export function playTab(notes, bpm, opts = {}) {
  const beat = 60 / bpm;
  // Flatten into a step grid of 1/12 beat for mixed triplets and eighths.
  const grid = 12;
  const events = [];
  let pos = 0;
  notes.forEach((n, idx) => {
    events.push({ at: Math.round(pos * grid), idx, n });
    pos += n[2];
  });
  const length = Math.round(pos * grid);
  const byStep = new Map(events.map((e) => [e.at, e]));
  let prevMidi = null;
  return own(
    new Loop({
      bpm,
      stepsPerBeat: grid,
      length,
      loop: !!opts.loop,
      onEnd: opts.onEnd,
      onStep: (i, t) => {
        if (opts.click && i % grid === 0) click(t, i === 0);
        const e = byStep.get(i);
        if (!e) return;
        const [s, f, beats, tech] = e.n;
        const midi = fretMidi(s, f);
        const dur = beats * beat * 0.98;
        if (tech === 'b') pluck(midi, t, { vel: 0.6, glide: 2, glideTime: Math.min(0.25, dur * 0.4), dur });
        else if (tech === 's' && prevMidi != null) pluck(prevMidi, t, { vel: 0.5, glide: midi - prevMidi, glideTime: 0.07, dur });
        else pluck(midi, t, { vel: tech === 'h' || tech === 'p' ? 0.38 : 0.6, dur, bright: tech === 'h' || tech === 'p' ? 0.35 : 0.6 });
        prevMidi = midi;
      },
      onVisual: (i) => {
        const e = byStep.get(i);
        if (e && opts.onNote) opts.onNote(e.idx);
      },
    }),
  );
}

// Backing track: drums + bass + guitar part, one bar per chord. onChord(idx) for the live chord-tone overlay.
export const BACKING_STYLES = {
  folk: { name: 'Folk picking', pick: 'travis', drums: 'brush' },
  ballad: { name: 'Slow arpeggio', pick: 'arp', drums: 'soft' },
  britpop: { name: 'Britpop strum', strum: 'britpop', drums: 'rock' },
  indie: { name: 'Indie eighths', strum: 'eighths', drums: 'rock' },
  jangle: { name: 'Jangle', pick: 'jangle', drums: 'rock' },
  funk: { name: '1975 funk', strum: 'funk', drums: 'funk' },
};

export function playBacking(chordSyms, styleId, bpm, { onChord, onStep, guitar = true, drums = true, bars = 1 } = {}) {
  const style = BACKING_STYLES[styleId];
  const spb = 4;
  const perBar = 16;
  const expanded = chordSyms.flatMap((c) => Array(bars).fill(c));
  const length = expanded.length * perBar;
  const pickPat = style.pick ? PICKS[style.pick] : null;
  const strumPat = style.strum ? STRUMS[style.strum] : null;
  return own(
    new Loop({
      bpm,
      stepsPerBeat: spb,
      length,
      onStep: (i, t, d) => {
        const bar = Math.floor(i / perBar);
        const s16 = i % perBar;
        const sym = expanded[bar];
        const shape = shapeFor(sym);
        const c = parseChord(sym);
        if (drums) {
          if (style.drums === 'rock') {
            if (s16 === 0 || s16 === 8 || s16 === 10) kick(t);
            if (s16 === 4 || s16 === 12) snare(t);
            if (s16 % 2 === 0) hat(t, s16 % 4 === 0 ? 0.2 : 0.12);
          } else if (style.drums === 'funk') {
            if (s16 === 0 || s16 === 6 || s16 === 10) kick(t, 0.8);
            if (s16 === 4 || s16 === 12) snare(t, 0.45);
            hat(t, s16 % 2 ? 0.08 : 0.15);
          } else if (style.drums === 'brush') {
            if (s16 === 0 || s16 === 8) kick(t, 0.5);
            if (s16 === 4 || s16 === 12) noiseHit(t, { vel: 0.12, hp: 2500, len: 0.18 });
          } else {
            if (s16 === 0) kick(t, 0.45);
            if (s16 % 4 === 0) hat(t, 0.06);
          }
        }
        // Bass: root on 1, fifth on 3.
        if (s16 === 0) bass(36 + ((c.bass ?? c.root) + 12 - 0) % 12, t, d * 7.5);
        if (s16 === 8) bass(36 + ((c.root + 7) % 12), t, d * 7.5);
        if (guitar && shape) {
          if (pickPat) {
            const slots = pickPat.slots;
            const idx = Math.floor(s16 / 2);
            if (s16 % 2 === 0 && idx < slots.length) {
              const roles = roleStrings(shape.frets);
              slots[idx].forEach((r) => shape.frets[roles[r]] >= 0 && pluck(fretMidi(roles[r], shape.frets[roles[r]]), t, { vel: 0.4, bright: 0.45 }));
            }
          } else if (strumPat) {
            const n = strumPat.slots.length;
            if (n === 16 || s16 % (16 / n) === 0) {
              const ch = strumPat.slots[n === 16 ? s16 : s16 / (16 / n)];
              if (ch === 'D') strumShape(shape.frets, t, { dir: 'down', vel: 0.34 });
              if (ch === 'U') strumShape(shape.frets, t, { dir: 'up', vel: 0.24 });
              if (ch === 'X') strumShape(shape.frets, t, { mute: true });
            }
          }
        }
      },
      onVisual: (i) => {
        if (i % perBar === 0 && onChord) onChord(Math.floor(i / perBar) / bars, expanded[Math.floor(i / perBar)]);
        if (onStep) onStep(i);
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Ear training sounds
export function playInterval(rootMidi, semis, when = now(), harmonic = false) {
  pluck(rootMidi, when, { vel: 0.7, dur: 1.1 });
  pluck(rootMidi + semis, when + (harmonic ? 0 : 0.8), { vel: 0.7, dur: 1.3 });
  return (harmonic ? 1.4 : 2.2) * 1000;
}

export function chordMidis(rootMidi, quality) {
  const tones = CHORDS[quality].tones.map((t) => (t < CHORDS[quality].tones[0] ? t + 12 : t));
  // voice: root, 5th, 3rd/octave spread like a guitar
  return [rootMidi, ...tones.slice(1).map((t) => rootMidi + (t < 7 ? t + 12 : t))];
}

export function playChordQuality(rootMidi, quality, when = now()) {
  chordMidis(rootMidi, quality).forEach((m, i) => pluck(m, when + i * 0.03, { vel: 0.55, dur: 2 }));
  return 2200;
}

export function playProgression(chordSyms, bpm = 80, onChord) {
  return playBacking(chordSyms, 'ballad', bpm, { drums: false, onChord });
}

export function playChordOnce(sym, when = now()) {
  const shape = shapeFor(sym);
  if (shape) strumShape(shape.frets, when, { spread: 0.02, vel: 0.55 });
}

// Spoken prompts (phone voice). Resolves when finished; falls back to a timer if no voice.
export function speak(text, { rate = 1 } = {}) {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return setTimeout(resolve, 400 + text.length * 40);
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.lang = 'en-GB';
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    u.onend = fin;
    u.onerror = fin;
    setTimeout(fin, 1500 + text.length * 90);
    synth.speak(u);
  });
}

export function canSpeak() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

// Keep the screen on during hands-free mode, where the browser allows it.
let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal)
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('aborted', 'AbortError'));
      });
  });
}
