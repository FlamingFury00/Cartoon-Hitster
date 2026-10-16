import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import deck from '../../src/data/deck.json' with { type: 'json' };
import { DEFAULT_SETTINGS, newGame } from '../../src/lib/game/engine';
import { insertSorted, validSlotRange } from '../../src/lib/game/timeline';
import type { GameState, Song } from '../../src/lib/game/types';

const songs = deck.songs as Song[];
const byId = new Map(songs.map((s) => [s.id, s]));
const yearOf = (id: string) => byId.get(id)!.year;
const tone = readFileSync(new URL('./fixtures/tone.mp3', import.meta.url));

/** Every music request is answered locally: the tests never touch Deezer, Spotify or Apple. */
async function mockMusic(page: Page) {
  await page.route('https://api.deezer.com/**', async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop();
    const exp = Math.floor(Date.now() / 1000) + 900;
    const body = JSON.stringify({ id: Number(id), readable: true, preview: `https://cdnt-preview.dzcdn.net/api/1/1/test/${id}.mp3?hdnea=exp=${exp}~acl=x` });
    const cb = url.searchParams.get('callback');
    await route.fulfill({ contentType: 'application/javascript', body: cb ? `${cb}(${body})` : body });
  });
  const audio = { contentType: 'audio/mpeg', body: tone, headers: { 'access-control-allow-origin': '*' } };
  await page.route(/dzcdn\.net|p\.scdn\.co|audio-ssl\.itunes\.apple\.com/, (route) => route.fulfill(audio));
  await page.route('https://itunes.apple.com/**', (route) => route.fulfill({ status: 404, body: '' }));
}

async function seed(page: Page, game: GameState | null, settings: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([g, s]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      if (g) localStorage.setItem('sif.game.v1', JSON.stringify(g));
      localStorage.setItem('sif.settings.v1', JSON.stringify({ seenRules: true, ...s }));
    },
    [game, settings] as const,
  );
}

/** A two-player game where Anna needs one more right card to win. */
function almostWonGame(): { game: GameState; slot: number } {
  const game = newGame({
    players: [
      { name: 'Anna', avatar: '🐱', color: '#ff4f9a' },
      { name: 'Bruno', avatar: '🐶', color: '#2bc4ff' },
    ],
    settings: { ...DEFAULT_SETTINGS, target: 5, tokens: false, minFame: 1 },
    songs,
    seed: 20251016,
  });
  for (let i = 0; i < 3; i++) {
    const id = game.deck.shift()!;
    game.players[0].timeline = insertSorted(game.players[0].timeline, id, yearOf);
  }
  const next = game.deck[game.deck.length - 1];
  const [slot] = validSlotRange(game.players[0].timeline, yearOf(next), yearOf);
  return { game, slot };
}

test.beforeEach(async ({ page }) => {
  await mockMusic(page);
});

test('a new game: setup, listen, place, reveal, next turn', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Nuova partita/ })).toBeVisible();
  await page.getByRole('button', { name: /Nuova partita/ }).click();

  await page.getByLabel('Nome del giocatore 1').fill('Anna');
  await page.getByLabel('Nome del giocatore 2').fill('Bruno');
  await page.getByRole('button', { name: /Si comincia/ }).click();

  await expect(page.getByRole('heading', { name: 'Anna!' })).toBeVisible();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();

  // The hidden preview starts playing: the transport shows the pause button.
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
  // Nothing on screen may reveal the song while it plays.
  const firstCard = await page.evaluate(() => JSON.parse(localStorage.getItem('sif.game.v1')!).phase.card as string);
  const song = byId.get(firstCard)!;
  await expect(page.getByText(song.title, { exact: true })).toHaveCount(0);

  const slots = page.getByRole('button', { name: 'Metti la carta in questa posizione' });
  await expect(slots).toHaveCount(2);
  await slots.first().click();
  await page.getByRole('button', { name: /Conferma/ }).click();

  // Bruno has tokens and may challenge: skip the challenge window.
  await page.getByRole('button', { name: /Gira la carta/ }).click();
  await expect(page.getByText(String(song.year)).first()).toBeVisible();
  await page.getByRole('button', { name: /Avanti/ }).click();

  await expect(page.getByRole('heading', { name: 'Bruno!' })).toBeVisible();
});

test('resume a saved game and win it', async ({ page }) => {
  const { game, slot } = almostWonGame();
  await seed(page, game);
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();

  await page.locator(`button[data-slot="${slot}"]`).click();
  await page.getByRole('button', { name: /Conferma/ }).click();
  await expect(page.getByText('Giusto', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: /Avanti/ }).click();

  await expect(page.getByRole('heading', { name: 'Vince Anna!' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Rivincita/ })).toBeVisible();

  // The game is recorded in the history.
  await page.goto('/');
  await page.getByRole('button', { name: /Storico/ }).click();
  await expect(page.getByText('Anna').first()).toBeVisible();
});

test('a saved game from an incompatible deck is discarded', async ({ page }) => {
  const { game } = almostWonGame();
  game.deck.push('999');
  await seed(page, game);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Nuova partita/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Riprendi la partita/ })).toHaveCount(0);
});

test('deck browser hides spoilers until asked', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  await page.getByRole('button', { name: /Le sigle/ }).click();
  await expect(page.getByRole('heading', { name: /Attenzione spoiler/ })).toBeVisible();
});

test('settings: audio test plays through the mocked preview', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  await page.getByRole('button', { name: 'Impostazioni' }).first().click();
  await page.getByRole('button', { name: /Prova l'audio/ }).click();
  await expect(page.getByText(/Audio OK/)).toBeVisible();
});
