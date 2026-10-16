#!/usr/bin/env node
// Builds an index of every track of the official reissue albums of the main theme-song
// artists on Deezer (RTI "Fivelandia Reloaded", "...e i tuoi amici in TV", etc.), used to
// find the original recording of a song when free-text search misses it.
//
//   node tools/deck/album-index.mjs > deck/album-index.json
import { getJson } from './lib/http.mjs';

const ARTISTS = { cristina: 14585, vanni: null };
// Compilations of original recordings and official reissues not listed under the artists.
const extraAlbums = [
  709082611, 7461453, 1350724, 6901152, // Cartoons 80, Tutto Cartoni & TV, Tutto Bimbi, Tutto Sigle & Cartoni TV
  80229112, 80229152, 82963612, 71402472, 71402442, // Fivelandia Reloaded 1, 4, 8, Fivelandia 9, 22
];

async function artistId(name) {
  const r = await getJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`);
  return r?.data?.find((a) => a.name.toLowerCase() === name.toLowerCase())?.id ?? null;
}

ARTISTS.vanni = await artistId('Giorgio Vanni');
const albumIds = new Set(extraAlbums);
for (const id of Object.values(ARTISTS)) {
  if (!id) continue;
  let url = `https://api.deezer.com/artist/${id}/albums?limit=100`;
  while (url) {
    const r = await getJson(url);
    for (const a of r?.data ?? []) albumIds.add(a.id);
    url = r?.next ?? null;
  }
}
const tracks = [];
for (const id of albumIds) {
  const album = await getJson(`https://api.deezer.com/album/${id}`);
  if (!album) continue;
  let url = `https://api.deezer.com/album/${id}/tracks?limit=200`;
  while (url) {
    const r = await getJson(url);
    for (const t of r?.data ?? [])
      tracks.push({
        id: t.id,
        title: t.title,
        artist: t.artist?.name,
        duration: t.duration,
        isrc: t.isrc,
        album: album.title,
        albumId: id,
        label: album.label,
        date: album.release_date,
        hasPreview: Boolean(t.preview),
      });
    url = r?.next ?? null;
  }
}
console.log(JSON.stringify({ artists: ARTISTS, albums: albumIds.size, tracks }, null, 1));
