<script lang="ts">
  import { scale } from 'svelte/transition';
  import { app } from '../../lib/app.svelte';
  import { decadeColor, song } from '../../lib/deckdata';
  import * as E from '../../lib/game/engine';
  import type { GameState } from '../../lib/game/types';
  import Icon from '../ui/Icon.svelte';

  let { game }: { game: GameState } = $props();
  const p = $derived(game.players[game.active]);
  const coop = $derived(game.settings.mode === 'coop');
  const tl = $derived(coop && game.team ? game.team.timeline : p.timeline);
  const finalRound = $derived(E.isFinalRound(game));
  const buyable = $derived(E.canBuy(game));
  const missing = $derived(game.settings.target - tl.length);
</script>

<div class="intro" style:--pc={p.color}>
  <div class="meta">
    <span class="pill">Turno {game.turn + 1}</span>
    {#if finalRound}<span class="pill hot">🔥 Ultimo giro!</span>{/if}
    <span class="pill">🃏 {game.deck.length} nel mazzo</span>
  </div>

  {#key game.active}
    <div class="who" in:scale={{ duration: 450, start: 0.4 }}>
      <div class="ava">{p.avatar}</div>
      <p class="tocca">{coop ? 'Decide' : 'Tocca a'}</p>
      <h2 class="name sticker">{p.name}!</h2>
    </div>
  {/key}

  <p class="pass">📱 Passa il telefono a <b>{p.name}</b>{coop ? ' (ma decidete insieme!)' : ''}</p>

  <div class="mini" aria-label="Linea del tempo attuale">
    {#each tl as id (id)}
      {@const s = song(id)}
      <span class="yr" style:--dc={decadeColor(s.year)}>{s.year}</span>
    {/each}
    <span class="left">{missing > 0 ? `ne mancano ${missing}` : 'pronta!'}</span>
  </div>

  <div class="actions">
    <button class="btn big wide" onclick={() => app.draw()}><Icon name="music" /> Pesca la sigla</button>
    {#if buyable}
      <button class="btn small paper" onclick={() => app.buy()}><Icon name="cart" size={18} /> Compra una carta senza ascoltare · 3 🪙</button>
    {/if}
  </div>

  <p class="tip">
    {#if coop}
      Ascoltate la sigla e scegliete insieme dove metterla.
    {:else if game.settings.tokens}
      Gli altri ascoltano: se sbagli possono sfidarti e rubarti la carta!
    {:else}
      Ascolta la sigla e mettila nel punto giusto della tua fila.
    {/if}
  </p>
</div>

<style>
  .intro {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 8px 20px 20px;
    text-align: center;
    min-height: 0;
    overflow-y: auto;
  }
  .meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .pill {
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    border: 2px solid rgba(255, 255, 255, 0.22);
    font-weight: 900;
    font-size: 0.85rem;
  }
  .pill.hot {
    background: var(--red);
    border-color: var(--ink);
    color: #fff;
    animation: wiggle 0.8s ease-in-out infinite;
  }
  .who {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .ava {
    display: grid;
    place-items: center;
    width: clamp(110px, 32vw, 150px);
    aspect-ratio: 1;
    border-radius: 50%;
    border: 5px solid var(--ink);
    background:
      radial-gradient(rgba(255, 255, 255, 0.35) 1.5px, transparent 2px) 0 0 / 12px 12px,
      var(--pc);
    box-shadow: 0 8px 0 var(--ink);
    font-size: clamp(4rem, 13vw, 5.6rem);
    animation: float 1.8s ease-in-out infinite;
  }
  .tocca {
    margin: 14px 0 0;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .name {
    font-size: clamp(2.6rem, 12vw, 3.8rem);
    max-width: 92vw;
    overflow-wrap: anywhere;
  }
  .pass {
    margin: 0;
    font-weight: 700;
  }
  .pass b {
    color: var(--yellow);
  }
  .mini {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    align-items: center;
    max-width: 440px;
  }
  .yr {
    padding: 2px 8px;
    border-radius: 8px;
    border: 2px solid var(--ink);
    background: var(--dc);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 1rem;
  }
  .left {
    font-weight: 800;
    font-size: 0.8rem;
    opacity: 0.75;
  }
  .actions {
    width: min(100%, 420px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }
  .tip {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 700;
    opacity: 0.75;
    max-width: 26em;
  }
</style>
