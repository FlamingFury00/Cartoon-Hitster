// Main theme of the menus: "Happy Happy Game Show" by Kevin MacLeod (incompetech.com,
// CC BY 4.0), prepared by tools/assets/theme.mjs as an intro followed by a seamless loop.
// It plays through the music bus of the shared audio graph (music volume, limiter), fades
// out with the screens, and its decoded audio is dropped during a game.
//
// It starts the moment it may: the app decodes it as soon as it opens, and its first seconds
// on their own first. They take a fraction of the time of the whole file (which needs a good
// while on a phone), so the music starts at once; the whole theme takes over a little later,
// on the very same sample.
import meta from '../../assets/music/theme.json';
import themeUrl from '../../assets/music/theme.mp3?url';
import { mp3Head } from './mp3';
import { decode, player } from './player';

/** Seconds decoded first: the intro and the start of the loop, time enough to decode the rest. */
const HEAD = 9;
/** The end of those seconds is left out (decoders may treat the end of a cut file their own way). */
const HEAD_MARGIN = 0.25;
/**
 * The audio is computed ahead of time: a start set at least this far ahead is kept to the
 * sample, so that the whole theme can take over exactly where its first seconds are.
 */
const LEAD = 0.1;
/** Crossfade from the first seconds to the whole theme (the same audio on both sides). */
const HANDOFF = 0.05;
const FADE_OUT = 0.8;

interface Voice {
  node: AudioBufferSourceNode;
  gain: GainNode;
}

class ThemePlayer {
  /** The file (kept: decoding it again after a game does not download it again). */
  private file: Promise<ArrayBuffer | null> | null = null;
  private loading: Promise<void> | null = null;
  /** The first seconds of the theme, until the whole of it is decoded. */
  private head: { buffer: AudioBuffer; until: number } | null = null;
  private whole: AudioBuffer | null = null;
  /** Volume of the theme (its fades); null while it does not play. */
  private out: GainNode | null = null;
  private voices: Voice[] = [];
  /** The first seconds playing, waiting for the whole theme: since when, and up to where. */
  private headVoice: Voice | null = null;
  private startedAt = 0;
  private headUntil = 0;
  private wanted = false;
  private release = false;
  private waiting = false;
  private stopTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Downloads and decodes the theme, its first seconds first; resolves once all of it is
   * decoded. It creates the audio context: allowed without a touch, it may wait for one to sound.
   */
  prepare(): Promise<void> {
    const ctx = player.ensureContext();
    if (!ctx || this.whole) return Promise.resolve();
    this.loading ??= this.load(ctx)
      .catch(() => {})
      .finally(() => (this.loading = null));
    return this.loading;
  }

  private download(): Promise<ArrayBuffer | null> {
    this.file ??= fetch(themeUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .catch(() => ((this.file = null), null)); // e.g. offline before the app was cached: tried again next time
    return this.file;
  }

  private async load(ctx: BaseAudioContext) {
    const bytes = await this.download();
    if (!bytes) return;
    // decodeAudioData takes away the data it is given: it gets copies.
    const part = this.head ? null : mp3Head(new Uint8Array(bytes), HEAD);
    if (part) {
      const buffer = await decode(ctx, bytes.slice(0, part.size)).catch(() => null);
      if (buffer) {
        this.head = { buffer, until: part.seconds - HEAD_MARGIN };
        this.ready();
      }
    }
    const whole = await decode(ctx, bytes.slice(0)).catch(() => null);
    if (!whole) return;
    this.whole = whole;
    this.head = null;
    this.ready();
  }

  /** A part of the theme was decoded: start it, or let the whole theme take over. */
  private ready() {
    const ctx = player.ctx;
    if (!this.wanted) {
      if (this.release) this.drop(); // stopped for good while it was loading
    } else if (ctx) this.update(ctx);
  }

  /** Plays the theme from the start, or keeps it playing. */
  play() {
    this.wanted = true;
    this.release = false;
    const ctx = player.ensureContext();
    if (!ctx) return;
    void this.prepare();
    if (this.out) {
      // Still fading out: bring it back.
      const g = this.out.gain;
      const now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(1, now + 0.4);
    }
    this.update(ctx);
  }

  /** Brings the sound in line with what is wanted and what is decoded. */
  private update(ctx: AudioContext) {
    if (!this.wanted) return;
    if (ctx.state !== 'running') {
      // Not allowed to sound yet (a browser waits for a first touch) or interrupted (a call on
      // an iPhone…): start as soon as it is.
      if (!this.waiting) {
        this.waiting = true;
        ctx.addEventListener('statechange', () => ((this.waiting = false), this.update(ctx)), { once: true });
      }
      return;
    }
    if (!this.out) this.start(ctx);
    else if (this.headVoice && this.whole) this.handoff(ctx, this.headVoice, this.whole);
  }

  /** Starts the theme from the top: the whole of it if decoded, else its first seconds. */
  private start(ctx: AudioContext) {
    const dest = player.musicOutput();
    const buffer = this.whole ?? this.head?.buffer;
    if (!dest || !buffer) return; // started by ready() once decoded
    this.out = ctx.createGain();
    this.out.connect(dest);
    // The first seconds start exactly on time, for the whole theme to take over later.
    this.startedAt = ctx.currentTime + (this.whole ? 0 : LEAD);
    // The file opens on silence: no fade-in, the first note is heard straight away.
    const voice = this.voice(ctx, buffer, this.startedAt, 0);
    this.headVoice = this.whole ? null : voice;
    this.headUntil = this.head?.until ?? 0;
  }

  /** The whole theme takes over from its first seconds, on the very same sample. */
  private handoff(ctx: AudioContext, head: Voice, whole: AudioBuffer) {
    this.headVoice = null;
    // A moment from now, on the sample grid of the start.
    const rate = whole.sampleRate;
    const frames = Math.ceil((ctx.currentTime + LEAD - this.startedAt) * rate);
    const when = this.startedAt + frames / rate;
    const at = frames / rate;
    // The same audio on both sides: a crossfade nobody can hear. If the first seconds ran out
    // first (a very slow device), the music comes back where it would be, more gently.
    const fade = at + HANDOFF <= this.headUntil ? HANDOFF : 0.3;
    head.gain.gain.setValueAtTime(1, when);
    head.gain.gain.linearRampToValueAtTime(0, when + fade);
    try {
      head.node.stop(when + fade);
    } catch {
      /* already over */
    }
    const [a, b] = meta.loop;
    this.voice(ctx, whole, when, at < b ? at : a + ((at - a) % (b - a)), fade);
  }

  /** Plays `buffer` from `offset` at `when` (the whole theme loops), fading in over `fade`. */
  private voice(ctx: AudioContext, buffer: AudioBuffer, when: number, offset: number, fade = 0): Voice {
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    if (buffer === this.whole) {
      node.loop = true;
      node.loopStart = meta.loop[0];
      node.loopEnd = meta.loop[1];
    }
    const gain = ctx.createGain();
    if (fade) {
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(1, when + fade);
    }
    node.connect(gain).connect(this.out!);
    node.start(when, offset);
    const voice = { node, gain };
    this.voices.push(voice);
    node.onended = () => {
      gain.disconnect();
      this.voices = this.voices.filter((v) => v !== voice);
    };
    return voice;
  }

  /**
   * Fades the theme out. With `release`, its decoded audio (about 20 MB) is dropped as well:
   * the next play() decodes it again from the bundled file.
   */
  stop(release = false) {
    this.wanted = false;
    this.release ||= release;
    const ctx = player.ctx;
    clearTimeout(this.stopTimer);
    const out = this.out;
    if (!ctx || !out) {
      if (this.release) this.drop();
      return;
    }
    const g = out.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.0001, now + FADE_OUT);
    // Not node.stop(time): a play() during the fade must be able to keep the same nodes.
    this.stopTimer = setTimeout(() => {
      if (this.wanted || this.out !== out) return;
      for (const { node } of this.voices) {
        try {
          node.stop();
        } catch {
          /* already stopped */
        }
      }
      out.disconnect();
      this.out = null;
      this.voices = [];
      this.headVoice = null;
      if (this.release) this.drop();
    }, FADE_OUT * 1000 + 100);
  }

  private drop() {
    this.head = null;
    this.whole = null;
  }
}

export const theme = new ThemePlayer();
