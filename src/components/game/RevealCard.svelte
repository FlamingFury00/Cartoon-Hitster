<script lang="ts" module>
  export type Verdict = 'right' | 'wrong' | 'stolen' | 'bought';
</script>

<script lang="ts">
  // The card of a reveal (the game's and the tutorial's): it shakes under a drum roll, turns
  // on a cymbal crash and gets stamped with the verdict. A tap turns it at once.
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import { app } from '../../lib/app.svelte';
  import { sfx, type Roll } from '../../lib/audio/sfx';
  import type { Song } from '../../lib/game/types';
  import { prefersReducedMotion } from '../../lib/platform';
  import BigCard from './BigCard.svelte';

  let { song, verdict, onlanded }: { song: Song; verdict: Verdict; onlanded?: () => void } = $props();

  const STAMP: Record<Verdict, string> = { right: 'GIUSTO!', wrong: 'SBAGLIATO!', stolen: 'RUBATA!', bought: 'COMPRATA!' };

  let flipped = $state(false);
  let landed = $state(false);
  /** After the slam, the stamp moves to the corner so year and title stay readable. */
  let settled = $state(false);
  let tension = $state(false);
  const timers: ReturnType<typeof setTimeout>[] = [];
  let roll: Roll | null = null;

  const calm = () => prefersReducedMotion() || app.settings.motion === 'reduced';
  // A bought card and the calm reveal skip the show.
  const dramatic = () => !calm() && verdict !== 'bought';

  function land() {
    if (flipped) return; // a second tap while the card turns
    flipped = true;
    tension = false;
    // The drum roll ends on a cymbal crash as the card turns; a card tapped before the roll
    // started (or with the roll not ready yet) still gets its crash.
    if (roll) roll.end(true);
    else if (dramatic()) sfx.crash();
    roll = null;
    timers.push(
      setTimeout(() => {
        landed = true;
        onlanded?.();
        if (calm()) settled = true;
        else timers.push(setTimeout(() => (settled = true), 1300));
      }, 420),
    );
  }

  onMount(() => {
    if (!dramatic()) {
      timers.push(setTimeout(land, verdict === 'bought' ? 300 : 50));
    } else {
      timers.push(
        setTimeout(() => {
          if (flipped) return; // already revealed with a tap
          tension = true;
          roll = sfx.drumroll();
        }, 380),
      );
      timers.push(setTimeout(land, 1450));
    }
    return () => {
      timers.forEach(clearTimeout);
      roll?.end(false);
    };
  });
</script>

<button class="cardbtn" class:tension aria-label={landed ? 'Carta rivelata' : 'Rivela subito'} onclick={land} in:scale={{ duration: 350, start: 0.6 }}>
  <BigCard {song} {flipped} />
  {#if landed}
    <div class="stamp {verdict}" class:settled in:scale={{ duration: calm() ? 0 : 420, start: 2.6 }}>{STAMP[verdict]}</div>
  {/if}
</button>

<style>
  .cardbtn {
    position: relative;
    margin-top: 4px;
  }
  .cardbtn.tension {
    animation: shake 0.28s linear infinite;
  }
  .stamp {
    position: absolute;
    left: 50%;
    top: 63%;
    transform: translate(-50%, -50%) rotate(-14deg);
    padding: 6px 18px 4px;
    border: 5px solid currentColor;
    border-radius: 14px;
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 9vw, 2.6rem);
    letter-spacing: 0.04em;
    background: rgba(255, 248, 234, 0.92);
    box-shadow: 0 6px 0 var(--ink);
    white-space: nowrap;
    pointer-events: none;
    transition:
      top 0.5s var(--ease-back),
      left 0.5s var(--ease-back),
      transform 0.5s var(--ease-back);
  }
  .stamp.settled {
    top: 8%;
    left: 74%;
    transform: translate(-50%, -50%) rotate(10deg) scale(0.5);
  }
  .stamp.right {
    color: #15a33a;
  }
  .stamp.wrong {
    color: #e0213a;
  }
  .stamp.stolen {
    color: #7a3df0;
  }
  .stamp.bought {
    color: #c98a00;
  }
</style>
