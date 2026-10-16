<script lang="ts">
  import { decadeColor, flagOf } from '../../lib/deckdata';
  import type { Song } from '../../lib/game/types';

  let {
    song,
    state = 'normal',
    compact = false,
  }: { song: Song; state?: 'normal' | 'new' | 'right' | 'wrong' | 'stolen'; compact?: boolean } = $props();
</script>

<div class="tcard {state}" class:compact style:--dc={decadeColor(song.year)}>
  <div class="year">{song.year}</div>
  <div class="body">
    <div class="cartoon"><span class="emoji" aria-hidden="true">{song.emoji}</span>{song.cartoon}</div>
    {#if !compact}
      <div class="meta">
        {#if song.title.toLowerCase() !== song.cartoon.toLowerCase()}<span class="title">«{song.title}»</span> ·{/if}
        <span>{song.performer}</span>
        <span class="flag" title={song.origin}>{flagOf(song.origin)}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .tcard {
    display: flex;
    align-items: stretch;
    min-height: 58px;
    border: var(--border);
    border-radius: 14px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .tcard.compact {
    min-height: 44px;
  }
  .year {
    flex: 0 0 74px;
    display: grid;
    place-items: center;
    background:
      radial-gradient(rgba(255, 255, 255, 0.35) 1px, transparent 1.5px) 0 0 / 7px 7px,
      var(--dc);
    border-right: var(--border);
    font-family: var(--font-display);
    font-size: 1.45rem;
    color: var(--paper);
    text-shadow:
      0 2px 0 var(--ink),
      1.5px 0 0 var(--ink),
      -1.5px 0 0 var(--ink),
      0 -1.5px 0 var(--ink),
      1.5px 1.5px 0 var(--ink),
      -1.5px 1.5px 0 var(--ink);
  }
  .compact .year {
    flex-basis: 62px;
    font-size: 1.2rem;
  }
  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 6px 10px;
  }
  .cartoon {
    font-weight: 900;
    font-size: 1rem;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .emoji {
    margin-right: 6px;
  }
  .meta {
    font-size: 0.78rem;
    font-weight: 700;
    color: rgba(23, 12, 55, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title {
    font-style: italic;
  }
  .flag {
    margin-left: 4px;
  }
  .new {
    animation: pop-in 0.45s var(--ease-back);
    outline: 4px solid var(--yellow);
  }
  .right {
    outline: 4px solid var(--green);
  }
  .wrong {
    outline: 4px solid var(--red);
    opacity: 0.92;
  }
  .stolen {
    outline: 4px solid var(--purple);
  }
</style>
