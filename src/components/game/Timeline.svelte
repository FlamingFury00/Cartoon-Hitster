<script lang="ts" module>
  export interface Marker {
    id: string;
    slot: number;
    avatar: string;
    color: string;
  }
</script>

<script lang="ts">
  // Vertical chronological timeline (oldest on top).
  //  - place:     tap a "+" slot or drag the mystery card to choose a position
  //  - challenge: shows the active choice and the challengers' tokens on free slots
  //  - reveal:    shows the revealed card, and where it should have gone
  //  - view:      read only
  import { flip } from 'svelte/animate';
  import { songsById } from '../../lib/deckdata';
  import TimelineCard from './TimelineCard.svelte';
  import MysteryCard from './MysteryCard.svelte';

  let {
    ids,
    mode = 'view',
    slot = null,
    card,
    markers = [],
    tappable = [],
    validRange,
    revealState,
    owner,
    highlight,
    onSlot,
    scroller,
  }: {
    ids: string[];
    mode?: 'view' | 'place' | 'challenge' | 'reveal';
    slot?: number | null;
    card?: string;
    markers?: Marker[];
    /** Challenge mode: slots that can be tapped. */
    tappable?: number[];
    validRange?: [number, number];
    revealState?: 'right' | 'wrong' | 'stolen' | 'bought';
    /** Avatar/colour of the player who placed the mystery card (challenge mode). */
    owner?: { avatar: string; color: string };
    /** A slot that pulses to draw the eye (the tutorial points at it). */
    highlight?: number;
    onSlot?: (slot: number) => void;
    /** Scrollable ancestor, used for auto-scroll while dragging. */
    scroller?: HTMLElement;
  } = $props();

  type Item = { key: string; kind: 'slot'; slot: number } | { key: string; kind: 'card'; id: string } | { key: string; kind: 'mystery'; slot: number };

  const showSlots = $derived(mode !== 'view');
  const items = $derived.by(() => {
    const out: Item[] = [];
    const n = ids.length;
    for (let i = 0; i <= n; i++) {
      if (slot === i && mode !== 'view') out.push({ key: 'mystery', kind: 'mystery', slot: i });
      else if (showSlots) out.push({ key: `s${i}`, kind: 'slot', slot: i });
      if (i < n) out.push({ key: ids[i], kind: 'card', id: ids[i] });
    }
    return out;
  });

  // ------------------------------------------------------------------ drag & drop
  let root: HTMLElement | undefined = $state();
  let ghost: HTMLElement | undefined = $state();
  let dragging = $state(false);
  let ghostW = $state(0);
  let hover = $state<number | null>(null);
  let press: { x: number; y: number; w: number; h: number; left: number; top: number; pid: number } | null = null;
  let lastY = 0;
  let raf = 0;

  function slotElements(): { slot: number; el: HTMLElement }[] {
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('[data-slot]')).map((el) => ({ slot: Number(el.dataset.slot), el }));
  }

  function nearestSlot(y: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const { slot: s, el } of slotElements()) {
      const r = el.getBoundingClientRect();
      const d = Math.abs(y - (r.top + r.height / 2));
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  function onPointerDown(e: PointerEvent) {
    if (mode !== 'place' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    press = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, left: r.left, top: r.top, pid: e.pointerId };
    el.setPointerCapture?.(e.pointerId);
  }

  function tick() {
    if (!dragging) return;
    const sc = scroller;
    if (sc) {
      const r = sc.getBoundingClientRect();
      const edge = 70;
      let v = 0;
      if (lastY < r.top + edge) v = -Math.ceil(((r.top + edge - lastY) / edge) * 14);
      else if (lastY > r.bottom - edge) v = Math.ceil(((lastY - (r.bottom - edge)) / edge) * 14);
      if (v) {
        sc.scrollTop += v;
        hover = nearestSlot(lastY);
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function onPointerMove(e: PointerEvent) {
    if (!press || e.pointerId !== press.pid) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!dragging && Math.hypot(dx, dy) > 7) {
      ghostW = press.w;
      dragging = true;
      raf = requestAnimationFrame(tick);
    }
    if (!dragging) return;
    e.preventDefault();
    lastY = e.clientY;
    if (ghost) ghost.style.transform = `translate3d(${press.left + dx}px, ${press.top + dy}px, 0) rotate(${Math.max(-6, Math.min(6, dx / 20))}deg)`;
    hover = nearestSlot(e.clientY);
  }

  function endDrag(e: PointerEvent, commit: boolean) {
    if (!press || e.pointerId !== press.pid) return;
    const wasDragging = dragging;
    press = null;
    dragging = false;
    cancelAnimationFrame(raf);
    if (wasDragging && commit && hover != null) onSlot?.(hover);
    hover = null;
  }

  $effect(() => {
    // Position the ghost as soon as it is mounted.
    if (dragging && ghost && press) ghost.style.transform = `translate3d(${press.left}px, ${press.top}px, 0)`;
  });

  function slotClass(s: number): string {
    const c: string[] = [];
    if (mode === 'place') c.push('open');
    if (mode === 'challenge' && tappable.includes(s)) c.push('open', 'challenge');
    if (hover === s) c.push('hover');
    if (highlight === s) c.push('spot');
    if (mode === 'reveal' && validRange && revealState === 'wrong' && s >= validRange[0] && s <= validRange[1]) c.push('valid');
    if (mode === 'reveal' && validRange && revealState === 'stolen' && s >= validRange[0] && s <= validRange[1]) c.push('valid');
    return c.join(' ');
  }

  const markerAt = (s: number) => markers.filter((m) => m.slot === s);
</script>

<div class="timeline" class:dragging bind:this={root}>
  <div class="edge top">▲ più vecchie</div>

  {#if mode === 'place' && slot == null}
    <div class="dock">
      <div
        class="drag"
        role="button"
        tabindex="0"
        aria-label="Carta misteriosa: trascinala nella tua linea del tempo oppure tocca un +"
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={(e) => endDrag(e, true)}
        onpointercancel={(e) => endDrag(e, false)}
        style:opacity={dragging ? 0.35 : 1}
      >
        <MysteryCard hint="Trascinami nella fila o tocca un +" />
      </div>
    </div>
  {/if}

  <ol class="list">
    {#each items as it (it.key)}
      <li animate:flip={{ duration: 260 }} class="item item-{it.kind}">
        {#if it.kind === 'card'}
          {@const s = songsById.get(it.id)}
          {#if s}<TimelineCard song={s} />{/if}
        {:else if it.kind === 'mystery'}
          {#if mode === 'reveal' && card && songsById.get(card)}
            <div data-slot={it.slot}>
              <TimelineCard song={songsById.get(card)!} state={revealState === 'right' || revealState === 'bought' ? 'right' : revealState === 'stolen' ? 'stolen' : 'wrong'} />
            </div>
          {:else}
            <div
              class="drag placed"
              data-slot={it.slot}
              role="button"
              tabindex="0"
              aria-label="Carta misteriosa posizionata. Trascinala per spostarla."
              onpointerdown={onPointerDown}
              onpointermove={onPointerMove}
              onpointerup={(e) => endDrag(e, true)}
              onpointercancel={(e) => endDrag(e, false)}
              style:opacity={dragging ? 0.35 : 1}
            >
              <MysteryCard compact badge={owner} />
            </div>
          {/if}
        {:else}
          {@const ms = markerAt(it.slot)}
          <button
            class="slot {slotClass(it.slot)}"
            data-slot={it.slot}
            disabled={!(mode === 'place' || (mode === 'challenge' && tappable.includes(it.slot)))}
            aria-label="Metti la carta in questa posizione"
            onclick={() => onSlot?.(it.slot)}
          >
            {#if ms.length}
              <span class="markers">
                {#each ms as m (m.id)}
                  <span class="marker" style:--mc={m.color}>{m.avatar}<b>🪙</b></span>
                {/each}
              </span>
            {:else if mode === 'reveal'}
              {#if slotClass(it.slot).includes('valid')}<span class="ok">✓ andava qui</span>{/if}
            {:else if mode === 'place' || tappable.includes(it.slot)}
              <span class="plus">+</span>
            {/if}
          </button>
        {/if}
      </li>
    {/each}
  </ol>

  <div class="edge bottom">▼ più recenti</div>
</div>

{#if dragging}
  <div class="ghost" bind:this={ghost} aria-hidden="true" style:width="{ghostW}px">
    <MysteryCard compact />
  </div>
{/if}

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 2px 16px;
  }
  .edge {
    text-align: center;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.55;
  }
  .dock {
    padding: 2px 0 8px;
  }
  .drag {
    touch-action: none;
    cursor: grab;
  }
  .dragging .drag {
    cursor: grabbing;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .slot {
    display: grid;
    place-items: center;
    width: 100%;
    height: 30px;
    border-radius: 12px;
    border: 2px dashed transparent;
    color: var(--paper);
    transition:
      height 0.18s var(--ease-out),
      background 0.15s,
      border-color 0.15s;
  }
  .slot.open {
    border-color: rgba(255, 255, 255, 0.35);
    background: rgba(255, 255, 255, 0.06);
  }
  .slot.open:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .slot.challenge {
    border-color: var(--purple);
    background: rgba(167, 107, 255, 0.18);
  }
  .slot.hover {
    height: 58px;
    border-color: var(--yellow);
    background: rgba(255, 210, 63, 0.22);
  }
  .slot.spot {
    border-color: var(--yellow);
    background: rgba(255, 210, 63, 0.18);
    animation: spot 1.1s ease-in-out infinite;
  }
  .slot.spot .plus {
    background: var(--yellow);
  }
  @keyframes spot {
    50% {
      box-shadow: 0 0 0 6px rgba(255, 210, 63, 0.35);
    }
  }
  .slot.valid {
    height: 40px;
    border-color: var(--green);
    background: rgba(79, 217, 107, 0.2);
  }
  .slot:disabled {
    cursor: default;
  }
  .slot:not(.open):not(.valid):not(:has(.markers)) {
    height: 8px;
  }
  .plus {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 1.2rem;
    line-height: 1;
    border: 2px solid var(--ink);
  }
  .slot.hover .plus {
    background: var(--yellow);
    transform: scale(1.25);
  }
  .ok {
    font-weight: 900;
    color: var(--green);
    font-size: 0.9rem;
  }
  .markers {
    display: flex;
    gap: 6px;
  }
  .marker {
    position: relative;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: var(--border);
    background: var(--mc);
    font-size: 1.15rem;
    animation: pop-in 0.3s var(--ease-back);
  }
  .marker b {
    position: absolute;
    right: -8px;
    bottom: -6px;
    font-size: 0.8rem;
  }
  .ghost {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 50;
    pointer-events: none;
    filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.45));
    will-change: transform;
  }
</style>
