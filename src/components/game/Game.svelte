<script lang="ts">
  import { app } from '../../lib/app.svelte';
  import type { GameState } from '../../lib/game/types';
  import Icon from '../ui/Icon.svelte';
  import Scoreboard from './Scoreboard.svelte';
  import TurnIntro from './TurnIntro.svelte';
  import PlayArea from './PlayArea.svelte';
  import RevealOverlay from './RevealOverlay.svelte';
  import Victory from './Victory.svelte';
  import PauseMenu from './PauseMenu.svelte';
  import PlayerSheet from './PlayerSheet.svelte';

  let sheet = $state<string | null>(null);
  const game = $derived(app.game);
  const over = $derived(game?.phase.t === 'over');

  $effect(() => {
    if (!app.game) app.go('home');
  });

  // A game saved during a reveal must show the reveal again when resumed.
  $effect(() => {
    if (app.game?.phase.t === 'reveal' && !app.revealing) app.revealing = true;
  });
</script>

{#if game}
  {#if over}
    <Victory game={game as GameState & { phase: { t: 'over' } }} />
  {:else}
    <header class="gh">
      <button class="icon-btn" aria-label="Menu di pausa" onclick={() => (app.menuOpen = true)}><Icon name="menu" /></button>
      <div class="title">
        <span class="sticker">Sigle in Fila</span>
        <small>
          {#if game.settings.mode === 'coop'}Squadra{:else if game.settings.mode === 'pro'}Esperto{:else}Classica{/if}
          · obiettivo {game.settings.target}
        </small>
      </div>
      {#if app.canUndo && game.phase.t === 'challenge'}
        <button class="icon-btn" aria-label="Annulla l'ultima mossa" onclick={() => app.undo()}><Icon name="undo" /></button>
      {:else}
        <span class="spacer"></span>
      {/if}
    </header>

    <Scoreboard {game} onPick={(id) => (sheet = id)} />

    {#if game.phase.t === 'intro'}
      <TurnIntro {game} />
    {:else}
      <PlayArea {game} />
    {/if}

    {#if game.phase.t === 'reveal' && app.revealing}
      {#key game.turn + ':' + game.phase.card}
        <RevealOverlay game={game as GameState & { phase: { t: 'reveal' } }} />
      {/key}
    {/if}
  {/if}

  {#if app.menuOpen && !over}
    <PauseMenu />
  {/if}
  {#if sheet}
    <PlayerSheet {game} playerId={sheet} onclose={() => (sheet = null)} />
  {/if}
{/if}

<style>
  .gh {
    display: grid;
    grid-template-columns: 46px 1fr 46px;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 2px;
  }
  .title {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.05;
  }
  .title .sticker {
    font-size: 1.35rem;
  }
  .title small {
    font-weight: 800;
    font-size: 0.75rem;
    opacity: 0.75;
    margin-top: 2px;
  }
  .spacer {
    width: 46px;
  }
</style>
