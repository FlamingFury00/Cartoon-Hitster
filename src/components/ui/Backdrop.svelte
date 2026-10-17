<script lang="ts">
  // Animated "TV studio" backdrop: slow rotating sunburst, halftone dots and a soft glow
  // tinted with the colour of the active player. Pure compositor animations (transform).
  let { tint = '#ff4f9a' }: { tint?: string } = $props();

  const rays = Array.from({ length: 18 }, (_, i) => {
    const a0 = (i * 2 * Math.PI) / 18;
    const a1 = a0 + Math.PI / 18;
    const r = 1000;
    return `M0 0 L${(Math.cos(a0) * r).toFixed(1)} ${(Math.sin(a0) * r).toFixed(1)} L${(Math.cos(a1) * r).toFixed(1)} ${(Math.sin(a1) * r).toFixed(1)} Z`;
  }).join(' ');

  const sparkles = [
    { x: 8, y: 14, s: 1, d: 0 },
    { x: 88, y: 9, s: 0.8, d: 1.2 },
    { x: 78, y: 42, s: 0.6, d: 2.1 },
    { x: 12, y: 58, s: 0.7, d: 0.6 },
    { x: 92, y: 74, s: 0.9, d: 1.7 },
    { x: 6, y: 88, s: 0.6, d: 2.6 },
  ];
</script>

<div class="backdrop" aria-hidden="true" style:--tint={tint}>
  <div class="glow"></div>
  <svg class="rays" viewBox="-1000 -1000 2000 2000" preserveAspectRatio="xMidYMid slice">
    <path d={rays} />
  </svg>
  <div class="dots"></div>
  {#each sparkles as sp, i (i)}
    <svg class="spark" viewBox="0 0 24 24" style:left="{sp.x}%" style:top="{sp.y}%" style:--s={sp.s} style:animation-delay="{sp.d}s">
      <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" />
    </svg>
  {/each}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    background:
      radial-gradient(120% 70% at 50% 18%, var(--bg-2) 0%, var(--bg-1) 48%, var(--bg-3) 100%);
    pointer-events: none;
  }
  .glow {
    position: absolute;
    inset: -20%;
    background: radial-gradient(45% 35% at 50% 30%, color-mix(in srgb, var(--tint) 45%, transparent), transparent 70%);
    opacity: 0.55;
    transition: background 0.8s;
  }
  .rays {
    position: absolute;
    left: 50%;
    top: 30%;
    width: 220vmax;
    height: 220vmax;
    margin: -110vmax 0 0 -110vmax;
    fill: rgba(255, 255, 255, 0.045);
    animation: spin 120s linear infinite;
    will-change: transform;
  }
  .dots {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1.3px, transparent 1.7px);
    background-size: 14px 14px;
    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.2));
    -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.2));
  }
  .spark {
    position: absolute;
    width: calc(22px * var(--s));
    height: calc(22px * var(--s));
    fill: var(--yellow);
    opacity: 0.55;
    animation: twinkle 3.2s ease-in-out infinite;
  }
  @keyframes twinkle {
    0%,
    100% {
      transform: scale(0.5) rotate(0deg);
      opacity: 0.15;
    }
    50% {
      transform: scale(1) rotate(45deg);
      opacity: 0.7;
    }
  }
</style>
