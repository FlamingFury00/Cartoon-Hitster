// iTunes Search API helpers (no authentication). The API is aggressively rate
// limited per IP, so calls are spaced out and cached.
import { getJson } from './http.mjs';
import { titleSim, versionPenalty } from './text.mjs';
import { artistSim } from './deezer.mjs';

const opts = { minIntervalMs: 3500, retries: 8 };

export async function searchItunes(song, { durationSec } = {}) {
  const artists = [song.performer, ...(song.aliases ?? [])].filter(Boolean);
  const terms = [`${song.title} ${song.performer}`, song.title];
  const seen = new Map();
  for (const term of terms) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=it&entity=song&limit=50&lang=it_it`;
    const res = await getJson(url, opts);
    for (const t of res?.results ?? []) if (t.kind === 'song' && !seen.has(t.trackId)) seen.set(t.trackId, t);
    if (seen.size >= 25) break;
  }
  const out = [];
  for (const t of seen.values()) {
    const tSim = titleSim(song.title, t.trackName);
    const aSim = artistSim(artists, [t.artistName ?? '']);
    const pen = versionPenalty(t.trackName, t.collectionName ?? '');
    const dur = (t.trackTimeMillis ?? 0) / 1000;
    const dDiff = durationSec ? Math.abs(dur - durationSec) : null;
    let score = 3 * tSim + 2 * aSim - 1.5 * pen;
    if (dDiff != null) score += dDiff <= 1.5 ? 1.5 : dDiff <= 3 ? 0.6 : -0.8;
    out.push({
      id: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      album: t.collectionName,
      releaseDate: t.releaseDate,
      duration: +dur.toFixed(1),
      dDiff: dDiff == null ? null : +dDiff.toFixed(1),
      preview: t.previewUrl,
      tSim: +tSim.toFixed(3),
      aSim: +aSim.toFixed(3),
      pen,
      score: +score.toFixed(3),
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
