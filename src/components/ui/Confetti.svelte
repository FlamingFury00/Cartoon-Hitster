<script lang="ts">
  // Lightweight canvas confetti (stars, notes and ribbons). Runs only while particles live.
  import { onMount } from 'svelte';
  import { prefersReducedMotion } from '../../lib/platform';

  let { fire = 0, amount = 140 }: { fire?: number; amount?: number } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; c: string; k: number; life: number };
  let parts: P[] = [];
  let raf = 0;
  const COLORS = ['#ff4f9a', '#2bc4ff', '#ffd23f', '#4fd96b', '#a76bff', '#ff8a2b', '#fff8ea'];

  function burst() {
    if (!canvas || prefersReducedMotion()) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (let i = 0; i < amount; i++) {
      const left = i % 2 === 0;
      parts.push({
        x: left ? -10 : w + 10,
        y: h * (0.55 + Math.random() * 0.3),
        vx: (left ? 1 : -1) * (4 + Math.random() * 9),
        vy: -(9 + Math.random() * 11),
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        s: 6 + Math.random() * 8,
        c: COLORS[i % COLORS.length],
        k: Math.floor(Math.random() * 3),
        life: 1,
      });
    }
    if (!raf) raf = requestAnimationFrame(step);
  }

  function step() {
    const c = canvas;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) c.width = Math.round(w * dpr);
    if (c.height !== Math.round(h * dpr)) c.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      if (p.y > h + 40) p.life = 0;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.strokeStyle = '#170c37';
      ctx.lineWidth = 1.5;
      if (p.k === 0) {
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.strokeRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      } else if (p.k === 1) {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? p.s / 2.4 : p.s;
          const a = (i * Math.PI) / 5;
          ctx.lineTo(Math.cos(a) * rr * 0.6, Math.sin(a) * rr * 0.6);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.font = `${p.s * 2}px sans-serif`;
        ctx.fillText('♪', -p.s / 2, p.s / 2);
      }
      ctx.restore();
    }
    parts = parts.filter((p) => p.life > 0);
    raf = parts.length ? requestAnimationFrame(step) : 0;
    if (!raf) ctx.clearRect(0, 0, w, h);
  }

  let last = 0;
  $effect(() => {
    if (fire > last) {
      last = fire;
      burst();
    }
  });

  onMount(() => () => cancelAnimationFrame(raf));
</script>

<canvas bind:this={canvas} class="confetti" aria-hidden="true"></canvas>

<style>
  .confetti {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    pointer-events: none;
    z-index: 80;
  }
</style>
