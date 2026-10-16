// Spotify track lookup WITHOUT a developer account: drives the public web player
// (open.spotify.com, logged out) in headless Chromium, exactly like a person typing
// in the search box, and reads the search results the page receives.
// Used only offline while curating the deck, never by the app itself.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.resolve('.cache/deck-spotify');
let browser;
let page;
let pending = null;

async function ensurePage() {
  if (page) return page;
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    ({ chromium } = await import('@playwright/test'));
  }
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    locale: 'it-IT',
  });
  page = await ctx.newPage();
  page.on('response', async (res) => {
    if (!pending || !res.url().includes('pathfinder')) return;
    try {
      const post = res.request().postData() ?? '';
      if (!post.includes('searchTracks') && !post.includes('searchDesktop')) return;
      const vars = JSON.parse(post).variables ?? {};
      if (vars.searchTerm !== pending.term) return;
      const json = await res.json();
      const items = json?.data?.searchV2?.tracksV2?.items ?? [];
      if (items.length || post.includes('searchTracks')) pending.resolve(items);
    } catch {
      /* ignore unrelated responses */
    }
  });
  return page;
}

function simplify(items) {
  return items
    .map((it) => it.item?.data ?? it.data ?? it)
    .filter((t) => t?.uri?.startsWith('spotify:track:'))
    .map((t) => ({
      id: t.id,
      title: t.name,
      artists: (t.artists?.items ?? []).map((a) => a.profile?.name),
      album: t.albumOfTrack?.name,
      albumId: t.albumOfTrack?.id,
      duration: (t.duration?.totalMilliseconds ?? 0) / 1000,
      playable: t.playability?.playable !== false,
    }));
}

/** Searches the Spotify catalogue (track results) for a free-text term or `isrc:XXXX`. */
export async function searchSpotify(term) {
  const file = path.join(CACHE_DIR, createHash('sha1').update(term).digest('hex') + '.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    /* miss */
  }
  const p = await ensurePage();
  let result = null;
  for (let attempt = 0; attempt < 3 && result === null; attempt++) {
    const got = new Promise((resolve) => {
      pending = { term, resolve };
    });
    await p.goto('https://open.spotify.com/search/' + encodeURIComponent(term) + '/tracks', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    result = await Promise.race([got, new Promise((r) => setTimeout(() => r(null), 15000))]);
    pending = null;
  }
  const simplified = simplify(result ?? []);
  if (result !== null) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(simplified));
  }
  return simplified;
}

export async function closeSpotify() {
  await browser?.close();
  browser = page = undefined;
}
