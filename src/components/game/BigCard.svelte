<script lang="ts">
  // The physical-looking card: back = mystery, front = year + show + song + performer.
  import { countryOf, decadeColor, flagOf } from '../../lib/deckdata';
  import type { Song } from '../../lib/game/types';

  let { song, flipped = false }: { song: Song; flipped?: boolean } = $props();
  const sameTitle = $derived(song.title.toLowerCase().replace(/\W/g, '') === song.cartoon.toLowerCase().replace(/\W/g, ''));
</script>

<div class="scene">
  <div class="card" class:flipped style:--dc={decadeColor(song.year)}>
    <div class="face back">
      <div class="burst"></div>
      <div class="qmark sticker">?</div>
      <div class="brand">SIGLE IN FILA</div>
    </div>
    <div class="face front">
      <div class="top">
        <span class="flag" title={countryOf(song.origin)}>{flagOf(song.origin)} {countryOf(song.origin)}</span>
        <span class="no">#{song.id}</span>
      </div>
      <div class="emoji">{song.emoji}</div>
      <div class="year sticker">{song.year}</div>
      <div class="info">
        <div class="cartoon">{song.cartoon}</div>
        {#if !sameTitle}<div class="title">«{song.title}»</div>{/if}
        <div class="performer">🎤 {song.performer}</div>
        {#if song.note}<div class="note">{song.note}</div>{/if}
      </div>
    </div>
  </div>
</div>

<style>
  .scene {
    perspective: 1200px;
    width: min(76vw, 300px, 46dvh);
    aspect-ratio: 3 / 4;
  }
  .card {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.75s var(--ease-back);
  }
  .card.flipped {
    transform: rotateY(180deg);
  }
  .face {
    position: absolute;
    inset: 0;
    border: 4px solid var(--ink);
    border-radius: 22px;
    box-shadow: 0 8px 0 var(--ink);
    overflow: hidden;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }
  .back {
    display: grid;
    place-items: center;
    background:
      radial-gradient(rgba(255, 255, 255, 0.12) 1.4px, transparent 1.8px) 0 0 / 12px 12px,
      linear-gradient(160deg, #3b1d98, #170c37);
  }
  .burst {
    position: absolute;
    inset: -40%;
    background: repeating-conic-gradient(from 0deg, rgba(255, 210, 63, 0.16) 0 10deg, transparent 10deg 20deg);
    animation: spin 18s linear infinite;
  }
  .qmark {
    position: relative;
    font-size: 9rem;
    color: var(--yellow);
    animation: float 1.4s ease-in-out infinite;
  }
  .brand {
    position: absolute;
    bottom: 14px;
    font-family: var(--font-display);
    letter-spacing: 0.18em;
    color: var(--paper);
    opacity: 0.85;
  }
  .front {
    transform: rotateY(180deg);
    display: flex;
    flex-direction: column;
    align-items: center;
    background:
      radial-gradient(rgba(255, 255, 255, 0.32) 1.4px, transparent 1.8px) 0 0 / 11px 11px,
      var(--dc);
    color: var(--ink);
    padding: 12px 14px 14px;
  }
  .top {
    align-self: stretch;
    display: flex;
    justify-content: space-between;
    font-weight: 900;
    font-size: 0.78rem;
  }
  .top span {
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(255, 248, 234, 0.85);
    border: 2px solid var(--ink);
  }
  .emoji {
    margin-top: 6px;
    display: grid;
    place-items: center;
    width: 76px;
    height: 76px;
    border-radius: 50%;
    background: var(--paper);
    border: 4px solid var(--ink);
    font-size: 2.6rem;
    box-shadow: 0 4px 0 var(--ink);
  }
  .year {
    margin-top: 2px;
    font-size: clamp(3.4rem, 15vw, 4.6rem);
    line-height: 1;
  }
  .info {
    margin-top: auto;
    align-self: stretch;
    background: var(--paper);
    border: 3px solid var(--ink);
    border-radius: 14px;
    padding: 8px 10px;
    text-align: center;
  }
  .cartoon {
    font-family: var(--font-display);
    font-size: 1.3rem;
    line-height: 1.05;
  }
  .title {
    font-style: italic;
    font-weight: 800;
    font-size: 0.92rem;
    margin-top: 2px;
  }
  .performer {
    font-weight: 900;
    font-size: 0.92rem;
    margin-top: 4px;
  }
  .note {
    margin-top: 4px;
    font-size: 0.72rem;
    font-weight: 800;
    color: rgba(23, 12, 55, 0.65);
  }
</style>
