#!/usr/bin/env node
// Builds the sound effects of the game (src/assets/sfx/*.mp3 + manifest.json) from real
// recordings with free licences (all listed in CREDITS.md):
//   - Kenney's CC0 audio packs: cards, poker chips, coins, clicks, short jingles
//   - public domain / CC0 recordings from Wikimedia Commons: a US Air Force Band drum roll,
//     a cymbal, a boxing bell, a small crowd cheering, mouth pops
//   - a CC0 brass fanfare from OpenGameArt and Joe Lamb's "Sad Trombone" (CC BY 3.0)
// Every effect is cut out of its source, cleaned (high-pass, silence trimmed, short fades),
// loudness-matched and encoded as a small mono MP3, so the whole set is reproducible:
//
//   node tools/assets/sfx.mjs        (needs ffmpeg with libmp3lame and unzip; downloads go to .cache/sfx)
import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SR, db, decode, download, encodeMp3, exists, loudness, peakOf, run } from './lib/audio.mjs';

const CACHE = path.resolve('.cache/sfx');
const OUT = path.resolve('src/assets/sfx');
const BITRATE = '96k';
/** Sample peak ceiling of every file (dBFS): MP3 overshoot stays below full scale. */
const PEAK_CEILING = -1;

const KENNEY = 'https://kenney.nl/media/pages/assets';
/** Zip packs: their sounds are referenced as "<pack>:<path inside the zip>". */
const PACKS = {
  casino: `${KENNEY}/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip`,
  rpg: `${KENNEY}/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip`,
  ui: `${KENNEY}/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip`,
  jingles: `${KENNEY}/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip`,
};
/** Single files: "commons:<file name on Wikimedia Commons>" or "oga:<file name on OpenGameArt>". */
const commonsUrl = (name) => {
  const h = createHash('md5').update(name).digest('hex');
  return `https://upload.wikimedia.org/wikipedia/commons/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(name)}`;
};
const ogaUrl = (name) => `https://opengameart.org/sites/default/files/${encodeURIComponent(name)}`;

const casino = (f, o = {}) => ({ src: `casino:Audio/${f}.ogg`, hp: 150, ...o });
const jingle = (dir, f, o = {}) => ({ src: `jingles:Audio/${dir} jingles/jingles_${f}.ogg`, fadeOut: 0.12, ...o });
const pop = (from) => ({ src: 'commons:Mouth_pop.ogg', from, to: from + 0.35, hp: 80 });

/**
 * Every effect, with one entry per variant (the game picks one at random each time).
 *   from/to   window of the source in seconds; the sound is trimmed inside it
 *   lufs      target loudness: highest momentary loudness (EBU R128, 400 ms window)
 *   hp        high-pass cutoff in Hz (rumble and hum of the recordings)
 *   fadeIn    fade at the start in seconds (default: 2 ms, just against clicks)
 *   fadeOut   fade at the end in seconds (default 40 ms)
 *   keepTail  keep the natural decay up to `to` instead of trimming the quiet tail
 *   layers    composite sound: several sources mixed at offsets `at` (seconds) with `gain` (dB)
 *   loop      [start, end] seconds of a seamless loop (crossfaded here, looped by the game)
 */
const SOUNDS = {
  // Interface: a soft click for toggles and steppers, a mouth "pop" for the main buttons.
  tap: { lufs: -30, variants: [{ src: 'ui:Audio/click1.ogg' }, { src: 'ui:Audio/click3.ogg' }] },
  pop: { lufs: -25, variants: [pop(4.6), pop(5.72), pop(7.05)] },
  // Cards and tokens, like the physical game on a table.
  draw: { lufs: -24, variants: [casino('card-shove-1'), casino('card-shove-2'), casino('card-shove-4')] },
  place: { lufs: -24, variants: [1, 2, 3, 4].map((i) => casino(`card-place-${i}`)) },
  shuffle: { lufs: -23, variants: [casino('card-shuffle', { to: 1.7, fadeOut: 0.45 })] },
  chip: { lufs: -23, variants: [casino('chips-stack-1'), casino('chips-stack-3'), casino('chips-stack-4')] },
  coin: { lufs: -21, variants: [{ src: 'rpg:Audio/handleCoins.ogg', to: 0.75, hp: 200, fadeOut: 0.18 }] },
  // The reveal: a concert snare roll (looped while the card spins) and a cymbal crash.
  roll: {
    lufs: -20,
    variants: [{ src: 'commons:Drum_Roll_-_Concert_Band_-_United_States_Air_Force_Band.mp3', from: 20, to: 22.4, hp: 90, keepTail: true, loop: [0.6, 2.2] }],
  },
  crash: { lufs: -16, variants: [{ src: 'commons:Cymbal_sounds.ogg', from: 17.08, to: 19.7, hp: 180, keepTail: true, fadeOut: 1.4 }] },
  // Verdicts and game events.
  correct: { lufs: -16, variants: [jingle('Steel', 'STEEL10')] },
  wrong: { lufs: -17, variants: [{ src: 'commons:Sad_Trombone-Joe_Lamb-665429450.ogg', to: 3.75, hp: 60, fadeOut: 0.3 }] },
  steal: { lufs: -17, variants: [{ src: 'commons:Ohhh_ahhh.ogg', from: 0.1, to: 2.05, hp: 120, keepTail: true, fadeIn: 0.05, fadeOut: 0.45 }] },
  challenge: { lufs: -16, variants: [{ src: 'commons:Dingdingding.wav', hp: 150, fadeOut: 0.25 }] },
  turn: { lufs: -21, variants: [jingle('Pizzicato', 'PIZZI08')] },
  fanfare: {
    lufs: -14,
    variants: [
      {
        layers: [
          { src: 'oga:fanfare_3.ogg', from: 0.15, to: 2.9, hp: 70, fadeOut: 0.3, at: 0, gain: 0 },
          { src: 'commons:Clapping_hurray.ogg', from: 5, to: 11.4, hp: 120, keepTail: true, fadeIn: 0.8, fadeOut: 0.5, at: 0.75, gain: -3 },
        ],
      },
    ],
  },
};

// ------------------------------------------------------------------ sources

/** Local path of a source reference, downloading (and unpacking) it on first use. */
async function source(ref) {
  const [kind, name] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
  if (kind in PACKS) {
    const dir = path.join(CACHE, kind);
    if (!(await exists(path.join(dir, name)))) {
      const zip = path.join(CACHE, `${kind}.zip`);
      await download(PACKS[kind], zip);
      await run('unzip', ['-q', '-o', zip, '-d', dir]);
    }
    return path.join(dir, name);
  }
  const url = kind === 'commons' ? commonsUrl(name) : kind === 'oga' ? ogaUrl(name) : null;
  if (!url) throw new Error(`Unknown source ${ref}`);
  const file = path.join(CACHE, name);
  await download(url, file);
  return file;
}

// ------------------------------------------------------------------ audio helpers

/** 2nd-order Butterworth high-pass, run twice (24 dB/octave). */
function highpass(x, hz) {
  const w = (2 * Math.PI * hz) / SR;
  const alpha = Math.sin(w) / Math.SQRT2;
  const a0 = 1 + alpha;
  const b0 = (1 + Math.cos(w)) / 2 / a0;
  const b1 = -(1 + Math.cos(w)) / a0;
  const a1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - alpha) / a0;
  let y = x;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(y.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = b0 * y[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = y[i];
      y2 = y1;
      y1 = v;
      out[i] = v;
    }
    y = out;
  }
  return y;
}

/** Cuts the silence before the attack (and after the sound, unless keepTail), then fades. */
function trim(x, { keepTail = false, fadeIn = 0.002, fadeOut = 0.04 } = {}) {
  const pk = peakOf(x);
  const onset = x.findIndex((v) => Math.abs(v) > pk * 0.03); // -30 dB below the peak
  let start = Math.max(0, onset - Math.round(0.003 * SR));
  let end = x.length;
  if (!keepTail) {
    // Last 10 ms block above -48 dB from the peak, plus a short natural release.
    const block = Math.round(0.01 * SR);
    for (let i = x.length - block; i > start; i -= block) {
      let rms = 0;
      for (let j = i; j < i + block; j++) rms += x[j] * x[j];
      if (Math.sqrt(rms / block) > pk * 0.004) {
        end = Math.min(x.length, i + block + Math.round(0.03 * SR));
        break;
      }
    }
  }
  const y = x.slice(start, end);
  const fi = Math.min(y.length, Math.round(fadeIn * SR));
  for (let i = 0; i < fi; i++) y[i] *= Math.sin(((i / fi) * Math.PI) / 2);
  const fo = Math.min(y.length, Math.round(fadeOut * SR));
  for (let i = 0; i < fo; i++) y[y.length - 1 - i] *= (i / fo) ** 2;
  return y;
}

/**
 * Makes [a, b] loop seamlessly: the audio just before b is crossfaded (equal power) with the
 * audio just before a, so that jumping from b back to a continues the sound without a seam.
 */
function makeLoop(x, [a, b], fade = 0.12) {
  const A = Math.round(a * SR);
  const B = Math.round(b * SR);
  const X = Math.round(fade * SR);
  const y = x.slice(0, Math.min(x.length, B + Math.round(0.08 * SR)));
  for (let i = B - X; i < B; i++) {
    const t = (i - (B - X)) / X;
    y[i] = x[i] * Math.cos((t * Math.PI) / 2) + x[i - (B - A)] * Math.sin((t * Math.PI) / 2);
  }
  return y;
}

async function render(v) {
  const x = await decode(await source(v.src), { from: v.from ?? 0, to: v.to ?? null });
  const y = trim(v.hp ? highpass(x, v.hp) : x, v);
  return v.loop ? makeLoop(y, v.loop) : y;
}

async function renderVariant(v) {
  if (!v.layers) return render(v);
  const parts = await Promise.all(v.layers.map(async (l) => ({ l, x: await render(l) })));
  const len = Math.max(...parts.map(({ l, x }) => Math.round(l.at * SR) + x.length));
  const mix = new Float32Array(len);
  for (const { l, x } of parts) {
    const off = Math.round(l.at * SR);
    const g = 10 ** ((l.gain ?? 0) / 20);
    for (let i = 0; i < x.length; i++) mix[off + i] += x[i] * g;
  }
  return mix;
}

// ------------------------------------------------------------------ build

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });
const manifest = {};
const rows = [];
for (const [name, def] of Object.entries(SOUNDS)) {
  const variants = [];
  for (const v of def.variants) {
    const x = await renderVariant(v);
    const lufs = await loudness(x);
    // Loudest level this variant reaches before its peaks hit the ceiling.
    variants.push({ v, x, lufs, max: lufs + PEAK_CEILING - db(peakOf(x)) });
  }
  // Sharp attacks (cards, chips) cannot always reach the target without clipping: all the
  // variants of an effect then share the quietest reachable level, so they sound alike.
  const target = Math.min(def.lufs, ...variants.map((r) => r.max));
  const files = [];
  const seconds = [];
  for (const [i, { v, x, lufs }] of variants.entries()) {
    const file = def.variants.length > 1 ? `${name}-${i + 1}.mp3` : `${name}.mp3`;
    const gain = 10 ** ((target - lufs) / 20);
    const y = x.map((s) => s * gain);
    await encodeMp3(y, path.join(OUT, file), { bitrate: BITRATE });
    const size = (await stat(path.join(OUT, file))).size;
    rows.push({ file, seconds: +(y.length / SR).toFixed(2), kB: +(size / 1024).toFixed(1), lufs: +(await loudness(y)).toFixed(1), peak: +db(peakOf(y)).toFixed(1) });
    files.push(file);
    seconds.push(+(y.length / SR).toFixed(3));
  }
  const loop = def.variants.find((v) => v.loop)?.loop;
  manifest[name] = loop ? { files, seconds, loop } : { files, seconds };
}

// Files of effects that no longer exist must not linger in the app.
for (const f of await readdir(OUT)) if (f.endsWith('.mp3') && !rows.some((r) => r.file === f)) await rm(path.join(OUT, f));
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.table(rows);
console.log(`${rows.length} files, ${rows.reduce((s, r) => s + r.kB, 0).toFixed(0)} kB -> ${path.relative(process.cwd(), OUT)}`);
