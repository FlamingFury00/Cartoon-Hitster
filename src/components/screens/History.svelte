<script lang="ts">
  import { clearHistory, loadHistory, type HistoryEntry } from '../../lib/storage';
  import { MODE_INFO } from '../../lib/ui-constants';
  import TopBar from '../ui/TopBar.svelte';

  let entries = $state<HistoryEntry[]>(loadHistory());
  let confirm = $state(false);

  const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const hall = $derived.by(() => {
    const m = new Map<string, { name: string; avatar: string; color: string; games: number; wins: number; cards: number }>();
    for (const e of entries) {
      if (e.mode === 'coop') continue;
      for (const p of e.players) {
        const k = p.name.toLowerCase();
        const r = m.get(k) ?? { name: p.name, avatar: p.avatar, color: p.color, games: 0, wins: 0, cards: 0 };
        r.games++;
        r.cards += p.cards;
        if (e.winners.includes(p.name)) r.wins++;
        m.set(k, r);
      }
    }
    return [...m.values()].sort((a, b) => b.wins - a.wins || b.wins / b.games - a.wins / a.games).slice(0, 8);
  });

  const minutes = (e: HistoryEntry) => Math.max(1, Math.round((e.endedAt - e.startedAt) / 60000));
</script>

<TopBar title="Storico partite" />

<div class="history scroll">
  {#if !entries.length}
    <div class="empty panel">
      <p class="big">🏆</p>
      <p>Ancora nessuna partita conclusa.<br />Finisci una partita e qui comparirà la sfida!</p>
    </div>
  {:else}
    {#if hall.length}
      <section class="panel">
        <h2>Albo d'oro</h2>
        <ol class="hall">
          {#each hall as h, i (i)}
            <li style:--pc={h.color}>
              <span class="pos">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}°`}</span>
              <span class="ava">{h.avatar}</span>
              <span class="nm">{h.name}</span>
              <span class="wins"><b>{h.wins}</b> vittorie su {h.games}</span>
            </li>
          {/each}
        </ol>
      </section>
    {/if}

    <section class="list">
      {#each entries as e (e.id)}
        <article class="panel game">
          <header>
            <span class="mode">{MODE_INFO[e.mode].emoji} {MODE_INFO[e.mode].label}</span>
            <time>{fmt.format(e.endedAt)}</time>
          </header>
          <p class="winner">
            {#if e.mode === 'coop'}
              {e.reason === 'coop-won' ? '🎉 Squadra vincente' : e.reason === 'ended' ? '🏁 Partita terminata' : '💔 Squadra sconfitta'} · {e.team?.cards ?? 0} carte
            {:else}
              🏆 {e.winners.join(' e ') || '—'}
            {/if}
          </p>
          <div class="ps">
            {#each e.players as p, i (i)}
              <span class="pchip" style:--pc={p.color}>{p.avatar} {p.name} {#if e.mode !== 'coop'}<b>{p.cards}</b>{/if}</span>
            {/each}
          </div>
          <footer>{e.turns} turni · {minutes(e)} min · obiettivo {e.target}</footer>
        </article>
      {/each}
    </section>

    {#if !confirm}
      <button class="btn small ghost" onclick={() => (confirm = true)}>Cancella lo storico</button>
    {:else}
      <div class="row">
        <button class="btn small paper" onclick={() => (confirm = false)}>Annulla</button>
        <button class="btn small pink" onclick={() => { clearHistory(); entries = []; confirm = false; }}>Sì, cancella</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .history {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 4px 16px 28px;
  }
  .panel {
    width: min(100%, 560px);
    padding: 14px 16px;
  }
  .empty {
    text-align: center;
    font-weight: 800;
  }
  .big {
    font-size: 3rem;
    margin: 0;
  }
  h2 {
    font-size: 1.4rem;
    margin-bottom: 8px;
  }
  .hall {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hall li {
    display: grid;
    grid-template-columns: 34px 38px 1fr auto;
    align-items: center;
    gap: 8px;
  }
  .pos {
    font-size: 1.3rem;
    text-align: center;
    font-weight: 900;
  }
  .ava {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    background: var(--pc);
    font-size: 1.2rem;
  }
  .nm {
    font-weight: 900;
  }
  .wins {
    font-weight: 700;
    font-size: 0.85rem;
  }
  .wins b {
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.2rem;
  }
  .list {
    width: min(100%, 560px);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .game header {
    display: flex;
    justify-content: space-between;
    font-weight: 800;
    font-size: 0.85rem;
  }
  .winner {
    margin: 6px 0;
    font-family: var(--font-display);
    font-size: 1.25rem;
  }
  .ps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pchip {
    padding: 2px 10px;
    border-radius: 999px;
    border: 2px solid var(--ink);
    background: var(--pc);
    font-weight: 800;
    font-size: 0.85rem;
  }
  .pchip b {
    margin-left: 4px;
  }
  .game footer {
    margin-top: 8px;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--ink-soft);
  }
  .row {
    display: flex;
    gap: 10px;
  }
</style>
