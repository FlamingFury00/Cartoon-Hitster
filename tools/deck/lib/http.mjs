// Polite, cached HTTP helpers for the deck curation pipeline.
// Responses are cached on disk (keyed by URL) so the pipeline is cheap to re-run
// and never hammers the public APIs it relies on.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = process.env.DECK_CACHE_DIR || path.resolve('.cache/deck-http');
const lastCall = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cachePath(url) {
  return path.join(CACHE_DIR, createHash('sha1').update(url).digest('hex') + '.json');
}

/**
 * GET a JSON document with on-disk caching, per-host throttling and retries.
 * @param {string} url
 * @param {{minIntervalMs?: number, retries?: number, ttlMs?: number, headers?: Record<string,string>}} [opts]
 */
export async function getJson(url, opts = {}) {
  const { minIntervalMs = 250, retries = 6, ttlMs = Infinity, headers = {} } = opts;
  const file = cachePath(url);
  try {
    const cached = JSON.parse(await readFile(file, 'utf8'));
    if (Date.now() - cached.t < ttlMs) return cached.body;
  } catch {
    /* cache miss */
  }
  const host = new URL(url).host;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const wait = (lastCall.get(host) ?? 0) + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall.set(host, Date.now());
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SigleInFila-DeckBuilder/1.0 (private family game)', ...headers },
      });
      if (res.status === 404) return null;
      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0;
        const backoff = Math.max(retryAfter * 1000, Math.min(120_000, 4000 * 2 ** attempt));
        console.warn(`[http] ${res.status} ${url.slice(0, 110)} -> retry in ${Math.round(backoff / 1000)}s`);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const text = await res.text();
      const body = text.trim() ? JSON.parse(text) : null;
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(file, JSON.stringify({ t: Date.now(), url, body }));
      return body;
    } catch (err) {
      lastErr = err;
      await sleep(Math.min(60_000, 2000 * 2 ** attempt));
    }
  }
  throw lastErr ?? new Error(`Giving up on ${url}`);
}
