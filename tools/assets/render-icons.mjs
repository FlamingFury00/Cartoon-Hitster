// Renders the PWA / Android launcher icons from tools/assets/icon.svg with headless Chromium.
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { readFile, mkdir, rm } from 'node:fs/promises';

const svg = await readFile(new URL('./icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, file, { padding = 0, radius = 0 } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - padding * 2;
  await page.setContent(`<html><body style="margin:0;background:#24135f;width:${size}px;height:${size}px;display:grid;place-items:center">
    <div style="width:${inner}px;height:${inner}px;border-radius:${radius}px;overflow:hidden">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: file, omitBackground: false });
}
await mkdir('public/icons', { recursive: true });
await render(192, 'public/icons/icon-192.png');
await render(512, 'public/icons/icon-512.png');
// Maskable: keep the artwork inside the 80% safe zone.
await render(512, 'public/icons/icon-maskable-512.png', { padding: 52 });
// Android launcher icons: legacy PNGs (Android 7) + adaptive icon layers (Android 8+).
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
// The adaptive background is the scenery of the icon, the foreground the cards, scaled into the
// 66 dp safe zone of the 108 dp layer so that no launcher mask can cut them.
const [head, art] = svg.split('<rect x="70" y="300"');
const background = `${head}</svg>`;
const foreground = `${head.slice(0, head.indexOf('<rect width="512"'))}<g transform="translate(256 256) scale(0.62) translate(-256 -290)"><rect x="70" y="300"${art.replace('</svg>', '')}</g></svg>`;
async function layer(markup, size, file, transparent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  const png = file.replace(/\.webp$/, '.png');
  await page.screenshot({ path: png, omitBackground: transparent });
  // WebP layers are 5-10x smaller than PNG (supported by every Android version the app runs on).
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', '90', file]);
  await rm(png);
}
for (const [d, k] of Object.entries(densities)) {
  const dir = `android/app/src/main/res/mipmap-${d}`;
  await mkdir(dir, { recursive: true });
  await render(48 * k, `${dir}/ic_launcher.png`, { radius: Math.round(48 * k * 0.18) });
  await layer(background, 108 * k, `${dir}/ic_launcher_background.webp`, false);
  await layer(foreground, 108 * k, `${dir}/ic_launcher_foreground.webp`, true);
}
await browser.close();
console.log('icons rendered');
