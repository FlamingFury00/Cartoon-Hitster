export const AVATARS = [
  '🐱', '🐶', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐰', '🐻', '🐨', '🐷',
  '🐹', '🐧', '🦄', '🐲', '🦖', '🐙', '🦋', '🐝', '🤖', '👾', '👻', '🧸',
  '🍕', '🍩', '🍦', '🚀', '🛸', '⭐', '🌈', '🎸', '🎤', '👑', '🧙', '🦸',
];

export const PLAYER_COLORS = ['#ff4f9a', '#2bc4ff', '#ffd23f', '#4fd96b', '#a76bff', '#ff8a2b'];

export const MODE_INFO = {
  classic: {
    label: 'Classica',
    emoji: '🎵',
    text: 'Metti la sigla nel punto giusto della tua linea del tempo per tenerla. Il primo che completa la fila vince.',
  },
  pro: {
    label: 'Esperto',
    emoji: '🧠',
    text: 'Come la classica, ma per tenere la carta devi anche dire il nome del cartone animato.',
  },
  coop: {
    label: 'Squadra',
    emoji: '🤝',
    text: 'Tutti insieme su una sola linea del tempo. Ogni errore costa un gettone: finiti i gettoni, si perde!',
  },
} as const;

export const FAME_INFO = {
  3: { label: 'Grandi classici', text: 'Solo le sigle che conoscono tutti' },
  2: { label: 'Classici + famose', text: 'Il mazzo consigliato' },
  1: { label: 'Tutte', text: 'Anche le chicche per veri esperti' },
} as const;
