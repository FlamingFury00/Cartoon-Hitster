// Small platform layer: haptics, screen wake lock and external links, with an optional
// native bridge when the app runs inside the Android wrapper (see android/).

interface AndroidBridge {
  vibrate(ms: number): void;
  vibratePattern?(pattern: string): void;
  keepScreenOn(on: boolean): void;
  openExternal(url: string): void;
  appVersion?(): string;
}

const bridge = (globalThis as unknown as { SigleBridge?: AndroidBridge }).SigleBridge;

export const isAndroidApp = Boolean(bridge);

let hapticsOn = true;
export function setHaptics(on: boolean) {
  hapticsOn = on;
}

/** Vibrates with a pattern (ms on/off...). Silently ignored where unsupported. */
export function haptic(pattern: number | number[]) {
  if (!hapticsOn) return;
  try {
    if (bridge) {
      if (Array.isArray(pattern) && bridge.vibratePattern) bridge.vibratePattern(pattern.join(','));
      else bridge.vibrate(Array.isArray(pattern) ? pattern[0] : pattern);
      return;
    }
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export const haptics = {
  tap: () => haptic(8),
  place: () => haptic(18),
  correct: () => haptic([30, 60, 30, 60, 60]),
  wrong: () => haptic([120, 80, 220]),
  coin: () => haptic([15, 40, 15]),
  win: () => haptic([60, 80, 60, 80, 200]),
};

// ------------------------------------------------------------------ wake lock

type WakeLockSentinel = { release(): Promise<void>; released?: boolean };
let sentinel: WakeLockSentinel | null = null;
let wantAwake = false;

async function acquire() {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<WakeLockSentinel> } }).wakeLock;
    if (wl && (!sentinel || sentinel.released)) sentinel = await wl.request('screen');
  } catch {
    /* not allowed (battery saver, iframe...) */
  }
}

export function keepAwake(on: boolean) {
  wantAwake = on;
  if (bridge) {
    bridge.keepScreenOn(on);
    return;
  }
  if (on) void acquire();
  else {
    void sentinel?.release().catch(() => {});
    sentinel = null;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wantAwake && !bridge) void acquire();
  });
}

// ------------------------------------------------------------------ links

export function openExternal(url: string) {
  if (bridge) {
    bridge.openExternal(url);
    return;
  }
  // A link click opens a new tab (or the Spotify app) and never replaces the game tab.
  // (window.open with "noopener" always returns null, so it cannot detect a blocked popup.)
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
