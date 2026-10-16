#!/usr/bin/env node
// Sanity checks for the app deck (src/data/deck.json). Exits with code 1 on errors.
//
//   node tools/deck/validate.mjs            offline checks (fast, used by CI)
//   node tools/deck/validate.mjs --online   also checks that every Deezer track still has a preview
import { readFile } from 'node:fs/promises';

const online = process.argv.includes('--online');
const deck = JSON.parse(await readFile('src/data/deck.json', 'utf8'));
const errors = [];
const warnings = [];
const KNOWN_TAGS = new Set(['cristina', 'vanni', 'robot', 'magia', 'sport', 'anime', 'western']);

if (deck.version !== 1) errors.push(`unexpected deck version ${deck.version}`);
if (!Array.isArray(deck.songs) || deck.songs.length < 100) errors.push(`the deck must contain at least 100 songs (found ${deck.songs?.length})`);

const seen = new Map();
const byDz = new Map();
const bySp = new Map();
const byTitle = new Map();
for (const s of deck.songs) {
  const where = `${s.id} "${s.title}"`;
  if (!/^\d{3}$/.test(s.id)) errors.push(`${where}: id must have 3 digits`);
  if (seen.has(s.id)) errors.push(`${where}: duplicate id`);
  seen.set(s.id, s);
  for (const f of ['cartoon', 'title', 'performer', 'origin', 'emoji']) if (!s[f] || typeof s[f] !== 'string') errors.push(`${where}: missing ${f}`);
  if (!Number.isInteger(s.year) || s.year < 1960 || s.year > new Date().getFullYear()) errors.push(`${where}: invalid year ${s.year}`);
  if (![1, 2, 3].includes(s.fame)) errors.push(`${where}: fame must be 1, 2 or 3`);
  if (!Array.isArray(s.tags)) errors.push(`${where}: tags must be an array`);
  for (const t of s.tags ?? []) if (!KNOWN_TAGS.has(t)) warnings.push(`${where}: unknown tag "${t}"`);
  const src = s.src ?? {};
  if (!src.dz && !src.itp && !src.spp) errors.push(`${where}: no playable source`);
  if (src.sp && !/^[0-9A-Za-z]{22}$/.test(src.sp)) errors.push(`${where}: malformed Spotify id ${src.sp}`);
  if (src.spp && !/^https:\/\/p\.scdn\.co\/mp3-preview\/[0-9a-f]+/.test(src.spp)) errors.push(`${where}: unexpected Spotify preview URL`);
  for (const [k, v] of Object.entries(src.gain ?? {})) if (!Number.isFinite(v) || Math.abs(v) > 15) errors.push(`${where}: gain.${k} out of range (${v})`);
  for (const [k, v] of Object.entries(src.skip ?? {})) if (!Number.isFinite(v) || v < 0 || v > 5) errors.push(`${where}: skip.${k} out of range (${v})`);
  if (src.dz) {
    if (byDz.has(src.dz)) errors.push(`${where}: Deezer track ${src.dz} also used by ${byDz.get(src.dz)}`);
    byDz.set(src.dz, s.id);
  }
  if (src.sp) {
    if (bySp.has(src.sp)) errors.push(`${where}: Spotify track ${src.sp} also used by ${bySp.get(src.sp)}`);
    bySp.set(src.sp, s.id);
  }
  const key = `${s.title}|${s.performer}`.toLowerCase();
  if (byTitle.has(key)) errors.push(`${where}: same title and performer as ${byTitle.get(key)}`);
  byTitle.set(key, s.id);
}

// The timeline is only fun with a good spread of years.
const perDecade = {};
for (const s of deck.songs) perDecade[Math.floor(s.year / 10) * 10] = (perDecade[Math.floor(s.year / 10) * 10] ?? 0) + 1;
const years = new Set(deck.songs.map((s) => s.year));
if (years.size < 30) warnings.push(`only ${years.size} distinct years`);

if (online) {
  let missing = 0;
  for (const s of deck.songs.filter((x) => x.src.dz)) {
    const res = await fetch(`https://api.deezer.com/track/${s.src.dz}`);
    const t = await res.json();
    if (t.error?.code === 4) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (!t.preview || t.readable === false) {
      missing++;
      warnings.push(`${s.id} "${s.title}": Deezer track ${s.src.dz} has no preview any more${s.src.spp || s.src.itp ? ' (fallback available)' : ''}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log(`Deezer previews missing: ${missing}`);
}

for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
console.log(
  `${deck.songs.length} songs, ${years.size} distinct years, per decade: ${Object.entries(perDecade)
    .map(([d, n]) => `${d}s ${n}`)
    .join(', ')}`,
);
if (errors.length) process.exit(1);
console.log('Deck OK');
