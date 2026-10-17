<script lang="ts">
  // Nastrina, the tutorial's guide: an audio cassette whose reels are eyes (they blink).
  let { size = 46 }: { size?: number } = $props();
</script>

<svg class="mascot" width={size} height={size * 0.8} viewBox="0 0 64 51" aria-hidden="true">
  <rect x="2" y="4" width="60" height="42" rx="8" fill="var(--pink)" stroke="var(--ink)" stroke-width="3" />
  <rect x="9" y="9" width="46" height="25" rx="5" fill="var(--paper)" stroke="var(--ink)" stroke-width="2.5" />
  <g class="eyes">
    <circle cx="22" cy="20" r="6.5" fill="#fff" stroke="var(--ink)" stroke-width="2.5" />
    <circle cx="42" cy="20" r="6.5" fill="#fff" stroke="var(--ink)" stroke-width="2.5" />
    <circle cx="23.2" cy="20.5" r="2.8" fill="var(--ink)" />
    <circle cx="43.2" cy="20.5" r="2.8" fill="var(--ink)" />
  </g>
  <path d="M27 28.5 Q32 33 37 28.5" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" />
  <circle cx="14" cy="28" r="2.4" fill="var(--pink)" opacity="0.6" />
  <circle cx="50" cy="28" r="2.4" fill="var(--pink)" opacity="0.6" />
  <path d="M15 46 L19.5 38 H44.5 L49 46" fill="var(--purple)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" />
  <circle cx="25" cy="42" r="1.8" fill="var(--ink)" />
  <circle cx="39" cy="42" r="1.8" fill="var(--ink)" />
</svg>

<style>
  .mascot {
    display: block;
    overflow: visible;
  }
  .eyes {
    transform-box: fill-box;
    transform-origin: center;
    animation: blink 4.2s infinite;
  }
  @keyframes blink {
    0%,
    92%,
    100% {
      transform: scaleY(1);
    }
    95% {
      transform: scaleY(0.1);
    }
  }
</style>
