<script lang="ts">
  import { fly } from 'svelte/transition';
  import { app } from '../../lib/app.svelte';

  $effect(() => {
    const timers = app.toasts.map((t) => setTimeout(() => app.dismissToast(t.id), 3200));
    return () => timers.forEach(clearTimeout);
  });
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each app.toasts as t (t.id)}
    <button class="toast" class:warn={t.kind === 'warn'} in:fly={{ y: -20, duration: 220 }} out:fly={{ y: -20, duration: 180 }} onclick={() => app.dismissToast(t.id)}>
      {t.msg}
    </button>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: calc(var(--safe-top) + 10px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(92vw, 420px);
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    padding: 12px 16px;
    border: var(--border);
    border-radius: 14px;
    background: var(--paper);
    color: var(--ink);
    font-weight: 800;
    box-shadow: var(--shadow-sm);
    text-align: left;
  }
  .toast.warn {
    background: var(--yellow);
  }
</style>
