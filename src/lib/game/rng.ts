// Deterministic randomness helpers. Every game stores its seed, so a game can be
// reproduced exactly in tests and a reloaded game keeps the same draw pile.

/** Mulberry32: tiny, fast, good-quality 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 2 ** 32);
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Weighted random permutation (Efraimidis & Spirakis, "Weighted random sampling with a
 * reservoir", Information Processing Letters 97(5), 2006): every item gets the key
 * u^(1/w) with u ~ U(0,1); sorting by key descending yields a permutation in which
 * heavier items tend to come first, while every item keeps a chance to appear anywhere.
 */
export function weightedOrder<T>(items: readonly T[], weight: (item: T) => number, rand: () => number): T[] {
  return items
    .map((item) => {
      const w = Math.max(1e-6, weight(item));
      const u = Math.max(Number.EPSILON, rand());
      // log(u)/w preserves the order of u^(1/w) and avoids float underflow.
      return { item, key: Math.log(u) / w };
    })
    .sort((x, y) => y.key - x.key)
    .map((x) => x.item);
}

/**
 * Re-orders a sequence so that items sharing the same key (e.g. the same cartoon) are
 * at least `gap` positions apart whenever possible, keeping the original order otherwise.
 */
export function spreadByKey<T>(items: readonly T[], key: (item: T) => string, gap = 4): T[] {
  const pending = items.slice();
  const out: T[] = [];
  while (pending.length) {
    const recent = new Set(out.slice(-gap).map(key));
    let idx = pending.findIndex((it) => !recent.has(key(it)));
    if (idx < 0) idx = 0; // impossible to satisfy: accept the next item
    out.push(pending.splice(idx, 1)[0]);
  }
  return out;
}
