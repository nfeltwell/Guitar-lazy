// Plec: a hand-drawn plectrum who keeps you company. Moods: hi, focus, done, sleepy.
import { svg } from './dom.js';

export function mascot(mood = 'hi', size = 64) {
  const s = svg('svg', { viewBox: '0 0 64 70', width: size, height: size * 70 / 64, class: 'mascot mood-' + mood, 'aria-hidden': 'true' });
  // Slightly lopsided outline so it reads as drawn, not generated.
  s.append(svg('path', { d: 'M31.5 65.5c-6.8-4.6-24.2-22.4-25.6-38.2C4.6 13.1 15.8 4.4 31.2 4.1c15.9-.3 27.9 8.1 26.9 22.4c-1.1 15.9-18.5 34.4-26.6 39z', class: 'm-body' }));
  s.append(svg('path', { d: 'M15 17.5c3.5-5.2 9.8-7.6 16.4-7.5', class: 'm-shine' }));
  const eyes = {
    hi: ['M22.5 27.5a2.6 2.9 0 1 0 .1 0z', 'M39.8 27.2a2.6 2.9 0 1 0 .1 0z'],
    focus: ['M20.5 28.5l5-1.2', 'M38 27.3l5 1.1'],
    done: ['M19.8 28.4c1.6-2.2 4.4-2.3 6 .1', 'M37.4 28.2c1.7-2.3 4.5-2.2 6.1.2'],
    sleepy: ['M20 29h6', 'M37.5 28.8h6'],
  }[mood] || [];
  eyes.forEach((d) => s.append(svg('path', { d, class: mood === 'hi' ? 'm-eye' : 'm-line' })));
  const mouth = {
    hi: 'M26.2 37.6c2.9 3.4 8.4 3.5 11.4-.2',
    focus: 'M29.4 38.8c1.4-.9 3.4-.9 4.9.1',
    done: 'M25 36.8c3.6 5.3 10.8 5.4 14.1-.4',
    sleepy: 'M29 39.5h5.5',
  }[mood];
  s.append(svg('path', { d: mouth, class: 'm-line' }));
  if (mood === 'done' || mood === 'hi') {
    s.append(svg('path', { d: 'M15.8 35.3c1.2.4 2.5.4 3.6-.1', class: 'm-cheek' }));
    s.append(svg('path', { d: 'M44.6 35.1c1.1.5 2.4.6 3.6.2', class: 'm-cheek' }));
  }
  return s;
}
