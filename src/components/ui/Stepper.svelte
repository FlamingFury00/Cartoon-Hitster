<script lang="ts">
  import { sfx } from '../../lib/audio/sfx';
  let { value = $bindable(0), min = 0, max = 10, label }: { value: number; min?: number; max?: number; label: string } = $props();
  function step(d: number) {
    const v = Math.min(max, Math.max(min, value + d));
    if (v !== value) {
      value = v;
      sfx.tap();
    }
  }
</script>

<div class="stepper" role="group" aria-label={label}>
  <button aria-label="Meno" disabled={value <= min} onclick={() => step(-1)}>−</button>
  <output aria-live="polite">{value}</output>
  <button aria-label="Più" disabled={value >= max} onclick={() => step(1)}>+</button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    border: var(--border);
    border-radius: 14px;
    background: #fff;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    flex-shrink: 0;
  }
  button {
    width: 44px;
    height: 44px;
    font-family: var(--font-display);
    font-size: 1.6rem;
    color: var(--ink);
    background: var(--paper-2);
  }
  button:disabled {
    opacity: 0.3;
  }
  button:active:not(:disabled) {
    background: var(--yellow);
  }
  output {
    min-width: 44px;
    text-align: center;
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--ink);
  }
</style>
