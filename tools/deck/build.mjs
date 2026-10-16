#!/usr/bin/env node
// Builds the app deck (src/data/deck.json) from the curated master sheet (deck/songs.csv).
//
//   node tools/deck/build.mjs [deck/songs.csv] [--all]
//
// Only rows marked verified=yes are exported (use --all while curating). Playback data
// (iTunes preview URLs, loudness corrections) comes from deck/sources.json, produced by
// tools/deck/sources.mjs and tools/deck/loudness.mjs.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseCsv } from './lib/csv.mjs';

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--')) ?? 'deck/songs.csv';
const includeAll = args.includes('--all');
const outPath = 'src/data/deck.json';

const rows = parseCsv(await readFile(csvPath, 'utf8'));
let sources = {};
try {
  sources = JSON.parse(await readFile('deck/sources.json', 'utf8'));
} catch {
  console.warn('deck/sources.json not found: iTunes previews and loudness data will be missing');
}

const errors = [];
const seenIds = new Set();
const songs = [];
for (const r of rows) {
  const id = r.id.padStart(3, '0');
  if (seenIds.has(id)) errors.push(`duplicate id ${id}`);
  seenIds.add(id);
  if (!includeAll && r.verified !== 'yes') continue;
  const year = Number(r.year);
  if (!Number.isInteger(year) || year < 1950 || year > 2030) errors.push(`${id}: invalid year "${r.year}"`);
  for (const f of ['cartoon', 'songTitle', 'performer']) if (!r[f]) errors.push(`${id}: missing ${f}`);
  const fame = Number(r.fame || 1);
  const src = sources[id] ?? {};
  const out = {
    id,
    cartoon: r.cartoon,
    title: r.songTitle,
    performer: r.performer,
    year,
    origin: r.origin || 'JP',
    emoji: r.emoji || '🎵',
    fame: [1, 2, 3].includes(fame) ? fame : 1,
    tags: (r.tags || '').split(';').map((t) => t.trim()).filter(Boolean),
    ...(r.notes ? { note: r.notes } : {}),
    src: {
      ...(r.deezerId ? { dz: Number(r.deezerId) } : {}),
      ...(r.itunesId ? { it: Number(r.itunesId) } : {}),
      ...(src.itp ? { itp: src.itp } : {}),
      ...(r.spotifyTrackId ? { sp: r.spotifyTrackId } : {}),
      ...(src.spp ? { spp: src.spp } : {}),
      ...(src.gain ? { gain: src.gain } : {}),
      ...(src.skip ? { skip: src.skip } : {}),
    },
  };
  if (!out.src.dz && !out.src.itp && !out.src.spp) errors.push(`${id} ${r.songTitle}: no playable source`);
  songs.push(out);
}

if (errors.length) {
  console.error(errors.join('\n'));
  if (!includeAll) process.exit(1);
}

songs.sort((a, b) => a.id.localeCompare(b.id));
const deck = { version: 1, generated: new Date().toISOString().slice(0, 10), songs };
await mkdir('src/data', { recursive: true });
await writeFile(outPath, JSON.stringify(deck));
const years = songs.map((s) => s.year);
console.log(`Wrote ${outPath}: ${songs.length} songs, ${Math.min(...years)}–${Math.max(...years)}`);
