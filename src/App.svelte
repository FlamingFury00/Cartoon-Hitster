<script lang="ts">
  import { fly } from 'svelte/transition';
  import { app } from './lib/app.svelte';
  import Backdrop from './components/ui/Backdrop.svelte';
  import Toasts from './components/ui/Toasts.svelte';
  import Home from './components/screens/Home.svelte';
  import Setup from './components/screens/Setup.svelte';
  import Game from './components/game/Game.svelte';
  import Rules from './components/screens/Rules.svelte';
  import Settings from './components/screens/Settings.svelte';
  import History from './components/screens/History.svelte';
  import DeckBrowser from './components/screens/DeckBrowser.svelte';

  const tint = $derived.by(() => {
    const g = app.game;
    if (app.screen !== 'game' || !g) return '#ff4f9a';
    return g.players[g.active]?.color ?? '#ff4f9a';
  });
</script>

<Backdrop {tint} />

{#key app.screen}
  <main class="screen" in:fly={{ y: 24, duration: 260 }}>
    {#if app.screen === 'home'}
      <Home />
    {:else if app.screen === 'setup'}
      <Setup />
    {:else if app.screen === 'game'}
      <Game />
    {:else if app.screen === 'rules'}
      <Rules />
    {:else if app.screen === 'settings'}
      <Settings />
    {:else if app.screen === 'history'}
      <History />
    {:else if app.screen === 'deck'}
      <DeckBrowser />
    {/if}
  </main>
{/key}

<Toasts />

<style>
  .screen {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
  }
</style>
