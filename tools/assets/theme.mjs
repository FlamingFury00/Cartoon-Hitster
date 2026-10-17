#!/usr/bin/env node
// Builds the main theme of the menus (src/assets/music/theme.mp3 + theme.json) from
// "Happy Happy Game Show" by Kevin MacLeod (incompetech.com, CC BY 4.0, credited in
// CREDITS.md and in the app): a 12-bar blues on organ, piano, bass, drums and horns at 230 bpm.
// Its 24-bar choruses repeat, so the opening bars play once as an intro and then two choruses
// (192 beats: organ, then horns) loop seamlessly in the app. The loop starts on a bar line, its
// length is refined to the sample by cross-correlation with the same bar one loop later, and
// the audio just before the loop end is crossfaded with the audio just before its start.
//
//   node tools/assets/theme.mjs      (needs ffmpeg with libmp3lame; the download goes to .cache/music)
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SR, db, decode, download, encodeMp3, loudness, peakOf } from './lib/audio.mjs';

const SOURCE = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Happy%20Happy%20Game%20Show.mp3';
const CACHE = path.resolve('.cache/music');
const OUT = path.resolve('src/assets/music');
const BPM = 230;
/** Two 24-bar choruses of 4 beats. */
const LOOP_BEATS = 192;
/** The loop starts on this bar: where the music matches its copy one loop later best. */
const SEAM_BAR = 6;
/** Crossfade before the loop end, in seconds. */
const XFADE = 0.25;
/** Menu music stays well below the songs of the game (played at -11 LUFS). */
const TARGET_LUFS = -19;
const PEAK_CEILING = -1;
const BITRATE = '128k';

/** Normalised correlation of two windows of `x` centred on `a` and `b`. */
function correlation(x, a, b, half) {
  let ab = 0, aa = 0, bb = 0;
  for (let i = -half; i < half; i++) {
    const u = x[a + i];
    const v = x[b + i];
    ab += u * v;
    aa += u * u;
    bb += v * v;
  }
  return ab / Math.sqrt(aa * bb + 1e-12);
}

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });
const file = path.join(CACHE, 'Happy Happy Game Show.mp3');
await download(SOURCE, file);
const x = await decode(file, { channels: 2 });
const frames = x.length / 2;
const mono = new Float32Array(frames);
for (let i = 0; i < frames; i++) mono[i] = (x[2 * i] + x[2 * i + 1]) / 2;

// The beat grid starts on the first note.
const threshold = peakOf(mono) * 0.05;
const first = mono.findIndex((v) => Math.abs(v) > threshold);
const start = Math.max(0, first - Math.round(0.005 * SR));
const bar = ((4 * 60) / BPM) * SR;
const a = Math.round(first + SEAM_BAR * bar);
const nominal = Math.round(((LOOP_BEATS * 60) / BPM) * SR);
let lag = nominal;
let best = -Infinity;
for (let d = nominal - Math.round(0.01 * SR); d <= nominal + Math.round(0.01 * SR); d++) {
  const c = correlation(mono, a, a + d, Math.round(0.5 * SR));
  if (c > best) [best, lag] = [c, d];
}
const b = a + lag;

// Intro + one loop (+ a little beyond the loop end, never played), with the crossfaded seam.
const end = Math.min(frames, b + Math.round(0.1 * SR));
const y = x.slice(start * 2, end * 2);
const X = Math.round(XFADE * SR);
for (let i = b - X; i < b; i++) {
  const w = (i - (b - X)) / X; // linear: the two sides are nearly identical, not independent
  for (let ch = 0; ch < 2; ch++) y[(i - start) * 2 + ch] = x[i * 2 + ch] * (1 - w) + x[(i - lag) * 2 + ch] * w;
}
for (let i = 0; i < Math.round(0.005 * SR); i++) for (let ch = 0; ch < 2; ch++) y[i * 2 + ch] *= i / (0.005 * SR);

// Loudness of the part that loops, which is what the players hear most.
const loop = y.slice((a - start) * 2, (b - start) * 2);
const lufs = await loudness(loop, { channels: 2, integrated: true });
const gain = Math.min(10 ** ((TARGET_LUFS - lufs) / 20), 10 ** (PEAK_CEILING / 20) / peakOf(y));
const out = y.map((s) => s * gain);
await encodeMp3(out, path.join(OUT, 'theme.mp3'), { bitrate: BITRATE, channels: 2 });

const meta = {
  file: 'theme.mp3',
  seconds: +((end - start) / SR).toFixed(3),
  loop: [+((a - start) / SR).toFixed(6), +((b - start) / SR).toFixed(6)],
};
await writeFile(path.join(OUT, 'theme.json'), JSON.stringify(meta, null, 2) + '\n');
const kB = (await stat(path.join(OUT, 'theme.mp3'))).size / 1024;
console.log(`theme.mp3: ${meta.seconds}s, loop ${meta.loop[0]}-${meta.loop[1]}s (${(lag / SR).toFixed(4)}s, seam match ${best.toFixed(3)})`);
console.log(`  ${lufs.toFixed(1)} LUFS -> ${(lufs + db(gain)).toFixed(1)} LUFS, peak ${db(peakOf(out)).toFixed(1)} dBFS, ${kB.toFixed(0)} kB`);
