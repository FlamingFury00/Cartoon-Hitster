// Helpers shared by the audio build scripts (sound effects, main theme): downloads with
// retries, decoding and encoding with ffmpeg through pipes, EBU R128 loudness.
import { execFile, spawn } from 'node:child_process';
import { stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

export const run = promisify(execFile);
export const SR = 44100;
const UA = 'SigleInFila/1.0 (https://github.com/FlamingFury00/Cartoon-Hitster; sound effects build)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function exists(file) {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

export async function download(url, file) {
  if (await exists(file)) return;
  for (let attempt = 1; ; attempt++) {
    let status = 0;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      status = res.status;
      if (res.ok) {
        await writeFile(file, Buffer.from(await res.arrayBuffer()));
        return;
      }
    } catch {
      /* connection dropped: retried below */
    }
    // Wikimedia answers 429 when downloads come too fast: wait and retry.
    if (attempt >= 6 || (status && status !== 429 && status < 500)) throw new Error(`${url}: HTTP ${status || 'network error'}`);
    await sleep(10000 * attempt);
  }
}

/** Decodes [from, to] of a file to float samples at SR (interleaved when channels > 1). */
export async function decode(file, { from = 0, to = null, channels = 1 } = {}) {
  const args = ['-v', 'error', '-ss', String(from), ...(to != null ? ['-t', String(to - from)] : []), '-i', file, '-vn', '-ac', String(channels), '-ar', String(SR), '-f', 'f32le', '-'];
  const { stdout } = await run('ffmpeg', args, { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });
  return new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.byteLength));
}

/** Pipes samples into ffmpeg and returns its stderr. */
export function ffmpegFrom(samples, args, channels = 1) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-nostats', '-f', 'f32le', '-ar', String(SR), '-ac', String(channels), '-i', 'pipe:0', ...args]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg ${code}: ${err.slice(-400)}`))));
    p.stdin.end(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
  });
}

/**
 * EBU R128 loudness in LUFS: the highest momentary value (400 ms window; silence around the
 * sound lets the window cover a short one), or the integrated loudness of the whole signal.
 */
export async function loudness(x, { channels = 1, integrated = false } = {}) {
  const pad = Math.round(0.4 * SR) * channels;
  const padded = new Float32Array(x.length + pad * 2);
  padded.set(x, pad);
  const log = await ffmpegFrom(padded, ['-af', 'ebur128', '-f', 'null', '-'], channels);
  if (integrated) return Number(/Integrated loudness:\s*I:\s*(-?[\d.]+) LUFS/.exec(log)?.[1] ?? NaN);
  let max = -Infinity;
  for (const m of log.matchAll(/ M:\s*(-?[\d.]+|-inf)/g)) if (m[1] !== '-inf') max = Math.max(max, Number(m[1]));
  return max;
}

export async function encodeMp3(x, file, { bitrate, channels = 1 }) {
  await ffmpegFrom(x, ['-v', 'error', '-c:a', 'libmp3lame', '-b:a', bitrate, '-map_metadata', '-1', '-id3v2_version', '0', '-y', file], channels);
}

export const peakOf = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
export const db = (g) => 20 * Math.log10(g);
