<script lang="ts">
  import { onDestroy } from 'svelte';
  import { app, toast } from '../../lib/app.svelte';
  import { player } from '../../lib/audio/player';
  import { sfx } from '../../lib/audio/sfx';
  import { songs } from '../../lib/deckdata';
  import { isAndroidApp } from '../../lib/platform';
  import { resetAll } from '../../lib/storage';
  import Toggle from '../ui/Toggle.svelte';
  import TopBar from '../ui/TopBar.svelte';

  let testing = $state(false);
  let confirmReset = $state(false);
  let testTimer: ReturnType<typeof setTimeout> | undefined;
  let testSong: string | null = null;

  // The test song must never cut a game song: stop it only if it is still the one playing.
  const stopTest = () => {
    clearTimeout(testTimer);
    if (testSong && player.songId === testSong) player.stop();
    testSong = null;
  };
  onDestroy(stopTest);
  const save = () => app.saveSettings();

  function vol(key: 'musicVolume' | 'sfxVolume', e: Event) {
    app.settings[key] = Number((e.currentTarget as HTMLInputElement).value) / 100;
    save();
  }

  async function testAudio() {
    testing = true;
    player.unlock();
    const s = songs.find((x) => x.fame === 3) ?? songs[0];
    stopTest();
    testSong = s.id;
    try {
      await player.play(s);
      const names: Record<string, string> = { dz: 'Deezer', it: 'iTunes', sp: 'Spotify' };
      toast(`Audio OK (sorgente: ${names[player.sourceKind() ?? ''] ?? '?'}) — si ferma tra 6 secondi`);
      testTimer = setTimeout(stopTest, 6000);
    } catch {
      toast('Non riesco a riprodurre l\'audio: controlla la connessione', 'warn');
    } finally {
      testing = false;
    }
  }

  function doReset() {
    resetAll();
    location.reload();
  }
</script>

<TopBar title="Impostazioni" />

<div class="settings scroll">
  <section class="panel">
    <h2>🔊 Audio</h2>
    <label class="slider">
      <span>Volume musica</span>
      <input type="range" min="0" max="100" value={Math.round(app.settings.musicVolume * 100)} oninput={(e) => vol('musicVolume', e)} />
    </label>
    <div class="opt">
      <div><strong>Musica nei menu</strong><small>La sigla del gioco, finché non si gioca</small></div>
      <Toggle bind:checked={app.settings.menuMusic} label="Musica nei menu" onchange={save} />
    </div>
    <div class="opt">
      <div><strong>Effetti sonori</strong><small>Rullo di tamburi, applausi, trombone triste…</small></div>
      <Toggle bind:checked={app.settings.sfx} label="Effetti sonori" onchange={() => (save(), sfx.pop())} />
    </div>
    {#if app.settings.sfx}
      <label class="slider">
        <span>Volume effetti</span>
        <input type="range" min="0" max="100" value={Math.round(app.settings.sfxVolume * 100)} oninput={(e) => vol('sfxVolume', e)} onchange={() => sfx.coin()} />
      </label>
    {/if}
    <div class="opt">
      <div><strong>Ripeti la sigla</strong><small>Finita l'anteprima di 30 secondi, ricomincia</small></div>
      <Toggle bind:checked={app.settings.autoLoop} label="Ripeti la sigla" onchange={save} />
    </div>
    <div class="opt col">
      <div><strong>Come suonano le sigle</strong></div>
      <div class="seg" role="radiogroup" aria-label="Riproduzione">
        <button role="radio" aria-checked={app.settings.playback === 'preview'} onclick={() => ((app.settings.playback = 'preview'), save())}>
          🎵 Nell'app <small>anteprima nascosta, consigliato</small>
        </button>
        <button role="radio" aria-checked={app.settings.playback === 'spotify'} onclick={() => ((app.settings.playback = 'spotify'), save())}>
          🎧 App Spotify <small>brano intero, ma il titolo si vede!</small>
        </button>
      </div>
    </div>
    {#if app.settings.playback === 'preview'}
      <div class="opt col">
        <div><strong>Sorgente preferita</strong><small>Se una non funziona si passa all'altra</small></div>
        <div class="seg three" role="radiogroup" aria-label="Sorgente audio">
          {#each [['auto', 'Automatica'], ['deezer', 'Deezer'], ['spotify', 'Spotify']] as [v, l] (v)}
            <button role="radio" aria-checked={app.settings.source === v} onclick={() => ((app.settings.source = v as typeof app.settings.source), save())}>{l}</button>
          {/each}
        </div>
      </div>
    {/if}
    <button class="btn small cyan" disabled={testing} onclick={testAudio}>{testing ? 'Prova in corso…' : '▶ Prova l\'audio'}</button>
  </section>

  <section class="panel">
    <h2>📱 Telefono</h2>
    <div class="opt">
      <div><strong>Vibrazione</strong><small>Feedback quando giri le carte</small></div>
      <Toggle bind:checked={app.settings.haptics} label="Vibrazione" onchange={save} />
    </div>
    <div class="opt">
      <div><strong>Schermo sempre acceso</strong><small>Durante la partita lo schermo non si spegne</small></div>
      <Toggle bind:checked={app.settings.keepAwake} label="Schermo sempre acceso" onchange={save} />
    </div>
    <div class="opt">
      <div><strong>Animazioni ridotte</strong><small>Meno movimento sullo schermo</small></div>
      <Toggle checked={app.settings.motion === 'reduced'} label="Animazioni ridotte" onchange={(v) => ((app.settings.motion = v ? 'reduced' : 'auto'), save())} />
    </div>
  </section>

  <section class="panel">
    <h2>ℹ️ Informazioni</h2>
    <p>
      <b>Sigle in Fila</b> è un gioco privato per famiglia e amici, ispirato ai party game musicali a linea del tempo.
      Contiene {songs.length} sigle curate a mano con l'anno della prima uscita italiana.
    </p>
    <p class="small">
      Audio: anteprime pubbliche di Deezer e Spotify, riprodotte in streaming. Nessun brano è incluso nell'app.
      {isAndroidApp ? 'Versione Android.' : 'Versione web: puoi installarla dal menu del browser ("Aggiungi a schermata Home").'}
    </p>
    <details class="credits small">
      <summary>🎺 Crediti di musica ed effetti sonori</summary>
      <p>Registrazioni vere con licenza libera, accorciate e normalizzate per il gioco:</p>
      <ul>
        <li>
          Musica dei menu: «<a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600006" target="_blank" rel="noopener noreferrer">Happy Happy Game Show</a>» di Kevin MacLeod (incompetech.com), licenza
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
        </li>
        <li>Carte, fiches, monete, clic e jingle: <a href="https://kenney.nl/assets" target="_blank" rel="noopener noreferrer">Kenney</a> (CC0)</li>
        <li>Rullo di tamburi: United States Air Force Band (pubblico dominio)</li>
        <li>Piatto, «pop», applausi e «ooh» del pubblico: aradlaw, cori, starlite su pdsounds.org (pubblico dominio)</li>
        <li>Campana da ring: IOII-IOIO-IIOI su Wikimedia Commons (CC0)</li>
        <li>Fanfara: fvcalderan su <a href="https://opengameart.org/content/classic-fanfare-lick" target="_blank" rel="noopener noreferrer">OpenGameArt</a> (CC0)</li>
        <li>
          «<a href="https://soundbible.com/1830-Sad-Trombone.html" target="_blank" rel="noopener noreferrer">Sad Trombone</a>» di Joe Lamb, licenza
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>
        </li>
      </ul>
    </details>
    {#if !confirmReset}
      <button class="btn small ghost danger" onclick={() => (confirmReset = true)}>🗑️ Cancella tutti i dati</button>
    {:else}
      <div class="confirm">
        <p>Cancello partita salvata, storico e impostazioni?</p>
        <button class="btn small paper" onclick={() => (confirmReset = false)}>Annulla</button>
        <button class="btn small pink" onclick={doReset}>Cancella</button>
      </div>
    {/if}
  </section>
</div>

<style>
  .settings {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 16px 28px;
  }
  .panel {
    width: min(100%, 560px);
    margin: 0 auto;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h2 {
    font-size: 1.4rem;
  }
  .opt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 10px;
    border-top: 2px dashed rgba(23, 12, 55, 0.15);
  }
  .opt.col {
    flex-direction: column;
    align-items: stretch;
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
  .slider {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 900;
  }
  .slider input {
    accent-color: var(--pink);
    height: 30px;
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .seg.three {
    grid-template-columns: repeat(3, 1fr);
  }
  .seg button {
    padding: 10px 8px;
    border: var(--border);
    border-radius: 12px;
    background: #fff;
    font-weight: 900;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .seg button small {
    font-weight: 700;
    font-size: 0.72rem;
    color: var(--ink-soft);
  }
  .seg button[aria-checked='true'] {
    background: var(--yellow);
  }
  p {
    margin: 0;
    font-weight: 600;
  }
  .small {
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .credits summary {
    font-weight: 900;
    cursor: pointer;
    padding: 4px 0;
  }
  .credits ul {
    margin: 6px 0 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .credits a {
    color: inherit;
    font-weight: 800;
  }
  .danger {
    --btn-fg: var(--red);
    border-color: var(--red) !important;
    align-self: flex-start;
  }
  .confirm {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 10px;
    border-radius: 12px;
    background: #ffe3e3;
    border: 2px solid var(--red);
  }
  .confirm p {
    width: 100%;
    font-weight: 800;
  }
</style>
