<script lang="ts">
  import { app } from '../../lib/app.svelte';
  import { songs } from '../../lib/deckdata';
  import { DECADES, filterDeck, minDeckSize, recommendedDeckSize, TAG_FILTERS } from '../../lib/game/deck';
  import { DEFAULT_SETTINGS, MAX_PLAYERS } from '../../lib/game/engine';
  import type { Decade, GameMode, GameSettings, PlayerSetup } from '../../lib/game/types';
  import { loadRoster } from '../../lib/storage';
  import { AVATARS, FAME_INFO, MODE_INFO, PLAYER_COLORS } from '../../lib/ui-constants';
  import { sfx } from '../../lib/audio/sfx';
  import Icon from '../ui/Icon.svelte';
  import Stepper from '../ui/Stepper.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import TopBar from '../ui/TopBar.svelte';

  function initialRoster(): PlayerSetup[] {
    const r = loadRoster().slice(0, MAX_PLAYERS);
    if (r.length >= 2) return r;
    return [
      { name: '', avatar: '🐱', color: PLAYER_COLORS[0] },
      { name: '', avatar: '🐶', color: PLAYER_COLORS[1] },
    ];
  }

  const FAMES = [3, 2, 1] as const;

  let players = $state<PlayerSetup[]>(initialRoster());
  let s = $state<GameSettings>({ ...$state.snapshot(app.settings.game) } as GameSettings);
  let picker = $state<number | null>(null);

  const coop = $derived(s.mode === 'coop');
  const pool = $derived(filterDeck(songs, s));
  const minSize = $derived(minDeckSize(coop ? 1 : players.length, s.target));
  const recommended = $derived(recommendedDeckSize(coop ? 1 : players.length, s.target));
  const minPlayers = $derived(coop ? 1 : 2);
  const tooFewPlayers = $derived(players.length < minPlayers);
  const valid = $derived(!tooFewPlayers && pool.length >= minSize);

  function addPlayer() {
    if (players.length >= MAX_PLAYERS) return;
    const usedA = new Set(players.map((p) => p.avatar));
    const usedC = new Set(players.map((p) => p.color));
    players.push({
      name: '',
      avatar: AVATARS.find((a) => !usedA.has(a)) ?? '⭐',
      color: PLAYER_COLORS.find((c) => !usedC.has(c)) ?? PLAYER_COLORS[players.length % PLAYER_COLORS.length],
    });
    sfx.pop();
  }

  function removePlayer(i: number) {
    players.splice(i, 1);
    sfx.tap();
  }

  function cycleColor(i: number) {
    const idx = PLAYER_COLORS.indexOf(players[i].color);
    players[i].color = PLAYER_COLORS[(idx + 1) % PLAYER_COLORS.length];
    sfx.tap();
  }

  function pickAvatar(a: string) {
    if (picker == null) return;
    players[picker].avatar = a;
    picker = null;
    sfx.pop();
  }

  let tokensBeforeCoop: number | null = null;

  function setMode(m: GameMode) {
    const wasCoop = s.mode === 'coop';
    s.mode = m;
    if (m === 'coop' && !wasCoop) {
      // As in Hitster's co-op rules the team starts with 5 tokens: 2 would end most games in a few turns.
      s.tokens = true;
      tokensBeforeCoop = s.startTokens;
      s.startTokens = 5;
    } else if (m !== 'coop' && wasCoop) {
      s.startTokens = tokensBeforeCoop ?? DEFAULT_SETTINGS.startTokens;
      tokensBeforeCoop = null;
    }
    sfx.tap();
  }

  function toggleDecade(d: Decade) {
    s.decades = s.decades.includes(d) ? s.decades.filter((x) => x !== d) : [...s.decades, d];
    sfx.tap();
  }

  function toggleTag(t: string) {
    s.tags = s.tags.includes(t) ? s.tags.filter((x) => x !== t) : [...s.tags, t];
    sfx.tap();
  }

  function start() {
    if (!valid) return;
    // Every player needs a distinct name (scores, history and challenges refer to it).
    const taken = new Set<string>();
    const named = players.map((p, i) => {
      const base = p.name.trim() || `Giocatore ${i + 1}`;
      let name = base;
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
      taken.add(name.toLowerCase());
      return { ...p, name };
    });
    app.newGame(named, $state.snapshot(s) as GameSettings);
  }

  const countFor = (patch: Partial<GameSettings>) => filterDeck(songs, { ...s, ...patch }).length;
</script>

<TopBar title="Nuova partita" />

<div class="setup scroll">
  <section class="block">
    <h2><Icon name="users" /> Giocatori <span class="count">{players.length}/{MAX_PLAYERS}</span></h2>
    <ul class="players">
      {#each players as p, i (i)}
        <li class="prow" style:--pc={p.color}>
          <button class="avatar" aria-label="Cambia avatar di {p.name || `Giocatore ${i + 1}`}" onclick={() => (picker = picker === i ? null : i)}>{p.avatar}</button>
          <input
            class="name"
            type="text"
            maxlength="16"
            placeholder="Giocatore {i + 1}"
            bind:value={p.name}
            autocomplete="off"
            enterkeyhint="done"
            aria-label="Nome del giocatore {i + 1}"
          />
          <button class="swatch" aria-label="Cambia colore" onclick={() => cycleColor(i)}></button>
          <button class="remove" aria-label="Rimuovi giocatore" disabled={players.length <= 1} onclick={() => removePlayer(i)}><Icon name="trash" size={20} /></button>
        </li>
        {#if picker === i}
          <li class="picker" aria-label="Scegli un avatar">
            {#each AVATARS as a (a)}
              <button class="emo" class:sel={a === p.avatar} onclick={() => pickAvatar(a)}>{a}</button>
            {/each}
          </li>
        {/if}
      {/each}
    </ul>
    {#if players.length < MAX_PLAYERS}
      <button class="btn small paper add" onclick={addPlayer}><Icon name="plus" size={20} /> Aggiungi giocatore</button>
    {/if}
    {#if tooFewPlayers}
      <p class="warn">Servono almeno 2 giocatori (oppure scegli la modalità Squadra).</p>
    {/if}
  </section>

  <section class="block">
    <h2>🎮 Modalità</h2>
    <div class="modes" role="radiogroup" aria-label="Modalità di gioco">
      {#each Object.entries(MODE_INFO) as [key, m] (key)}
        <button class="mode" role="radio" aria-checked={s.mode === key} onclick={() => setMode(key as GameMode)}>
          <span class="memo">{m.emoji}</span>
          <span class="mlabel">{m.label}</span>
        </button>
      {/each}
    </div>
    <p class="hint">{MODE_INFO[s.mode].text}</p>

    <div class="opt">
      <div>
        <strong>Carte per vincere</strong>
        <small>{coop ? 'Linea del tempo di squadra' : 'Chi arriva per primo vince'}</small>
      </div>
      <Stepper bind:value={s.target} min={5} max={15} label="Carte per vincere" />
    </div>
    {#if !coop}
      <div class="opt">
        <div>
          <strong>Gettoni</strong>
          <small>Salta una sigla, sfida gli altri, compra una carta</small>
        </div>
        <Toggle bind:checked={s.tokens} label="Gettoni" />
      </div>
    {/if}
    {#if s.tokens}
      <div class="opt">
        <div>
          <strong>{coop ? 'Gettoni della squadra' : 'Gettoni iniziali'}</strong>
          <small>{coop ? 'Ogni errore ne costa uno' : 'Massimo 5 a testa'}</small>
        </div>
        <Stepper bind:value={s.startTokens} min={coop ? 1 : 0} max={5} label="Gettoni iniziali" />
      </div>
    {/if}
    {#if !coop}
      <div class="opt">
        <div>
          <strong>Turni uguali per tutti</strong>
          <small>Si finisce il giro anche dopo che qualcuno ha vinto</small>
        </div>
        <Toggle bind:checked={s.equalTurns} label="Turni uguali" />
      </div>
    {/if}
  </section>

  <section class="block">
    <h2><Icon name="cards" /> Mazzo <span class="count" class:bad={pool.length < minSize}>{pool.length} sigle</span></h2>
    <p class="sub">Quali sigle?</p>
    <div class="fame" role="radiogroup" aria-label="Notorietà">
      {#each FAMES as f (f)}
        <button class="chip" role="radio" aria-checked={s.minFame === f} onclick={() => ((s.minFame = f), sfx.tap())}>
          {FAME_INFO[f].label} <em>{countFor({ minFame: f })}</em>
        </button>
      {/each}
    </div>
    <p class="sub">Decenni <small>(nessuno selezionato = tutti)</small></p>
    <div class="chips">
      {#each DECADES as d (d.value)}
        {@const n = countFor({ decades: [d.value] })}
        {#if n > 0}
          <button class="chip" aria-pressed={s.decades.includes(d.value)} onclick={() => toggleDecade(d.value)}>{d.label} <em>{n}</em></button>
        {/if}
      {/each}
    </div>
    <p class="sub">Generi <small>(nessuno selezionato = tutti)</small></p>
    <div class="chips">
      {#each TAG_FILTERS as t (t.tag)}
        {@const n = countFor({ tags: [t.tag] })}
        {#if n > 0}
          <button class="chip" aria-pressed={s.tags.includes(t.tag)} onclick={() => toggleTag(t.tag)}>{t.emoji} {t.label} <em>{n}</em></button>
        {/if}
      {/each}
    </div>
    {#if pool.length < minSize}
      <p class="warn">Troppe poche sigle: servono almeno {minSize} carte. Allarga i filtri.</p>
    {:else if pool.length < recommended}
      <p class="note">Il mazzo potrebbe finire prima che qualcuno vinca: in quel caso vince chi ha più carte.</p>
    {/if}
  </section>
</div>

<footer class="go">
  <button class="btn big wide" disabled={!valid} onclick={start}>Si comincia! 🎬</button>
</footer>

<style>
  .setup {
    flex: 1;
    min-height: 0;
    padding: 4px 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .block {
    background: var(--paper);
    color: var(--ink);
    border: var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 16px;
    width: min(100%, 560px);
    margin: 0 auto;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.45rem;
    margin-bottom: 12px;
  }
  .count {
    margin-left: auto;
    font-family: var(--font-body);
    font-weight: 900;
    font-size: 0.85rem;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--paper);
  }
  .count.bad {
    background: var(--red);
  }
  .players {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .prow {
    display: grid;
    grid-template-columns: 54px 1fr 40px 40px;
    align-items: center;
    gap: 8px;
  }
  .avatar {
    width: 54px;
    height: 54px;
    border-radius: 16px;
    border: var(--border);
    background: var(--pc);
    font-size: 1.9rem;
    box-shadow: var(--shadow-sm);
    line-height: 1;
  }
  .name {
    min-width: 0;
    height: 50px;
    padding: 0 14px;
    border: var(--border);
    border-radius: 14px;
    background: #fff;
    color: var(--ink);
    font-weight: 800;
    font-size: 1.1rem;
  }
  .name::placeholder {
    color: rgba(23, 12, 55, 0.4);
  }
  .swatch {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: var(--border);
    background: var(--pc);
    box-shadow: var(--shadow-sm);
  }
  .remove {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--ink);
    opacity: 0.7;
  }
  .remove:disabled {
    opacity: 0.2;
  }
  .picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 6px;
    padding: 10px;
    border: 2px dashed var(--ink-soft);
    border-radius: 14px;
    background: var(--paper-2);
  }
  .emo {
    font-size: 1.7rem;
    height: 46px;
    border-radius: 12px;
  }
  .emo.sel {
    background: var(--yellow);
    outline: 3px solid var(--ink);
  }
  .add {
    margin-top: 12px;
  }
  .modes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 4px;
    border: var(--border);
    border-radius: 14px;
    background: #fff;
    box-shadow: var(--shadow-sm);
    transition: transform 0.08s;
  }
  .mode[aria-checked='true'] {
    background: var(--yellow);
    transform: translateY(-2px);
  }
  .memo {
    font-size: 1.7rem;
  }
  .mlabel {
    font-family: var(--font-display);
    font-size: 1.05rem;
  }
  .hint {
    margin: 10px 2px 6px;
    font-weight: 700;
    font-size: 0.92rem;
    color: var(--ink-2);
  }
  .opt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0 2px;
    border-top: 2px dashed rgba(23, 12, 55, 0.15);
    margin-top: 10px;
  }
  .opt strong {
    display: block;
    font-weight: 900;
  }
  .opt small {
    display: block;
    color: var(--ink-soft);
    font-weight: 700;
  }
  .sub {
    margin: 14px 0 8px;
    font-weight: 900;
  }
  .sub small {
    font-weight: 700;
    color: var(--ink-soft);
  }
  .chips,
  .fame {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip em {
    font-style: normal;
    font-size: 0.78rem;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--paper);
  }
  .warn {
    margin: 12px 0 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: #ffd6d6;
    border: 2px solid var(--red);
    font-weight: 800;
  }
  .note {
    margin: 12px 0 0;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--ink-soft);
  }
  .go {
    padding: 12px 16px calc(12px + var(--safe-bottom) * 0);
    display: flex;
    justify-content: center;
    background: linear-gradient(to top, rgba(19, 9, 58, 0.95), rgba(19, 9, 58, 0));
  }
  .go .btn {
    max-width: 560px;
  }
</style>
