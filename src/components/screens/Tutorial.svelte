<script lang="ts">
  // Interactive tutorial: a short scripted game against Bruno that teaches by doing. You listen
  // to real themes, place cards on your timeline (helped, then alone), turn them over, win a
  // bonus token and challenge Bruno to steal his card. It runs on its own state with the real
  // components, songs and sounds, so it never touches the saved game or the history.
  import { onDestroy, onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { app } from '../../lib/app.svelte';
  import { player, type PlaybackState } from '../../lib/audio/player';
  import { sfx } from '../../lib/audio/sfx';
  import { song } from '../../lib/deckdata';
  import { describeSlot, insertSorted, validSlotRange } from '../../lib/game/timeline';
  import { haptics } from '../../lib/platform';
  import { BRUNO, TUTORIAL as T, YOU, rightSlot } from '../../lib/tutorial';
  import Cassette from '../game/Cassette.svelte';
  import RevealCard, { type Verdict } from '../game/RevealCard.svelte';
  import Timeline, { type Marker } from '../game/Timeline.svelte';
  import TimelineCard from '../game/TimelineCard.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import Mascot from '../ui/Mascot.svelte';
  import TopBar from '../ui/TopBar.svelte';

  type Step = 'welcome' | 'timeline' | 'draw1' | 'place1' | 'reveal1' | 'draw2' | 'place2' | 'reveal2' | 'bonus' | 'rival' | 'reveal3' | 'finish';
  const CHAPTER: Record<Step, number> = {
    welcome: 0,
    timeline: 0,
    draw1: 1,
    place1: 1,
    reveal1: 1,
    draw2: 2,
    place2: 2,
    reveal2: 2,
    bonus: 3,
    rival: 4,
    reveal3: 4,
    finish: 5,
  };
  const CHAPTERS = ['La fila', 'Ascolta', 'Da solo', 'Gettoni', 'Sfida', 'Fine'];

  const yearOf = (id: string) => song(id).year;
  const first = song(T.first);
  const second = song(T.second);
  const stolen = song(T.steal);
  /** Where the guided card goes (above the first card). */
  const guided = validSlotRange([T.start], first.year, yearOf)[0];

  let step = $state<Step>('welcome');
  let mine = $state<string[]>([T.start]);
  let slot = $state<number | null>(null);
  let tokens = $state(2);
  let landed = $state(false);
  let secondRight = $state(false);
  let guess = $state({ cartoon: false, performer: false });
  let earned = $state(false);
  let challenging = $state(false);
  let challengeSlot = $state<number | null>(null);
  let stole = $state(false);
  let nudge = $state(0);
  let audioFailed = $state(false);
  let confetti = $state(0);
  let pstate = $state<PlaybackState>(player.state);
  let stage: HTMLElement | undefined = $state();

  onMount(() => player.onChange((s) => (pstate = s)));
  onDestroy(() => player.stop());

  const listening = $derived(step === 'place1' || step === 'place2' || step === 'rival');
  const rivalFree = $derived([0, 1, 2].filter((s) => s !== T.rivalSlot));
  const markers = $derived<Marker[]>(challengeSlot == null ? [] : [{ id: 'you', slot: challengeSlot, ...YOU }]);
  const rivalVerdict = $derived<Verdict>(stole ? 'stolen' : 'wrong');

  function goTo(next: Step) {
    step = next;
    landed = false;
    stage?.scrollTo({ top: 0 });
  }

  function listen(id: string) {
    player.unlock();
    audioFailed = false;
    player.play(song(id)).catch(() => (audioFailed = true));
  }

  function draw(id: string, next: Step) {
    sfx.draw();
    haptics.tap();
    slot = null;
    listen(id);
    goTo(next);
  }

  function onSlot(s: number) {
    if (step === 'place1' && s !== guided) {
      nudge++; // the hint wiggles: the guided card goes above
      sfx.tap();
      return;
    }
    if ((step === 'place1' || step === 'place2') && slot !== s) {
      slot = s;
      sfx.place();
      haptics.place();
    } else if (step === 'rival' && challenging) {
      challengeSlot = s;
      challenging = false;
      tokens--;
      sfx.chip();
      haptics.coin();
    }
  }

  function confirm() {
    if (slot == null) return;
    if (step === 'place1') goTo('reveal1');
    else {
      secondRight = rightSlot(mine, T.second, slot, yearOf);
      goTo('reveal2');
    }
  }

  function onlanded(verdict: Verdict) {
    landed = true;
    if (verdict === 'wrong') {
      sfx.wrong();
      haptics.wrong();
      return;
    }
    if (verdict === 'stolen') sfx.steal();
    else sfx.correct();
    haptics.correct();
    confetti++;
  }

  function toggle(k: 'cartoon' | 'performer') {
    guess[k] = !guess[k];
    sfx.tap();
    if (guess.cartoon && guess.performer && !earned) {
      earned = true;
      tokens++;
      sfx.coin();
      haptics.coin();
    }
  }

  function startRival() {
    sfx.draw();
    listen(T.steal);
    goTo('rival');
  }

  function challenge() {
    challenging = true;
    sfx.challenge();
    haptics.tap();
  }

  function turnRival() {
    if (challengeSlot == null) return;
    stole = rightSlot(T.rival, T.steal, challengeSlot, yearOf);
    goTo('reveal3');
  }

  function done(next: 'setup' | 'home') {
    app.settings.tutorialDone = true;
    app.saveSettings();
    if (next === 'setup') sfx.pop();
    app.go(next);
  }
</script>

<TopBar title="Impara a giocare">
  {#snippet right()}
    {#if step !== 'finish'}
      <button class="skip" onclick={() => done('home')}>Salta</button>
    {/if}
  {/snippet}
</TopBar>

<Confetti fire={confetti} />

<div class="tutorial">
  <ol class="chapters" aria-label="Avanzamento del tutorial">
    {#each CHAPTERS as c, i (c)}
      <li class:done={i < CHAPTER[step]} class:now={i === CHAPTER[step]} aria-current={i === CHAPTER[step] ? 'step' : undefined}>
        <span class="visually-hidden">{c}</span>
      </li>
    {/each}
  </ol>

  {#key step + landed + nudge + challenging + earned + (challengeSlot ?? '')}
    <section class="guide" in:fly={{ y: -12, duration: 260 }} aria-live="polite">
      <div class="mascot"><Mascot /></div>
      <div class="say">
        {#if step === 'welcome'}
          <p><b>Ciao! Sono Nastrina</b>, la cassetta delle sigle.</p>
          <p>Ti insegno a giocare in due minuti, giocando davvero. Alza il volume: si ascoltano le sigle dei cartoni!</p>
        {:else if step === 'timeline'}
          <p>Questa è la tua <b>fila</b>. Ogni carta è una sigla, con l'<b>anno</b> in cui è arrivata in Italia.</p>
          <p>Le carte stanno in ordine: <b>in alto le più vecchie</b>, in basso le più recenti. Per ora hai solo <b>Occhi di gatto</b>, del 1985.</p>
        {:else if step === 'draw1'}
          <p>A ogni turno peschi una <b>sigla misteriosa</b>: la ascolti, ma titolo e anno restano nascosti. Prova!</p>
        {:else if step === 'place1'}
          {#if slot == null}
            <p>
              La riconosci? È <b>«{first.title}»</b>, la sigla di Goldrake: un cartone di fine anni '70, quindi più vecchio di Occhi di gatto.
            </p>
            <p class:wiggle={nudge > 0}>Mettila <b>sopra</b>: tocca il <b>+ in alto</b> o trascina la carta.</p>
          {:else}
            <p><b>Perfetto!</b> Quando sei convinto, premi <b>Conferma</b> e la carta si gira.</p>
          {/if}
        {:else if step === 'reveal1'}
          {#if landed}
            <p><b>Giusto!</b> «{first.title}» è del {first.year}: la carta resta nella tua fila. Ora le carte sono due.</p>
          {:else}
            <p>Rullo di tamburi…</p>
          {/if}
        {:else if step === 'draw2'}
          <p>Adesso tocca a te, <b>senza aiutini</b>! Pesca la prossima sigla.</p>
        {:else if step === 'place2'}
          {#if slot == null}
            <p>
              Ora i posti sono tre: <b>prima del {first.year}</b>, <b>tra il {first.year} e il 1985</b> o <b>dopo il 1985</b>. Dove la metti?
            </p>
          {:else}
            <p>La metti <b>{describeSlot(mine, slot, yearOf)}</b>. Puoi ancora cambiare idea, poi premi <b>Conferma</b>.</p>
          {/if}
        {:else if step === 'reveal2'}
          {#if !landed}
            <p>Vediamo un po'…</p>
          {:else if secondRight}
            <p><b>Bravissimo!</b> Era «{second.title}», del {second.year}: proprio in mezzo. Hai già tre carte!</p>
          {:else}
            <p>
              <b>Peccato!</b> Era «{second.title}», del {second.year}: andava <b>tra il {first.year} e il 1985</b>. Quando sbagli, la carta
              viene scartata. Capita a tutti!
            </p>
          {/if}
        {:else if step === 'bonus'}
          {#if !earned}
            <p>
              <b>Bonus!</b> Se mentre ascolti dici anche il <b>cartone</b> e <b>chi canta</b>, vinci un gettone 🪙. Era «{second.title}» dei
              {second.cartoon}, cantata da {second.performer}.
            </p>
            <p>Facciamo finta che tu li abbia indovinati: tocca <b>tutti e due</b>!</p>
          {:else}
            <p><b>+1 gettone!</b> I gettoni servono a <b>saltare</b> una sigla (1), a <b>comprare</b> una carta (3) e soprattutto a <b>sfidare</b> gli altri (1).</p>
          {/if}
        {:else if step === 'rival'}
          {#if challengeSlot != null}
            <p>Ora si gira la carta: se Bruno ha sbagliato e <b>tu hai ragione</b>, la carta è tua!</p>
          {:else if challenging}
            <p><b>Tocca il posto</b> dove secondo te va davvero.</p>
          {:else}
            <p>
              Ora è il turno di <b>{BRUNO.name}</b> {BRUNO.avatar}. Ha ascoltato la sigla e l'ha messa <b>dopo il 1999</b>. Sarà giusto? Ascolta anche
              tu…
            </p>
            <p>Se pensi che abbia sbagliato, <b>sfidalo</b> con un gettone!</p>
          {/if}
        {:else if step === 'reveal3'}
          {#if !landed}
            <p>Chi avrà ragione?</p>
          {:else if stole}
            <p><b>Rubata!</b> Era «{stolen.title}», del {stolen.year}: Bruno ha sbagliato e tu avevi ragione, quindi la carta va nella <b>tua</b> fila!</p>
          {:else}
            <p>
              Era «{stolen.title}», del {stolen.year}: andava tra il 1987 e il 1999. Avete sbagliato tutti e due: la carta viene scartata e il
              tuo gettone è perso.
            </p>
          {/if}
        {:else}
          <p><b>Ecco fatto!</b> Vince chi mette in fila per primo <b>10 carte</b> (prima della partita puoi scegliere un altro traguardo).</p>
          <p>Si può giocare anche in <b>Squadra</b>, tutti insieme contro il mazzo, o in modalità <b>Esperto</b>, per chi i cartoni li sa a memoria.</p>
        {/if}
        {#if audioFailed && listening}
          <p class="warn">Non riesco a far partire la musica (connessione?). Nessun problema: continua lo stesso!</p>
        {/if}
      </div>
    </section>
  {/key}

  <div class="stage scroll" bind:this={stage}>
    {#if listening}
      <div class="deck">
        <div class="tape"><Cassette side={step === 'rival' ? 'B' : 'A'} /></div>
        <div class="transport">
          <button class="icon-btn big" aria-label={pstate === 'playing' ? 'Pausa' : 'Riproduci'} disabled={pstate === 'loading'} onclick={() => player.toggle()}>
            <Icon name={pstate === 'playing' ? 'pause' : 'play'} size={28} />
          </button>
          <button class="icon-btn" aria-label="Ricomincia la sigla" disabled={pstate === 'loading'} onclick={() => player.restart()}>
            <Icon name="replay" />
          </button>
        </div>
      </div>
    {/if}

    {#if step === 'welcome'}
      <div class="hello" in:scale={{ duration: 400, start: 0.6 }}><Mascot size={170} /></div>
    {:else if step === 'reveal1' || step === 'reveal2'}
      {@const id = step === 'reveal1' ? T.first : T.second}
      {@const verdict = step === 'reveal1' || secondRight ? 'right' : 'wrong'}
      <div class="reveal"><RevealCard song={song(id)} {verdict} onlanded={() => onlanded(verdict)} /></div>
      {#if landed}
        <h2 class="label" in:fly={{ y: 16 }}>La tua fila</h2>
        <Timeline ids={mine} mode="reveal" {slot} card={id} revealState={verdict} validRange={validSlotRange(mine, yearOf(id), yearOf)} />
      {/if}
    {:else if step === 'reveal3'}
      <div class="reveal"><RevealCard song={stolen} verdict={rivalVerdict} onlanded={() => onlanded(rivalVerdict)} /></div>
      {#if landed}
        <h2 class="label" in:fly={{ y: 16 }}>La fila di {BRUNO.name} {BRUNO.avatar}</h2>
        <Timeline
          ids={[...T.rival]}
          mode="reveal"
          slot={T.rivalSlot}
          card={T.steal}
          {markers}
          revealState={rivalVerdict}
          validRange={validSlotRange(T.rival, stolen.year, yearOf)}
        />
      {/if}
    {:else if step === 'rival'}
      <h2 class="label">La fila di {BRUNO.name} {BRUNO.avatar}</h2>
      <Timeline
        ids={[...T.rival]}
        mode="challenge"
        slot={T.rivalSlot}
        card={T.steal}
        {markers}
        tappable={challenging ? rivalFree : []}
        owner={BRUNO}
        {onSlot}
        scroller={stage}
      />
    {:else if step === 'bonus'}
      <div class="bonus">
        <div class="card"><TimelineCard song={second} /></div>
        <div class="chips">
          <button class="chip big" aria-pressed={guess.cartoon} onclick={() => toggle('cartoon')}>🎬 Cartone {guess.cartoon ? '✓' : ''}</button>
          <button class="chip big" aria-pressed={guess.performer} onclick={() => toggle('performer')}>🎤 Interprete {guess.performer ? '✓' : ''}</button>
        </div>
        <p class="purse" aria-label="{tokens} gettoni">{#each { length: tokens } as _, i (i)}<span in:scale={{ start: 2 }}>🪙</span>{/each}</p>
      </div>
    {:else}
      <h2 class="label">La tua fila {step === 'finish' ? `· ${mine.length} carte · 🪙 ${tokens}` : ''}</h2>
      <Timeline
        ids={mine}
        mode={step === 'place1' || step === 'place2' ? 'place' : 'view'}
        {slot}
        highlight={step === 'place1' && slot == null ? guided : undefined}
        {onSlot}
        scroller={stage}
      />
    {/if}
  </div>

  <footer class="bar">
    {#if step === 'welcome'}
      <button class="btn big wide" onclick={() => (sfx.pop(), goTo('timeline'))}>Iniziamo!</button>
    {:else if step === 'timeline'}
      <button class="btn big wide" onclick={() => (sfx.tap(), goTo('draw1'))}>Ho capito</button>
    {:else if step === 'draw1'}
      <button class="btn big wide" onclick={() => draw(T.first, 'place1')}><Icon name="music" /> Pesca la sigla</button>
    {:else if step === 'draw2'}
      <button class="btn big wide" onclick={() => draw(T.second, 'place2')}><Icon name="music" /> Pesca la sigla</button>
    {:else if step === 'place1' || step === 'place2'}
      <button class="btn big wide pink" disabled={slot == null} onclick={confirm}><Icon name="check" /> Conferma</button>
    {:else if step === 'reveal1'}
      <button class="btn big wide green" disabled={!landed} onclick={() => ((mine = insertSorted(mine, T.first, yearOf)), player.stop(), goTo('draw2'))}>Avanti</button>
    {:else if step === 'reveal2'}
      <button class="btn big wide green" disabled={!landed} onclick={() => (secondRight && (mine = insertSorted(mine, T.second, yearOf)), goTo('bonus'))}>
        Avanti
      </button>
    {:else if step === 'bonus'}
      <button class="btn big wide green" disabled={!earned} onclick={startRival}>Avanti</button>
    {:else if step === 'rival'}
      {#if challengeSlot != null}
        <button class="btn big wide green" in:fly={{ y: 20 }} onclick={turnRival}>🃏 Gira la carta!</button>
      {:else}
        <button class="btn big wide purple" disabled={challenging} onclick={challenge}>🥊 Sfida {BRUNO.name} · 1 🪙</button>
      {/if}
    {:else if step === 'reveal3'}
      <button class="btn big wide green" disabled={!landed} onclick={() => (stole && (mine = insertSorted(mine, T.steal, yearOf)), player.stop(), goTo('finish'))}>
        Avanti
      </button>
    {:else}
      <button class="btn big wide pink" onclick={() => done('setup')}>🎉 Gioca una partita</button>
      <button class="btn small ghost" onclick={() => done('home')}>Torna al menu</button>
    {/if}
  </footer>
</div>

<style>
  .tutorial {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    width: min(100%, 620px);
    margin: 0 auto;
  }
  .skip {
    font-weight: 900;
    padding: 8px 4px;
    color: var(--paper);
    opacity: 0.85;
  }
  .chapters {
    list-style: none;
    display: flex;
    justify-content: center;
    gap: 6px;
    margin: 0 0 10px;
    padding: 0;
  }
  .chapters li {
    width: 26px;
    height: 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.2);
    transition: background 0.3s;
  }
  .chapters li.done {
    background: var(--green);
  }
  .chapters li.now {
    background: var(--yellow);
  }
  .guide {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin: 0 14px 8px;
    padding: 12px 14px;
    background: var(--paper);
    color: var(--ink);
    border: var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .mascot {
    flex: 0 0 auto;
    margin-top: 2px;
    animation: float 2.4s ease-in-out infinite;
  }
  .say {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 700;
    line-height: 1.35;
  }
  .say p {
    margin: 0;
  }
  .say b {
    font-weight: 900;
  }
  .wiggle {
    animation: wiggle 0.5s ease-in-out 2;
  }
  .warn {
    color: #b3261e;
    font-size: 0.9rem;
  }
  .stage {
    flex: 1;
    min-height: 0;
    padding: 4px 14px 10px;
    display: flex;
    flex-direction: column;
  }
  .deck {
    display: grid;
    grid-template-columns: minmax(140px, 210px) auto;
    justify-content: center;
    align-items: center;
    gap: 14px;
    margin-bottom: 6px;
  }
  .transport {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .icon-btn.big {
    width: 62px;
    height: 62px;
    border-radius: 50%;
    background: var(--yellow);
  }
  .icon-btn:disabled {
    opacity: 0.5;
  }
  .label {
    font-size: 1.2rem;
    margin: 6px 2px 4px;
  }
  .hello {
    margin: auto;
    animation: float 2.4s ease-in-out infinite;
  }
  .reveal {
    display: flex;
    justify-content: center;
    margin-bottom: 8px;
  }
  .bonus {
    margin: auto 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }
  .card {
    width: 100%;
  }
  .chips {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .chip.big {
    min-height: 54px;
    padding: 0 18px;
    font-size: 1.08rem;
  }
  .chip.big[aria-pressed='true'] {
    background: var(--green);
  }
  .purse {
    margin: 0;
    font-size: 2.2rem;
    letter-spacing: 4px;
  }
  .purse span {
    display: inline-block;
  }
  .bar {
    padding: 10px 14px calc(12px + var(--safe-bottom, 0px));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
</style>
