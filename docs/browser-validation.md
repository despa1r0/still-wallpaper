# Browser validation

Validated on 2026-10-08 against the rebuilt local application at `http://127.0.0.1:8001` using Playwright Chromium. Result: **12 tests passed** in 7.5 seconds.

The suite verifies:

- Desk wallpaper selection using keyboard arrows, opening and closing lighting controls, persisted favorites, and original download interaction.
- Filter application and matching URL/API parameters for categories, ratio, resolution, color, sorting, and period.
- Gallery details, Escape dismissal and focus restoration, navigation to phone preview and back, persisted phone settings, and crop reset.
- Empty results, filter reset, and a working desk scene with disabled navigation.
- Upstream failure messaging, retained starter artwork, and retry.
- Desktop (1440 × 1100) and mobile (390 × 844) layouts without horizontal page overflow, lighting initially collapsed, mobile lighting dialog, and gallery navigation.
- A true 1080 × 1920 portrait fixture preserves its complete frame on both the monitor and laptop by default. Choosing Fill screen enables cropping; Full image restores the complete frame. Phone preview defaults to contain, supports explicit cover mode, and restores contain and 100% zoom on framing reset.

- Image proxy failure recovers through the direct original URL.
- When both original sources return 404, the selected wallpaper’s thumbnail remains visible on the desk, in View wallpaper, and on the phone, with an explicit smaller-preview notice.
- Complete image failure clears the previous wallpaper from both desk screens; Retry preview loads the selected wallpaper after recovery.
- An original request delayed across a selection change cannot replace the newly selected wallpaper.
- Phone framing preserves portrait edges, supports zoom and positioning by slider and pointer dragging, and resets zoom and position when a different wallpaper is selected.

Wallhaven API responses, same-origin image responses, image CDN responses, and the download response are mocked for reproducibility. This suite verifies browser behavior; it does not establish live Wallhaven availability or validate actual downloaded image bytes. CDN images are replaced with the shipped SVG artwork or a portrait SVG with border markers, and external fonts are disabled.

Screenshots are **QA fixture previews**, not live wallpaper results. Browser tests save them in the root `previews/` directory, which is excluded by `.gitignore`. They remain local and are not committed. The following files were visually reviewed for scene composition, control placement, and responsive layout:

- `previews/preview-desktop.png` — Desktop preview
- `previews/preview-mobile.png` — Mobile preview
- `previews/preview-framing.png` — Portrait framing preview
- `previews/preview-phone.png` — Phone framing preview

Visual review confirmed the English interface, graphite and blue palette, level laptop and keyboard, removed figurine, and complete scene visible on mobile. The portrait screenshot shows all four border edges on both desk screens, with empty space at the sides instead of cropping. The phone screenshot was visually reviewed: all portrait border edges remain visible, and framing controls fit a 390-pixel-wide viewport.

Run with the Docker application already started:

```bash
cd tests/browser
npm ci
npx playwright install chromium
npm test
```

Set `BASE_URL` to test another server. Failure screenshots and traces are written to `tests/browser/test-results/`. The layout and framing tests refresh the four preview images in `docs/`.

Full-preview image assertions target the wallpaper’s accessible name so decorative SVG button icons do not make the locator ambiguous. Tests serve actual image bytes at `/api/wallpapers/{id}/image` and wait for the expected original source instead of asserting during thumbnail loading.
