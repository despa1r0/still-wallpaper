import { test, expect, type Page } from '@playwright/test';

const ids = ['aaaaaa', 'bbbbbb', 'cccccc', 'dddddd', 'eeeeee', 'ffffff'];
const wallpapers = ids.map((id, index) => ({
  id,
  url: `https://wallhaven.cc/w/${id}`,
  path: `https://w.wallhaven.cc/full/${id.slice(0, 2)}/wallhaven-${id}.jpg`,
  thumbs: Object.fromEntries(['large', 'small', 'original'].map(key => [key, `https://th.wallhaven.cc/lg/${id.slice(0, 2)}/${id}.jpg`])),
  resolution: index === 2 ? '1080x1920' : '2560x1440',
  dimension_x: index === 2 ? 1080 : 2560,
  dimension_y: index === 2 ? 1920 : 1440,
  colors: ['#608c91', '#bbaa88', '#253e58'],
  tags: [{ id: 123, name: 'mountains' }],
  uploader: { username: 'test-photographer' },
}));

async function mockApi(page: Page, mode: 'ok' | 'empty' | 'error' = 'ok') {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route(/^https:\/\/(w|th)\.wallhaven\.cc\//, async route => {
    if (route.request().url().includes('cccccc')) {
      // Portrait fixture with edge markers makes accidental cropping visible.
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#263e64"/><rect x="20" y="20" width="1040" height="1880" fill="none" stroke="#c4d9ff" stroke-width="40"/><circle cx="540" cy="960" r="260" fill="#7fa7e8"/></svg>' });
      return;
    }
    // Use the shipped artwork, so visual checks do not depend on external CDNs.
    const image = await page.request.get('/art/quiet-valley.svg');
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: await image.body() });
  });
  await page.route('**/api/wallpapers**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/download')) {
      await route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from([255, 216, 255, 217]) });
    } else if (/\/wallpapers\/\w+$/.test(url.pathname)) {
      const found = wallpapers.find(w => url.pathname.endsWith(w.id));
      await route.fulfill({ json: { data: found || wallpapers[0] } });
    } else if (mode === 'error') {
      await route.fulfill({ status: 503, json: { detail: 'Upstream unavailable' } });
    } else {
      await route.fulfill({ json: { data: mode === 'empty' ? [] : wallpapers, meta: { current_page: 1, last_page: 1, total: mode === 'empty' ? 0 : wallpapers.length, seed: url.searchParams.get('seed') } } });
    }
  });
}

test('desk selection, lighting, favorites persistence and original download', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Preview wallpaper aaaaaa' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Preview wallpaper bbbbbb' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Lighting', exact: true }).click();
  await page.getByRole('button', { name: 'Cool', exact: true }).click();
  await page.getByRole('switch', { name: 'Lamp', exact: true }).click();
  await page.getByRole('button', { name: 'Close lighting settings' }).click();
  await page.getByRole('button', { name: 'Add to favorites', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Lighting', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('switch', { name: 'Lamp', exact: true })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Close lighting settings' }).click();
  await expect(page.getByRole('button', { name: 'Remove from favorites', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('still-bbbbbb.jpg');
  await page.getByRole('navigation').getByRole('button', { name: /Favorites/ }).click();
  await expect(page.getByRole('button', { name: 'Open wallpaper bbbbbb' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove from favorites', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your favorites will live here' })).toBeVisible();
});

test('filters apply atomically and encode supported values in request and URL', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Mountains, space, minimalism…').fill('mountains');
  await dialog.getByRole('combobox', { name: 'Aspect ratio', exact: true }).selectOption('16x9');
  await dialog.getByRole('combobox', { name: 'Minimum resolution', exact: true }).selectOption('3840x2160');
  await dialog.getByRole('button', { name: 'Anime', exact: true }).click();
  await dialog.getByRole('button', { name: 'Color #0066cc' }).click();
  await dialog.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('toplist');
  await dialog.getByRole('combobox', { name: 'Time range', exact: true }).selectOption('1w');
  const requestEvent = page.waitForRequest(r => r.url().includes('/api/wallpapers?') && new URL(r.url()).searchParams.get('q') === 'mountains');
  await dialog.getByRole('button', { name: 'Show wallpapers' }).click();
  const request = new URL((await requestEvent).url());
  for (const [key, value] of Object.entries({ categories: '101', ratios: '16x9', atleast: '3840x2160', colors: '0066cc', sorting: 'toplist', topRange: '1w' })) {
    expect(request.searchParams.get(key)).toBe(value);
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  }
  expect(request.searchParams.has('seed')).toBe(false);
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.locator('.filter-summary')).toHaveCount(0);
});

test('gallery details retain selection across desk and phone navigation', async ({ page }) => {
  await mockApi(page);
  await page.goto('/gallery');
  await page.getByRole('button', { name: 'Open wallpaper cccccc' }).click();
  const dialog = page.getByRole('dialog', { name: 'Wallpaper #cccccc' });
  await expect(dialog.getByText('Uploaded by test-photographer')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'mountains', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open wallpaper cccccc' })).toBeFocused();
  await page.getByRole('button', { name: 'Open wallpaper cccccc' }).click();
  await dialog.getByRole('button', { name: 'Preview on phone', exact: true }).click();
  await expect(page).toHaveURL(/\/phone\?wallpaper=cccccc/);
  await expect(page.getByAltText('Selected wallpaper on the phone')).toHaveAttribute('src', wallpapers[2].path);
  await page.getByRole('button', { name: 'Home screen', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByLabel('Zoom').fill('1.5');
  await page.getByLabel('Horizontal position').fill('70');
  await page.reload();
  await expect(page.locator('.home-widget')).toBeVisible();
  await expect(page.locator('.phone-device')).toHaveClass(/dark-ink/);
  await expect(page.getByLabel('Zoom')).toHaveValue('1.5');
  await expect(page.getByLabel('Horizontal position')).toHaveValue('70');
  await page.getByRole('button', { name: 'Reset framing' }).click();
  await expect(page.getByLabel('Zoom')).toHaveValue('1');
  await expect(page.getByLabel('Horizontal position')).toHaveValue('50');
  await page.getByRole('button', { name: 'Back to my desk' }).click();
  await expect(page.getByRole('button', { name: 'Preview wallpaper cccccc' })).toHaveAttribute('aria-pressed', 'true');
});

test('empty results offer a filter reset and do not break the scene', async ({ page }) => {
  await mockApi(page, 'empty');
  await page.goto('/gallery?q=unfindable');
  await expect(page.getByRole('heading', { name: 'No wallpapers found' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
  await page.getByRole('button', { name: 'Back to my desk' }).click();
  await expect(page.locator('.desk-scene')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next wallpaper', exact: true })).toBeDisabled();
});

test('upstream failure keeps starter artwork and supports retry', async ({ page }) => {
  await mockApi(page, 'error');
  await page.goto('/');
  await expect(page.getByText('Wallhaven is temporarily unavailable. Your selected wallpaper is still here.')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.desk-scene')).toBeVisible();
  const requestEvent = page.waitForRequest('**/api/wallpapers?**');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await requestEvent;
});

test('desktop and mobile layouts fit viewport and provide usable lighting dialog', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Preview wallpaper aaaaaa' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Cool', exact: true })).not.toBeVisible();
  await page.screenshot({ path: '../../docs/preview-desktop.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../../docs/preview-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Lighting' }).click();
  const dialog = page.getByRole('dialog', { name: 'Light your space' });
  await dialog.getByRole('button', { name: 'Cool', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Cool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'All wallpapers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open wallpaper aaaaaa' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('portrait wallpapers preserve their full frame on both screens and phone until fill is chosen', async ({ page }) => {
  await mockApi(page);
  await page.goto('/?wallpaper=cccccc');
  const monitor = page.locator('.desk-scene .monitor-wallpaper');
  const laptop = page.locator('.desk-scene .laptop-wallpaper');
  for (const screen of [monitor, laptop]) {
    await expect(screen).toHaveAttribute('href', wallpapers[2].path);
    await expect(screen).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  }
  await page.screenshot({ path: '../../docs/preview-framing.png', fullPage: true });
  await page.getByRole('button', { name: 'View wallpaper', exact: true }).click();
  const originalPreview = page.getByRole('dialog', { name: 'Wallpaper preview', exact: true });
  await expect(originalPreview.getByRole('img')).toHaveAttribute('src', wallpapers[2].path);
  await expect(originalPreview.getByRole('img')).toHaveCSS('object-fit', 'contain');
  await page.keyboard.press('Escape');
  await expect(originalPreview).not.toBeVisible();
  await page.getByRole('button', { name: 'Fill screen', exact: true }).click();
  for (const screen of [monitor, laptop]) {
    await expect(screen).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
  }
  await page.getByRole('button', { name: 'Full image', exact: true }).click();
  for (const screen of [monitor, laptop]) {
    await expect(screen).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  }
  await page.getByRole('button', { name: 'Phone preview', exact: true }).click();
  const phone = page.getByAltText('Selected wallpaper on the phone');
  await expect(phone).toHaveAttribute('src', wallpapers[2].path);
  await expect(phone).toHaveCSS('object-fit', 'contain');
  await expect.poll(() => phone.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, 1920]);
  await page.getByRole('button', { name: 'Fill screen', exact: true }).click();
  await expect(phone).toHaveCSS('object-fit', 'cover');
  await page.getByLabel('Zoom').fill('1.5');
  await page.getByRole('button', { name: 'Reset framing' }).click();
  await expect(phone).toHaveCSS('object-fit', 'contain');
  await expect(page.getByLabel('Zoom')).toHaveValue('1');
});
