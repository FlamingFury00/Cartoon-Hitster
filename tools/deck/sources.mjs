#!/usr/bin/env node
// Resolves the stable playback data of each card and stores it in deck/sources.json:
//  - spp:  Spotify 30 s preview URL (read from the public embed page of the track)
//  - itp:  iTunes 30 s preview URL (iTunes lookup API, rate limited: cached and slow)
//  - meta: release dates seen on each store (used by the year sanity checks)
//
//   node tools/deck/sources.mjs [deck/songs.csv] [--skip-itunes]
import { readFile, writeFile } from 'node:fs/promises';
import { parseCsv } from './lib/csv.mjs';
import { getJson } from './lib/http.mjs';
import { deezerTrack } from './lib/deezer.mjs';

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--')) ?? 'deck/songs.csv';
const skipItunes = args.includes('--skip-itunes');
const out = 'deck/sources.json';

const rows = parseCsv(await readFile(csvPath, 'utf8'));
let sources = {};
try {
  sources = JSON.parse(await readFile(out, 'utf8'));
} catch {
  /* fresh */
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const embedCache = new Map();

async function spotifyEmbed(id) {
  if (embedCache.has(id)) return embedCache.get(id);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://open.spotify.com/embed/track/${id}`, { headers: { 'User-Agent': UA } });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
        continue;
      }
      const html = await res.text();
      const m = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s.exec(html);
      if (!m) return null;
      const entity = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity;
      const data = entity && {
        title: entity.name,
        artists: (entity.artists ?? []).map((a) => a.name),
        releaseDate: entity.releaseDate?.isoString?.slice(0, 10) ?? null,
        duration: Math.round((entity.duration ?? 0) / 1000),
        preview: entity.audioPreview?.url ?? null,
        playable: entity.isPlayable !== false,
      };
      embedCache.set(id, data);
      await new Promise((r) => setTimeout(r, 350));
      return data;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return null;
}

let n = 0;
for (const r of rows) {
  n++;
  const id = r.id.padStart(3, '0');
  const entry = (sources[id] ??= {});
  entry.title = r.songTitle;

  if (r.spotifyTrackId && entry.spId !== r.spotifyTrackId) {
    const e = await spotifyEmbed(r.spotifyTrackId);
    entry.spId = r.spotifyTrackId;
    entry.spp = e?.preview ?? undefined;
    entry.spMeta = e ? { title: e.title, artists: e.artists, releaseDate: e.releaseDate, duration: e.duration, playable: e.playable } : null;
  }
  if (r.deezerId && entry.dzId !== Number(r.deezerId)) {
    const t = await deezerTrack(r.deezerId);
    entry.dzId = Number(r.deezerId);
    entry.dzMeta = t
      ? { title: t.title, artist: t.artist?.name, album: t.album?.title, releaseDate: t.release_date, duration: t.duration, isrc: t.isrc, readable: t.readable, hasPreview: Boolean(t.preview) }
      : null;
  }
  if (!skipItunes && r.itunesId && entry.itId !== Number(r.itunesId)) {
    const res = await getJson(`https://itunes.apple.com/lookup?id=${r.itunesId}&country=it&entity=song`, { minIntervalMs: 3500, retries: 8 });
    const t = res?.results?.find((x) => x.kind === 'song');
    entry.itId = Number(r.itunesId);
    entry.itp = t?.previewUrl ?? undefined;
    entry.itMeta = t ? { title: t.trackName, artist: t.artistName, album: t.collectionName, releaseDate: t.releaseDate?.slice(0, 10), duration: Math.round((t.trackTimeMillis ?? 0) / 1000) } : null;
  }
  if (n % 10 === 0) {
    await writeFile(out, JSON.stringify(sources, null, 1));
    console.log(`${n}/${rows.length}`);
  }
}
await writeFile(out, JSON.stringify(sources, null, 1));
console.log(`Wrote ${out} (${Object.keys(sources).length} entries)`);
