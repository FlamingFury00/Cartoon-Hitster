import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import deck from '../../src/data/deck.json' with { type: 'json' };
import { DEFAULT_SETTINGS, newGame } from '../../src/lib/game/engine';
import type { GameSettings, GameState, Song } from '../../src/lib/game/types';

export const songs = deck.songs as Song[];
export const byId = new Map(songs.map((s) => [s.id, s]));
export const yearOf = (id: string) => byId.get(id)!.year;
const tone = readFileSync(new URL('./fixtures/tone.mp3', import.meta.url));

export interface MusicMock {
  /** While true every preview request fails (Deezer error + CDN 404). */
  failing: boolean;
}

/** Every music request is answered locally: the tests never touch Deezer, Spotify or Apple. */
export async function mockMusic(page: Page): Promise<MusicMock> {
  const mock: MusicMock = { failing: false };
  await page.route('https://api.deezer.com/**', async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop();
    const exp = Math.floor(Date.now() / 1000) + 900;
    const data = mock.failing
      ? { error: { type: 'DataException', message: 'no data', code: 800 } }
      : { id: Number(id), readable: true, preview: `https://cdnt-preview.dzcdn.net/api/1/1/test/${id}.mp3?hdnea=exp=${exp}~acl=x` };
    const cb = url.searchParams.get('callback');
    const body = JSON.stringify(data);
    await route.fulfill({ contentType: 'application/javascript', body: cb ? `${cb}(${body})` : body });
  });
  await page.route(/dzcdn\.net|p\.scdn\.co|audio-ssl\.itunes\.apple\.com/, (route) =>
    mock.failing
      ? route.fulfill({ status: 404, body: '' })
      : route.fulfill({ contentType: 'audio/mpeg', body: tone, headers: { 'access-control-allow-origin': '*' } }),
  );
  await page.route('https://itunes.apple.com/**', (route) => route.fulfill({ status: 404, body: '' }));
  return mock;
}

/** Starts the app with a clean storage, optionally with a saved game. */
export async function seed(page: Page, game: GameState | null, settings: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([g, s]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      if (g) localStorage.setItem('sif.game.v1', JSON.stringify(g));
      localStorage.setItem('sif.settings.v1', JSON.stringify({ tutorialDone: true, ...s }));
    },
    [game, settings] as const,
  );
}

export function makeGame(settings: Partial<GameSettings> = {}, names = ['Anna', 'Bruno'], seedValue = 20251016): GameState {
  const avatars = ['🐱', '🐶', '🦊', '🐸'];
  const colors = ['#ff4f9a', '#2bc4ff', '#ffd23f', '#4fd96b'];
  return newGame({
    players: names.map((name, i) => ({ name, avatar: avatars[i], color: colors[i] })),
    settings: { ...DEFAULT_SETTINGS, minFame: 1, ...settings },
    songs,
    seed: seedValue,
  });
}

/** The saved game as the app currently sees it. */
export function savedGame(page: Page): Promise<GameState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sif.game.v1')!));
}
