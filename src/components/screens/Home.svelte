<script lang="ts">
  import { app } from '../../lib/app.svelte';
  import { songs, yearRange } from '../../lib/deckdata';
  import Logo from '../ui/Logo.svelte';
  import Icon from '../ui/Icon.svelte';
  import { sfx } from '../../lib/audio/sfx';
  import { player } from '../../lib/audio/player';

  const saved = $derived(app.game && app.game.phase.t !== 'over' ? app.game : null);
  const savedLabel = $derived.by(() => {
    if (!saved) return '';
    const names = saved.players.map((p) => p.avatar + ' ' + p.name).join(' · ');
    return `${names} — turno ${saved.turn + 1}`;
  });

  function start() {
    player.unlock();
    sfx.pop();
    app.go('setup');
  }
</script>

<div class="home">
  <header class="top">
    <button class="icon-btn" aria-label="Impostazioni" onclick={() => app.go('settings')}><Icon name="settings" /></button>
  </header>

  <section class="hero">
    <Logo size={1.25} />
    <p class="tagline">Il party game delle <strong>sigle dei cartoni animati</strong>.<br />Ascolta, indovina l'anno, mettile in fila!</p>
    <p class="stats"><span>{songs.length} sigle</span><span>{yearRange.min}–{yearRange.max}</span><span>2–6 giocatori</span></p>
  </section>

  <nav class="actions">
    {#if saved}
      <button class="btn big pink wide resume" onclick={() => app.resumeGame()}>
        <span>Riprendi la partita</span>
        <small>{savedLabel}</small>
      </button>
    {/if}
    <button class="btn big wide" onclick={start}><Icon name="play" /> Nuova partita</button>
    <button class="btn cyan wide" onclick={() => app.go('rules')}><Icon name="info" /> Come si gioca</button>
    <div class="row">
      <button class="btn paper" onclick={() => app.go('history')}><Icon name="trophy" /> Storico</button>
      <button class="btn paper" onclick={() => app.go('deck')}><Icon name="cards" /> Le sigle</button>
    </div>
  </nav>

  <footer class="foot">Musica in anteprima da Deezer e Spotify · nessun account richiesto</footer>
</div>

<style>
  .home {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 20px 16px;
    overflow-y: auto;
    min-height: 0;
  }
  .top {
    align-self: stretch;
    display: flex;
    justify-content: flex-end;
  }
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
    margin: clamp(8px, 4vh, 40px) 0 clamp(16px, 4vh, 36px);
  }
  .tagline {
    text-wrap: balance;
    margin: 10px 0 0;
    font-size: 1.08rem;
    font-weight: 700;
    max-width: 22em;
    color: var(--paper-2);
  }
  .tagline strong {
    color: var(--yellow);
    font-weight: 900;
  }
  .stats {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
    margin: 0;
  }
  .stats span {
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.18);
    font-weight: 800;
    font-size: 0.85rem;
  }
  .actions {
    width: min(100%, 420px);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .resume {
    flex-direction: column;
    gap: 4px;
  }
  .resume small {
    font-family: var(--font-body);
    font-weight: 800;
    font-size: 0.8rem;
    opacity: 0.95;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .foot {
    margin-top: auto;
    padding-top: 18px;
    font-size: 0.75rem;
    opacity: 0.55;
    text-align: center;
  }
</style>
