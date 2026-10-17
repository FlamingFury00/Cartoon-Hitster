import { expect, test, type Page } from '@playwright/test';
import { makeGame, mockMusic, savedGame, seed } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockMusic(page);
});

const settings = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sif.settings.v1')!));

async function toFirstReveal(page: Page) {
  await page.getByRole('button', { name: /Impara a giocare/ }).click();
  await page.getByRole('button', { name: 'Iniziamo!' }).click();
  await page.getByRole('button', { name: 'Ho capito' }).click();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  // The song plays, with the transport of the real game.
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
  // Guided: only the slot above the first card is accepted.
  await page.locator('button[data-slot="1"]').click();
  await expect(page.getByRole('button', { name: /Conferma/ })).toBeDisabled();
  await page.locator('button[data-slot="0"]').click();
  await page.getByRole('button', { name: /Conferma/ }).click();
  await expect(page.getByText('GIUSTO!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();
}

test('the tutorial teaches by playing, and leaves the saved game alone', async ({ page }) => {
  const game = makeGame();
  await seed(page, game, { tutorialDone: false });
  await page.goto('/');
  await toFirstReveal(page);

  // On your own: between 1978 and 1985.
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await page.locator('button[data-slot="1"]').click();
  await expect(page.getByText(/La metti tra il 1978 e il 1985/)).toBeVisible();
  await page.getByRole('button', { name: /Conferma/ }).click();
  await expect(page.getByText('GIUSTO!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();

  // The bonus token: both answers are needed.
  await expect(page.getByRole('button', { name: 'Avanti' })).toBeDisabled();
  await page.getByRole('button', { name: /Cartone/ }).click();
  await page.getByRole('button', { name: /Interprete/ }).click();
  await expect(page.getByLabel('3 gettoni')).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();

  // Bruno puts his card after 1999: challenge him and steal it.
  await page.getByRole('button', { name: /Sfida Bruno/ }).click();
  await page.locator('button[data-slot="1"]').click();
  await page.getByRole('button', { name: /Gira la carta/ }).click();
  await expect(page.getByText('RUBATA!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();

  await expect(page.getByText(/La tua fila · 4 carte · 🪙 2/)).toBeVisible();
  await page.getByRole('button', { name: /Gioca una partita/ }).click();
  await expect(page.getByLabel('Nome del giocatore 1')).toBeVisible();
  expect((await settings(page)).tutorialDone).toBe(true);
  expect(await savedGame(page)).toEqual(game);
});

test('wrong answers in the tutorial: the card is discarded, the token lost', async ({ page }) => {
  await seed(page, null, { tutorialDone: false });
  await page.goto('/');
  await toFirstReveal(page);

  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await page.locator('button[data-slot="0"]').click();
  await page.getByRole('button', { name: /Conferma/ }).click();
  await expect(page.getByText('SBAGLIATO!', { exact: true })).toBeVisible();
  await expect(page.getByText(/andava tra il 1978 e il 1985/)).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();

  await page.getByRole('button', { name: /Cartone/ }).click();
  await page.getByRole('button', { name: /Interprete/ }).click();
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByRole('button', { name: /Sfida Bruno/ }).click();
  await page.locator('button[data-slot="0"]').click();
  await page.getByRole('button', { name: /Gira la carta/ }).click();
  await expect(page.getByText('SBAGLIATO!', { exact: true })).toBeVisible();
  await expect(page.getByText(/gettone è perso/)).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();

  await expect(page.getByText(/La tua fila · 2 carte · 🪙 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Torna al menu' }).click();
  await expect(page.getByRole('button', { name: /Nuova partita/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Impara a giocare/ })).toHaveCount(0);
});

test('the tutorial can be skipped, and is still there in the rules', async ({ page }) => {
  await seed(page, null, { tutorialDone: false });
  await page.goto('/');
  await page.getByRole('button', { name: /Impara a giocare/ }).click();
  await page.getByRole('button', { name: 'Salta' }).click();
  await expect(page.getByRole('button', { name: /Nuova partita/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Impara a giocare/ })).toHaveCount(0);
  expect((await settings(page)).tutorialDone).toBe(true);

  await page.getByRole('button', { name: /Come si gioca/ }).click();
  await page.getByRole('button', { name: /tutorial interattivo/ }).click();
  await expect(page.getByRole('button', { name: 'Iniziamo!' })).toBeVisible();
});
