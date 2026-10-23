/* DJ set: VILLIAN, madk1d — «ДИНАСТИЯ» on a loop. Webviews only play sound after a tap, so it starts with the
   subject's first touch (skipping the splash counts) unless they switched it off; pauses while the app is hidden. */
import { create } from 'zustand';
import { haptic } from '../lib/telegram';
import { toast } from '../lib/store';

const TRACK = { src: '/audio/dynasty.mp3', title: 'VILLIAN, madk1d — ДИНАСТИЯ' };
const KEY = 'm8:dj';
const pref = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const save = (v: 'on' | 'off') => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };

export const useDj = create<{ on: boolean }>(() => ({ on: false }));
let audio: HTMLAudioElement | null = null;
let resume = false;

const el = () => {
  if (!audio) {
    audio = new Audio(TRACK.src);
    audio.loop = true;
    audio.volume = 0.7;
    audio.preload = 'none';
    audio.addEventListener('play', () => useDj.setState({ on: true }));
    audio.addEventListener('pause', () => useDj.setState({ on: false }));
  }
  return audio;
};
const play = () => el().play().catch(() => {}); // refused without a gesture — the next tap retries

export function initDj() {
  // a first tap on the DJ button itself is left to the button (it would start and stop the track at once)
  const first = (e: Event) => { if (pref() !== 'off' && !(e.target as Element).closest?.('.hdr__dj')) void play(); };
  document.addEventListener('pointerdown', first, { capture: true, once: true });
  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden) { resume = !audio.paused; audio.pause(); }
    else if (resume) void play();
  });
}

export function DjButton() {
  const on = useDj((s) => s.on);
  const toggle = () => {
    haptic.impact('light');
    if (on) { el().pause(); save('off'); toast('DJ SET — ПАУЗА'); }
    else { void play(); save('on'); toast(`▶ ${TRACK.title}`); }
  };
  return (
    <button type="button" className={`hdr__dj ${on ? 'is-on' : ''}`} onClick={toggle} aria-label={on ? `Пауза: ${TRACK.title}` : `Включить: ${TRACK.title}`} aria-pressed={on}>
      <i /><i /><i /><i />
    </button>
  );
}
