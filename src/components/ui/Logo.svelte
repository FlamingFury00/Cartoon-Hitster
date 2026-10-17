<script lang="ts">
  // "SIGLE in fila": every letter is a little card laid on a timeline.
  let { size = 1 }: { size?: number } = $props();
  const letters = [
    { ch: 'S', c: 'var(--d70)', r: -8 },
    { ch: 'I', c: 'var(--d80)', r: 5 },
    { ch: 'G', c: 'var(--d90)', r: -4 },
    { ch: 'L', c: 'var(--d00)', r: 7 },
    { ch: 'E', c: 'var(--d10)', r: -6 },
  ];
</script>

<div class="logo" style:--k={size} role="img" aria-label="Sigle in Fila">
  <div class="cards">
    {#each letters as l, i (i)}
      <span class="card" style:--c={l.c} style:--r="{l.r}deg" style:--i={i}>{l.ch}</span>
    {/each}
  </div>
  <div class="ribbon"><span>in fila</span></div>
  <div class="line" aria-hidden="true"></div>
</div>

<style>
  .logo {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    font-size: calc(16px * var(--k));
  }
  .cards {
    display: flex;
    gap: 0.35em;
    position: relative;
    z-index: 1;
  }
  .card {
    display: grid;
    place-items: center;
    font-size: 2.4em;
    width: 1.3em;
    height: 1.65em;
    border: calc(3px * var(--k)) solid var(--ink);
    border-radius: 0.25em;
    background:
      radial-gradient(rgba(255, 255, 255, 0.35) 1px, transparent 1.4px) 0 0 / 0.2em 0.2em,
      var(--c);
    box-shadow: 0 0.13em 0 var(--ink);
    font-family: var(--font-display);
    line-height: 1;
    color: var(--paper);
    transform: rotate(var(--r));
    animation: drop 0.7s var(--ease-back) both;
    animation-delay: calc(var(--i) * 0.08s);
    text-shadow:
      0 0.06em 0 var(--ink),
      0.04em 0 0 var(--ink),
      -0.04em 0 0 var(--ink),
      0 -0.04em 0 var(--ink),
      0.04em 0.04em 0 var(--ink),
      -0.04em 0.04em 0 var(--ink),
      0.04em -0.04em 0 var(--ink),
      -0.04em -0.04em 0 var(--ink);
  }
  .ribbon {
    position: relative;
    z-index: 2;
    margin-top: -0.55em;
    padding: 0.1em 1.1em 0.2em;
    background: var(--yellow);
    border: calc(3px * var(--k)) solid var(--ink);
    border-radius: 0.5em;
    box-shadow: 0 0.25em 0 var(--ink);
    transform: rotate(-3deg);
    animation: drop 0.7s var(--ease-back) 0.45s both;
  }
  .ribbon span {
    font-family: var(--font-display);
    font-size: 1.7em;
    color: var(--ink);
    letter-spacing: 0.04em;
  }
  .line {
    position: absolute;
    left: -0.6em;
    right: -0.6em;
    top: 2.1em;
    height: 0.3em;
    background: var(--paper);
    border: calc(2px * var(--k)) solid var(--ink);
    border-radius: 9px;
    z-index: 0;
    opacity: 0.9;
  }
  @keyframes drop {
    from {
      transform: translateY(-1.2em) rotate(0deg) scale(0.6);
      opacity: 0;
    }
  }
</style>
