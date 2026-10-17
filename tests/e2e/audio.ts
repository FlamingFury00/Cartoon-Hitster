import { expect, type Page } from '@playwright/test';
import meta from '../../src/assets/music/theme.json' with { type: 'json' };
import manifest from '../../src/assets/sfx/manifest.json' with { type: 'json' };

export type Source = {
  duration: number;
  loop: boolean;
  when: number;
  offset: number;
  rate: number;
  /** performance.now() of the start() call. */
  t: number;
  stopped: boolean;
  stopAt: number | null;
};

/** Records every Web Audio source the page starts (and stops), and the time of the first touch. */
export async function recordSources(page: Page) {
  await page.addInitScript(() => {
    const log: Source[] = [];
    const entries = new WeakMap<AudioBufferSourceNode, Source>();
    const w = window as unknown as { __sources: Source[]; __touch: number | null };
    w.__sources = log;
    w.__touch = null;
    addEventListener('pointerup', () => (w.__touch ??= performance.now()), { capture: true });
    const { start, stop } = AudioBufferSourceNode.prototype;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, when = 0, offset = 0, ...rest: number[]) {
      const e = {
        duration: this.buffer?.duration ?? 0,
        loop: this.loop,
        when,
        offset,
        rate: this.context.sampleRate,
        t: performance.now(),
        stopped: false,
        stopAt: null,
      };
      log.push(e);
      entries.set(this, e);
      return start.call(this, when, offset, ...rest);
    };
    AudioBufferSourceNode.prototype.stop = function (this: AudioBufferSourceNode, when = 0) {
      const e = entries.get(this);
      if (e) Object.assign(e, { stopped: true, stopAt: when });
      return stop.call(this, when);
    };
  });
}

export const sources = (page: Page) => page.evaluate(() => (window as unknown as { __sources: Source[] }).__sources);
export const firstTouch = (page: Page) => page.evaluate(() => (window as unknown as { __touch: number | null }).__touch);

/** The whole theme (it loops) and its first seconds, played while the rest is decoded. */
export const isWhole = (s: Source) => s.loop && Math.abs(s.duration - meta.seconds) < 0.01;
export const isHead = (s: Source) => !s.loop && s.duration > 8 && s.duration < 10;
export const isTheme = (s: Source) => isWhole(s) || isHead(s);

/** The theme is playing: one of its parts started and not stopped. */
export const themeOn = async (page: Page) => (await sources(page)).some((s) => isTheme(s) && !s.stopped);
/** How many times a part of the theme was started. */
export const themeStarts = async (page: Page) => (await sources(page)).filter(isTheme).length;

/** Resolves once the sound effects are downloaded (with the menu music on, right after the theme). */
export async function audioAwake(page: Page) {
  const files = Object.values(manifest).flatMap((e) => e.files).length;
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/assets\/(?!theme-)[^/]+\.mp3$/.test(e.name)).length))
    .toBe(files);
}
