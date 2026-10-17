import { expect, test } from '@playwright/test';
import { isHead, isTheme, isWhole, recordSources, sources, themeOn, themeStarts } from './audio';
import { mockMusic, seed } from './helpers';
import { firstCard, toFinish, toLesson } from './tutorial-steps';

// Where the platform lets the app sound without a first touch: the Android app (its WebView
// allows it) and a web app installed on the home screen.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

test.beforeEach(async ({ page }) => {
  await mockMusic(page);
  await recordSources(page);
});

test('the theme starts with the app, and the whole theme takes over on the very same sample', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  // No touch: its first seconds are decoded in a moment and start at once…
  await expect.poll(async () => (await sources(page)).some(isWhole)).toBe(true);
  const list = await sources(page);
  const head = list.find(isTheme)!;
  const whole = list.find(isWhole)!;
  expect(isHead(head)).toBe(true);
  expect(head.offset).toBe(0);
  // …and the whole theme, decoded meanwhile, goes on from exactly where they are.
  expect(whole.when).toBeGreaterThan(head.when);
  expect(whole.offset).toBeCloseTo(whole.when - head.when, 9);
  const frames = whole.offset * whole.rate;
  expect(Math.abs(frames - Math.round(frames))).toBeLessThan(1e-6);
  expect(head.stopped).toBe(true);
  expect(head.stopAt! - whole.when).toBeCloseTo(0.05, 6);
  expect(whole.offset + 0.05).toBeLessThan(head.duration - 0.2);
});

test('a new player hears the theme in the tutorial, until its lesson starts and from its end', async ({ page }) => {
  await seed(page, null, { tutorialDone: false });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Iniziamo!' })).toBeVisible();
  await expect.poll(() => themeOn(page)).toBe(true);
  await toLesson(page);
  // The lesson plays its own songs: no theme until its end.
  await expect.poll(() => themeOn(page)).toBe(false);
  const starts = await themeStarts(page);
  await firstCard(page);
  await toFinish(page);
  await expect.poll(() => themeOn(page)).toBe(true);
  expect(await themeStarts(page)).toBe(starts + 1);
  // On into the setup without starting over.
  await page.getByRole('button', { name: /Gioca una partita/ }).click();
  await expect(page.getByLabel('Nome del giocatore 1')).toBeVisible();
  await page.waitForTimeout(300);
  expect(await themeOn(page)).toBe(true);
  expect(await themeStarts(page)).toBe(starts + 1);
});
