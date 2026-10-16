<script lang="ts">
  // "Juke-box": browse every card of the deck and listen to it. Contains spoilers!
  import { onMount } from 'svelte';
  import { player, type PlaybackState } from '../../lib/audio/player';
  import { spotifyUrl } from '../../lib/audio/sources';
  import { songs } from '../../lib/deckdata';
  import { DECADES, decadeOf } from '../../lib/game/deck';
  import type { Decade, Song } from '../../lib/game/types';
  import { openExternal } from '../../lib/platform';
  import { norm } from '../../lib/text';
  import Icon from '../ui/Icon.svelte';
  import TopBar from '../ui/TopBar.svelte';
  import TimelineCard from '../game/TimelineCard.svelte';

  let q = $state('');
  let decade = $state<Decade | null>(null);
  let playing = $state<string | null>(null);
  let pstate = $state<PlaybackState>('idle');
  let spoilerOk = $state(false);

  onMount(() => {
    const off = player.onChange((s) => {
      pstate = s;
      if (s === 'idle' || s === 'error') playing = null;
    });
    return () => {
      off();
      player.stop();
    };
  });

  const sorted = $derived([...songs].sort((a, b) => a.year - b.year || a.cartoon.localeCompare(b.cartoon)));
  const filtered = $derived.by(() => {
    const nq = norm(q);
    return sorted.filter(
      (s) =>
        (decade == null || decadeOf(s.year) === decade) &&
        (!nq || norm(`${s.cartoon} ${s.title} ${s.performer} ${s.year}`).includes(nq)),
    );
  });

  function toggle(s: Song) {
    if (playing === s.id) {
      player.stop();
      playing = null;
      return;
    }
    playing = s.id;
    player.play(s).catch(() => (playing = null));
  }
</script>

<TopBar title="Le sigle" />

{#if !spoilerOk}
  <div class="spoiler">
    <div class="panel">
      <p class="big">🙈</p>
      <h2>Attenzione spoiler!</h2>
      <p>Qui trovi tutte le {songs.length} carte del mazzo con il loro anno. Se le studi… vinci facile!</p>
      <button class="btn wide" onclick={() => (spoilerOk = true)}>Mostrami le sigle</button>
    </div>
  </div>
{:else}
  <div class="filters">
    <label class="search">
      <Icon name="search" size={20} />
      <input type="search" placeholder="Cerca cartone, interprete, anno…" bind:value={q} aria-label="Cerca" />
    </label>
    <div class="chips">
      <button class="chip" aria-pressed={decade == null} onclick={() => (decade = null)}>Tutte</button>
      {#each DECADES as d (d.value)}
        {#if songs.some((s) => decadeOf(s.year) === d.value)}
          <button class="chip" aria-pressed={decade === d.value} onclick={() => (decade = d.value)}>{d.short}</button>
        {/if}
      {/each}
    </div>
  </div>

  <ul class="list scroll">
    {#each filtered as s (s.id)}
      <li>
        <TimelineCard song={s} />
        <div class="btns">
          <button class="icon-btn" aria-label={playing === s.id ? 'Ferma' : `Ascolta ${s.title}`} onclick={() => toggle(s)}>
            {#if playing === s.id && pstate === 'loading'}
              <span class="spin">⏳</span>
            {:else}
              <Icon name={playing === s.id ? 'pause' : 'play'} />
            {/if}
          </button>
          <button class="icon-btn" aria-label="Apri su Spotify" onclick={() => openExternal(spotifyUrl(s))}>🎧</button>
        </div>
      </li>
    {:else}
      <li class="none">Nessuna sigla trovata.</li>
    {/each}
  </ul>
{/if}

<style>
  .spoiler {
    flex: 1;
    display: grid;
    place-items: center;
    padding: 16px;
  }
  .spoiler .panel {
    width: min(100%, 420px);
    padding: 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .spoiler p {
    margin: 0;
    font-weight: 700;
  }
  .big {
    font-size: 3rem;
  }
  .filters {
    padding: 0 16px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(100%, 640px);
    margin: 0 auto;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 48px;
    border: var(--border);
    border-radius: 14px;
    background: #fff;
    color: var(--ink);
  }
  .search input {
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    font-weight: 800;
    font-size: 1rem;
    color: var(--ink);
    min-width: 0;
  }
  .chips {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 6px;
  }
  .chips .chip {
    flex-shrink: 0;
  }
  .list {
    flex: 1;
    min-height: 0;
    list-style: none;
    margin: 0 auto;
    padding: 4px 16px 24px;
    width: min(100%, 640px);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .list li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: center;
  }
  .btns {
    display: flex;
    gap: 6px;
  }
  .none {
    display: block !important;
    text-align: center;
    font-weight: 800;
    padding: 30px 0;
  }
  .spin {
    display: inline-block;
    animation: spin 1s linear infinite;
  }
</style>
