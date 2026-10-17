#!/usr/bin/env node
// Captures the README screenshots (docs/screenshots/*.webp, via ffmpeg) from the production build.
// Music requests are mocked with a short tone, so no network access is needed.
//
//   npm run build && npx vite preview --port 4174 &   node tools/assets/screenshots.mjs
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { chromium, devices } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4174';
const OUT = 'docs/screenshots';
const tone = await readFile('tests/e2e/fixtures/tone.mp3');

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1.5, locale: 'it-IT', serviceWorkers: 'block' });
await context.route('https://api.deezer.com/**', async (route) => {
  const url = new URL(route.request().url());
  const id = url.pathname.split('/').pop();
  const body = JSON.stringify({ id: Number(id), readable: true, preview: `https://cdnt-preview.dzcdn.net/x/${id}.mp3?hdnea=exp=${Math.floor(Date.now() / 1000) + 900}~acl=x` });
  await route.fulfill({ contentType: 'application/javascript', body: `${url.searchParams.get('callback')}(${body})` });
});
await context.route(/dzcdn\.net|p\.scdn\.co/, (route) =>
  route.fulfill({ contentType: 'audio/mpeg', body: tone, headers: { 'access-control-allow-origin': '*' } }),
);
const page = await context.newPage();
const shot = async (name) => {
  await page.waitForTimeout(700);
  const png = `${OUT}/${name}.png`;
  await page.screenshot({ path: png });
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', '82', `${OUT}/${name}.webp`]);
  await rm(png);
  console.log(`${OUT}/${name}.webp`);
};

await page.goto(BASE);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('sif.settings.v1', JSON.stringify({ tutorialDone: true }));
  localStorage.setItem(
    'sif.roster.v1',
    JSON.stringify([
      { name: 'Giulia', avatar: '🦊', color: '#ff4f9a' },
      { name: 'Marco', avatar: '🐸', color: '#2bc4ff' },
      { name: 'Nonna Rita', avatar: '🦉', color: '#ffd23f' },
    ]),
  );
});
await page.reload();
await shot('home');

await page.getByRole('button', { name: /Nuova partita/ }).click();
await page.getByRole('button', { name: /Si comincia/ }).click();

// Play a few turns so the timelines have some cards.
for (let turn = 0; turn < 7; turn++) {
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await page.getByRole('button', { name: 'Pausa', exact: true }).waitFor();
  if (turn === 6) {
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Metti la carta in questa posizione' }).nth(1).click();
    await shot('listen');
  } else {
    await page.getByRole('button', { name: 'Metti la carta in questa posizione' }).first().click();
  }
  await page.getByRole('button', { name: /Conferma/ }).click();
  const flip = page.getByRole('button', { name: /Gira la carta/ });
  if (await flip.isVisible().catch(() => false)) await flip.click();
  await page.getByRole('button', { name: /Avanti/ }).waitFor({ timeout: 15000 });
  if (turn === 6) await shot('reveal');
  await page.getByRole('button', { name: /Avanti/ }).click();
}

// Jump to the end of the game: give the active player the winning cards and play the last one.
await page.evaluate(() => {
  const g = JSON.parse(localStorage.getItem('sif.game.v1'));
  g.settings.target = Math.max(5, g.players[g.active].timeline.length + 1);
  localStorage.setItem('sif.game.v1', JSON.stringify(g));
});
await page.reload();
await page.getByRole('button', { name: /Riprendi la partita/ }).click();
for (let guard = 0; guard < 30; guard++) {
  if (await page.getByRole('button', { name: /Rivincita/ }).isVisible().catch(() => false)) break;
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  const slots = page.getByRole('button', { name: 'Metti la carta in questa posizione' });
  await slots.first().waitFor();
  // Try each gap from the left: the reveal tells us whether it was right.
  await slots.first().click();
  await page.getByRole('button', { name: /Conferma/ }).click();
  const flip = page.getByRole('button', { name: /Gira la carta/ });
  if (await flip.isVisible().catch(() => false)) await flip.click();
  await page.getByRole('button', { name: /Avanti/ }).click({ timeout: 15000 });
  await page.waitForTimeout(400);
}
await page.waitForTimeout(1800);
await shot('victory');
await browser.close();
