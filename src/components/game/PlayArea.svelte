<script lang="ts">
  // Listening + placing phase (also the backdrop of the challenge and reveal phases).
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { app } from '../../lib/app.svelte';
  import { player, type PlaybackState } from '../../lib/audio/player';
  import { spotifyUrl } from '../../lib/audio/sources';
  import { song } from '../../lib/deckdata';
  import * as E from '../../lib/game/engine';
  import { describeSlot } from '../../lib/game/timeline';
  import type { GameState } from '../../lib/game/types';
  import { openExternal } from '../../lib/platform';
  import Cassette from './Cassette.svelte';
  import Timeline, { type Marker } from './Timeline.svelte';
  import Icon from '../ui/Icon.svelte';

  let { game }: { game: GameState } = $props();

  let scroller: HTMLElement | undefined = $state();
  let pstate = $state<PlaybackState>(player.state);
  let challenger = $state<string | null>(null);

  onMount(() => player.onChange((s) => (pstate = s)));

  const phase = $derived(game.phase as Extract<GameState['phase'], { t: 'listen' | 'challenge' | 'reveal' }>);
  const active = $derived(game.players[game.active]);
  const coop = $derived(game.settings.mode === 'coop');
  const timeline = $derived(E.activeTimeline(game));
  const yearOf = (id: string) => song(id).year;
  const spotifyMode = $derived(app.settings.playback === 'spotify');

  const mode = $derived(phase.t === 'listen' ? 'place' : phase.t === 'challenge' ? 'challenge' : 'reveal');
  const markers = $derived.by<Marker[]>(() => {
    if (phase.t === 'listen') return [];
    return phase.challenges.map((c) => {
      const p = game.players.find((x) => x.id === c.playerId)!;
      return { id: p.id, slot: c.slot, avatar: p.avatar, color: p.color };
    });
  });
  const free = $derived(phase.t === 'challenge' && challenger ? E.freeChallengeSlots(game) : []);
  const revealState = $derived.by(() => {
    if (phase.t !== 'reveal') return undefined;
    const o = phase.outcome;
    return o.bought ? 'bought' : o.placementCorrect ? 'right' : o.stolenBy ? 'stolen' : 'wrong';
  });
  const slotText = $derived(phase.slot == null ? '' : describeSlot(timeline, phase.slot, yearOf));
  const possibleChallengers = $derived(phase.t === 'challenge' ? E.challengers(game) : []);

  function onSlot(s: number) {
    if (phase.t === 'listen') app.setSlot(s);
    else if (phase.t === 'challenge' && challenger) {
      app.addChallenge(challenger, s);
      challenger = null;
    }
  }

  // "Gira la carta!" appears where "Conferma" was: ignore it for a moment so that a double tap
  // on Conferma does not skip the challenge window.
  const inChallenge = $derived(phase.t === 'challenge');
  let flipArmed = $state(true);
  $effect(() => {
    if (!inChallenge) return;
    flipArmed = false;
    const t = setTimeout(() => (flipArmed = true), 500);
    return () => clearTimeout(t);
  });

  // Nothing loaded (stopped, or the last attempt failed): load the current card again.
  const idle = () => pstate === 'idle' || pstate === 'error';
  const playPause = () => (idle() ? app.replayCurrent() : player.toggle());
  const restart = () => (idle() ? app.replayCurrent() : player.restart());

  function pickChallenger(id: string) {
    challenger = challenger === id ? null : id;
  }

  function reveal(slot: number) {
    queueMicrotask(() => {
      const el = scroller?.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  // Bring the chosen slot into view after a tap/drop...
  $effect(() => {
    const s = phase.slot;
    if (s != null && scroller) reveal(s);
  });
  // ...and the marker of the latest challenger.
  $effect(() => {
    const last = phase.t === 'challenge' ? phase.challenges[phase.challenges.length - 1] : undefined;
    if (last && scroller) reveal(last.slot);
  });
</script>

<div class="play" class:challenging={phase.t === 'challenge'}>
  <section class="deckpanel">
    <div class="tape">
      <Cassette label={phase.t === 'reveal' ? song(phase.card).cartoon.toUpperCase().slice(0, 22) : 'SIGLA MISTERIOSA'} side={String((game.turn % 2) ? 'B' : 'A')} />
    </div>
    <div class="controls">
      {#if spotifyMode}
        <button class="btn small green" onclick={() => openExternal(spotifyUrl(song(phase.card)))}>🎧 Riapri Spotify</button>
      {:else}
        <div class="transport">
          <button class="icon-btn big" aria-label={pstate === 'playing' ? 'Pausa' : 'Riproduci'} onclick={playPause} disabled={pstate === 'loading'}>
            <Icon name={pstate === 'playing' ? 'pause' : 'play'} size={28} />
          </button>
          <button class="icon-btn" aria-label="Ricomincia la sigla" onclick={restart} disabled={pstate === 'loading'}>
            <Icon name="replay" />
          </button>
        </div>
      {/if}
      {#if phase.t === 'listen'}
        <div class="spend">
          {#if game.settings.tokens}
            <button class="btn small paper" disabled={!E.canSkip(game)} onclick={() => app.skip()} aria-label="Salta questa sigla per 1 gettone">
              <Icon name="skip" size={18} /> Salta · 1🪙
            </button>
          {/if}
          {#if E.canBuy(game)}
            <button class="btn small paper" onclick={() => app.buy()} aria-label="Compra questa carta per 3 gettoni"><Icon name="cart" size={18} /> Compra · 3🪙</button>
          {/if}
        </div>
      {/if}
    </div>
  </section>

  {#if app.audioError && phase.t === 'listen'}
    <div class="audio-error" transition:fly={{ y: -10 }}>
      <p>{app.audioError}</p>
      <button class="btn small" onclick={() => app.swapUnplayable()}>Pesca un'altra sigla (gratis)</button>
    </div>
  {/if}

  <div class="tl-head">
    {#if phase.t === 'listen'}
      <h2>{coop ? 'Dove la mettete?' : `Dove la metti, ${active.name}?`}</h2>
    {:else if phase.t === 'challenge'}
      <h2>🥊 Sfida!</h2>
    {:else}
      <h2>{coop ? 'Linea del tempo della squadra' : `La fila di ${active.name}`}</h2>
    {/if}
  </div>

  <div class="tl scroll" bind:this={scroller}>
    <Timeline
      ids={timeline}
      {mode}
      slot={phase.slot}
      card={phase.card}
      {markers}
      tappable={free}
      validRange={phase.t === 'reveal' ? [phase.outcome.validFrom, phase.outcome.validTo] : undefined}
      {revealState}
      owner={phase.t === 'challenge' ? { avatar: active.avatar, color: active.color } : undefined}
      {onSlot}
      {scroller}
    />
  </div>

  {#if phase.t === 'listen'}
    <footer class="bar">
      <p class="where">{phase.slot == null ? 'Tocca un + o trascina la carta' : `La metti ${slotText}`}</p>
      <button class="btn big wide pink" disabled={phase.slot == null} onclick={() => app.confirm()}>
        <Icon name="check" /> Conferma
      </button>
    </footer>
  {:else if phase.t === 'challenge'}
    <footer class="bar challenge" in:fly={{ y: 40, duration: 260 }}>
      <p class="where">
        {active.avatar} <b>{active.name}</b> la mette {slotText}.
        {#if challenger}
          <br /><b class="hint">Tocca dove pensi che vada davvero!</b>
        {:else if possibleChallengers.length}
          <br />Chi non è d'accordo può sfidare con 1 🪙:
        {/if}
      </p>
      {#if possibleChallengers.length || phase.challenges.length}
        <div class="challengers">
          {#each possibleChallengers as p (p.id)}
            <button class="cbtn" class:sel={challenger === p.id} style:--pc={p.color} onclick={() => pickChallenger(p.id)}>
              <span>{p.avatar}</span>{p.name} <small>🪙{p.tokens}</small>
            </button>
          {/each}
          {#each phase.challenges as c (c.playerId)}
            {@const p = game.players.find((x) => x.id === c.playerId)}
            {#if p}
              <button class="cbtn done" style:--pc={p.color} onclick={() => app.removeChallenge(p.id)} aria-label="Annulla la sfida di {p.name}">
                <span>{p.avatar}</span>{p.name} ✓ <small>annulla</small>
              </button>
            {/if}
          {/each}
        </div>
      {/if}
      <button class="btn big wide green" disabled={!flipArmed} onclick={() => app.reveal()}>🃏 Gira la carta!</button>
    </footer>
  {/if}
</div>

<style>
  .play {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .deckpanel {
    display: grid;
    grid-template-columns: minmax(150px, 230px) 1fr;
    align-items: center;
    gap: 12px;
    padding: 2px 14px 6px;
    max-width: 620px;
    width: 100%;
    margin: 0 auto;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .transport {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .icon-btn.big {
    width: 62px;
    height: 62px;
    border-radius: 50%;
    background: var(--yellow);
  }
  .icon-btn:disabled {
    opacity: 0.5;
  }
  .spend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .audio-error {
    margin: 4px 14px 8px;
    padding: 10px 12px;
    border-radius: 14px;
    background: var(--paper);
    color: var(--ink);
    border: var(--border);
    font-weight: 800;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .audio-error p {
    margin: 0;
  }
  .tl-head {
    padding: 4px 16px 2px;
    max-width: 620px;
    width: 100%;
    margin: 0 auto;
  }
  .tl-head h2 {
    font-size: 1.35rem;
  }
  .tl {
    flex: 1;
    /* never squeezed away, even with six players in the challenge window */
    min-height: 110px;
    padding: 4px 14px 10px;
    max-width: 620px;
    width: 100%;
    margin: 0 auto;
  }
  .bar {
    padding: 10px 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 620px;
    width: 100%;
    margin: 0 auto;
    background: linear-gradient(to top, rgba(19, 9, 58, 0.98) 60%, rgba(19, 9, 58, 0));
  }
  .where {
    margin: 0;
    text-align: center;
    font-weight: 800;
    font-size: 0.95rem;
  }
  .where b {
    color: var(--yellow);
  }
  .hint {
    animation: wiggle 0.9s ease-in-out infinite;
    display: inline-block;
  }
  /* One row that scrolls sideways: with 5-6 players a wrapping list would eat the timeline. */
  .challengers {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 2px 2px 6px;
    scrollbar-width: none;
  }
  .challengers::-webkit-scrollbar {
    display: none;
  }
  .challengers > :first-child {
    margin-left: auto;
  }
  .challengers > :last-child {
    margin-right: auto;
  }
  .cbtn {
    flex: 0 0 auto;
  }
  /* Short phones: the cassette art gives way to the timeline while players challenge. */
  @media (max-height: 760px) {
    .challenging .tape {
      display: none;
    }
    .challenging .deckpanel {
      grid-template-columns: 1fr;
      justify-items: center;
    }
  }
  .cbtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px 4px 4px;
    border-radius: 999px;
    border: var(--border);
    background: var(--paper);
    color: var(--ink);
    font-weight: 900;
    box-shadow: var(--shadow-sm);
  }
  .cbtn span {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--pc);
    border: 2px solid var(--ink);
    font-size: 1.1rem;
  }
  .cbtn small {
    font-size: 0.75rem;
    opacity: 0.8;
  }
  .cbtn.sel {
    background: var(--yellow);
    transform: translateY(-2px);
    outline: 3px solid var(--paper);
  }
  .cbtn.done {
    background: var(--purple);
    color: #fff;
  }
  @media (min-width: 900px) and (min-aspect-ratio: 4/3) {
    .play {
      display: grid;
      grid-template-columns: minmax(320px, 420px) minmax(360px, 620px);
      grid-template-rows: auto auto 1fr auto;
      justify-content: center;
      column-gap: 28px;
    }
    .deckpanel {
      grid-column: 1;
      grid-row: 1 / span 3;
      grid-template-columns: 1fr;
      align-self: start;
      justify-items: center;
    }
    .controls {
      align-items: center;
    }
    .audio-error {
      grid-column: 1;
    }
    .tl-head,
    .tl,
    .bar {
      grid-column: 2;
    }
    .tl-head {
      grid-row: 1;
    }
    .tl {
      grid-row: 2 / span 2;
    }
    .bar {
      grid-row: 4;
    }
  }
</style>
