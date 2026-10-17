// Sound effects: real recordings with free licences (cards and poker chips on a table, a
// concert snare roll, a cymbal, a boxing bell, a brass fanfare, a small cheering crowd…),
// prepared by tools/assets/sfx.mjs into src/assets/sfx (credits in CREDITS.md).
// They are decoded once into AudioBuffers on the music's audio graph, so every effect starts
// instantly and goes through the same volume control and limiter as the songs.
import manifest from '../../assets/sfx/manifest.json';
import { decode, player } from './player';

type Name = keyof typeof manifest;

interface PlayOpts {
  /** Random pitch/speed spread (±), so repeated sounds are never machine-gun identical. */
  vary?: number;
  /** Seconds during which the music is lowered under the effect. */
  duck?: number;
  /** Seconds to wait before playing. */
  delay?: number;
}

/** A sound effect asked for while the audio is still waking up plays only if this is quick. */
const LATE_MS = 400;
/** At most this many copies of one effect at the same time (fast taps on a stepper…). */
const MAX_VOICES = 4;

const urls = import.meta.glob<string>('../../assets/sfx/*.mp3', { query: '?url', import: 'default', eager: true });

let enabled = true;
/** Loading of each effect (dropped again if it failed, so that it is retried later). */
const loading = new Map<Name, Promise<void>>();
const buffers = new Map<Name, AudioBuffer[]>();
const lastVariant = new Map<Name, number>();
const voices = new Map<Name, AudioBufferSourceNode[]>();

export function setSfxEnabled(on: boolean) {
  enabled = on;
  // Switched back on once the audio is up: get the effects ready.
  if (on && player.ctx) void preloadSfx();
}

async function load(ctx: BaseAudioContext, file: string): Promise<AudioBuffer | null> {
  const url = urls[`../../assets/sfx/${file}`];
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await decode(ctx, await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Downloads and decodes one effect (all its variants), once. */
function prepare(name: Name): Promise<void> {
  let p = loading.get(name);
  if (p) return p;
  const ctx = player.ensureContext();
  if (!ctx) return Promise.resolve();
  p = Promise.all(manifest[name].files.map((f) => load(ctx, f))).then((list) => {
    const ok = list.filter((b): b is AudioBuffer => b !== null);
    if (ok.length) buffers.set(name, ok);
    // Not available (e.g. offline before the app was cached): tried again next time.
    else loading.delete(name);
  });
  loading.set(name, p);
  return p;
}

/** Downloads and decodes every effect (about 330 kB), unless they are off. Safe to call repeatedly. */
export function preloadSfx(): Promise<void> {
  if (!enabled) return Promise.resolve();
  return Promise.all((Object.keys(manifest) as Name[]).map(prepare)).then(() => undefined);
}

/** The audio context, if effects can be heard right now. */
function live(): AudioContext | null {
  const ctx = player.ctx;
  return enabled && ctx && ctx.state === 'running' ? ctx : null;
}

function pick(name: Name): AudioBuffer | null {
  const list = buffers.get(name);
  if (!list?.length) return null;
  // A different variant from the previous one, so that the repetition is not noticed.
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastVariant.get(name)) i = (i + 1) % list.length;
  lastVariant.set(name, i);
  return list[i];
}

function start(ctx: AudioContext, name: Name, opts: PlayOpts): AudioBufferSourceNode | null {
  const out = player.fxOutput();
  const buffer = pick(name);
  if (!out || !buffer) return null;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  if (opts.vary) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * opts.vary;
  src.connect(out);
  const playing = voices.get(name) ?? [];
  while (playing.length >= MAX_VOICES) {
    try {
      playing.shift()!.stop();
    } catch {
      /* already over */
    }
  }
  playing.push(src);
  voices.set(name, playing);
  src.onended = () => {
    const list = voices.get(name);
    if (list) voices.set(name, list.filter((v) => v !== src));
  };
  src.start(ctx.currentTime + (opts.delay ?? 0));
  if (opts.duck) player.duck(opts.duck + (opts.delay ?? 0));
  return src;
}

function play(name: Name, opts: PlayOpts = {}) {
  if (!enabled) return;
  const ctx = live();
  if (ctx && buffers.has(name)) {
    start(ctx, name, opts);
    return;
  }
  // First taps after launch: the audio is still being unlocked or decoded. Play the sound
  // as soon as it is ready, but only if that takes a moment (a late effect is worse than none).
  const asked = performance.now();
  const fresh = () => performance.now() - asked < LATE_MS;
  const suspended = player.ctx;
  if (suspended && suspended.state !== 'running' && suspended.state !== 'closed') void suspended.resume().catch(() => {});
  void prepare(name).then(() => {
    const c = player.ctx;
    if (!c || !fresh()) return;
    if (c.state === 'running') {
      if (live()) start(c, name, opts);
    } else {
      c.addEventListener('statechange', () => fresh() && live() && start(c, name, opts), { once: true });
    }
  });
}

/** The drum roll of a reveal, playing until it is ended. */
export interface Roll {
  /** Ends the roll: with `crash`, on a cymbal crash (the card lands). */
  end(crash: boolean): void;
}

const FOLEY = { vary: 0.06 };
/** Seconds the music stays low under the cymbal (and the verdict that follows it). */
const CRASH_DUCK = 1.5;

export const sfx = {
  /** Toggles, steppers, chips: a soft click. */
  tap: () => play('tap', FOLEY),
  /** Main buttons: a mouth pop. */
  pop: () => play('pop', { vary: 0.08 }),
  /** A card drawn from the deck. */
  draw: () => play('draw', FOLEY),
  /** The card put down in a slot of the timeline. */
  place: () => play('place', FOLEY),
  /** A new game: the deck is shuffled. */
  shuffle: () => play('shuffle', { vary: 0.03 }),
  /** Tokens put on the table (skip, buy, challenge): one chip each. */
  chip(count = 1) {
    for (let i = 0; i < count; i++) play('chip', { vary: 0.07, delay: i * 0.09 });
  },
  /** A token won. */
  coin: () => play('coin', { vary: 0.03 }),
  correct: () => play('correct', { duck: 1.1 }),
  /** The classic "wah wah wah waaah" sad trombone. */
  wrong: () => play('wrong', { duck: 3.6 }),
  /** Someone else takes the card: "ooooh!" */
  steal: () => play('steal', { duck: 1.9 }),
  /** Boxing bell: the other players may challenge the placement. */
  challenge: () => play('challenge', { duck: 1.6 }),
  /** Next player's turn. */
  turn: () => play('turn'),
  /** End of the game (the music has stopped): brass fanfare and a cheering crowd. */
  fanfare: () => play('fanfare'),
  /** The card turns: cymbal crash (on its own when there was no drum roll to end). */
  crash: () => play('crash', { duck: CRASH_DUCK }),

  /**
   * Snare roll while the card spins: it grows louder and a bit faster (the sample loops
   * seamlessly) until it is ended, and stops by itself after `max` seconds.
   */
  drumroll(max = 4): Roll | null {
    const ctx = live();
    const out = player.fxOutput();
    const buffer = buffers.get('roll')?.[0];
    if (!ctx || !out || !buffer) return null;
    const [loopStart, loopEnd] = manifest.roll.loop;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = loopStart;
    src.loopEnd = loopEnd;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const rise = Math.min(1.1, max / 2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(1, now + rise);
    gain.gain.setValueAtTime(1, now + Math.max(rise, max - 0.3));
    gain.gain.linearRampToValueAtTime(0.0001, now + max);
    src.playbackRate.setValueAtTime(1, now);
    src.playbackRate.linearRampToValueAtTime(1.07, now + rise);
    src.connect(gain).connect(out);
    src.start(now);
    src.stop(now + max + 0.05);
    player.duck(max);
    let ended = false;
    return {
      end(crash: boolean) {
        if (ended) return;
        ended = true;
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + 0.06);
        try {
          src.stop(t + 0.08);
        } catch {
          /* already stopped */
        }
        // The music stays low under the crash (and the verdict that follows), or comes back.
        player.unduck(crash ? CRASH_DUCK : 0);
        if (crash) play('crash');
      },
    };
  },
};
