#!/usr/bin/env node
// Measures every preview used by the deck with ffmpeg (EBU R128 integrated loudness, true peak
// and leading silence) and stores per-source corrections in deck/sources.json:
//   gain: dB added at playback so that every song plays at TARGET_LUFS
//   skip: seconds of silence to jump over at the start of the preview
// Old mono TV recordings and modern masters differ by 10+ dB: without this the volume
// would jump from card to card.
//
//   node tools/deck/loudness.mjs [deck/songs.csv] [--force]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseCsv } from './lib/csv.mjs';

const run = promisify(execFile);
const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--')) ?? 'deck/songs.csv';
const force = args.includes('--force');
const out = 'deck/sources.json';
const AUDIO_DIR = path.resolve('.cache/previews');

/** Previews are mastered loud (median -8.5 LUFS): -11 keeps a party-friendly level on phone speakers. */
const TARGET_LUFS = -11;
const MAX_BOOST = 9;
const MAX_CUT = -12;
/** Boosted true peaks may exceed full scale by this much: the in-app limiter catches them. */
const PEAK_CEILING = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(file) {
  try {
    return (await stat(file)).size > 1000;
  } catch {
    return false;
  }
}

async function download(url, file) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 403 || res.status === 404 || res.status === 410) return false;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) return false;
      await writeFile(file, buf);
      return true;
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  return false;
}

/** Fresh signed preview URL from the Deezer API (they expire after ~15 minutes). */
async function deezerPreviewUrl(id) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`https://api.deezer.com/track/${id}`);
      const json = await res.json();
      if (json?.error?.code === 4) {
        await sleep(3000 * (attempt + 1)); // quota
        continue;
      }
      return json?.preview || null;
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

async function measure(file) {
  const { stderr } = await run(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-48dB:d=0.2,ebur128=framelog=quiet:peak=true', '-f', 'null', '-'],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(stderr)?.[1]);
  const peak = Number(/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(stderr.split('True peak:')[1] ?? '')?.[1]);
  let lead = 0;
  const start = /silence_start: (-?[\d.e-]+)/.exec(stderr);
  if (start && Number(start[1]) <= 0.05) lead = Number(/silence_end: ([\d.]+)/.exec(stderr)?.[1] ?? 0);
  const duration = Number(/Duration: (\d+):(\d+):([\d.]+)/.exec(stderr)?.slice(1).reduce((t, v) => t * 60 + Number(v), 0));
  return { lufs, peak: Number.isFinite(peak) ? peak : null, lead, duration };
}

function correction(m) {
  if (!Number.isFinite(m.lufs) || m.lufs < -70) return 0;
  let gain = TARGET_LUFS - m.lufs;
  if (m.peak !== null) gain = Math.min(gain, PEAK_CEILING - m.peak);
  gain = Math.max(MAX_CUT, Math.min(MAX_BOOST, gain));
  return Math.round(gain * 10) / 10;
}

const rows = parseCsv(await readFile(csvPath, 'utf8'));
let sources = {};
try {
  sources = JSON.parse(await readFile(out, 'utf8'));
} catch {
  console.error(`${out} not found: run tools/deck/sources.mjs first`);
  process.exit(1);
}
await mkdir(AUDIO_DIR, { recursive: true });

const jobs = [];
for (const r of rows) {
  const id = r.id.padStart(3, '0');
  const entry = (sources[id] ??= {});
  entry.loud ??= {};
  if (r.deezerId) jobs.push({ entry, kind: 'dz', key: r.deezerId, file: `dz-${r.deezerId}.mp3`, url: () => deezerPreviewUrl(r.deezerId) });
  if (entry.spp) jobs.push({ entry, kind: 'sp', key: entry.spp, file: `sp-${r.spotifyTrackId}.mp3`, url: async () => entry.spp });
  if (entry.itp) jobs.push({ entry, kind: 'it', key: entry.itp, file: `it-${r.itunesId}.m4a`, url: async () => entry.itp });
}

let done = 0;
let failed = 0;
async function worker(queue) {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const cached = job.entry.loud[job.kind];
    if (!force && cached?.key === job.key && Number.isFinite(cached.lufs)) {
      done++;
      continue;
    }
    const file = path.join(AUDIO_DIR, job.file);
    if (!(await exists(file))) {
      const url = await job.url();
      if (!url || !(await download(url, file))) {
        failed++;
        console.warn(`  ! ${job.kind} ${job.file}: preview not downloadable`);
        continue;
      }
    }
    try {
      const m = await measure(file);
      job.entry.loud[job.kind] = { key: job.key, lufs: m.lufs, peak: m.peak, lead: Math.round(m.lead * 100) / 100, duration: Math.round(m.duration * 10) / 10 };
    } catch (err) {
      failed++;
      console.warn(`  ! ${job.kind} ${job.file}: ${err.message.split('\n')[0]}`);
    }
    if (++done % 25 === 0) console.log(`${done}/${jobs.length}`);
  }
}
const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, () => worker(queue)));

// Derive the playback corrections from the measurements.
for (const entry of Object.values(sources)) {
  const gain = {};
  const skip = {};
  for (const [kind, m] of Object.entries(entry.loud ?? {})) {
    const g = correction(m);
    if (g !== 0) gain[kind] = g;
    if (m.lead > 0.08) skip[kind] = Math.min(4, Math.round(m.lead * 100) / 100);
  }
  entry.gain = Object.keys(gain).length ? gain : undefined;
  entry.skip = Object.keys(skip).length ? skip : undefined;
}
await writeFile(out, JSON.stringify(sources, null, 1));

const all = Object.values(sources).flatMap((e) => Object.values(e.loud ?? {}).map((m) => m.lufs)).filter(Number.isFinite);
all.sort((a, b) => a - b);
const pct = (p) => all[Math.min(all.length - 1, Math.floor(p * all.length))]?.toFixed(1);
console.log(`Measured ${all.length} previews (${failed} failed). Loudness LUFS: min ${pct(0)}, p10 ${pct(0.1)}, median ${pct(0.5)}, p90 ${pct(0.9)}, max ${pct(1)}`);
