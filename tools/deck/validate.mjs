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
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function deezerOk(id) {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const t = await (await fetch(`https://api.deezer.com/track/${id}`)).json();
        if (t.error?.code === 4) {
          await sleep(5000); // quota: retry the same track
          continue;
        }
        return Boolean(t.preview) && t.readable !== false;
      } catch {
        await sleep(2000);
      }
    }
    return false;
  }
  async function urlOk(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) return true;
        if (res.status === 403 || res.status === 404) return false;
      } catch {
        /* retry */
      }
      await sleep(1500);
    }
    return false;
  }
  let dzMissing = 0;
  let spMissing = 0;
  for (const s of deck.songs) {
    const dz = s.src.dz ? await deezerOk(s.src.dz) : false;
    const sp = s.src.spp ? await urlOk(s.src.spp) : false;
    if (s.src.dz && !dz) {
      dzMissing++;
      warnings.push(`${s.id} "${s.title}": Deezer track ${s.src.dz} has no preview any more`);
    }
    if (s.src.spp && !sp) {
      spMissing++;
      warnings.push(`${s.id} "${s.title}": Spotify preview not reachable`);
    }
    if (!dz && !sp && !s.src.itp) errors.push(`${s.id} "${s.title}": no working preview at all`);
    await sleep(120);
  }
  console.log(`Previews missing: Deezer ${dzMissing}, Spotify ${spMissing}`);
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
