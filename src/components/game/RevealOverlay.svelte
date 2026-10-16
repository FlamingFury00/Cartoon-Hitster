<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { app } from '../../lib/app.svelte';
  import { sfx } from '../../lib/audio/sfx';
  import { spotifyUrl } from '../../lib/audio/sources';
  import { song } from '../../lib/deckdata';
  import * as E from '../../lib/game/engine';
  import { describeSlot } from '../../lib/game/timeline';
  import type { GameState } from '../../lib/game/types';
  import { openExternal, prefersReducedMotion } from '../../lib/platform';
  import BigCard from './BigCard.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';

  let { game }: { game: GameState & { phase: { t: 'reveal' } } } = $props();

  const phase = $derived(game.phase);
  const s = $derived(song(phase.card));
  const outcome = $derived(phase.outcome);
  const active = $derived(game.players[game.active]);
  const coop = $derived(game.settings.mode === 'coop');
  const pro = $derived(game.settings.mode === 'pro');
  const nameOf = (id: string | null) => game.players.find((p) => p.id === id)?.name ?? '';

  let flipped = $state(false);
  let landed = $state(false);
  let tension = $state(false);
  let confetti = $state(0);
  let guess = $state<E.Guess>({ cartoon: false, performer: false });
  const timers: ReturnType<typeof setTimeout>[] = [];

  const verdict = $derived.by(() => {
    if (outcome.bought) return { text: 'COMPRATA!', cls: 'bought' };
    if (outcome.placementCorrect) return { text: 'GIUSTO!', cls: 'right' };
    if (outcome.stolenBy) return { text: 'RUBATA!', cls: 'stolen' };
    return { text: 'SBAGLIATO!', cls: 'wrong' };
  });

  const yearOf = (id: string) => song(id).year;
  const timeline = $derived(coop && game.team ? game.team.timeline : active.timeline);
  const where = $derived(describeSlot(timeline, outcome.validFrom, yearOf));
  const dest = $derived(E.cardDestination(game, guess));
  const earns = $derived(E.earnsToken(game, guess));
  const showGuess = $derived(!outcome.bought && (game.settings.tokens || pro));
  const tokensNow = $derived(coop && game.team ? game.team.tokens : active.tokens);

  function land() {
    if (landed) return;
    flipped = true;
    tension = false;
    timers.push(
      setTimeout(() => {
        landed = true;
        app.revealLanded();
        if (outcome.bought || outcome.placementCorrect || outcome.stolenBy) confetti++;
      }, 420),
    );
  }

  onMount(() => {
    if (prefersReducedMotion() || app.settings.motion === 'reduced' || outcome.bought) {
      timers.push(setTimeout(land, outcome.bought ? 300 : 50));
    } else {
      timers.push(
        setTimeout(() => {
          tension = true;
          sfx.drumroll(1.05);
        }, 380),
      );
      timers.push(setTimeout(land, 1450));
    }
    return () => timers.forEach(clearTimeout);
  });

  function toggle(k: keyof E.Guess) {
    guess[k] = !guess[k];
    sfx.tap();
  }

  function next() {
    app.resolve($state.snapshot(guess));
  }
</script>

<div class="overlay" transition:fade={{ duration: 180 }}>
  <Confetti fire={confetti} />
  <div class="stage scroll">
    <button class="cardbtn" class:tension aria-label={landed ? 'Carta rivelata' : 'Rivela subito'} onclick={land} in:scale={{ duration: 350, start: 0.6 }}>
      <BigCard song={s} {flipped} />
      {#if landed}
        <div class="stamp {verdict.cls}" in:scale={{ duration: 420, start: 2.6 }}>{verdict.text}</div>
      {/if}
    </button>

    {#if landed}
      <section class="result" in:fly={{ y: 30, duration: 320 }}>
        <p class="line">
          {#if outcome.bought}
            {active.avatar} <b>{active.name}</b> si è comprata la carta con 3 gettoni.
          {:else if outcome.placementCorrect}
            {active.avatar} <b>{active.name}</b> l'ha messa al posto giusto!
          {:else if outcome.stolenBy}
            {active.avatar} <b>{active.name}</b> ha sbagliato… e <b>{nameOf(outcome.stolenBy)}</b> la ruba!
          {:else}
            Andava messa <b>{where}</b>.
          {/if}
        </p>

        {#if phase.challenges.length}
          <ul class="challenges">
            {#each phase.challenges as c (c.playerId)}
              {@const p = game.players.find((x) => x.id === c.playerId)}
              {@const ok = c.slot >= outcome.validFrom && c.slot <= outcome.validTo}
              {#if p}
                <li class:ok>{p.avatar} {p.name}: {ok ? 'sfida vinta' : 'sfida persa'} {ok ? '✓' : '✗'}</li>
              {/if}
            {/each}
          </ul>
        {/if}

        {#if showGuess}
          <div class="guess">
            <p class="q">
              {#if pro && outcome.placementCorrect}
                {coop ? 'Avete' : `${active.name} ha`} detto il <b>cartone</b>? Serve per tenere la carta!
              {:else}
                Bonus 🪙: {coop ? 'avete' : `${active.name} ha`} indovinato <b>cartone</b> e <b>interprete</b>?
              {/if}
            </p>
            <div class="gchips">
              <button class="chip" aria-pressed={guess.cartoon} onclick={() => toggle('cartoon')}>🎬 Cartone {guess.cartoon ? '✓' : ''}</button>
              {#if game.settings.tokens}
                <button class="chip" aria-pressed={guess.performer} onclick={() => toggle('performer')}>🎤 Interprete {guess.performer ? '✓' : ''}</button>
              {/if}
            </div>
            {#if earns}
              <p class="earn" in:scale>+1 gettone {tokensNow >= game.settings.maxTokens ? '(sei già al massimo!)' : '🪙'}</p>
            {/if}
          </div>
        {/if}

        <p class="dest">
          {#if dest === 'team'}
            La carta entra nella linea del tempo della squadra.
          {:else if dest}
            La carta va nella fila di <b>{nameOf(dest)}</b>.
          {:else if coop}
            Carta scartata: la squadra perde un gettone {game.team && game.team.tokens === 0 ? '…ed è finita!' : ''}
          {:else}
            La carta viene scartata.
          {/if}
        </p>

        <div class="actions">
          <button class="btn big wide green" onclick={next}>Avanti <Icon name="play" /></button>
          <button class="btn small ghost" onclick={() => openExternal(spotifyUrl(s))}>🎧 Ascolta tutta la sigla su Spotify <Icon name="external" size={16} /></button>
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: radial-gradient(80% 60% at 50% 35%, rgba(59, 29, 152, 0.92), rgba(19, 9, 58, 0.97));
    display: flex;
    flex-direction: column;
  }
  .stage {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 18px);
  }
  .cardbtn {
    position: relative;
    margin-top: 4px;
  }
  .cardbtn.tension {
    animation: shake 0.28s linear infinite;
  }
  .stamp {
    position: absolute;
    left: 50%;
    top: 63%;
    transform: translate(-50%, -50%) rotate(-14deg);
    padding: 6px 18px 4px;
    border: 5px solid currentColor;
    border-radius: 14px;
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 9vw, 2.6rem);
    letter-spacing: 0.04em;
    background: rgba(255, 248, 234, 0.92);
    box-shadow: 0 6px 0 var(--ink);
    white-space: nowrap;
    pointer-events: none;
  }
  .stamp.right {
    color: #15a33a;
  }
  .stamp.wrong {
    color: #e0213a;
  }
  .stamp.stolen {
    color: #7a3df0;
  }
  .stamp.bought {
    color: #c98a00;
  }
  .result {
    width: min(100%, 440px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
  .line {
    margin: 0;
    font-size: 1.12rem;
    font-weight: 800;
  }
  .line b {
    color: var(--yellow);
  }
  .challenges {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }
  .challenges li {
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(255, 75, 75, 0.25);
    border: 2px solid var(--red);
    font-weight: 800;
    font-size: 0.85rem;
  }
  .challenges li.ok {
    background: rgba(79, 217, 107, 0.25);
    border-color: var(--green);
  }
  .guess {
    background: var(--paper);
    color: var(--ink);
    border: var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 12px;
  }
  .q {
    margin: 0 0 10px;
    font-weight: 800;
  }
  .gchips {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .gchips .chip {
    min-height: 48px;
    font-size: 1.02rem;
  }
  .gchips .chip[aria-pressed='true'] {
    background: var(--green);
  }
  .earn {
    margin: 10px 0 0;
    font-family: var(--font-display);
    font-size: 1.3rem;
    color: #c98a00;
  }
  .dest {
    margin: 0;
    font-weight: 700;
    opacity: 0.9;
  }
  .dest b {
    color: var(--yellow);
  }
  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
</style>
