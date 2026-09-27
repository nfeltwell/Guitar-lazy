# Lazy Guitar

A personal guitar practice app for the phone, built on the "lazy speed-run" principles: one tap to start, the app decides what to practise, an honest countdown in minutes, and no guilt.

It is tuned for an intermediate player who skipped scales. You know your open chords, E-shape barres and some riffs, and you strum and sing. The goal is **Noodle & write**: pick up the guitar and fingerpick your own progressions with a melody on top. You have 20–30 minutes on most days and longer at weekends.

## What's in it

| Tab | What it does |
|---|---|
| **Today** | Choose 2, 10, 20, 30 or 60 minutes and press Start. It shows the countdown to the next milestone, with separate bars for picking, fretboard, ear and writing. The slowest bar sets the date. |
| **Session** | One playable item at a time: tab, a fretboard that lights up the string to pick (p/i/m/a), a metronome at your current tempo, and playback so you hear the target first. You rate each item *clean / sloppy / couldn't*. A clean rating speeds the item up next time; a miss slows it down. Every session ends with a minute of free play over a loop, then **"Done. Go live your life."** |
| **Pick** | The Pick lab. Build a chord loop from numbered chips (the six chords in the key plus borrowed chords), with "sounds nice next" suggestions and the capo trick. Choose one of 12 picking or 8 strumming patterns, add sparkle chords or a melody on top, and watch which string to pluck next. Save loops as ideas. |
| **Neck** | Scales by position in any key, voicings of any chord up the neck (E/A/C/G/D shapes), *Name it* (tap frets and it names the chord), a note map, and reference tones for tuning. |
| **Jam** | Backing tracks (folk picking, Britpop strum, jangle, 1975 funk…). The notes that fit the key light up across the neck, and the current chord's notes are highlighted live. |
| **Ear** | Ear quizzes: intervals, chord types, progressions and the bass note. **Hands-free mode** speaks the question, plays the sound, pauses for you to answer out loud, then tells you the answer. Licks you sing come back in your next guitar session. |
| **You** | Your milestone path, the countdown with its levers, 14-day history, weekly recording log, song repertoire (spaced so songs don't fade), AI coach, AI lick generator, the full library, and settings. |

### How it teaches

- **Placement check first.** It asks what you can do (pre-filled from what you said), tests five items, and skips what you already play.
- **Items, not lessons.** There are 69 playable items: picking patterns, strums, barre shapes, scale positions, fretboard-note quizzes, licks, melodies learned by ear, progressions in several keys, writing prompts and ear quizzes. Each has a target tempo. **Locked in = clean at target tempo on 3 separate days.** Keys and positions rotate from one review to the next.
- **Weak spots first.** New material comes from the track furthest behind. Theory arrives as 16 short cheat codes, each shown just before the item it unlocks.
- **Forgiving scheduler.** A miss keeps 30% of the old gap rather than starting over. A clean rep after a long gap earns a bigger jump. A pile of reviews holds back new material. The shakiest items come first. The number of unfinished items allowed at once scales with how much you actually practise.
- **Milestones:** Travis on autopilot → Pretty chords → Know the neck → **Noodle & write** (your goal) → Solo over a jam.

### Honest about limits

- **No microphone.** Pages inside Claude can't use the phone's mic, so there's no listening tuner and no timing check. You get reference tones and your own ratings instead. The app says so where it matters.
- **The countdown only counts what it can check.** Practice you log from elsewhere keeps your streak going but doesn't move the countdown. The app tells you that sessions alone won't make you a songwriter.
- **Weekly recordings** are a log. Short videos (under 20 MB) can be attached; audio-only files aren't accepted by the file store.
- **AI is optional.** The coach, the lick generator and "explain the harmony" use your Claude account. Every generated lick is checked note by note against the scale, and wrong notes are dropped before you see it. Everything else works without AI.
- **Progress syncs** to your Claude account through the artifact's private per-user database, with a copy on the device. There's also a backup you can copy and restore.

## How it's checked

```
npm test        # build + content audit + 37 tests
npm run sim     # the practice simulation report
npm run sim -- --write   # regenerate src/calibration.js and docs/SIMULATION.md
```

1. **Content audit** (`scripts/check-content.mjs`). This is the guitarist's equivalent of the Russian app's native-speaker audit, and it runs automatically:
   - every chord shape really spells its chord, has the right bass note, and is playable with four fingers;
   - every E- and A-shape barre form is correct in all 12 keys;
   - every progression resolves to a playable shape in 5 keys;
   - every lick and melody note is in its key, hammer-ons go up and pull-offs go down, and nothing spans more than one hand position;
   - every picking pattern maps onto real, unmuted strings;
   - the prerequisites have no cycles, and each milestone only needs earlier material.
2. **Engine tests** (`test/engine.test.mjs`). These cover the scale boxes, chord naming, the voicing finder, Roman numerals, the lock-in rule, the 30% lapse, the long-gap bonus, the backlog throttle, shakiest-first ordering, placement, the countdown, the levers and the forgiving streak.
3. **Screen tests** (`test/ui.test.mjs`, Playwright + Chromium). Every tab is checked at 390 px and 360 px in light and dark mode: no sideways scroll and no script errors. The flows tested are the placement check, a full session through to the Done screen, the Pick lab, naming a chord, an ear quiz, adding a song, syncing to the account (with a stand-in for Claude's page APIs), rejecting AI notes that are out of key, and preferring a newer copy of your progress saved from another device.
4. **Simulation** (`sim/simulate.mjs`). Simulated learners whose skills grow with practice and fade over time use the real planner and scheduler for 180 and 365 days. The "you" profile matches your habits (20–30 min on 65% of weekdays, 30–60 min on most weekend days), cross-checked against a lazier profile. See [`docs/SIMULATION.md`](docs/SIMULATION.md).

### Decisions the simulation drove

- **A cap on unfinished items is the biggest lever.** With no cap, a 5-minute-a-day player locked in 8 items in 6 months; with a cap, 19. At your pace a larger cap reaches the goal sooner (day ~102 with a cap of 16 vs ~132 with 8). So the cap scales with your real pace: about 14 at 20 min/day, and 6–7 for a lazy week.
- **Tempo steps of 10%**, not 5%. Small steps waste reps well below your real ability, and the goal comes about 3 weeks later.
- **Ear training is the natural bottleneck** if you only do it hands-free. The planner now slips up to two short ear quizzes into a guitar session whenever ear is the slowest track.
- The 30% lapse, the long-gap bonus and shakiest-first were in the brief. In simulation they are neutral to slightly positive (differences within noise), so they stay.
- **The countdown is calibrated.** Reps-to-lock per item type and review overhead are measured, and one correction factor is fitted. On the "you" profile the median predicted/actual ratio is 1.00 (half of predictions fall between 0.68× and 1.57×). On the lazy profile it is 1.09.
- **At your pace:** Travis on autopilot ≈ day 72, Noodle & write ≈ day 116 (about 4 months). You'd lock in all built-in items in about 5 months. After that, the AI lick generator, your repertoire and your saved ideas keep sessions going.

## Layout

```
src/theory.js      notes, scales by position, chord spelling, voicing search, chord naming
src/content.js     shapes, patterns, progressions, licks, cheat codes, items, milestones, placement
src/srs.js         the scheduler (ratings, tempo, lock-in)
src/planner.js     today's session: what to practise, in what order
src/progress.js    milestones, the countdown, levers, streak
src/calibration.js generated by the simulation
src/audio.js       plucked-string synthesis, metronome, drums/bass backing, speech
src/store.js       account sync (artifact db) + local copy
src/ai.js          optional AI extras with output validation
src/ui/*.js        screens
scripts/build.mjs  bundles everything into dist/lazy-guitar.html (one self-contained page)
```
