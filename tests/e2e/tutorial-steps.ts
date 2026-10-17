import { expect, type Page } from '@playwright/test';

/** From the tutorial's welcome screen to the end of the guided card. */
export async function toFirstReveal(page: Page) {
  await page.getByRole('button', { name: 'Iniziamo!' }).click();
  await page.getByRole('button', { name: 'Ho capito' }).click();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  // The song plays, with the transport of the real game.
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
  // Guided: only the slot above the first card is accepted.
  await page.locator('button[data-slot="1"]').click();
  await expect(page.getByRole('button', { name: /Conferma/ })).toBeDisabled();
  await page.locator('button[data-slot="0"]').click();
  await page.getByRole('button', { name: /Conferma/ }).click();
  await expect(page.getByText('GIUSTO!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();
}

/** The rest of the tutorial with the right answers, up to its last screen. */
export async function toFinish(page: Page) {
  // On your own: between 1978 and 1985.
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await page.locator('button[data-slot="1"]').click();
  await expect(page.getByText(/La metti tra il 1978 e il 1985/)).toBeVisible();
  await page.getByRole('button', { name: /Conferma/ }).click();
  await expect(page.getByText('GIUSTO!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();

  // The bonus token: both answers are needed.
  await expect(page.getByRole('button', { name: 'Avanti' })).toBeDisabled();
  await page.getByRole('button', { name: /Cartone/ }).click();
  await page.getByRole('button', { name: /Interprete/ }).click();
  await expect(page.getByLabel('3 gettoni')).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();

  // Bruno puts his card after 1999: challenge him and steal it.
  await page.getByRole('button', { name: /Sfida Bruno/ }).click();
  await page.locator('button[data-slot="1"]').click();
  await page.getByRole('button', { name: /Gira la carta/ }).click();
  await expect(page.getByText('RUBATA!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();
  await expect(page.getByText(/La tua fila · 4 carte · 🪙 2/)).toBeVisible();
}
