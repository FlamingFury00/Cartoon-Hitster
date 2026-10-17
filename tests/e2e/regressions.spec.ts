import { expect, test } from '@playwright/test';
import { makeGame, mockMusic, savedGame, seed } from './helpers';

const back = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { sifBack: () => string }).sifBack());

test.beforeEach(async ({ page }) => {
  await mockMusic(page);
});

test('a game saved while listening plays its song again when resumed', async ({ page }) => {
  const game = makeGame();
  game.phase = { t: 'listen', card: game.deck.pop()!, slot: null };
  await seed(page, game);
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
});

test('coming back from the rules restarts the song and the controls still work', async ({ page }) => {
  await seed(page, makeGame());
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Menu di pausa' }).click();
  await page.getByRole('button', { name: /Regole/ }).click();
  await expect(page.getByRole('heading', { name: /Lo scopo/ })).toBeVisible();
  await page.goBack();

  // Back to the pause menu, with the song playing again underneath.
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeAttached();
  await page.getByRole('button', { name: /Riprendi/ }).click();
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Riproduci' })).toBeEnabled();
  await page.getByRole('button', { name: 'Riproduci' }).click();
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
});

test('players with the same name get distinct names', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  await page.getByRole('button', { name: /Nuova partita/ }).click();
  await page.getByLabel('Nome del giocatore 1').fill('Luca');
  await page.getByLabel('Nome del giocatore 2').fill('luca');
  await page.getByRole('button', { name: /Si comincia/ }).click();
  const g = await savedGame(page);
  expect(g.players.map((p) => p.name)).toEqual(['Luca', 'luca 2']);
});

test('the Spotify link opens a new tab and keeps the game', async ({ page, context }) => {
  await context.route('https://open.spotify.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>spotify</p>' }));
  const game = makeGame({ tokens: false });
  await seed(page, game);
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await page.getByRole('button', { name: 'Metti la carta in questa posizione' }).first().click();
  await page.getByRole('button', { name: /Conferma/ }).click();
  const popup = context.waitForEvent('page');
  await page.getByRole('button', { name: /Ascolta tutta la sigla su Spotify/ }).click();
  expect((await popup).url()).toContain('open.spotify.com');
  await expect(page.getByRole('button', { name: /Avanti/ })).toBeVisible();
  expect(new URL(page.url()).hostname).toBe('localhost');
});

test('Android back: previous screen, pause menu in a game, exit only on the home screen', async ({ page }) => {
  await seed(page, makeGame());
  await page.goto('/');
  expect(await back(page)).toBe('exit');

  await page.getByRole('button', { name: /Come si gioca/ }).click();
  expect(await back(page)).toBe('handled');
  await expect(page.getByRole('button', { name: /Nuova partita/ })).toBeVisible();

  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  expect(await back(page)).toBe('handled');
  await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible();
  await page.getByRole('button', { name: /Torna al menu/ }).click();
  await expect(page.getByRole('button', { name: /Nuova partita/ })).toBeVisible();
  // No stale screens left behind: back on the home screen closes the app.
  expect(await back(page)).toBe('exit');
});
