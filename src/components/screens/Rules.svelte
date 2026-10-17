<script lang="ts">
  import { app } from '../../lib/app.svelte';
  import { sfx } from '../../lib/audio/sfx';
  import TopBar from '../ui/TopBar.svelte';
</script>

<TopBar title="Come si gioca" />

<div class="rules scroll">
  <button class="btn green wide learn" onclick={() => (sfx.pop(), app.go('tutorial'))}>🎓 Prova il tutorial interattivo · 2 min</button>

  <article class="panel">
    <h2>🎯 Lo scopo</h2>
    <p>
      Ogni carta nasconde la <b>sigla di un cartone animato</b>. Ascoltala e mettila nel punto giusto della tua
      <b>linea del tempo</b>, in ordine di anno. Il primo che mette in fila <b>10 sigle</b> (o l'obiettivo scelto) vince!
    </p>
  </article>

  <article class="panel">
    <h2>🔁 Un turno</h2>
    <ol>
      <li><b>Pesca la sigla</b>: parte la musica, ma titolo e anno restano nascosti.</li>
      <li><b>Scegli dove va</b>: prima, in mezzo o dopo le carte che hai già. Tocca un <span class="plus">+</span> oppure trascina la carta.</li>
      <li><b>Conferma</b> e gira la carta: compaiono anno, cartone, titolo e interprete.</li>
      <li><b>Giusto?</b> La carta resta nella tua fila. <b>Sbagliato?</b> Viene scartata.</li>
      <li>Si passa il telefono al giocatore successivo.</li>
    </ol>
    <p class="note">Due sigle dello stesso anno possono stare una prima o dopo l'altra: vanno bene entrambe le posizioni.</p>
  </article>

  <article class="panel">
    <h2>🪙 I gettoni</h2>
    <ul>
      <li><b>Guadagni 1 gettone</b> se, dopo aver ascoltato, dici il nome del <b>cartone</b> e dell'<b>interprete</b> (al massimo 5).</li>
      <li><b>Salta (1 🪙)</b>: non ti piace la sigla? Scartala e pescane un'altra.</li>
      <li><b>Sfida (1 🪙)</b>: quando un altro ha scelto la posizione, se pensi che abbia sbagliato indica tu dove va. Se lui sbaglia e tu hai ragione, <b>la carta è tua</b>!</li>
      <li><b>Compra (3 🪙)</b>: la carta finisce direttamente nella tua fila, senza indovinare.</li>
    </ul>
  </article>

  <article class="panel">
    <h2>🎮 Modalità</h2>
    <ul>
      <li><b>Classica</b>: le regole qui sopra.</li>
      <li><b>Esperto</b>: per tenere la carta devi anche dire il nome del cartone.</li>
      <li><b>Squadra</b>: tutti insieme su un'unica linea del tempo. La squadra parte con 5 gettoni: ogni errore ne costa uno, indovinare cartone e interprete ne fa guadagnare uno. Un errore senza gettoni fa perdere la partita.</li>
    </ul>
  </article>

  <article class="panel">
    <h2>📅 Che anno conta?</h2>
    <p>
      L'anno della carta è quello della <b>prima uscita di quella sigla in Italia</b> (prima messa in onda o primo disco).
      Molti cartoni hanno avuto più sigle: ogni sigla ha il suo anno. Per esempio <i>Lady Oscar</i> dei Cavalieri del Re è del 1982,
      mentre <i>Una spada per Lady Oscar</i> di Cristina D'Avena è del 1991.
    </p>
  </article>

  <article class="panel">
    <h2>🎧 L'audio</h2>
    <p>
      Le sigle suonano direttamente nell'app grazie alle anteprime di 30 secondi di <b>Deezer</b> e <b>Spotify</b>:
      non serve nessun account. Dopo aver girato la carta puoi aprire la sigla completa su <b>Spotify</b>.
      Nelle impostazioni puoi anche scegliere di far partire ogni sigla direttamente nell'app Spotify (ma lì il titolo è visibile!).
    </p>
  </article>
</div>

<style>
  .rules {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 16px 28px;
  }
  .learn {
    width: min(100%, 600px);
    margin: 0 auto;
  }
  .panel {
    width: min(100%, 600px);
    margin: 0 auto;
    padding: 14px 16px;
  }
  h2 {
    font-size: 1.4rem;
    margin-bottom: 8px;
  }
  p,
  li {
    font-weight: 600;
    line-height: 1.45;
  }
  p {
    margin: 0;
  }
  ol,
  ul {
    margin: 0;
    padding-left: 1.3em;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .note {
    margin-top: 10px;
    font-size: 0.9rem;
    color: var(--ink-2);
  }
  .plus {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    font-family: var(--font-display);
    line-height: 1;
  }
</style>
