<script lang="ts">
  import type { GameState } from '../../lib/game/types';

  let { game, onPick }: { game: GameState; onPick?: (playerId: string) => void } = $props();
  const target = $derived(game.settings.target);
</script>

<div class="board" aria-label="Classifica">
  {#if game.team}
    <div class="team">
      <span class="tava">🤝</span>
      <span class="tname">Squadra</span>
      <span class="count"><b>{game.team.timeline.length}</b>/{target}</span>
      <span class="lives" aria-label="{game.team.tokens} gettoni">{'🪙'.repeat(Math.min(5, game.team.tokens)) || '—'}</span>
    </div>
  {/if}
  {#each game.players as p, i (p.id)}
    {@const isActive = i === game.active}
    {@const n = game.team ? 0 : p.timeline.length}
    <button class="pl" class:active={isActive} style:--pc={p.color} onclick={() => onPick?.(p.id)} aria-label="{p.name}: {n} carte, {p.tokens} gettoni{isActive ? ', di turno' : ''}">
      <span class="ava">{p.avatar}</span>
      <span class="txt">
        <span class="name">{p.name}</span>
        {#if !game.team}
          <span class="bar"><i style:width="{Math.min(100, (n / target) * 100)}%"></i></span>
        {/if}
      </span>
      {#if !game.team}
        <span class="num">{n}</span>
        {#if game.settings.tokens}<span class="tok">🪙{p.tokens}</span>{/if}
      {/if}
    </button>
  {/each}
</div>

<style>
  .board {
    display: flex;
    gap: 8px;
    padding: 6px 12px 10px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .board::-webkit-scrollbar {
    display: none;
  }
  .pl,
  .team {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 4px;
    border: var(--border);
    border-radius: 999px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s var(--ease-back);
    max-width: 210px;
  }
  .pl.active {
    background: var(--pc);
    transform: translateY(-2px) scale(1.04);
  }
  .ava,
  .tava {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--pc, var(--yellow));
    border: 2px solid var(--ink);
    font-size: 1.2rem;
  }
  .pl.active .ava {
    background: var(--paper);
  }
  .txt {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 2px;
  }
  .name,
  .tname {
    font-weight: 900;
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 90px;
  }
  .bar {
    display: block;
    width: 56px;
    height: 6px;
    border-radius: 3px;
    background: rgba(23, 12, 55, 0.18);
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--ink);
    border-radius: 3px;
    transition: width 0.5s var(--ease-out);
  }
  .num {
    font-family: var(--font-display);
    font-size: 1.35rem;
    line-height: 1;
  }
  .tok {
    font-weight: 900;
    font-size: 0.78rem;
  }
  .count {
    font-weight: 900;
  }
  .count b {
    font-family: var(--font-display);
    font-size: 1.3rem;
    font-weight: 400;
  }
  .lives {
    font-size: 0.9rem;
  }
</style>
