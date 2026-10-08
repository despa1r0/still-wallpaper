import { previewPath } from "./preview-path";
import { test, expect, type Page } from '@playwright/test';

const wallpapers = ['aaaaaa', 'bbbbbb', 'cccccc'].map((id, index) => ({
  id, url: `https://wallhaven.cc/w/${id}`,
  path: `https://w.wallhaven.cc/full/${id.slice(0, 2)}/wallhaven-${id}.jpg`,
  thumbs: Object.fromEntries(['original', 'large', 'small'].map(size => [size, `https://th.wallhaven.cc/${size}/${id}.jpg`])),
  resolution: index === 2 ? '1080x1920' : '2560x1440',
  dimension_x: index === 2 ? 1080 : 2560, dimension_y: index === 2 ? 1920 : 1440,
  colors: ['#608c91'], tags: [],
}));
const artwork = (portrait = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="${portrait ? 1080 : 2560}" height="${portrait ? 1920 : 1440}"><rect width="100%" height="100%" fill="#263e64"/><rect x="2%" y="2%" width="96%" height="96%" fill="none" stroke="#c4d9ff" stroke-width="30"/><circle cx="50%" cy="50%" r="100" fill="#7fa7e8"/></svg>`;
type Source = 'proxy' | 'original' | 'thumbnail';
type Behavior = (id: string, source: Source) => boolean | Promise<boolean>;

async function mockPreview(page: Page, succeeds: Behavior) {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route(/https:\/\/(w|th)\.wallhaven\.cc\//, async route => {
    const url = route.request().url();
    const id = wallpapers.find(w => url.includes(w.id))!.id;
    const ok = await succeeds(id, url.includes('th.wallhaven') ? 'thumbnail' : 'original');
    await route.fulfill({ status: ok ? 200 : 404, contentType: 'image/svg+xml', body: ok ? artwork(id === 'cccccc') : '' });
  });
  await page.route('**/api/wallpapers**', async route => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/')[3];
    if (url.pathname.endsWith('/image')) {
      const ok = await succeeds(id, 'proxy');
      await route.fulfill({ status: ok ? 200 : 404, contentType: 'image/svg+xml', body: ok ? artwork(id === 'cccccc') : '' });
    } else if (id) {
      await route.fulfill({ json: { data: wallpapers.find(w => w.id === id) } });
    } else {
      await route.fulfill({ json: { data: wallpapers, meta: { current_page: 1, last_page: 1, total: 3, seed: 'test' } } });
    }
  });
}
const monitor = (page: Page) => page.locator('.desk-scene .monitor-wallpaper');
const phone = (page: Page) => page.getByAltText('Selected wallpaper on the phone');

test('direct original recovers when the image proxy is unavailable', async ({ page }) => {
  await mockPreview(page, (_id, source) => source !== 'proxy');
  await page.goto('/?wallpaper=aaaaaa');
  await expect(monitor(page)).toHaveAttribute('href', wallpapers[0].path);
  await expect(page.locator('.preview-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Phone preview', exact: true }).click();
  await expect(phone(page)).toHaveAttribute('src', wallpapers[0].path);
  await expect.poll(() => phone(page).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(2560);
});

test('unavailable originals keep the selected thumbnail on desk, full preview and phone', async ({ page }) => {
  await mockPreview(page, (_id, source) => source === 'thumbnail');
  await page.goto('/?wallpaper=cccccc');
  await expect(monitor(page)).toHaveAttribute('href', wallpapers[2].thumbs.original);
  await expect(page.getByText('Original unavailable. Showing a smaller preview.')).toBeVisible();
  await page.getByRole('button', { name: 'View wallpaper', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Wallpaper preview', exact: true });
  await expect(dialog.getByRole('img', { name: 'Wallpaper cccccc, 1080x1920', exact: true })).toHaveAttribute('src', wallpapers[2].thumbs.original);
  await expect(dialog.getByText('Original unavailable. Showing a smaller preview.')).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'Wallpaper cccccc, 1080x1920', exact: true })).toHaveCSS('object-fit', 'contain');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Phone preview', exact: true }).click();
  await expect(phone(page)).toHaveAttribute('src', wallpapers[2].thumbs.original);
  await expect(page.getByText('Original unavailable. Showing a smaller preview.')).toBeVisible();
  await expect(phone(page)).toHaveCSS('object-fit', 'contain');
});

test('failed selection clears the old image and explicit retry recovers it', async ({ page }) => {
  let recovered = false;
  await mockPreview(page, (id) => id !== 'bbbbbb' || recovered);
  await page.goto('/?wallpaper=aaaaaa');
  await expect(monitor(page)).toHaveAttribute('href', '/api/wallpapers/aaaaaa/image');
  await page.getByRole('button', { name: 'Preview wallpaper bbbbbb' }).click();
  await expect(page.getByText('This image could not be loaded.')).toBeVisible();
  await expect(monitor(page)).not.toHaveAttribute('href');
  await expect(page.locator('.desk-scene .laptop-wallpaper')).not.toHaveAttribute('href');
  recovered = true;
  await page.getByRole('button', { name: 'Retry preview', exact: true }).click();
  await expect(monitor(page)).toHaveAttribute('href', '/api/wallpapers/bbbbbb/image');
  await expect(page.locator('.preview-notice')).toHaveCount(0);
});

test('a late image response cannot overwrite the newly selected wallpaper', async ({ page }) => {
  let releaseA!: () => void;
  const heldResponse = new Promise<void>(resolve => { releaseA = resolve; });
  await mockPreview(page, async (id, source) => {
    if (id === 'aaaaaa' && source === 'proxy') await heldResponse;
    return true;
  });
  const firstRequest = page.waitForRequest('**/api/wallpapers/aaaaaa/image');
  await page.goto('/?wallpaper=aaaaaa');
  await firstRequest;
  await page.getByRole('button', { name: 'Preview wallpaper bbbbbb' }).click();
  await expect(monitor(page)).toHaveAttribute('href', '/api/wallpapers/bbbbbb/image');
  const lateResponse = page.waitForResponse('**/api/wallpapers/aaaaaa/image');
  releaseA();
  // The browser can cancel the old request instead of delivering its response.
  await Promise.race([lateResponse.catch(() => undefined), page.waitForTimeout(500)]);
  await expect(monitor(page)).toHaveAttribute('href', '/api/wallpapers/bbbbbb/image');
  await expect(page.getByRole('button', { name: 'Preview wallpaper bbbbbb' })).toHaveAttribute('aria-pressed', 'true');
});

test('phone framing preserves portrait edges, pans at zoom, and resets for another wallpaper', async ({ page }) => {
  await mockPreview(page, () => true);
  await page.goto('/phone?wallpaper=cccccc');
  await expect(phone(page)).toHaveAttribute('src', '/api/wallpapers/cccccc/image');
  await expect(phone(page)).toHaveCSS('object-fit', 'contain');
  await expect.poll(() => phone(page).evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, 1920]);
  await page.getByLabel('Zoom').fill('1.5');
  await page.getByLabel('Horizontal position').fill('70');
  await page.getByLabel('Vertical position').fill('30');
  await expect(phone(page)).toHaveCSS('object-position', '70% 30%');
  const screen = await page.locator('.phone-screen').boundingBox();
  if (!screen) throw new Error('Phone screen missing');
  await page.mouse.move(screen.x + screen.width / 2, screen.y + screen.height / 2);
  await page.mouse.down();
  await page.mouse.move(screen.x + screen.width / 2, screen.y + screen.height / 2 + 30);
  await page.mouse.up();
  await expect(page.getByLabel('Vertical position')).not.toHaveValue('30');
  await page.getByRole('button', { name: 'Reset framing' }).click();
  await expect(page.getByLabel('Zoom')).toHaveValue('1');
  await expect(phone(page)).toHaveCSS('object-position', '50% 50%');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: previewPath("preview-phone.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Zoom').fill('1.8');
  await page.getByLabel('Horizontal position').fill('90');
  await page.getByRole('button', { name: 'Back to my desk', exact: true }).click();
  await page.getByRole('button', { name: 'Preview wallpaper bbbbbb' }).click();
  await page.getByRole('button', { name: 'Phone preview', exact: true }).click();
  await expect(phone(page)).toHaveAttribute('src', '/api/wallpapers/bbbbbb/image');
  await expect(page.getByLabel('Zoom')).toHaveValue('1');
  await expect(page.getByLabel('Horizontal position')).toHaveValue('50');
  await expect(page.getByLabel('Vertical position')).toHaveValue('50');
});
