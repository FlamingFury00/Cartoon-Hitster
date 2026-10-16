<script lang="ts">
  import { onMount } from 'svelte';
  import { scale, fly } from 'svelte/transition';
  import { app } from '../../lib/app.svelte';
  import { song } from '../../lib/deckdata';
  import type { GameState, Player } from '../../lib/game/types';
  import Confetti from '../ui/Confetti.svelte';
  import Timeline from './Timeline.svelte';
  import PlayerSheet from './PlayerSheet.svelte';

  let { game }: { game: GameState & { phase: { t: 'over' } } } = $props();
  let fire = $state(0);
  let sheet = $state<string | null>(null);

  const reason = $derived(game.phase.reason);
  const winners = $derived(game.players.filter((p) => game.phase.winners.includes(p.id)));
  const coop = $derived(game.settings.mode === 'coop');
  const ranking = $derived(
    [...game.players].sort((a, b) => b.timeline.length - a.timeline.length || b.tokens - a.tokens || b.stats.correct - a.stats.correct),
  );
  const showcase = $derived(coop && game.team ? game.team.timeline : winners[0]?.timeline ?? ranking[0].timeline);

  const title = $derived.by(() => {
    if (reason === 'coop-won') return 'La squadra ha vinto!';
    if (reason === 'coop-lost') return 'Peccato, la squadra ha perso!';
    if (reason === 'ended' && coop) return 'Partita terminata';
    if (winners.length > 1) return 'Pareggio!';
    return `Vince ${winners[0]?.name ?? ''}!`;
  });
  const subtitle = $derived.by(() => {
    if (reason === 'coop-won') return `${game.team?.timeline.length} sigle messe in fila insieme 🎉`;
    if (reason === 'coop-lost') return 'Gettoni finiti: riprovate, la prossima è quella buona!';
    if (reason === 'deck') return 'Il mazzo è finito: vince chi ha più carte.';
    if (reason === 'ended') return coop ? `${game.team?.timeline.length} sigle messe in fila insieme` : 'Partita terminata: vince chi ha più carte.';
    if (winners.length > 1) return `Vincono ${winners.map((w) => w.name).join(' e ')}`;
    return `${winners[0]?.timeline.length} sigle in fila!`;
  });

  const acc = (p: Player) => (p.stats.placed ? Math.round((p.stats.correct / p.stats.placed) * 100) : 0);

  // Fun end-of-game awards
  const awards = $derived.by(() => {
    if (coop) return [];
    const out: { emoji: string; title: string; who: Player; why: string }[] = [];
    const ps = game.players.filter((p) => p.stats.placed > 0);
    const best = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, b) => (f(b) > f(a) ? b : a), arr[0]);
    if (ps.length) {
      const sharp = best(ps, acc);
      if (acc(sharp) > 0) out.push({ emoji: '🐘', title: "Memoria d'elefante", who: sharp, why: `${acc(sharp)}% di risposte giuste` });
      const streak = best(ps, (p) => p.stats.bestStreak);
      if (streak.stats.bestStreak >= 3) out.push({ emoji: '🔥', title: 'Inarrestabile', who: streak, why: `${streak.stats.bestStreak} giuste di fila` });
    }
    const thief = best(game.players, (p) => p.stats.steals);
    if (thief && thief.stats.steals > 0) out.push({ emoji: '🦹', title: 'Ladro di sigle', who: thief, why: `${thief.stats.steals} carte rubate` });
    const span = (p: Player) => (p.timeline.length > 1 ? song(p.timeline[p.timeline.length - 1]).year - song(p.timeline[0]).year : 0);
    const traveller = best(game.players, span);
    if (traveller && span(traveller) >= 15) out.push({ emoji: '⏳', title: 'Viaggiatore nel tempo', who: traveller, why: `${span(traveller)} anni di sigle in fila` });
    const bonus = best(game.players, (p) => p.stats.bonus);
    if (bonus && bonus.stats.bonus >= 2) out.push({ emoji: '🎤', title: 'Enciclopedia vivente', who: bonus, why: `${bonus.stats.bonus} cartoni e interpreti indovinati` });
    return out;
  });

  onMount(() => {
    if (reason !== 'coop-lost') {
      fire = 1;
      const t = setTimeout(() => (fire = 2), 900);
      return () => clearTimeout(t);
    }
  });

  const medal = ['🥇', '🥈', '🥉'];
</script>

<Confetti {fire} amount={180} />

<div class="victory scroll">
  <header class="hero" in:scale={{ duration: 500, start: 0.5 }}>
    <div class="avas">
      {#if coop}
        <span class="ava big">{reason === 'coop-won' ? '🏆' : '💔'}</span>
      {:else}
        {#each winners as w (w.id)}
          <span class="ava big" style:--pc={w.color}>{w.avatar}<i class="crown">👑</i></span>
        {/each}
      {/if}
    </div>
    <h1 class="sticker">{title}</h1>
    <p class="sub">{subtitle}</p>
  </header>

  {#if !coop}
    <section class="panel ranking" in:fly={{ y: 30, delay: 200 }}>
      <h2>Classifica</h2>
      <ol>
        {#each ranking as p, i (p.id)}
          <li>
            <button onclick={() => (sheet = p.id)} style:--pc={p.color}>
              <span class="pos">{medal[i] ?? `${i + 1}°`}</span>
              <span class="pava">{p.avatar}</span>
              <span class="pname">{p.name}</span>
              <span class="pcards"><b>{p.timeline.length}</b> carte</span>
              <span class="pacc">{acc(p)}%</span>
            </button>
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if awards.length}
    <section class="awards" in:fly={{ y: 30, delay: 350 }}>
      {#each awards as a (a.title)}
        <div class="award" style:--pc={a.who.color}>
          <span class="aemo">{a.emoji}</span>
          <div>
            <strong>{a.title}</strong>
            <small>{a.who.avatar} {a.who.name} · {a.why}</small>
          </div>
        </div>
      {/each}
    </section>
  {/if}

  <section class="show" in:fly={{ y: 30, delay: 450 }}>
    <h2>{coop ? 'La vostra linea del tempo' : `La fila di ${winners[0]?.name ?? ranking[0].name}`}</h2>
    <Timeline ids={showcase} mode="view" />
  </section>

  <footer class="actions">
    <button class="btn big wide" onclick={() => app.rematch()}>🔁 Rivincita</button>
    <div class="row">
      <button class="btn paper" onclick={() => { app.closeGame(); app.go('setup'); }}>🎮 Nuova partita</button>
      <button class="btn paper" onclick={() => { app.closeGame(); app.go('home'); }}>🏠 Menu</button>
    </div>
  </footer>
</div>

{#if sheet}
  <PlayerSheet {game} playerId={sheet} onclose={() => (sheet = null)} />
{/if}

<style>
  .victory {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 12px 16px 24px;
  }
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    margin-top: 8px;
  }
  .avas {
    display: flex;
    gap: 12px;
  }
  .ava.big {
    position: relative;
    display: grid;
    place-items: center;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 5px solid var(--ink);
    background: var(--pc, var(--yellow));
    box-shadow: 0 8px 0 var(--ink);
    font-size: 4.4rem;
    animation: float 1.6s ease-in-out infinite;
  }
  .crown {
    position: absolute;
    top: -34px;
    font-style: normal;
    font-size: 2.6rem;
    transform: rotate(-12deg);
  }
  h1 {
    font-size: clamp(2.2rem, 10vw, 3.4rem);
    margin-top: 10px;
  }
  .sub {
    margin: 0;
    font-weight: 800;
    color: var(--paper-2);
  }
  .panel {
    width: min(100%, 520px);
    padding: 14px;
  }
  h2 {
    font-size: 1.4rem;
    margin-bottom: 10px;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  ol button {
    width: 100%;
    display: grid;
    grid-template-columns: 36px 40px 1fr auto auto;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 14px;
    border: 2px solid var(--ink);
    background: #fff;
    text-align: left;
  }
  .pos {
    font-size: 1.4rem;
    text-align: center;
    font-weight: 900;
  }
  .pava {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--pc);
    border: 2px solid var(--ink);
    font-size: 1.3rem;
  }
  .pname {
    font-weight: 900;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pcards b {
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.3rem;
  }
  .pcards,
  .pacc {
    font-weight: 800;
    font-size: 0.85rem;
  }
  .awards {
    width: min(100%, 520px);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }
  .award {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 16px;
    border: var(--border);
    background: var(--paper);
    color: var(--ink);
    box-shadow: var(--shadow-sm);
  }
  .aemo {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    background: var(--pc);
    font-size: 1.6rem;
    flex-shrink: 0;
  }
  .award strong {
    display: block;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.1rem;
  }
  .award small {
    font-weight: 800;
    color: var(--ink-2);
  }
  .show {
    width: min(100%, 520px);
  }
  .actions {
    width: min(100%, 520px);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
</style>
