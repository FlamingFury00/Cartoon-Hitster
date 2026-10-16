// Text normalisation and fuzzy matching helpers used to pair curated songs with
// catalogue entries on Deezer / iTunes / Spotify.

/** Lower-case, strip accents and punctuation, collapse whitespace. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Removes decorations that stores append to titles ("- Sigla", "(Remastered)", ...). */
export function coreTitle(s) {
  return norm(
    String(s ?? '')
      .replace(/\((?:feat|with|con)\.?[^)]*\)/gi, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\((?:sigla|remaster|remastered|versione originale|original version|from|dalla serie|tv version|versione tv)[^)]*\)/gi, ' ')
      .replace(/\s-\s(?:sigla|remaster|remastered|from|dalla|tratto|original|versione originale).*$/i, ' '),
  );
}

function bigrams(s) {
  const t = ` ${s} `;
  const out = new Map();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Sørensen–Dice coefficient on character bigrams (0..1). */
export function dice(a, b) {
  a = norm(a);
  b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let total = 0;
  for (const [g, n] of A) {
    total += n;
    inter += Math.min(n, B.get(g) ?? 0);
  }
  for (const n of B.values()) total += n;
  return (2 * inter) / total;
}

/** Fraction of the expected tokens that appear in the candidate (0..1). */
export function tokenCoverage(expected, candidate) {
  const e = norm(expected).split(' ').filter(Boolean);
  const c = new Set(norm(candidate).split(' ').filter(Boolean));
  if (!e.length) return 0;
  return e.filter((t) => c.has(t)).length / e.length;
}

/** Best-effort title similarity combining bigram and token measures. */
export function titleSim(expected, candidate) {
  const a = coreTitle(expected);
  const b = coreTitle(candidate);
  return Math.max(dice(a, b), 0.92 * Math.min(tokenCoverage(a, b), tokenCoverage(b, a) + 0.25));
}

// Words that identify covers, karaoke tracks, remixes and other non-original versions.
// Matched as whole words on normalised text.
const BAD_VERSION = [
  'karaoke', 'base musicale', 'basi musicali', 'instrumental', 'strumentale', 'remix', 'rmx', 'mix', 'live',
  'dal vivo', 'cover', 'in the style', 'originally performed', 'made famous', 'tribute', 'nuova versione',
  'new version', 'acoustic', 'acustica', 'piano version', 'lullaby', 'medley', 'mashup', 'mash up',
  'radio edit', 'extended', 'club mix', 'dance version', 'versione dance', 'reprise', 'demo', 'reggae',
  'rock version', 'metal version', 'orchestral version', 'sped up', 'slowed', 'unplugged', '8 bit',
  'chiptune', 'trap version', 'versione rock', 'versione piano', 'carillon', 'music box',
];

/** Number of non-original-version markers found in the given strings (0 = looks clean). */
export function versionPenalty(...strings) {
  const s = ' ' + strings.map((x) => norm(x)).join(' ') + ' ';
  let p = 0;
  for (const w of BAD_VERSION) if (s.includes(' ' + norm(w) + ' ')) p += 1;
  return p;
}
