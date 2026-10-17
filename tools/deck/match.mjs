#!/usr/bin/env node
// Finds catalogue entries (Deezer, iTunes, Spotify) for every song of a deck CSV.
//
//   node tools/deck/match.mjs deck/songs.csv [--only=id,id] [--skip-itunes] [--skip-spotify]
//
// Writes deck/match-report.json with the chosen track per service plus the runner-up
// candidates, so a human can review ambiguous matches. IDs already present in the CSV
// are treated as manual overrides and are never replaced.
import { readFile, writeFile } from 'node:fs/promises';
import { parseCsv } from './lib/csv.mjs';
import { searchDeezer, deezerTrack, deezerAlbum } from './lib/deezer.mjs';
import { searchItunes } from './lib/itunes.mjs';
import { searchSpotify, closeSpotify } from './lib/spotify.mjs';
import { titleSim } from './lib/text.mjs';

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--')) ?? 'deck/songs.csv';
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const skipItunes = args.includes('--skip-itunes');
const skipSpotify = args.includes('--skip-spotify');
const reportPath = (args.find((a) => a.startsWith('--report=')) ?? '--report=deck/match-report.json').slice(9);

const songs = parseCsv(await readFile(csvPath, 'utf8')).filter((s) => !only.length || only.includes(s.id));
let report = {};
try {
  report = JSON.parse(await readFile(reportPath, 'utf8'));
} catch {
  /* fresh report */
}

const toSong = (row) => ({
  title: row.songTitle,
  performer: row.performer,
  aliases: row.aliases ? row.aliases.split(';').map((s) => s.trim()) : [],
  cartoon: row.cartoon,
});

let n = 0;
for (const row of songs) {
  n++;
  const song = toSong(row);
  const entry = (report[row.id] ??= {});
  entry.key = `${row.cartoon} | ${row.songTitle} | ${row.performer} | ${row.year}`;

  // ---- Deezer
  if (!entry.deezer || entry.deezer.key !== entry.key) {
    let chosenId = row.deezerId ? Number(row.deezerId) : null;
    const cands = await searchDeezer(song);
    const good = cands.filter((c) => c.tSim >= 0.6 && c.aSim >= 0.5 && c.pen === 0);
    if (!chosenId && good.length) chosenId = good[0].id;
    let chosen = null;
    if (chosenId) {
      const t = await deezerTrack(chosenId);
      const album = t?.album?.id ? await deezerAlbum(t.album.id) : null;
      chosen = t && {
        id: t.id,
        title: t.title,
        artist: t.artist?.name,
        contributors: (t.contributors ?? []).map((c) => c.name),
        album: t.album?.title,
        albumId: t.album?.id,
        albumDate: album?.release_date ?? t.release_date,
        label: album?.label,
        isrc: t.isrc,
        duration: t.duration,
        readable: t.readable,
        hasPreview: Boolean(t.preview),
        rank: t.rank,
      };
    }
    // Distinct recordings (ISRCs) among the plausible candidates: more than one means
    // re-recordings exist and the pick deserves a human look.
    const isrcs = new Map();
    for (const c of good.slice(0, 8)) {
      const t = await deezerTrack(c.id);
      if (!t?.isrc) continue;
      const k = t.isrc;
      if (!isrcs.has(k)) isrcs.set(k, { isrc: k, duration: t.duration, albums: [] });
      isrcs.get(k).albums.push(`${t.album?.title} (${t.release_date})`);
    }
    entry.deezer = {
      key: entry.key,
      chosen,
      recordings: [...isrcs.values()],
      alternatives: cands.slice(0, 8),
    };
  }

  // ---- iTunes (matched on title/artist and on the Deezer duration: same master = same length)
  if (!skipItunes && (!entry.itunes || entry.itunes.key !== entry.key)) {
    const durationSec = entry.deezer?.chosen?.duration;
    const cands = await searchItunes(song, { durationSec });
    const good = cands.filter((c) => c.tSim >= 0.6 && c.aSim >= 0.5 && c.pen === 0 && c.preview);
    const pick = row.itunesId ? cands.find((c) => String(c.id) === row.itunesId) ?? { id: Number(row.itunesId) } : good[0];
    entry.itunes = { key: entry.key, chosen: pick ?? null, alternatives: cands.slice(0, 6) };
  }

  // ---- Spotify (exact recording through the ISRC, text search as fallback)
  if (!skipSpotify && (!entry.spotify || entry.spotify.key !== entry.key)) {
    const isrc = row.isrc || entry.deezer?.chosen?.isrc;
    const dur = entry.deezer?.chosen?.duration;
    let viaIsrc = isrc ? await searchSpotify(`isrc:${isrc}`) : [];
    viaIsrc = viaIsrc.filter((t) => t.playable);
    let chosen = null;
    let method = null;
    if (row.spotifyTrackId) {
      chosen = { id: row.spotifyTrackId };
      method = 'manual';
    } else if (viaIsrc.length) {
      viaIsrc.sort((a, b) => Math.abs(a.duration - (dur ?? a.duration)) - Math.abs(b.duration - (dur ?? b.duration)));
      chosen = viaIsrc[0];
      method = 'isrc';
    } else {
      const text = await searchSpotify(`${song.title} ${song.performer}`);
      const ok = text.filter(
        (t) => t.playable && titleSim(song.title, t.title) >= 0.6 && (dur == null || Math.abs(t.duration - dur) <= 2),
      );
      if (ok.length) {
        chosen = ok[0];
        method = 'text+duration';
      }
    }
    entry.spotify = { key: entry.key, chosen, method, isrcHits: viaIsrc.length };
  }

  const d = entry.deezer?.chosen;
  console.log(
    `[${n}/${songs.length}] ${row.id} ${row.songTitle} (${row.year}) -> DZ ${d ? `${d.id} "${d.title}" / ${d.album} [${d.isrc}]` : '—'}` +
      `${entry.deezer?.recordings?.length > 1 ? ` ⚠ ${entry.deezer.recordings.length} recordings` : ''}` +
      ` | IT ${entry.itunes?.chosen?.id ?? '—'} | SP ${entry.spotify?.chosen?.id ?? '—'} (${entry.spotify?.method ?? ''})`,
  );
  if (n % 10 === 0) await writeFile(reportPath, JSON.stringify(report, null, 1));
}
await writeFile(reportPath, JSON.stringify(report, null, 1));
await closeSpotify();
