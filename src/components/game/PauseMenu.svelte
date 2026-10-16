<script lang="ts">
  import { app } from '../../lib/app.svelte';
  import Modal from '../ui/Modal.svelte';
  import Icon from '../ui/Icon.svelte';

  let confirmEnd = $state(false);
  const close = () => (app.menuOpen = false);

  function setVolume(e: Event) {
    app.settings.musicVolume = Number((e.currentTarget as HTMLInputElement).value) / 100;
    app.saveSettings();
  }
</script>

<Modal title="Pausa" onclose={close}>
  <div class="menu">
    <button class="btn wide green" onclick={close}><Icon name="play" /> Riprendi</button>
    {#if app.canUndo}
      <button class="btn wide paper" onclick={() => app.undo()}><Icon name="undo" /> Annulla l'ultima mossa</button>
    {/if}
    <label class="vol">
      <span><Icon name="volume" size={20} /> Volume musica</span>
      <input type="range" min="0" max="100" value={Math.round(app.settings.musicVolume * 100)} oninput={setVolume} />
    </label>
    <div class="row">
      <button class="btn small paper" onclick={() => app.go('rules')}><Icon name="info" size={18} /> Regole</button>
      <button class="btn small paper" onclick={() => app.go('settings')}><Icon name="settings" size={18} /> Impostazioni</button>
    </div>
    <button class="btn wide cyan" onclick={() => { close(); app.go('home'); }}>🏠 Torna al menu (la partita resta salvata)</button>
    {#if !confirmEnd}
      <button class="btn small ghost danger" onclick={() => (confirmEnd = true)}>🏳️ Termina la partita</button>
    {:else}
      <div class="confirm">
        <p>Vuoi davvero terminare? Vince chi ha più carte adesso.</p>
        <div class="row">
          <button class="btn small paper" onclick={() => (confirmEnd = false)}>No</button>
          <button class="btn small pink" onclick={() => app.abandon()}>Sì, termina</button>
        </div>
      </div>
    {/if}
  </div>
</Modal>

<style>
  .menu {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .row {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .vol {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 900;
  }
  .vol span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .vol input {
    width: 100%;
    accent-color: var(--pink);
    height: 32px;
  }
  .danger {
    color: var(--red) !important;
    border-color: var(--red) !important;
    align-self: center;
    --btn-fg: var(--red);
  }
  .confirm {
    padding: 12px;
    border-radius: 14px;
    background: #ffe3e3;
    border: 2px solid var(--red);
    text-align: center;
    font-weight: 800;
  }
  .confirm p {
    margin: 0 0 10px;
  }
</style>
