<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import Icon from './Icon.svelte';

  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="backdrop" transition:fade={{ duration: 160 }} onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={title} transition:fly={{ y: 60, duration: 260 }}>
  <header>
    <h2>{title}</h2>
    <button class="icon-btn" aria-label="Chiudi" onclick={onclose}><Icon name="close" /></button>
  </header>
  <div class="content scroll">
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(10, 4, 30, 0.6);
  }
  .sheet {
    position: fixed;
    z-index: 61;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(100%, 560px);
    max-height: 88dvh;
    display: flex;
    flex-direction: column;
    background: var(--paper);
    color: var(--ink);
    border: var(--border);
    border-bottom: 0;
    border-radius: 24px 24px 0 0;
    box-shadow: 0 -6px 0 rgba(23, 12, 55, 0.4);
    padding-bottom: var(--safe-bottom);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 8px;
  }
  h2 {
    font-size: 1.6rem;
  }
  .content {
    padding: 4px 16px 18px;
    min-height: 0;
  }
</style>
