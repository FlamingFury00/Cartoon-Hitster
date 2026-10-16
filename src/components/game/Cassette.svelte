<script lang="ts">
  // A 1980s compilation cassette playing the mystery theme: the reels spin while the
  // song plays, the tape moves from one reel to the other with the preview progress
  // and the window shows a live spectrum analyser.
  import { onMount } from 'svelte';
  import { player, type PlaybackState } from '../../lib/audio/player';

  let { label = 'SIGLA MISTERIOSA', side = 'A' }: { label?: string; side?: string } = $props();

  let pstate = $state<PlaybackState>(player.state);
  let progress = $state(0);
  let canvas: HTMLCanvasElement | undefined = $state();

  onMount(() => {
    const off = player.onChange((s) => (pstate = s));
    pstate = player.state;
    let raf = 0;
    const bins = new Uint8Array(new ArrayBuffer(256));
    const BARS = 22;
    const smooth = new Float32Array(BARS);
    let t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dur = player.duration() || 30;
      progress = Math.min(1, player.position() / dur);
      const c = canvas;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const playing = player.state === 'playing';
      const real = playing && player.levels(bins);
      t += 0.06;
      const gap = 3;
      const bw = (w - gap * (BARS - 1)) / BARS;
      for (let i = 0; i < BARS; i++) {
        let v: number;
        if (real) {
          // Log-ish frequency mapping so bass does not dominate.
          const a = Math.floor(Math.pow(i / BARS, 1.6) * 90) + 1;
          const b = Math.floor(Math.pow((i + 1) / BARS, 1.6) * 90) + 2;
          let m = 0;
          for (let k = a; k < b; k++) m = Math.max(m, bins[k]);
          v = m / 255;
        } else if (playing) {
          v = 0.35 + 0.3 * Math.sin(t * 2 + i * 0.7) * Math.sin(t * 0.7 + i);
        } else v = 0.06;
        smooth[i] += (v - smooth[i]) * (v > smooth[i] ? 0.55 : 0.18);
        const bh = Math.max(3, smooth[i] * (h - 4));
        const hue = 330 - (i / BARS) * 250;
        ctx.fillStyle = `hsl(${hue} 95% 62%)`;
        const x = i * (bw + gap);
        const y = h - bh;
        const r = Math.min(bw / 2, 3);
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.lineTo(x + bw - r, y);
        ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
        ctx.lineTo(x + bw, h);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  });

  // Tape radius: full reel 30, empty hub 14.
  const leftR = $derived(14 + 16 * Math.sqrt(1 - progress));
  const rightR = $derived(14 + 16 * Math.sqrt(progress));
  const spinning = $derived(pstate === 'playing');
</script>

<div class="cassette" class:spinning class:loading={pstate === 'loading'}>
  <svg viewBox="0 0 320 200" class="shell" aria-hidden="true">
    <defs>
      <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.1" fill="rgba(255,255,255,0.18)" />
      </pattern>
    </defs>
    <rect x="4" y="10" width="312" height="188" rx="18" fill="#170c37" />
    <rect x="4" y="4" width="312" height="188" rx="18" fill="#2b1b64" stroke="#170c37" stroke-width="5" />
    <rect x="4" y="4" width="312" height="188" rx="18" fill="url(#dots)" />
    <!-- label -->
    <rect x="22" y="18" width="276" height="122" rx="10" fill="#fff8ea" stroke="#170c37" stroke-width="4" />
    <rect x="22" y="18" width="276" height="26" rx="10" fill="#ff4f9a" stroke="#170c37" stroke-width="4" />
    <rect x="26" y="40" width="268" height="6" fill="#ffd23f" />
    <text x="160" y="37" text-anchor="middle" class="label">{label}</text>
    <text x="34" y="64" class="side">{side}</text>
    <text x="286" y="64" text-anchor="end" class="c60">C-60</text>
    <!-- window -->
    <rect x="70" y="56" width="180" height="62" rx="31" fill="#170c37" />
    <rect x="76" y="61" width="168" height="52" rx="26" fill="#3a2a7a" />
    <!-- tape -->
    <circle cx="113" cy="87" r={leftR} fill="#5b3a1e" />
    <circle cx="207" cy="87" r={rightR} fill="#5b3a1e" />
    <!-- reels -->
    <g class="reel" style="transform-origin: 113px 87px">
      <circle cx="113" cy="87" r="13" fill="#fff8ea" stroke="#170c37" stroke-width="3" />
      {#each [0, 60, 120, 180, 240, 300] as a (a)}
        <rect x="111" y="76" width="4" height="7" rx="1" fill="#170c37" transform="rotate({a} 113 87)" />
      {/each}
    </g>
    <g class="reel" style="transform-origin: 207px 87px">
      <circle cx="207" cy="87" r="13" fill="#fff8ea" stroke="#170c37" stroke-width="3" />
      {#each [0, 60, 120, 180, 240, 300] as a (a)}
        <rect x="205" y="76" width="4" height="7" rx="1" fill="#170c37" transform="rotate({a} 207 87)" />
      {/each}
    </g>
    <!-- bottom trapezoid -->
    <path d="M70 192 L88 154 H232 L250 192" fill="#3a2a7a" stroke="#170c37" stroke-width="4" stroke-linejoin="round" />
    <circle cx="112" cy="175" r="7" fill="#170c37" />
    <circle cx="208" cy="175" r="7" fill="#170c37" />
    <circle cx="26" cy="172" r="6" fill="#170c37" />
    <circle cx="294" cy="172" r="6" fill="#170c37" />
  </svg>
  <canvas bind:this={canvas} class="viz" aria-hidden="true"></canvas>
  {#if pstate === 'loading'}
    <div class="loadmsg">Carico la sigla…</div>
  {/if}
</div>

<style>
  .cassette {
    position: relative;
    width: min(100%, 300px);
    margin: 0 auto;
  }
  .shell {
    display: block;
    width: 100%;
    height: auto;
  }
  .label {
    font-family: var(--font-display);
    font-size: 15px;
    fill: #fff8ea;
    letter-spacing: 1px;
  }
  .side,
  .c60 {
    font-family: var(--font-display);
    font-size: 15px;
    fill: #170c37;
  }
  .reel {
    transform-box: view-box;
  }
  .spinning .reel {
    animation: spin 1.6s linear infinite;
  }
  .loading .reel {
    animation: spin 3s linear infinite;
    opacity: 0.7;
  }
  .viz {
    display: block;
    width: 78%;
    height: 30px;
    margin: 8px auto 0;
    pointer-events: none;
  }
  .loadmsg {
    position: absolute;
    left: 50%;
    top: 46%;
    transform: translate(-50%, -50%);
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--yellow);
    font-weight: 900;
    font-size: 0.8rem;
    white-space: nowrap;
  }
</style>
