#!/usr/bin/env node
// Writes docs/DECK.md: how the deck was verified plus the full card list with the evidence
// behind every year and links to the exact recordings.
//
//   node tools/deck/report.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { parseCsv } from './lib/csv.mjs';

const rows = parseCsv(await readFile('deck/songs.csv', 'utf8')).filter((r) => r.verified === 'yes');
const deck = JSON.parse(await readFile('src/data/deck.json', 'utf8'));
const byId = new Map(deck.songs.map((s) => [s.id, s]));

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
const decades = {};
for (const r of rows) decades[`${Math.floor(Number(r.year) / 10) * 10}`] = (decades[`${Math.floor(Number(r.year) / 10) * 10}`] ?? 0) + 1;
const fame = { 1: 0, 2: 0, 3: 0 };
for (const r of rows) fame[r.fame] = (fame[r.fame] ?? 0) + 1;

const lines = [];
lines.push('# Il mazzo di Sigle in Fila');
lines.push('');
lines.push(`${rows.length} sigle verificate, dal ${Math.min(...rows.map((r) => Number(r.year)))} al ${Math.max(...rows.map((r) => Number(r.year)))}.`);
lines.push(`Per decennio: ${Object.entries(decades).map(([d, n]) => `anni ${d.slice(2)}: ${n}`).join(' · ')}.`);
lines.push(`Per notorietà: ⭐⭐⭐ ${fame[3]} · ⭐⭐ ${fame[2]} · ⭐ ${fame[1]}.`);
lines.push('');
lines.push('## Quale anno vale');
lines.push('');
lines.push("L'anno di una carta è quello della **prima uscita italiana di quella sigla**: il primo disco pubblicato");
lines.push('oppure la prima messa in onda con quella sigla, se è avvenuta prima. Una serie con più sigle (seconde serie,');
lines.push('repliche con sigla nuova) ha una carta per ogni sigla, ognuna con il suo anno: la nota sul retro della carta');
lines.push('lo spiega (per esempio "Sigla delle repliche di Lady Oscar").');
lines.push('');
lines.push('Come sono stati verificati gli anni:');
lines.push('');
lines.push("1. **Fino al 1990**: anno di pubblicazione del 45 giri o dell'album (Fivelandia, Cristina D'Avena e i tuoi amici");
lines.push('   in TV…) dalle voci di it.wikipedia sui singoli e sulle discografie.');
lines.push('2. **Dal 1991**: gli elenchi delle canzoni riportano l\'anno di **deposito SIAE**, che può precedere la messa in onda.');
lines.push("   Ogni anno è stato confrontato con la data della prima TV italiana (infobox delle voci sulle serie) e con l'album");
lines.push('   in cui la sigla è uscita: se la serie è arrivata in TV dopo il deposito, vale la prima TV.');
lines.push('3. Sigle incise ma pubblicate solo anni dopo (es. Ken il guerriero, incisa nel 1986 e uscita su 45 giri nel 2010)');
lines.push('   usano la prima messa in onda.');
lines.push('');
lines.push('## Quale registrazione si sente');
lines.push('');
lines.push('Ogni carta punta alla **registrazione originale** della sigla, mai a cover, karaoke, duetti o reincisioni:');
lines.push('');
lines.push("- si preferiscono le ristampe ufficiali dei titolari dei master (RTI/Five Record: Fivelandia, Fivelandia Reloaded,");
lines.push("  Cristina D'Avena e i tuoi amici in TV; Warner: Tutto Cartoni & TV - Le sigle originali; GDM: Cartoons 80);");
lines.push('- il codice ISRC collega la stessa registrazione su Deezer e su Spotify;');
lines.push("- sono stati esclusi: Duets e Duets Forever, 40 - Il sogno continua, le reincisioni del 2014 di Giorgio Vanni,");
lines.push('  le raccolte di cover (Cartoon Band, Mundial Cartoon, Mini Robots…), karaoke e live;');
lines.push('- le sigle senza una registrazione originale affidabile in catalogo sono state tolte dal mazzo (per esempio');
lines.push('  Jeeg robot d\'acciaio, Mazinga Z, Barbapapà, Il giro del mondo di Willy Fog, Winx Club).');
lines.push('');
lines.push("Nel gioco l'audio è l'anteprima pubblica di 30 secondi: Deezer per prima, poi Spotify come riserva, con il volume");
lines.push('normalizzato (EBU R128) carta per carta.');
lines.push('');
lines.push('## Elenco completo');
lines.push('');
lines.push('| # | Anno | Sigla | Cartone | Interprete | ⭐ | Perché questo anno | Ascolta |');
lines.push('|---|------|-------|---------|------------|----|--------------------|---------|');
for (const r of [...rows].sort((a, b) => Number(a.year) - Number(b.year) || a.id.localeCompare(b.id))) {
  const s = byId.get(r.id);
  const links = [];
  if (r.deezerId) links.push(`[Deezer](https://www.deezer.com/track/${r.deezerId})`);
  if (r.spotifyTrackId) links.push(`[Spotify](https://open.spotify.com/track/${r.spotifyTrackId})`);
  const note = r.notes ? ` _(${esc(r.notes)})_` : '';
  const why = esc(r.yearSource).replace(/^it\.wikipedia: /, 'it.wikipedia: ');
  lines.push(`| ${r.id} | ${r.year} | ${esc(r.songTitle)}${note} | ${esc(r.cartoon)} | ${esc(r.performer)} | ${'⭐'.repeat(Number(r.fame) || 1)} | ${why} | ${links.join(' · ')}${s ? '' : ' ⚠️'} |`);
}
lines.push('');
await writeFile('docs/DECK.md', lines.join('\n'));
console.log(`Wrote docs/DECK.md (${rows.length} songs)`);
