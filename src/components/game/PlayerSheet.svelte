<script lang="ts">
  import type { GameState } from '../../lib/game/types';
  import Modal from '../ui/Modal.svelte';
  import Timeline from './Timeline.svelte';

  let { game, playerId, onclose }: { game: GameState; playerId: string; onclose: () => void } = $props();
  const p = $derived(game.players.find((x) => x.id === playerId)!);
  const tl = $derived(game.team ? game.team.timeline : p.timeline);
  const acc = $derived(p.stats.placed ? Math.round((p.stats.correct / p.stats.placed) * 100) : null);
</script>

<Modal title="{p.avatar} {p.name}" {onclose}>
  <div class="stats">
    <span><b>{tl.length}</b>/{game.settings.target} carte</span>
    {#if game.settings.tokens && !game.team}<span><b>{p.tokens}</b> 🪙</span>{/if}
    {#if acc != null}<span><b>{acc}%</b> giuste</span>{/if}
    {#if p.stats.steals}<span><b>{p.stats.steals}</b> rubate</span>{/if}
  </div>
  <div class="tl">
    <Timeline ids={tl} mode="view" />
  </div>
</Modal>

<style>
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
  .stats span {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--paper-2);
    border: 2px solid var(--ink);
    font-weight: 800;
    font-size: 0.85rem;
  }
  .stats b {
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.1rem;
  }
  .tl {
    color: var(--ink);
  }
  .tl :global(.edge) {
    color: var(--ink);
  }
</style>
