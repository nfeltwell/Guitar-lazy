// Optional AI extras through the artifact's `sample` capability. Everything works without them.
import { SCALES, pc, fretMidi } from './theory.js';
import { TRACKS } from './content.js';

let samplePromise = null;
export function getSample() {
  if (!samplePromise) {
    const c = typeof window !== 'undefined' ? window.claude : null;
    samplePromise = c && typeof c.use === 'function' ? c.use('sample').catch(() => null) : Promise.resolve(null);
  }
  return samplePromise;
}

export function aiErrorText(e) {
  const code = e && e.code;
  if (code === 'cancelled') return '';
  if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled') return 'AI is switched off for this page. Everything else still works.';
  if (code === 'rate_limited') return 'Too many requests just now. Try again in a minute.';
  if (code === 'session_expired') return 'Sign in to Claude again, then retry.';
  if (code === 'invalid_json') return 'The answer came back garbled. Tap to try again.';
  if (code === 'refused') return 'Claude would not answer that one. Try rewording it.';
  return 'Could not reach Claude. Try again.';
}

// Validate AI tab against the key and scale. Returns cleaned notes or throws.
export function validateLick(raw, key, scaleId) {
  const notes = Array.isArray(raw) ? raw : raw && Array.isArray(raw.notes) ? raw.notes : null;
  if (!notes || notes.length < 3) throw new Error('No notes came back.');
  const scale = SCALES[scaleId].steps.map((s) => (s + pc(key)) % 12);
  const beatsOk = [0.25, 0.33, 0.34, 0.5, 0.75, 1, 1.5, 2, 3];
  const out = [];
  for (const n of notes.slice(0, 24)) {
    const s = Number(n[0]);
    const f = Number(n[1]);
    let b = Number(n[2]);
    const t = ['h', 'p', 's', 'b'].includes(n[3]) ? n[3] : undefined;
    if (!(s >= 0 && s <= 5 && f >= 0 && f <= 15)) continue;
    if (!beatsOk.includes(b)) b = 0.5;
    const target = fretMidi(s, f) + (t === 'b' ? 2 : 0);
    if (!scale.includes(fretMidi(s, f) % 12) || !scale.includes(target % 12)) continue;
    out.push(t ? [s, f, b, t] : [s, f, b]);
  }
  if (out.length < 3) throw new Error('The lick had too many wrong notes, so I threw it away.');
  return out;
}

export async function generateLick({ key, scaleId, style, level, signal }) {
  const sample = await getSample();
  if (!sample) throw { code: 'not_granted' };
  const prompt = `You write short guitar licks as tab data for a practice app.
Player: intermediate, ${level}. Style: ${style}. Key: ${key}, scale: ${SCALES[scaleId].name} (${SCALES[scaleId].degrees.join(' ')}).
Write ONE musical lick of 6 to 12 notes, playable in one hand position (frets within a 4-fret span, frets 0-15).
Strings are numbered 0 = low E, 1 = A, 2 = D, 3 = G, 4 = B, 5 = high e. Only use notes from the scale.
Beats per note: 0.25, 0.5, 1, 1.5 or 2. Optional technique: "h" hammer-on, "p" pull-off, "s" slide into, "b" whole-step bend (bent note must also be in the scale).
Reply with only JSON: {"name": "3-4 word name", "tip": "one sentence on how to play or use it", "notes": [[string, fret, beats, "technique?"], ...]}
Example: {"name":"Lazy walk","tip":"Let the open strings ring.","notes":[[4,0,0.5],[4,1,0.5],[4,3,1,"h"]]}`;
  const res = await sample.json(prompt, { signal, cache: false });
  const notes = validateLick(res, key, scaleId);
  return { name: String(res.name || 'AI lick').slice(0, 40), tip: String(res.tip || '').slice(0, 200), notes };
}

export async function explainHarmony(song, { onText, signal }) {
  const sample = await getSample();
  if (!sample) throw { code: 'not_granted' };
  const prompt = `Explain the harmony of this song to an intermediate guitarist who knows open and barre chords but little theory. Use Roman numerals, name any borrowed chords, the key, capo tricks, and one idea for a fingerpicking arrangement. Plain English, short paragraphs, under 220 words. Do not reproduce lyrics or full tabs.
Song: "${song.title}"${song.artist ? ' by ' + song.artist : ''}.${song.chords ? '\nChords the player uses: ' + song.chords : ''}${song.key ? '\nKey/capo noted: ' + song.key : ''}`;
  return sample(prompt, { onText, signal, cache: { gcTime: 86400000 } });
}

export async function coachAdvice(text, summary, { signal } = {}) {
  const sample = await getSample();
  if (!sample) throw { code: 'not_granted' };
  const prompt = `You are a relaxed guitar practice coach inside a practice app. The player says what felt hard; you adjust the plan.
Tracks: ${Object.entries(TRACKS).map(([k, v]) => k + ' (' + v.name + ')').join(', ')}.
Items in progress (id: title, current bpm / target): ${summary}
Player says: "${text.slice(0, 600)}"
Reply with only JSON: {"message": "2-3 friendly sentences of specific advice", "focus": one track id or null, "slower": [ids of items to slow down, max 3]}`;
  const res = await sample.json(prompt, { signal, cache: false, modelTier: 'quick' });
  return {
    message: String(res.message || '').slice(0, 600),
    focus: Object.keys(TRACKS).includes(res.focus) ? res.focus : null,
    slower: Array.isArray(res.slower) ? res.slower.map(String).slice(0, 3) : [],
  };
}
