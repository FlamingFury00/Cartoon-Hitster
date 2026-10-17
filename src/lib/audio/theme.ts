// Main theme of the menus: "Happy Happy Game Show" by Kevin MacLeod (incompetech.com,
// CC BY 4.0), prepared by tools/assets/theme.mjs as an intro followed by a seamless loop.
// It plays through the music bus of the shared audio graph (music volume, limiter), fades
// in and out with the screens, and its decoded audio is dropped during a game.
import meta from '../../assets/music/theme.json';
import themeUrl from '../../assets/music/theme.mp3?url';
import { decode, player } from './player';

const FADE_IN = 1.5;
const FADE_OUT = 0.8;

class ThemePlayer {
  private buffer: AudioBuffer | null = null;
  private loading: Promise<AudioBuffer | null> | null = null;
  private node: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private wanted = false;
  private release = false;
  private waiting = false;
  private stopTimer: ReturnType<typeof setTimeout> | undefined;

  private load(ctx: BaseAudioContext): Promise<AudioBuffer | null> {
    if (this.buffer) return Promise.resolve(this.buffer);
    this.loading ??= fetch(themeUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => decode(ctx, data))
      .then((buffer) => (this.buffer = buffer))
      .catch(() => null) // e.g. offline before the app was cached: tried again next time
      .finally(() => (this.loading = null));
    return this.loading;
  }

  /** Plays the theme from the start with a fade-in, or keeps it playing. */
  play() {
    this.wanted = true;
    this.release = false;
    const ctx = player.ctx;
    if (!ctx) return; // the audio is created by the first touch
    if (ctx.state !== 'running') {
      // Not unlocked yet (e.g. iPhone wants a tap first): start as soon as it is.
      if (!this.waiting) {
        this.waiting = true;
        ctx.addEventListener('statechange', () => ((this.waiting = false), this.wanted && this.play()), { once: true });
      }
      return;
    }
    if (this.node && this.gain) {
      // Still fading out: bring it back.
      const g = this.gain.gain;
      const now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(1, now + 0.4);
      return;
    }
    void this.load(ctx).then((buffer) => {
      const out = player.musicOutput();
      if (!buffer || !out || !this.wanted || this.node || ctx.state !== 'running') return;
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = true;
      node.loopStart = meta.loop[0];
      node.loopEnd = meta.loop[1];
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(1, now + FADE_IN);
      node.connect(gain).connect(out);
      node.start(now);
      this.node = node;
      this.gain = gain;
    });
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
    const node = this.node;
    if (!ctx || !node || !this.gain) {
      if (this.release) this.buffer = null;
      return;
    }
    const g = this.gain.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.0001, now + FADE_OUT);
    // Not node.stop(time): a play() during the fade must be able to keep the same node.
    this.stopTimer = setTimeout(() => {
      if (this.wanted || this.node !== node) return;
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
      node.disconnect();
      this.node = null;
      this.gain = null;
      if (this.release) this.buffer = null;
    }, FADE_OUT * 1000 + 100);
  }
}

export const theme = new ThemePlayer();
