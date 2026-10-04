# Browser validation

Validated on 2026-10-04 against the Docker application at `http://127.0.0.1:8000` using Playwright Chromium. Result: **7 tests passed** in 5.6 seconds. The framing regression was then rerun successfully to capture its additional screenshot.

The suite verifies:

- Desk wallpaper selection using keyboard arrows, opening and closing lighting controls, persisted favorites, and original download interaction.
- Filter application and matching URL/API parameters for categories, ratio, resolution, color, sorting, and period.
- Gallery details, Escape dismissal and focus restoration, navigation to phone preview and back, persisted phone settings, and crop reset.
- Empty results, filter reset, and a working desk scene with disabled navigation.
- Upstream failure messaging, retained starter artwork, and retry.
- Desktop (1440 × 1100) and mobile (390 × 844) layouts without horizontal page overflow, lighting initially collapsed, mobile lighting dialog, and gallery navigation.
- A true 1080 × 1920 portrait fixture preserves its complete frame on both the monitor and laptop by default. Choosing Fill screen enables cropping; Full image restores the complete frame. Phone preview defaults to contain, supports explicit cover mode, and restores contain and 100% zoom on framing reset.

Wallhaven API responses, image CDN responses, and the download response are mocked for reproducibility. This suite verifies browser behavior; it does not establish live Wallhaven availability or validate actual downloaded image bytes. CDN images are replaced with the shipped SVG artwork or a portrait SVG with border markers, and external fonts are disabled.

The screenshots below are **QA fixture previews**, not live wallpaper results. They were visually reviewed for scene composition, control placement, and responsive layout:

- [Desktop preview](preview-desktop.png)
- [Mobile preview](preview-mobile.png)
- [Portrait framing preview](preview-framing.png)

Visual review confirmed the English interface, graphite and blue palette, level laptop and keyboard, removed figurine, and complete scene visible on mobile. The portrait screenshot shows all four border edges on both desk screens, with empty space at the sides instead of cropping.

Run with the Docker application already started:

```bash
cd tests/browser
npm ci
npx playwright install chromium
npm test
```

Set `BASE_URL` to test another server. Failure screenshots and traces are written to `tests/browser/test-results/`. The layout and framing tests refresh the three preview images in `docs/`.

The original filter test used an exact label-text locator on a label containing a select. Playwright included descendant option text in that lookup, so it did not match. The test now locates the combobox by its accessible name. No application change was needed.
