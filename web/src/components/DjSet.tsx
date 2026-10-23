/* DJ set: every mp3 in src/audio (file name = «Артист — Название»), shuffled without repeats and mixed with a crossfade.
   Webviews only play sound after a tap, so it starts with the subject's first touch (skipping the splash counts)
   unless they switched it off; pauses while the app is hidden. Volume goes through Web Audio gain: iOS ignores audio.volume. */
import { create } from 'zustand';
import { haptic } from '../lib/telegram';
import { toast } from '../lib/store';

const TRACKS = Object.entries(import.meta.glob('../audio/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
  .map(([path, src]) => ({ src, title: path.split('/').pop()!.replace(/\.mp3$/i, '') }));
const FADE = 6; // seconds both tracks play over each other
const VOL = 0.7;
const KEY = 'm8:dj';
const pref = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const save = (v: 'on' | 'off') => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };

export const useDj = create<{ on: boolean; title: string }>(() => ({ on: false, title: TRACKS[0]?.title ?? '' }));

type Deck = { a: HTMLAudioElement; g: GainNode; title: string };
let ctx: AudioContext | null = null;
let deck: Deck | null = null; // the track that is playing
let out: Deck | null = null; // the track fading out under it
let queue: number[] = [];
let last = -1;
let resume = false;

// a fresh shuffle each round, never the same track twice in a row across rounds
const nextTrack = () => {
  if (!queue.length) {
    queue = TRACKS.map((_, i) => i);
    for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
    if (queue.length > 1 && queue[queue.length - 1] === last) queue.unshift(queue.pop()!);
  }
  return (last = queue.pop()!);
};

const load = (): Deck => {
  const t = TRACKS[nextTrack()];
  const a = new Audio(t.src);
  const g = ctx!.createGain();
  g.gain.value = 0;
  ctx!.createMediaElementSource(a).connect(g).connect(ctx!.destination);
  const d = { a, g, title: t.title };
  // the next track comes in FADE seconds before this one ends; a broken file is skipped the same way
  const done = () => { if (deck === d) mix(); };
  a.addEventListener('timeupdate', () => { if (a.duration - a.currentTime <= FADE) done(); });
  a.addEventListener('ended', done);
  a.addEventListener('error', done);
  return d;
};

const drop = (d: Deck) => { d.a.pause(); d.a.removeAttribute('src'); d.a.load(); d.g.disconnect(); };

const ramp = (g: GainNode, to: number, sec: number) => {
  const now = ctx!.currentTime;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(to, now + sec);
};

function mix() {
  if (out) drop(out);
  out = deck;
  deck = load();
  useDj.setState({ title: deck.title });
  void deck.a.play().catch(() => {});
  ramp(deck.g, VOL, out ? FADE : 0.3);
  if (!out) return;
  const o = out;
  ramp(o.g, 0, FADE);
  setTimeout(() => { if (out === o) { drop(o); out = null; } }, FADE * 1000 + 300);
}

// must run inside a tap: that is the only moment a webview lets the AudioContext and <audio> start
const play = () => {
  if (!TRACKS.length) return;
  if (!ctx) {
    ctx = new AudioContext();
    const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (s) s.type = 'playback'; // iOS 17+: play past the silent switch like plain <audio> did
  }
  void ctx.resume();
  if (!deck) mix();
  else { void deck.a.play().catch(() => {}); if (out) void out.a.play().catch(() => {}); }
  useDj.setState({ on: true });
};

const pause = () => {
  deck?.a.pause();
  if (out) { drop(out); out = null; }
  useDj.setState({ on: false });
};

export function initDj() {
  // a first tap on the DJ button itself is left to the button (it would start and stop the set at once)
  const first = (e: Event) => { if (pref() !== 'off' && !(e.target as Element).closest?.('.hdr__dj')) play(); };
  document.addEventListener('pointerdown', first, { capture: true, once: true });
  document.addEventListener('visibilitychange', () => {
    if (!deck) return;
    if (document.hidden) { resume = useDj.getState().on; pause(); }
    else if (resume) play();
  });
}

export function DjButton() {
  const { on, title } = useDj();
  const toggle = () => {
    haptic.impact('light');
    if (on) { pause(); save('off'); toast('DJ SET — ПАУЗА'); }
    else { play(); save('on'); toast(`▶ ${useDj.getState().title}`); }
  };
  return (
    <button type="button" className={`hdr__dj ${on ? 'is-on' : ''}`} onClick={toggle} aria-label={on ? `Пауза: ${title}` : `Включить DJ SET: ${title}`} aria-pressed={on}>
      <i /><i /><i /><i />
    </button>
  );
}
