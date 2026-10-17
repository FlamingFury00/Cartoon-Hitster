<script lang="ts">
  import { sfx } from '../../lib/audio/sfx';
  let { checked = $bindable(false), label, onchange }: { checked: boolean; label: string; onchange?: (v: boolean) => void } = $props();
</script>

<button
  class="toggle"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onclick={() => {
    checked = !checked;
    sfx.tap();
    onchange?.(checked);
  }}
>
  <span class="knob"></span>
</button>

<style>
  .toggle {
    position: relative;
    flex-shrink: 0;
    width: 64px;
    height: 38px;
    border: var(--border);
    border-radius: 999px;
    background: #d8cfe8;
    box-shadow: inset 0 2px 0 rgba(0, 0, 0, 0.12);
    transition: background 0.18s;
  }
  .toggle[aria-checked='true'] {
    background: var(--green);
  }
  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: var(--border);
    background: #fff;
    transition: transform 0.2s var(--ease-back);
  }
  .toggle[aria-checked='true'] .knob {
    transform: translateX(26px);
  }
</style>
