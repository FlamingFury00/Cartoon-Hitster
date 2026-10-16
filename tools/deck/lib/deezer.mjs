// Deezer public API helpers (no authentication required).
import { getJson } from './http.mjs';
import { norm, titleSim, versionPenalty, dice } from './text.mjs';

const API = 'https://api.deezer.com';
const opts = { minIntervalMs: 130 };

export const deezerTrack = (id) => getJson(`${API}/track/${id}`, { ...opts, ttlMs: 7 * 864e5 });
export const deezerAlbum = (id) => getJson(`${API}/album/${id}`, opts);

// Album families that are known to carry the ORIGINAL recordings (RTI/Five reissues).
const ORIGINAL_ALBUM_HINTS = [
  'fivelandia', 'i tuoi amici in tv', 'reloaded', 'bee hive story', 'arriva cristina story', 'story',
  'sigle originali', 'le sigle originali', 'original', 'cartoni animati', 'time machine',
];
// Album families that are known to carry re-recordings or covers.
const RERECORD_ALBUM_HINTS = [
  'duets', 'magia di natale', 'il sogno continua', 'cri megamix', 'karaoke', 'canta disney',
  'piano', 'lullaby', 'ninne nanne', 'baby', 'bimbi', 'cartoonlandia', 'party', 'hits for kids',
  'kids', 'per bambini', 'compilation karaoke', 'cover', 'tribute', 'acoustic', 'unplugged',
];

function albumBias(albumTitle) {
  const a = ' ' + norm(albumTitle) + ' ';
  let b = 0;
  if (ORIGINAL_ALBUM_HINTS.some((h) => a.includes(' ' + norm(h) + ' ') || a.includes(norm(h)))) b += 0.4;
  if (RERECORD_ALBUM_HINTS.some((h) => a.includes(norm(h)))) b -= 1.5;
  return b;
}

export function artistSim(expectedNames, candidateNames) {
  let best = 0;
  for (const e of expectedNames) for (const c of candidateNames) best = Math.max(best, dice(e, c), norm(c).includes(norm(e)) && norm(e).length > 3 ? 0.95 : 0);
  return best;
}

/**
 * Searches Deezer for a curated song and returns scored candidates (best first).
 * @param {{title: string, performer: string, aliases?: string[], cartoon?: string}} song
 */
export async function searchDeezer(song) {
  const artists = [song.performer, ...(song.aliases ?? [])].filter(Boolean);
  const queries = [
    `artist:"${song.performer}" track:"${song.title}"`,
    `${song.title} ${song.performer}`,
    `${song.title} ${(song.aliases ?? [])[0] ?? ''}`.trim(),
    song.title,
  ];
  const seen = new Map();
  for (const q of [...new Set(queries)]) {
    const res = await getJson(`${API}/search?q=${encodeURIComponent(q)}&limit=50`, opts);
    for (const t of res?.data ?? []) if (!seen.has(t.id)) seen.set(t.id, t);
    if (seen.size >= 60) break;
  }
  const out = [];
  for (const t of seen.values()) {
    const tSim = titleSim(song.title, t.title);
    const aSim = artistSim(artists, [t.artist?.name ?? '']);
    const pen = versionPenalty(t.title, t.title_version ?? '', t.album?.title ?? '');
    const score = 3 * tSim + 2 * aSim - 1.5 * pen + albumBias(t.album?.title ?? '') + Math.min(0.3, (t.rank ?? 0) / 1e6);
    out.push({
      id: t.id,
      title: t.title,
      artist: t.artist?.name,
      album: t.album?.title,
      albumId: t.album?.id,
      duration: t.duration,
      rank: t.rank,
      readable: t.readable,
      hasPreview: Boolean(t.preview),
      tSim: +tSim.toFixed(3),
      aSim: +aSim.toFixed(3),
      pen,
      score: +score.toFixed(3),
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
