import { useCallback, useEffect, useState } from "react";
import type { Wallpaper } from "../types";

export type PreviewStatus = "loading" | "ready" | "fallback" | "error";
interface Preview {
  key: string;
  src?: string;
  status: PreviewStatus;
}
const originals = new Map<string, string>();
const MAX_CACHED_PREVIEWS = 24;

function remember(key: string, src: string) {
  originals.delete(key);
  originals.set(key, src);
  if (originals.size > MAX_CACHED_PREVIEWS)
    originals.delete(originals.keys().next().value!);
}

/** Load the selected image independently of previous selections, with a small
 * preview while its original loads. Stop stale requests on navigation. */
export function useWallpaperPreview(wallpaper: Wallpaper, enabled = true) {
  const key = `${wallpaper.id}:${wallpaper.path}`;
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<Preview>({ key, status: "loading" });
  const retry = useCallback(() => {
    originals.delete(key);
    setPreview({ key, status: "loading" });
    setAttempt((value) => value + 1);
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    const cached = originals.get(key);
    if (cached) {
      setPreview({ key, src: cached, status: "ready" });
      return;
    }
    let active = true;
    let fullReady = false;
    let fullFinished = false;
    let thumbFinished = wallpaper.id === "local";
    let thumbnail: string | undefined;
    const cancel = new Set<() => void>();
    setPreview({ key, status: "loading" });

    function load(src: string, timeout: number): Promise<string> {
      return new Promise((resolve, reject) => {
        const image = new Image();
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          image.onload = image.onerror = null;
          cancel.delete(abort);
          if (ok && image.naturalWidth > 0) resolve(src);
          else {
            image.removeAttribute("src");
            reject(new Error("Image could not be loaded"));
          }
        };
        const abort = () => finish(false);
        const timer = window.setTimeout(abort, timeout);
        cancel.add(abort);
        image.referrerPolicy = "no-referrer";
        image.onload = () => finish(true);
        image.onerror = abort;
        image.src = src;
      });
    }
    function updateFallback() {
      if (!active || fullReady) return;
      if (thumbnail)
        setPreview({
          key,
          src: thumbnail,
          status: fullFinished ? "fallback" : "loading",
        });
      else if (fullFinished && thumbFinished)
        setPreview({ key, status: "error" });
    }
    async function loadThumbnail() {
      for (const src of [
        ...new Set([wallpaper.thumbs.original, wallpaper.thumbs.large]),
      ]) {
        if (!active || fullReady) return;
        try {
          thumbnail = await load(src, 8000);
          break;
        } catch {
          /* Try the other thumbnail. */
        }
      }
      thumbFinished = true;
      updateFallback();
    }
    async function loadOriginal() {
      const sources =
        wallpaper.id === "local"
          ? [wallpaper.path]
          : [`/api/wallpapers/${wallpaper.id}/image`, wallpaper.path];
      for (const src of sources) {
        if (!active) return;
        try {
          await load(src, src.startsWith("/api/") ? 30000 : 12000);
          if (!active) return;
          fullReady = true;
          remember(key, src);
          setPreview({ key, src, status: "ready" });
          return;
        } catch {
          /* Browser/CDN failure: try the independent source. */
        }
      }
      fullFinished = true;
      updateFallback();
    }
    if (wallpaper.id !== "local") void loadThumbnail();
    void loadOriginal();
    return () => {
      active = false;
      cancel.forEach((abort) => abort());
    };
  }, [
    key,
    wallpaper.id,
    wallpaper.path,
    wallpaper.thumbs.original,
    wallpaper.thumbs.large,
    attempt,
    enabled,
  ]);

  // Never label an earlier wallpaper as the newly selected one, even for a render.
  return {
    ...(preview.key === key
      ? preview
      : { key, status: "loading" as PreviewStatus }),
    retry,
  };
}
