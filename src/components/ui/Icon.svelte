<script lang="ts" module>
  const PATHS = {
    play: 'M8 5.5v13a1 1 0 0 0 1.5.87l10.5-6.5a1 1 0 0 0 0-1.74L9.5 4.63A1 1 0 0 0 8 5.5z',
    pause: 'M7 5h3.2v14H7zM13.8 5H17v14h-3.2z',
    replay: 'M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H4.5A7.5 7.5 0 1 0 12 5z',
    skip: 'M5 6.2v11.6a.9.9 0 0 0 1.4.75L14 13.4v4.4a.9.9 0 0 0 1.4.75l7-5.8a.9.9 0 0 0 0-1.5l-7-5.8a.9.9 0 0 0-1.4.75v4.4L6.4 5.45A.9.9 0 0 0 5 6.2z',
    cart: 'M3 4h2.2l2.3 10.5a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 1.9-1.4L21 8H7.1M10 20.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm9 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
    menu: 'M4 6.5h16M4 12h16M4 17.5h16',
    close: 'M6 6l12 12M18 6L6 18',
    back: 'M15 5l-7 7 7 7',
    settings:
      'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7.4-2.5c.05-.33.1-.66.1-1s-.05-.67-.1-1l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6c-.6.25-1.2.6-1.7 1l-2.5-1-2 3.5L4.4 11c-.05.33-.1.66-.1 1s.05.67.1 1l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.75 1.7 1l.4 2.6h4l.4-2.6c.6-.25 1.2-.6 1.7-1l2.5 1 2-3.5z',
    trophy: 'M7 4h10v4a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5v.5',
    music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    x: 'M6 6l12 12M18 6L6 18',
    plus: 'M12 5v14M5 12h14',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    cards: 'M8 3h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM4 7v12a2 2 0 0 0 2 2h10',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
    volume: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
    external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 24, stroke = 2.6, fill = false }: { name: IconName; size?: number; stroke?: number; fill?: boolean } = $props();
  const filled = $derived(fill || name === 'play' || name === 'pause' || name === 'skip');
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  aria-hidden="true"
  fill={filled ? 'currentColor' : 'none'}
  stroke={filled ? 'none' : 'currentColor'}
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d={PATHS[name]} />
</svg>
