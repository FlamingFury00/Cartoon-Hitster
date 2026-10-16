<script lang="ts">
  import type { Snippet } from 'svelte';
  import { app } from '../../lib/app.svelte';
  import Icon from './Icon.svelte';
  let { title, right }: { title: string; right?: Snippet } = $props();
</script>

<header class="topbar">
  <button class="icon-btn" aria-label="Indietro" onclick={() => app.back()}><Icon name="back" /></button>
  <h1 class="sticker">{title}</h1>
  <div class="right">{@render right?.()}</div>
</header>

<style>
  .topbar {
    display: grid;
    grid-template-columns: 46px 1fr 46px;
    align-items: center;
    gap: 10px;
    padding: 12px 16px 10px;
  }
  h1 {
    text-align: center;
    font-size: clamp(1.5rem, 6vw, 2rem);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .right {
    display: flex;
    justify-content: flex-end;
  }
</style>
