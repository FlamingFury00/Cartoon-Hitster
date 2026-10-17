import { expect, test } from '@playwright/test';
import { insertSorted, validSlotRange } from '../../src/lib/game/timeline';
import type { GameState } from '../../src/lib/game/types';
import { byId, makeGame, mockMusic, seed, yearOf } from './helpers';

/** A two-player game where Anna needs one more right card to win. */
function almostWonGame(): { game: GameState; slot: number } {
  const game = makeGame({ target: 5, tokens: false });
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
