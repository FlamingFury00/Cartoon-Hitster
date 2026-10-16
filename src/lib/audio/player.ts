// Music playback engine.
//
// Previews are downloaded and decoded into AudioBuffers ahead of time (the next card is
// preloaded while the previous turn is still being played), so a tap on "Pesca" starts
// the song instantly and sample-accurately. Everything runs through one Web Audio graph:
//
//   buffer source -> track gain (loudness normalisation) -> fade gain -> music volume
//                 -> compressor (safety limiter) -> analyser (visualiser) -> speakers
//
// If decoding is impossible (very old WebViews) a plain <audio> element is used instead.
import type { Song } from '../game/types';
import { sourceCandidates, type ResolvedSource, type SourcePreference } from './sources';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface Loaded {
  source: ResolvedSource;
  buffer: AudioBuffer | null;
  /** Fallback element when the buffer could not be decoded. */
  element: HTMLAudioElement | null;
}

const FADE_IN = 0.35;
const FADE_OUT = 0.18;
const LOOP_FADE = 1.4;
const LOOP_GAP_MS = 900;
const FETCH_TIMEOUT = 15000;
const CACHE_SIZE = 4;

const dbToGain = (db: number) => Math.pow(10, Math.max(-18, Math.min(12, db)) / 20);

type Ctor = typeof AudioContext;
function audioContextCtor(): Ctor | null {
  const w = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { mode: 'cors', credentials: 'omit', signal: ctrl.signal, referrerPolicy: 'no-referrer' });
  } finally {
    clearTimeout(t);
  }
}

function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    // Callback form for old Safari, promise form everywhere else.
    const p = ctx.decodeAudioData(data, resolve, reject) as unknown as Promise<AudioBuffer> | undefined;
    p?.then?.(resolve, reject);
  });
}

export class MusicPlayer {
  ctx: AudioContext | null = null;
  private music: GainNode | null = null;
  private fx: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private cache = new Map<string, Promise<Loaded>>();
  private lru: string[] = [];

  private node: AudioBufferSourceNode | null = null;
  private trackGain: GainNode | null = null;
  private fade: GainNode | null = null;
  private element: HTMLAudioElement | null = null;
  private current: { id: string; loaded: Loaded } | null = null;
  private startedAt = 0;
  private offset = 0;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private request = 0;

  state: PlaybackState = 'idle';
  error: string | null = null;
  autoLoop = true;
  preference: SourcePreference = 'auto';
  private musicVolume = 1;
  private fxVolume = 0.8;
  private listeners = new Set<(s: PlaybackState) => void>();

  onChange(fn: (s: PlaybackState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(s: PlaybackState) {
    this.state = s;
    for (const fn of this.listeners) fn(s);
  }

  /** Creates the audio graph lazily (allowed without a gesture; it starts suspended). */
  ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const C = audioContextCtor();
    if (!C) return null;
    const ctx = new C({ latencyHint: 'playback' });
    const music = ctx.createGain();
    music.gain.value = this.musicVolume;
    const fx = ctx.createGain();
    fx.gain.value = this.fxVolume;
    const comp = ctx.createDynamicsCompressor();
    // Previews are loudness-normalised offline (tools/deck/loudness.mjs): this only limits peaks.
    comp.threshold.value = -4;
    comp.knee.value = 4;
    comp.ratio.value = 12;
    comp.attack.value = 0.002;
    comp.release.value = 0.2;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.78;
    music.connect(comp);
    fx.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);
    this.ctx = ctx;
    this.music = music;
    this.fx = fx;
    this.analyser = analyser;
    return ctx;
  }

  /** Output for sound effects (shares the limiter with the music). */
  fxOutput(): GainNode | null {
    this.ensureContext();
    return this.fx;
  }

  /** Must run inside a user gesture at least once (autoplay policies, iOS unlock). */
  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {
      /* ignore */
    }
  }

  setMusicVolume(v: number) {
    this.musicVolume = v;
    if (this.music && this.ctx) this.music.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    if (this.element) this.element.volume = Math.min(1, v);
  }

  setFxVolume(v: number) {
    this.fxVolume = v;
    if (this.fx && this.ctx) this.fx.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  // ------------------------------------------------------------- loading

  private async loadSong(song: Song): Promise<Loaded> {
    const ctx = this.ensureContext();
    let lastErr: unknown = new Error('Nessuna sorgente audio');
    for (const candidate of sourceCandidates(song, this.preference)) {
      let source: ResolvedSource | null = null;
      try {
        source = await candidate();
        if (!source) continue;
        if (ctx) {
          const res = await fetchWithTimeout(source.url, FETCH_TIMEOUT);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.arrayBuffer();
          const buffer = await decode(ctx, data);
          if (buffer.duration < 4) throw new Error('preview troppo corta');
          return { source, buffer, element: null };
        }
        return { source, buffer: null, element: await this.loadElement(source.url) };
      } catch (err) {
        lastErr = err;
        // Decoding failed but the file may still be playable by the media element.
        if (source && ctx && !(err instanceof DOMException && err.name === 'AbortError')) {
          try {
            return { source, buffer: null, element: await this.loadElement(source.url) };
          } catch (e2) {
            lastErr = e2;
          }
        }
      }
    }
    throw lastErr;
  }

  private loadElement(url: string): Promise<HTMLAudioElement> {
    return new Promise((resolve, reject) => {
      const el = new Audio();
      el.preload = 'auto';
      const t = setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT);
      el.oncanplaythrough = () => {
        clearTimeout(t);
        resolve(el);
      };
      el.onerror = () => {
        clearTimeout(t);
        reject(new Error('media error'));
      };
      el.src = url;
      el.load();
    });
  }

  /** Starts downloading/decoding a song in the background. Safe to call repeatedly. */
  preload(song: Song): Promise<Loaded> {
    let p = this.cache.get(song.id);
    if (!p) {
      p = this.loadSong(song);
      this.cache.set(song.id, p);
      // Failed loads must not stay cached forever (network may come back).
      p.catch(() => {
        if (this.cache.get(song.id) === p) this.cache.delete(song.id);
      });
    }
    this.lru = [song.id, ...this.lru.filter((x) => x !== song.id)];
    while (this.lru.length > CACHE_SIZE) {
      const old = this.lru.pop()!;
      if (old !== this.current?.id) this.cache.delete(old);
    }
    return p;
  }

  isReady(songId: string): boolean {
    return this.cache.has(songId);
  }

  // ------------------------------------------------------------- transport

  /** Plays a song from the beginning. Resolves once audio is actually playing. */
  async play(song: Song): Promise<void> {
    const req = ++this.request;
    this.unlock();
    this.halt(false);
    this.error = null;
    this.setState('loading');
    let loaded: Loaded;
    try {
      loaded = await this.preload(song);
    } catch (err) {
      if (req !== this.request) return;
      this.error = err instanceof Error ? err.message : String(err);
      this.setState('error');
      throw err;
    }
    if (req !== this.request) return;
    this.current = { id: song.id, loaded };
    await this.startAt(loaded.source.skip);
  }

  private async startAt(offset: number) {
    const cur = this.current;
    const ctx = this.ctx;
    if (!cur) return;
    this.clearLoopTimer();
    if (cur.loaded.buffer && ctx) {
      if (ctx.state !== 'running') await ctx.resume().catch(() => {});
      const buffer = cur.loaded.buffer;
      const start = Math.max(0, Math.min(offset, buffer.duration - 1));
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      const trackGain = ctx.createGain();
      trackGain.gain.value = dbToGain(cur.loaded.source.gainDb);
      const fade = ctx.createGain();
      const now = ctx.currentTime;
      fade.gain.setValueAtTime(0.0001, now);
      fade.gain.exponentialRampToValueAtTime(1, now + FADE_IN);
      // Gentle fade at the end of the preview so loops never click.
      const end = now + (buffer.duration - start);
      if (buffer.duration - start > LOOP_FADE + FADE_IN) {
        fade.gain.setValueAtTime(1, end - LOOP_FADE);
        fade.gain.linearRampToValueAtTime(0.0001, end);
      }
      node.connect(trackGain).connect(fade).connect(this.music!);
      node.onended = () => {
        if (this.node !== node) return; // stopped on purpose
        this.node = null;
        this.offset = 0;
        if (this.autoLoop && this.current === cur) {
          this.loopTimer = setTimeout(() => {
            if (this.current === cur && this.state === 'playing') void this.startAt(cur.loaded.source.skip);
          }, LOOP_GAP_MS);
        } else this.setState('paused');
      };
      node.start(now, start);
      this.node = node;
      this.trackGain = trackGain;
      this.fade = fade;
      this.startedAt = now;
      this.offset = start;
      this.setState('playing');
    } else if (cur.loaded.element) {
      const el = cur.loaded.element;
      this.element = el;
      el.volume = Math.min(1, this.musicVolume);
      el.loop = this.autoLoop;
      el.currentTime = offset;
      el.onended = () => this.setState('paused');
      await el.play();
      this.setState('playing');
    }
  }

  /** Stops the sound immediately (with a short fade), keeping or dropping the current song. */
  private halt(keepCurrent: boolean) {
    this.clearLoopTimer();
    const ctx = this.ctx;
    if (this.node && this.fade && ctx) {
      const node = this.node;
      const fade = this.fade;
      const now = ctx.currentTime;
      fade.gain.cancelScheduledValues(now);
      fade.gain.setValueAtTime(Math.max(0.0001, fade.gain.value), now);
      fade.gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT);
      try {
        node.stop(now + FADE_OUT + 0.02);
      } catch {
        /* already stopped */
      }
      this.node = null;
    }
    if (this.element) {
      this.element.pause();
      if (!keepCurrent) this.element = null;
    }
    if (!keepCurrent) this.current = null;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.offset = this.position();
    this.halt(true);
    this.setState('paused');
  }

  async resume() {
    if (this.state !== 'paused' || !this.current) return;
    this.unlock();
    if (this.current.loaded.buffer) await this.startAt(this.offset);
    else if (this.element) {
      await this.element.play();
      this.setState('playing');
    }
  }

  async toggle() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') await this.resume();
  }

  async restart() {
    if (!this.current) return;
    this.unlock();
    this.halt(true);
    await this.startAt(this.current.loaded.source.skip);
  }

  stop() {
    this.request++;
    this.halt(false);
    this.setState('idle');
  }

  /** Current playback position within the preview, in seconds. */
  position(): number {
    if (this.element && this.current && !this.current.loaded.buffer) return this.element.currentTime;
    if (!this.current?.loaded.buffer || !this.ctx) return 0;
    if (this.state !== 'playing' || !this.node) return this.offset;
    return Math.min(this.current.loaded.buffer.duration, this.offset + (this.ctx.currentTime - this.startedAt));
  }

  duration(): number {
    if (this.current?.loaded.buffer) return this.current.loaded.buffer.duration;
    return this.element?.duration || 30;
  }

  sourceKind(): string | null {
    return this.current?.loaded.source.kind ?? null;
  }

  /** Fills `out` with frequency magnitudes (0-255). Returns false when no analyser is available. */
  levels(out: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser || !this.current?.loaded.buffer) return false;
    this.analyser.getByteFrequencyData(out);
    return true;
  }

  private clearLoopTimer() {
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = null;
  }
}

export const player = new MusicPlayer();
