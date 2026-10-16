// Renders the PWA / Android launcher icons from tools/assets/icon.svg with headless Chromium.
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';

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
// Android launcher icons (legacy square + round use the same art).
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, px] of Object.entries(densities)) {
  await mkdir(`android/app/src/main/res/mipmap-${d}`, { recursive: true });
  await render(px, `android/app/src/main/res/mipmap-${d}/ic_launcher.png`, { radius: Math.round(px * 0.18) });
}
await browser.close();
console.log('icons rendered');
