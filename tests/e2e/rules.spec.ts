import { expect, test } from '@playwright/test';
import { validSlotRange } from '../../src/lib/game/timeline';
import { makeGame, mockMusic, savedGame, seed, yearOf } from './helpers';

test('co-op: a wrong placement costs the team a life', async ({ page }) => {
  await mockMusic(page);
  const game = makeGame({ mode: 'coop', startTokens: 3 }, ['Anna', 'Bruno', 'Carla']);
  // Make sure the first card cannot share the year of the starting card (so a wrong gap exists).
  const startYear = yearOf(game.team!.timeline[0]);
  const idx = game.deck.findLastIndex((id) => yearOf(id) !== startYear);
  game.deck.push(game.deck.splice(idx, 1)[0]);
  await seed(page, game);
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await expect(page.getByLabel('3 gettoni')).toBeVisible();

  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  const g = await savedGame(page);
  const card = (g.phase as { card: string }).card;
  const [from, to] = validSlotRange(g.team!.timeline, yearOf(card), yearOf);
  const wrong = [0, 1].find((s) => s < from || s > to)!;
  await page.locator(`button[data-slot="${wrong}"]`).click();
  await page.getByRole('button', { name: /Conferma/ }).click();

  // No challenges in co-op: the card flips straight away.
  await expect(page.getByText('SBAGLIATO!')).toBeVisible();
  await page.getByRole('button', { name: /Avanti/ }).click();
  await expect(page.getByLabel('2 gettoni')).toBeVisible();
  expect((await savedGame(page)).team!.tokens).toBe(2);
});

test('buying a card costs three tokens and places it right', async ({ page }) => {
  await mockMusic(page);
  const game = makeGame({ startTokens: 3, maxTokens: 5 });
  await seed(page, game);
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await page.getByRole('button', { name: /Compra una carta/ }).click();
  await expect(page.getByText('COMPRATA!')).toBeVisible();
  await page.getByRole('button', { name: /Avanti/ }).click();

  const g = await savedGame(page);
  expect(g.players[0].tokens).toBe(0);
  expect(g.players[0].timeline).toHaveLength(2);
  const years = g.players[0].timeline.map(yearOf);
  expect([...years].sort((a, b) => a - b)).toEqual(years);
});

test('skipping a song costs a token and draws another one', async ({ page }) => {
  await mockMusic(page);
  await seed(page, makeGame({ startTokens: 2 }));
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  const first = ((await savedGame(page)).phase as { card: string }).card;
  await page.getByRole('button', { name: 'Salta questa sigla per 1 gettone' }).click();
  await expect.poll(async () => ((await savedGame(page)).phase as { card: string }).card).not.toBe(first);
  const g = await savedGame(page);
  expect(g.players[0].tokens).toBe(1);
  expect(g.discard).toContain(first);
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
});

test('undo brings back the placement step', async ({ page }) => {
  await mockMusic(page);
  await seed(page, makeGame());
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await page.getByRole('button', { name: 'Metti la carta in questa posizione' }).first().click();
  await page.getByRole('button', { name: /Conferma/ }).click();
  await expect(page.getByRole('button', { name: /Gira la carta/ })).toBeVisible();

  await page.getByRole('button', { name: "Annulla l'ultima mossa" }).click();
  await expect(page.getByRole('button', { name: /Conferma/ })).toBeVisible();
  expect((await savedGame(page)).phase.t).toBe('listen');
});

test('an unplayable song can be swapped for free', async ({ page }) => {
  const music = await mockMusic(page);
  music.failing = true;
  await seed(page, makeGame({ startTokens: 0 }));
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await expect(page.getByText(/Non riesco a caricare questa sigla/)).toBeVisible({ timeout: 20_000 });

  music.failing = false;
  const first = ((await savedGame(page)).phase as { card: string }).card;
  await page.getByRole('button', { name: /Pesca un'altra sigla/ }).click();
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
  await expect(page.getByText(/Non riesco a caricare questa sigla/)).toHaveCount(0);
  const g = await savedGame(page);
  expect((g.phase as { card: string }).card).not.toBe(first);
  expect(g.players[0].tokens).toBe(0);
});
