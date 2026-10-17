#!/usr/bin/env node
// Lists every catalogue version of each song (Deezer + Spotify) so that a human can pick
// the ORIGINAL recording: album, label, ISRC (Deezer), duration and release date.
//
//   node tools/deck/versions.mjs deck/candidates.csv [--only=id,id] > versions.txt
import { readFile } from 'node:fs/promises';
import { parseCsv } from './lib/csv.mjs';
import { searchDeezer, deezerTrack, artistSim } from './lib/deezer.mjs';
import { searchSpotify, closeSpotify } from './lib/spotify.mjs';
import { titleSim, versionPenalty } from './lib/text.mjs';

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--')) ?? 'deck/songs.csv';
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const rows = parseCsv(await readFile(csvPath, 'utf8')).filter((r) => !only.length || only.includes(r.id));

for (const r of rows) {
  const song = { title: r.songTitle, performer: r.performer, aliases: r.aliases ? r.aliases.split(';') : [] };
  const names = [song.performer, ...song.aliases];
  console.log(`\n### ${r.id} ${r.songTitle} — ${r.performer} (${r.year})`);
  const dz = (await searchDeezer(song)).filter((c) => c.tSim >= 0.72 && c.aSim >= 0.6).slice(0, 12);
  for (const c of dz) {
    const t = await deezerTrack(c.id);
    console.log(
      `  DZ ${String(c.id).padEnd(11)} ${String(t?.duration ?? c.duration).padStart(3)}s ${t?.isrc ?? ''} | ${c.title.slice(0, 40)} | ${c.artist?.slice(0, 22)} | ${c.album?.slice(0, 50)} (${t?.release_date ?? ''})${c.pen ? ' [pen]' : ''}`,
    );
  }
  const sp = (await searchSpotify(`${song.title} ${song.performer}`)).filter(
    (t) => titleSim(song.title, t.title) >= 0.72 && artistSim(names, t.artists) >= 0.6,
  );
  for (const t of sp.slice(0, 10)) {
    console.log(
      `  SP ${t.id} ${String(Math.round(t.duration)).padStart(3)}s | ${t.title.slice(0, 40)} | ${t.artists.join(', ').slice(0, 22)} | ${t.album?.slice(0, 50)}${versionPenalty(t.title, t.album) ? ' [pen]' : ''}${t.playable ? '' : ' [unplayable]'}`,
    );
  }
}
await closeSpotify();
