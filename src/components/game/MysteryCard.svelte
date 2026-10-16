<script lang="ts">
  let { compact = false, hint = '', badge }: { compact?: boolean; hint?: string; badge?: { avatar: string; color: string } } = $props();
</script>

<div class="mystery" class:compact>
  <div class="q">
    <span>?</span>
  </div>
  <div class="body">
    <strong>Sigla misteriosa</strong>
    {#if hint}<small>{hint}</small>{/if}
    <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
  </div>
  {#if badge}<span class="badge" style:--bc={badge.color}>{badge.avatar}</span>{/if}
</div>

<style>
  .mystery {
    position: relative;
    display: flex;
    align-items: stretch;
    min-height: 74px;
    border: var(--border);
    border-radius: 14px;
    background: repeating-linear-gradient(-45deg, var(--yellow) 0 14px, #ffc61a 14px 28px);
    color: var(--ink);
    box-shadow: var(--shadow);
    overflow: hidden;
    animation: wiggle 2.4s ease-in-out infinite;
  }
  .compact {
    min-height: 58px;
    box-shadow: var(--shadow-sm);
    animation: none;
  }
  .q {
    flex: 0 0 74px;
    display: grid;
    place-items: center;
    background: var(--ink);
    border-right: var(--border);
  }
  .compact .q {
    flex-basis: 62px;
  }
  .q span {
    font-family: var(--font-display);
    font-size: 2.2rem;
    color: var(--yellow);
    animation: float 1.6s ease-in-out infinite;
  }
  .compact .q span {
    font-size: 1.8rem;
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    /* room for the equalizer (or the badge) on the right */
    padding: 6px 48px 6px 12px;
    min-width: 0;
  }
  strong {
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.2rem;
    letter-spacing: 0.02em;
  }
  small {
    font-weight: 800;
    font-size: 0.8rem;
  }
  .eq {
    position: absolute;
    right: 12px;
    bottom: 10px;
    display: flex;
    gap: 3px;
    align-items: flex-end;
    height: 18px;
  }
  .eq i {
    width: 4px;
    height: 100%;
    background: var(--ink);
    border-radius: 2px;
    transform-origin: bottom;
    animation: eq 0.9s ease-in-out infinite;
  }
  .eq i:nth-child(2) {
    animation-delay: -0.3s;
  }
  .eq i:nth-child(3) {
    animation-delay: -0.6s;
  }
  .eq i:nth-child(4) {
    animation-delay: -0.15s;
  }
  .eq i:nth-child(5) {
    animation-delay: -0.45s;
  }
  @keyframes eq {
    0%,
    100% {
      transform: scaleY(0.25);
    }
    50% {
      transform: scaleY(1);
    }
  }
  .badge {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: var(--border);
    background: var(--bc);
    font-size: 1.2rem;
  }
  .mystery:has(.badge) .eq {
    display: none;
  }
</style>
