// Resolves a playable 30-second preview for a song, with no developer account:
//  1. Deezer public API (JSONP) -> fresh signed preview URL (expires after ~15 minutes)
//  2. Spotify preview URL stored in the deck (stable, read from the public embed page)
//  3. iTunes preview URL, when the deck has one (optional, refreshed through the lookup API)
// All these CDNs send `Access-Control-Allow-Origin: *`, so previews can be decoded with Web Audio.
import type { Song } from '../game/types';

export type SourceKind = 'dz' | 'it' | 'sp';

export interface ResolvedSource {
  kind: SourceKind;
  url: string;
  gainDb: number;
  skip: number;
}

const JSONP_TIMEOUT = 7000;
let jsonpSeq = 0;

/** Minimal JSONP loader (the Deezer API does not send CORS headers for arbitrary origins). */
export function jsonp<T>(url: string, timeoutMs = JSONP_TIMEOUT): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const name = `__sif_dz_${(jsonpSeq++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    let done = false;
    const finish = () => {
      done = true;
      clearTimeout(timer);
      script.remove();
      // Keep a no-op behind for late responses, then clean up.
      w[name] = () => {};
      setTimeout(() => delete w[name], 60_000);
    };
    const timer = setTimeout(() => {
      if (done) return;
      finish();
      reject(new Error('timeout'));
    }, timeoutMs);
    w[name] = (data: T) => {
      if (done) return;
      finish();
      resolve(data);
    };
    script.onerror = () => {
      if (done) return;
      finish();
      reject(new Error('network'));
    };
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${name}`;
    document.head.appendChild(script);
  });
}

interface DeezerTrack {
  readable?: boolean;
  preview?: string;
  error?: unknown;
}

const dzCache = new Map<number, { url: string; expires: number }>();

/** Signed Deezer preview URLs carry `exp=<unix seconds>`; refresh one minute early. */
function expiryOf(url: string): number {
  const m = /exp=(\d{9,})/.exec(url);
  return m ? Number(m[1]) * 1000 - 60_000 : Date.now() + 10 * 60_000;
}

export async function deezerPreview(id: number): Promise<string | null> {
  const hit = dzCache.get(id);
  if (hit && hit.expires > Date.now()) return hit.url;
  const data = await jsonp<DeezerTrack>(`https://api.deezer.com/track/${id}`);
  if (!data || data.error || !data.preview) return null;
  dzCache.set(id, { url: data.preview, expires: expiryOf(data.preview) });
  return data.preview;
}

export async function itunesLookup(id: number): Promise<string | null> {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&country=it&entity=song`, { mode: 'cors' });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: { previewUrl?: string }[] };
  return json.results?.find((r) => r.previewUrl)?.previewUrl ?? null;
}

export type SourcePreference = 'auto' | 'deezer' | 'itunes' | 'spotify';

/** Ordered list of lazily-resolved candidate sources for a song. */
export function sourceCandidates(song: Song, pref: SourcePreference = 'auto'): (() => Promise<ResolvedSource | null>)[] {
  const { src } = song;
  const dz = src.dz
    ? async (): Promise<ResolvedSource | null> => {
        const url = await deezerPreview(src.dz!);
        return url ? { kind: 'dz', url, gainDb: src.gain?.dz ?? 0, skip: src.skip?.dz ?? 0 } : null;
      }
    : null;
  const itStored = src.itp
    ? async (): Promise<ResolvedSource | null> => ({ kind: 'it', url: src.itp!, gainDb: src.gain?.it ?? 0, skip: src.skip?.it ?? 0 })
    : null;
  const itFresh = src.it
    ? async (): Promise<ResolvedSource | null> => {
        const url = await itunesLookup(src.it!);
        return url && url !== src.itp ? { kind: 'it', url, gainDb: src.gain?.it ?? 0, skip: src.skip?.it ?? 0 } : null;
      }
    : null;
  const sp = src.spp
    ? async (): Promise<ResolvedSource | null> => ({ kind: 'sp', url: src.spp!, gainDb: src.gain?.sp ?? 0, skip: src.skip?.sp ?? 0 })
    : null;
  const order = pref === 'itunes' ? [itStored, itFresh, dz, sp] : pref === 'spotify' ? [sp, dz, itStored, itFresh] : [dz, itStored, sp, itFresh];
  return order.filter((x): x is () => Promise<ResolvedSource | null> => x !== null);
}

export function hasPlayableSource(song: Song): boolean {
  return Boolean(song.src.dz || song.src.itp || song.src.it || song.src.spp);
}

export function spotifyUrl(song: Song): string {
  if (song.src.sp) return `https://open.spotify.com/track/${song.src.sp}`;
  return `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.performer}`)}`;
}
