import type { Filters, Listing, Wallpaper } from "./types";
export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { signal });
  if (!response.ok) {
    let message = "Could not load wallpapers. Please try again.";
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      /* keep readable fallback */
    }
    if (response.status === 429)
      message = "Wallhaven needs a moment. Please try again in a minute.";
    if (response.status >= 500)
      message =
        "Wallhaven is temporarily unavailable. Your selected wallpaper is still here.";
    throw new Error(message);
  }
  return response.json();
}
export function getWallpapers(
  filters: Filters,
  page: number,
  seed: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  params.set("page", String(page));
  if (filters.sorting === "random") params.set("seed", seed);
  return api<Listing>(`/wallpapers?${params}`, signal);
}
export const getWallpaper = (id: string, signal?: AbortSignal) =>
  api<{ data: Wallpaper }>(`/wallpapers/${id}`, signal);
export function seed() {
  const values = crypto.getRandomValues(new Uint8Array(6));
  return [...values]
    .map((v) => "abcdefghijklmnopqrstuvwxyz0123456789"[v % 36])
    .join("");
}
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private mode and full storage should not break browsing. */
  }
}
