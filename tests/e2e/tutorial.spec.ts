import { expect, test, type Page } from '@playwright/test';
import { makeGame, mockMusic, savedGame, seed, type MusicMock } from './helpers';
import { toFinish, toFirstReveal } from './tutorial-steps';

let music: MusicMock;

test.beforeEach(async ({ page }) => {
  music = await mockMusic(page);
});

const settings = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sif.settings.v1')!));

test('the tutorial teaches by playing, and leaves the saved game alone', async ({ page }) => {
  const game = makeGame();
  await seed(page, game, { tutorialDone: false });
  await page.goto('/');
  await page.getByRole('button', { name: /Impara a giocare/ }).click();
  await toFirstReveal(page);
  await toFinish(page);

  await page.getByRole('button', { name: /Gioca una partita/ }).click();
  await expect(page.getByLabel('Nome del giocatore 1')).toBeVisible();
  expect((await settings(page)).tutorialDone).toBe(true);
  expect(await savedGame(page)).toEqual(game);
  // The setup took the tutorial's place: back goes home.
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.getByRole('button', { name: /Riprendi la partita/ })).toBeVisible();
});

test('wrong answers in the tutorial: the card is discarded, the token lost', async ({ page }) => {
  await seed(page, null, { tutorialDone: false });
  await page.goto('/');
  await page.getByRole('button', { name: /Impara a giocare/ }).click();
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
  // Seen to the end counts as done, even when leaving with "back".
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.getByRole('button', { name: /Nuova partita/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Impara a giocare/ })).toHaveCount(0);
});

test('a song that fails to load in the tutorial can be played again', async ({ page }) => {
  await seed(page, null, { tutorialDone: false });
  await page.goto('/');
  await page.getByRole('button', { name: /Impara a giocare/ }).click();
  await page.getByRole('button', { name: 'Iniziamo!' }).click();
  await page.getByRole('button', { name: 'Ho capito' }).click();
  music.failing = true;
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await expect(page.getByText(/Non riesco a far partire la musica/)).toBeVisible();
  music.failing = false;
  await page.getByRole('button', { name: 'Riproduci' }).click();
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
  await expect(page.getByText(/Non riesco a far partire la musica/)).toHaveCount(0);
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
