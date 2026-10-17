// Procedural sound effects (no audio files): everything is synthesised with Web Audio
// oscillators and noise, so the app stays tiny and works offline.
import { player } from './player';

let enabled = true;
let noiseBuffer: AudioBuffer | null = null;

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

function out(): { ctx: AudioContext; dest: AudioNode } | null {
  if (!enabled) return null;
  const dest = player.fxOutput();
  const ctx = player.ctx;
  if (!ctx || !dest || ctx.state !== 'running') return null;
  return { ctx, dest };
}

function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = ctx.sampleRate;
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuffer = b;
  return b;
}

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  to?: number;
  at?: number;
  dur: number;
  vol?: number;
  attack?: number;
  vibrato?: number;
  filter?: number;
}

function tone(ctx: AudioContext, dest: AudioNode, o: ToneOpts) {
  const t0 = ctx.currentTime + (o.at ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  const g = ctx.createGain();
  const vol = o.vol ?? 0.25;
  const attack = o.attack ?? 0.008;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let node: AudioNode = osc;
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = o.vibrato;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + o.dur + 0.05);
  }
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.filter;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

function burst(ctx: AudioContext, dest: AudioNode, at: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1) {
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  tap() {
    const o = out();
    if (!o) return;
    tone(o.ctx, o.dest, { type: 'triangle', freq: 880, to: 1320, dur: 0.06, vol: 0.12 });
  },
  pop() {
    const o = out();
    if (!o) return;
    tone(o.ctx, o.dest, { type: 'sine', freq: 420, to: 980, dur: 0.09, vol: 0.2 });
  },
  whoosh() {
    const o = out();
    if (!o) return;
    const t0 = o.ctx.currentTime;
    const src = o.ctx.createBufferSource();
    src.buffer = noise(o.ctx);
    const f = o.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t0);
    f.frequency.exponentialRampToValueAtTime(3200, t0 + 0.28);
    const g = o.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    src.connect(f).connect(g).connect(o.dest);
    src.start(t0);
    src.stop(t0 + 0.35);
  },
  /** Card dropped into a slot. */
  place() {
    const o = out();
    if (!o) return;
    burst(o.ctx, o.dest, 0, 0.06, 0.35, 'lowpass', 1800);
    tone(o.ctx, o.dest, { type: 'sine', freq: 180, to: 90, dur: 0.12, vol: 0.35 });
  },
  /** Snare roll that accelerates, used while the card flips. */
  drumroll(seconds = 1.1) {
    const o = out();
    if (!o) return;
    let t = 0;
    let step = 0.075;
    while (t < seconds) {
      burst(o.ctx, o.dest, t, 0.07, 0.16 + 0.16 * (t / seconds), 'bandpass', 2400, 0.8);
      t += step;
      step = Math.max(0.035, step * 0.94);
    }
    burst(o.ctx, o.dest, seconds, 0.9, 0.32, 'highpass', 5000, 0.7); // cymbal
    tone(o.ctx, o.dest, { type: 'sine', freq: 110, to: 55, at: seconds, dur: 0.3, vol: 0.45 }); // kick
  },
  correct() {
    const o = out();
    if (!o) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(o.ctx, o.dest, { type: 'triangle', freq: f, at: i * 0.075, dur: 0.32 + i * 0.05, vol: 0.22 }),
    );
    [1568, 2093].forEach((f, i) => tone(o.ctx, o.dest, { type: 'sine', freq: f, at: 0.32 + i * 0.06, dur: 0.25, vol: 0.08 }));
  },
  /** The classic "wah wah wah waaah" sad trombone. */
  wrong() {
    const o = out();
    if (!o) return;
    const notes = [311.13, 293.66, 277.18, 261.63];
    notes.forEach((f, i) =>
      tone(o.ctx, o.dest, {
        type: 'sawtooth',
        freq: f,
        at: i * 0.32,
        dur: i === 3 ? 0.95 : 0.3,
        vol: 0.14,
        attack: 0.04,
        vibrato: i === 3 ? 7 : 0,
        filter: 1100,
      }),
    );
  },
  coin() {
    const o = out();
    if (!o) return;
    tone(o.ctx, o.dest, { type: 'square', freq: 987.77, dur: 0.08, vol: 0.09, filter: 5000 });
    tone(o.ctx, o.dest, { type: 'square', freq: 1318.5, at: 0.08, dur: 0.38, vol: 0.09, filter: 5000 });
  },
  steal() {
    const o = out();
    if (!o) return;
    tone(o.ctx, o.dest, { type: 'sine', freq: 900, to: 160, dur: 0.35, vol: 0.25 });
    tone(o.ctx, o.dest, { type: 'triangle', freq: 660, at: 0.3, dur: 0.25, vol: 0.18 });
    tone(o.ctx, o.dest, { type: 'triangle', freq: 990, at: 0.42, dur: 0.35, vol: 0.18 });
  },
  challenge() {
    const o = out();
    if (!o) return;
    tone(o.ctx, o.dest, { type: 'square', freq: 220, dur: 0.12, vol: 0.1, filter: 1600 });
    tone(o.ctx, o.dest, { type: 'square', freq: 330, at: 0.12, dur: 0.22, vol: 0.1, filter: 1600 });
  },
  turn() {
    const o = out();
    if (!o) return;
    tone(o.ctx, o.dest, { type: 'triangle', freq: 392, dur: 0.12, vol: 0.18 });
    tone(o.ctx, o.dest, { type: 'triangle', freq: 587.33, at: 0.1, dur: 0.22, vol: 0.18 });
  },
  fanfare() {
    const o = out();
    if (!o) return;
    const seq: [number, number, number][] = [
      [392, 0, 0.16],
      [392, 0.18, 0.16],
      [392, 0.36, 0.16],
      [523.25, 0.54, 0.7],
      [466.16, 1.0, 0.3],
      [523.25, 1.3, 0.3],
      [659.25, 1.6, 1.1],
    ];
    for (const [f, at, dur] of seq) {
      tone(o.ctx, o.dest, { type: 'sawtooth', freq: f, at, dur, vol: 0.12, attack: 0.03, filter: 2400 });
      tone(o.ctx, o.dest, { type: 'square', freq: f / 2, at, dur, vol: 0.05, attack: 0.03, filter: 1200 });
    }
    burst(o.ctx, o.dest, 1.6, 1.2, 0.25, 'highpass', 6000, 0.6);
  },
};
