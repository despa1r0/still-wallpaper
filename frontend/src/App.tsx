import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  Heart,
  ImageOff,
  LayoutGrid,
  Lightbulb,
  LoaderCircle,
  Monitor,
  Search,
  Shuffle,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  X,
  ExternalLink,
  WifiOff,
} from "lucide-react";
import {
  getWallpaper,
  getWallpapers,
  readStorage,
  seed,
  writeStorage,
} from "./api";
import {
  defaults,
  starter,
  type Filters as FilterValues,
  type Lighting,
  type Wallpaper,
} from "./types";
import DeskScene from "./components/DeskScene";
import FilterPanel from "./components/Filters";
import PhonePreview from "./components/PhonePreview";
import Dialog from "./components/Dialog";

function validWallpaper(value: unknown): value is Wallpaper {
  if (!value || typeof value !== "object") return false;
  const v = value as Wallpaper;
  return (
    typeof v.id === "string" &&
    /^[a-z0-9]{6}$/.test(v.id) &&
    typeof v.path === "string" &&
    /^https:\/\/w\.wallhaven\.cc\//.test(v.path) &&
    typeof v.thumbs?.large === "string" &&
    typeof v.resolution === "string" &&
    Array.isArray(v.colors)
  );
}
function initialLighting(): Lighting {
  const saved = readStorage<Partial<Lighting>>("still-light", {});
  return {
    temperature: ["warm", "neutral", "cool"].includes(saved?.temperature || "")
      ? saved.temperature!
      : "warm",
    brightness:
      typeof saved?.brightness === "number"
        ? Math.min(100, Math.max(0, saved.brightness))
        : 70,
    lamp: typeof saved?.lamp === "boolean" ? saved.lamp : true,
    garland: typeof saved?.garland === "boolean" ? saved.garland : true,
  };
}
function WallpaperImage({
  wallpaper,
  full = false,
}: {
  wallpaper: Wallpaper;
  full?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [wallpaper.id]);
  return failed ? (
    <div className="image-unavailable">
      <ImageOff size={24} />
      <span>Image unavailable</span>
    </div>
  ) : (
    <img
      src={full ? wallpaper.path : wallpaper.thumbs.large}
      alt={`Wallpaper ${wallpaper.id}, ${wallpaper.resolution}`}
      loading={full ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}
function App() {
  const location = useLocation(),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode =
    location.pathname === "/gallery"
      ? "gallery"
      : location.pathname === "/favorites"
        ? "favorites"
        : location.pathname === "/phone"
          ? "phone"
          : "desk";
  const filters = useMemo(() => {
    const f = { ...defaults };
    (Object.keys(f) as (keyof FilterValues)[]).forEach((k) => {
      if (params.has(k)) f[k] = params.get(k)!;
    });
    return f;
  }, [params]);
  const [randomSeed, setRandomSeed] = useState(
    () => params.get("seed")?.match(/^[a-zA-Z0-9]{6}$/)?.[0] || seed(),
  );
  const activeSeed =
    params.get("seed")?.match(/^[a-zA-Z0-9]{6}$/)?.[0] || randomSeed;
  const [selected, setSelected] = useState<Wallpaper>(() => {
    const saved = readStorage<unknown>("still-wallpaper", null);
    return validWallpaper(saved) ? saved : starter;
  });
  const [displayedImage, setDisplayedImage] = useState(starter.path);
  const [previewStatus, setPreviewStatus] = useState<
    "ready" | "loading" | "error"
  >("ready");
  const [favorites, setFavorites] = useState<Wallpaper[]>(() => {
    const value = readStorage<unknown>("still-favorites", []);
    return Array.isArray(value) ? value.filter(validWallpaper) : [];
  });
  const [lighting, setLighting] = useState<Lighting>(initialLighting);
  const [previewFit, setPreviewFit] = useState<"contain" | "cover">(() =>
    readStorage<string>("still-preview-fit", "contain") === "cover"
      ? "cover"
      : "contain",
  );
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const lightingButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    writeStorage("still-preview-fit", previewFit);
  }, [previewFit]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const onChange = () => setCompact(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  const [filtersOpen, setFiltersOpen] = useState(false),
    [lightOpen, setLightOpen] = useState(false),
    [modal, setModal] = useState<Wallpaper | null>(null),
    [expanded, setExpanded] = useState(false),
    [toast, setToast] = useState(""),
    [downloading, setDownloading] = useState(false);
  useEffect(() => {
    if (!lightOpen || compact) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightOpen(false);
        lightingButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [lightOpen, compact]);
  const galleryScroll = useRef(0);
  const loadMarker = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const listing = useInfiniteQuery({
    queryKey: ["wallpapers", filters, activeSeed],
    queryFn: ({ pageParam, signal }) =>
      getWallpapers(filters, pageParam, activeSeed, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.current_page < last.meta.last_page
        ? last.meta.current_page + 1
        : undefined,
  });
  const wallpapers = useMemo(
    () => [
      ...new Map(
        (listing.data?.pages.flatMap((p) => p.data) || []).map((w) => [
          w.id,
          w,
        ]),
      ).values(),
    ],
    [listing.data],
  );
  const deepId = params.get("wallpaper");
  const deepLink = useQuery({
    queryKey: ["wallpaper", deepId],
    queryFn: ({ signal }) => getWallpaper(deepId!, signal),
    enabled: !!deepId && /^[a-z0-9]{6}$/.test(deepId) && deepId !== selected.id,
    retry: 1,
  });
  const detail = useQuery({
    queryKey: ["wallpaper", modal?.id],
    queryFn: ({ signal }) => getWallpaper(modal!.id, signal),
    enabled: !!modal && modal.id !== "local",
  });
  useEffect(() => {
    if (deepLink.data?.data && deepLink.data.data.id === deepId)
      setSelected(deepLink.data.data);
  }, [deepLink.data, deepId]);
  useEffect(() => {
    if (selected.id === "local" && wallpapers.length && !deepId)
      setSelected(wallpapers[0]);
  }, [wallpapers, selected.id, deepId]);
  useEffect(() => {
    if (selected.id !== "local") writeStorage("still-wallpaper", selected);
  }, [selected]);
  useEffect(() => {
    let active = true;
    const image = new Image();
    setPreviewStatus("loading");
    image.onload = () => {
      if (active) {
        setDisplayedImage(selected.path);
        setPreviewStatus("ready");
      }
    };
    image.onerror = () => {
      if (active) setPreviewStatus("error");
    };
    image.src = selected.path;
    return () => {
      active = false;
    };
  }, [selected.path]);
  useEffect(() => {
    document.title =
      {
        desk: "My desk",
        gallery: "All wallpapers",
        favorites: "Favorites",
        phone: "Phone preview",
      }[mode] + " — still.";
  }, [mode]);
  useEffect(() => writeStorage("still-favorites", favorites), [favorites]);
  useEffect(() => writeStorage("still-light", lighting), [lighting]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (deepLink.isError)
      setToast("Could not open this wallpaper. Try finding it in the gallery.");
  }, [deepLink.isError]);
  useEffect(() => {
    const index = wallpapers.findIndex((w) => w.id === selected.id);
    const next = wallpapers[index + 1];
    if (next) {
      const img = new Image();
      img.src = next.path;
    }
  }, [selected.id, wallpapers]);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      window.scrollTo(0, mode === "gallery" ? galleryScroll.current : 0),
    );
    return () => cancelAnimationFrame(frame);
  }, [mode]);
  useEffect(() => {
    if (
      mode !== "gallery" ||
      !loadMarker.current ||
      !listing.hasNextPage ||
      listing.isFetchingNextPage ||
      listing.isFetchNextPageError
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void listing.fetchNextPage();
      },
      { rootMargin: "500px" },
    );
    observer.observe(loadMarker.current);
    return () => observer.disconnect();
  }, [
    mode,
    listing.hasNextPage,
    listing.isFetchingNextPage,
    listing.isFetchNextPageError,
    listing.fetchNextPage,
    wallpapers.length,
  ]);
  const selectedIndex = wallpapers.findIndex((w) => w.id === selected.id);
  const pick = useCallback(
    (wallpaper: Wallpaper) => {
      setSelected(wallpaper);
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (wallpaper.id !== "local") next.set("wallpaper", wallpaper.id);
          else next.delete("wallpaper");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  const step = useCallback(
    async (direction: number) => {
      if (!wallpapers.length) return;
      const next = selectedIndex + direction;
      if (next >= 0 && next < wallpapers.length) {
        pick(wallpapers[next]);
        return;
      }
      if (direction > 0 && listing.hasNextPage && !listing.isFetchingNextPage) {
        const result = await listing.fetchNextPage();
        const first = result.data?.pages
          .at(-1)
          ?.data.find(
            (w) => !wallpapers.some((current) => current.id === w.id),
          );
        if (first) pick(first);
      } else if (direction > 0 && !listing.hasNextPage) pick(wallpapers[0]);
    },
    [
      wallpapers,
      selectedIndex,
      pick,
      listing.hasNextPage,
      listing.isFetchingNextPage,
      listing.fetchNextPage,
    ],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        mode !== "desk" ||
        modal ||
        filtersOpen ||
        expanded ||
        wallpaperOpen ||
        lightOpen ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        (e.target instanceof HTMLElement &&
          e.target.closest("input,textarea,select,button,[contenteditable]"))
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        void step(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        void step(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, modal, filtersOpen, expanded, wallpaperOpen, lightOpen, step]);
  function go(path: string) {
    setLightOpen(false);
    if (mode === "gallery") galleryScroll.current = window.scrollY;
    navigate(`${path}${params.size ? "?" + params.toString() : ""}`);
    setModal(null);
  }
  function applyFilters(next: FilterValues) {
    const p = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value && value !== defaults[key as keyof FilterValues])
        p.set(key, value);
    });
    const newSeed = seed();
    p.set("seed", newSeed);
    setRandomSeed(newSeed);
    setParams(p);
    setSelected(starter);
    galleryScroll.current = 0;
  }
  function shuffle() {
    applyFilters({ ...filters, sorting: "random" });
  }
  function toggleFavorite(wallpaper: Wallpaper) {
    if (wallpaper.id === "local") return;
    setFavorites((previous) =>
      previous.some((w) => w.id === wallpaper.id)
        ? previous.filter((w) => w.id !== wallpaper.id)
        : [wallpaper, ...previous],
    );
  }
  async function download(wallpaper = selected) {
    if (downloading) return;
    setDownloading(true);
    try {
      const url =
        wallpaper.id === "local"
          ? wallpaper.path
          : `/api/wallpapers/${wallpaper.id}/download`;
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          "Could not download the original. Try again or open it on Wallhaven.",
        );
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `still-${wallpaper.id}.${blob.type.includes("png") ? "png" : blob.type.includes("svg") ? "svg" : "jpg"}`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setToast("Your wallpaper is ready. The download has started.");
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Could not download the wallpaper.",
      );
    } finally {
      setDownloading(false);
    }
  }
  const count = Object.entries(filters).filter(
    ([k, v]) => v !== defaults[k as keyof FilterValues] && k !== "topRange",
  ).length;
  const isFavorite = favorites.some((w) => w.id === selected.id);
  const modalWallpaper = detail.data?.data || modal;
  const filterSummary = [
    filters.q,
    filters.ratios
      .replace("landscape", "Landscape")
      .replace("portrait", "Portrait"),
    filters.atleast,
    filters.colors ? "#" + filters.colors : "",
  ].filter(Boolean);
  const error =
    listing.error instanceof Error
      ? listing.error.message
      : "Could not load this collection.";
  const lightControls = (
    <>
      <div className="control-heading">
        <span>
          <Sun size={17} /> Lighting
        </span>
        <button
          className="icon-button"
          aria-label="Close lighting settings"
          onClick={() => {
            setLightOpen(false);
            lightingButton.current?.focus();
          }}
        >
          <X size={15} />
        </button>
      </div>
      <div className="temperature-options">
        {(["warm", "neutral", "cool"] as const).map((value, i) => (
          <button
            key={value}
            className={lighting.temperature === value ? "active" : ""}
            aria-pressed={lighting.temperature === value}
            onClick={() => setLighting((l) => ({ ...l, temperature: value }))}
          >
            <span className={`temperature-dot ${value}`} />
            {["Warm", "Daylight", "Cool"][i]}
          </button>
        ))}
      </div>
      <label className="range-label brightness-label">
        <span>
          <Sun size={14} /> Brightness
        </span>
        <span>{lighting.brightness}%</span>
        <input
          type="range"
          min="0"
          max="100"
          value={lighting.brightness}
          onChange={(e) =>
            setLighting((l) => ({ ...l, brightness: Number(e.target.value) }))
          }
        />
      </label>
      <div className="light-toggles">
        <button
          role="switch"
          aria-checked={lighting.lamp}
          onClick={() => setLighting((l) => ({ ...l, lamp: !l.lamp }))}
        >
          <span>Lamp</span>
          <i className={lighting.lamp ? "on" : ""} />
        </button>
        <button
          role="switch"
          aria-checked={lighting.garland}
          onClick={() => setLighting((l) => ({ ...l, garland: !l.garland }))}
        >
          <span>String lights</span>
          <i className={lighting.garland ? "on" : ""} />
        </button>
      </div>
    </>
  );
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <Link
          className="brand"
          to={`/${params.size ? "?" + params.toString() : ""}`}
          aria-label="still. — home"
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          still<span className="brand-dot">.</span>
          <span className="brand-caption">WALLPAPER STUDIO</span>
        </Link>
        <nav aria-label="Main navigation">
          <button
            className={mode === "desk" ? "active" : ""}
            onClick={() => go("/")}
          >
            <Monitor size={16} /> My desk
          </button>
          <button
            className={mode === "gallery" ? "active" : ""}
            onClick={() => go("/gallery")}
          >
            <LayoutGrid size={16} /> All wallpapers
          </button>
          <button
            className={mode === "favorites" ? "active" : ""}
            onClick={() => go("/favorites")}
          >
            <Heart size={16} /> Favorites
            {favorites.length > 0 && (
              <span className="nav-count">{favorites.length}</span>
            )}
          </button>
        </nav>
        <div className="header-note">
          <span />A little space for your mood
        </div>
      </header>
      <main id="main">
        {mode === "desk" && (
          <>
            <section className="page-intro">
              <div>
                <div className="eyebrow">
                  <span className="mini-line" /> YOUR EVERYDAY VIEW
                </div>
                <h1>
                  Fresh wallpaper. <span>A different mood.</span>
                </h1>
                <p>Try it on your desk. Set the light. Find your favorite.</p>
              </div>
              <button
                className="button subtle phone-link"
                onClick={() => go("/phone")}
              >
                <Smartphone size={17} /> Phone preview <ArrowRight size={16} />
              </button>
            </section>
            <section className="studio" aria-label="Wallpaper studio">
              <div className="studio-controls">
                <button
                  ref={lightingButton}
                  className="button subtle"
                  aria-expanded={lightOpen}
                  aria-controls="lighting-settings"
                  onClick={() => setLightOpen((open) => !open)}
                >
                  <Lightbulb size={15} /> Lighting
                </button>
                <div className="preview-fit">
                  <span>Image framing</span>
                  <div className="segmented" aria-label="Desktop image framing">
                    <button
                      aria-pressed={previewFit === "contain"}
                      className={previewFit === "contain" ? "active" : ""}
                      onClick={() => setPreviewFit("contain")}
                    >
                      Full image
                    </button>
                    <button
                      aria-pressed={previewFit === "cover"}
                      className={previewFit === "cover" ? "active" : ""}
                      onClick={() => setPreviewFit("cover")}
                    >
                      Fill screen
                    </button>
                  </div>
                </div>
                <button
                  className="button subtle"
                  onClick={() => setWallpaperOpen(true)}
                >
                  <Expand size={15} /> View wallpaper
                </button>
              </div>
              <div className="studio-art">
                <div className="scene-topline">
                  <span className="scene-label">
                    <span /> YOUR SPACE
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => setExpanded(true)}
                    aria-label="Expand desk preview"
                  >
                    <Expand size={17} />
                  </button>
                </div>
                <div
                  className="scene-wrap"
                  onTouchStart={(e) => {
                    touch.current = e.touches[0].clientX;
                  }}
                  onTouchEnd={(e) => {
                    if (
                      touch.current !== null &&
                      Math.abs(e.changedTouches[0].clientX - touch.current) > 60
                    )
                      void step(
                        e.changedTouches[0].clientX < touch.current ? 1 : -1,
                      );
                    touch.current = null;
                  }}
                >
                  <DeskScene
                    image={displayedImage}
                    lighting={lighting}
                    fit={previewFit}
                  />
                </div>
                <div className="preview-status" role="status">
                  {previewStatus === "loading" && (
                    <>
                      <LoaderCircle size={13} className="spin" /> Loading
                      preview…
                    </>
                  )}
                  {previewStatus === "error" && (
                    <>
                      <ImageOff size={13} /> Preview unavailable · showing your
                      previous wallpaper
                    </>
                  )}
                </div>
                {lightOpen && !compact && (
                  <aside
                    id="lighting-settings"
                    className="lighting-panel"
                    aria-label="Lighting settings"
                  >
                    {lightControls}
                  </aside>
                )}
                <div className="scene-bottomline">
                  <span className="scene-credit">
                    {selected.id === "local"
                      ? "STARTER ARTWORK · QUIET VALLEY"
                      : `WALLHAVEN / ${selected.id.toUpperCase()}`}
                  </span>
                  <div className="scene-hints">
                    <span>←</span>
                    <span>→</span> to change wallpaper
                  </div>
                </div>
              </div>
            </section>
            <div className="wallpaper-toolbar">
              <div className="wallpaper-info">
                <span className="wallpaper-number">
                  {selected.id === "local"
                    ? "—"
                    : String(Math.max(0, selectedIndex) + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>
                    {selected.id === "local"
                      ? "Quiet Valley"
                      : `Wallpaper #${selected.id}`}
                  </strong>
                  <span>
                    {selected.resolution.replace("x", " × ")} <b>·</b>{" "}
                    {selected.id === "local"
                      ? "Artwork by still."
                      : "Wallhaven"}
                  </span>
                </div>
                <div className="palette">
                  {selected.colors.slice(0, 4).map((color, i) => (
                    <i key={i} style={{ background: color }} />
                  ))}
                </div>
              </div>
              <div className="browse-controls">
                <button
                  className="icon-button"
                  aria-label="Previous wallpaper"
                  disabled={selectedIndex <= 0}
                  onClick={() => void step(-1)}
                >
                  <ChevronLeft size={21} />
                </button>
                <button
                  className="button shuffle-button"
                  onClick={shuffle}
                  disabled={listing.isFetching}
                >
                  <Shuffle size={16} /> Shuffle wallpapers
                </button>
                <button
                  className="icon-button"
                  aria-label="Next wallpaper"
                  disabled={!wallpapers.length || listing.isFetchingNextPage}
                  onClick={() => void step(1)}
                >
                  <ChevronRight size={21} />
                </button>
              </div>
              <div className="save-controls">
                <button
                  className={`icon-button favorite-button ${isFavorite ? "saved" : ""}`}
                  aria-label={
                    isFavorite ? "Remove from favorites" : "Add to favorites"
                  }
                  aria-pressed={isFavorite}
                  disabled={selected.id === "local"}
                  onClick={() => toggleFavorite(selected)}
                >
                  <Heart
                    size={19}
                    fill={isFavorite ? "currentColor" : "none"}
                  />
                </button>
                <button
                  className="button primary"
                  disabled={downloading}
                  onClick={() => void download()}
                >
                  {downloading ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Download size={17} />
                  )}
                  <span>Download</span>
                </button>
              </div>
            </div>
            <section className="discovery">
              <div className="section-heading">
                <div>
                  <h2>
                    A little more inspiration{" "}
                    <span className="tiny-label">PICKED FOR YOU</span>
                  </h2>
                </div>
                <div className="section-actions">
                  <button
                    className="text-button"
                    onClick={() => setFiltersOpen(true)}
                  >
                    <SlidersHorizontal size={15} /> Filters
                    {count > 0 && <span className="badge">{count}</span>}
                  </button>
                  <span className="separator" />
                  <button
                    className="text-button"
                    onClick={() => go("/gallery")}
                  >
                    All wallpapers <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              {filterSummary.length > 0 && (
                <div className="filter-summary">
                  {filterSummary.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                  <button
                    onClick={() => applyFilters({ ...defaults })}
                    aria-label="Reset filters"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {listing.isPending ? (
                <div className="thumbnail-strip">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="thumbnail skeleton" />
                  ))}
                </div>
              ) : wallpapers.length ? (
                <div className="thumbnail-strip">
                  {wallpapers.map((w) => (
                    <button
                      key={w.id}
                      className={`thumbnail ${selected.id === w.id ? "selected" : ""}`}
                      onClick={() => pick(w)}
                      aria-label={`Preview wallpaper ${w.id}`}
                      aria-pressed={selected.id === w.id}
                    >
                      <WallpaperImage wallpaper={w} />
                      {selected.id === w.id && (
                        <span className="selected-check">
                          <Check size={12} />
                        </span>
                      )}
                      <span className="thumbnail-res">{w.resolution}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="inline-empty">
                  {listing.isError ? (
                    <WifiOff size={20} />
                  ) : (
                    <Search size={20} />
                  )}
                  <span>
                    {listing.isError
                      ? error
                      : "No wallpapers match these filters. Try adjusting your selection."}
                  </span>
                  <button
                    className="text-button"
                    onClick={() =>
                      listing.isError
                        ? void listing.refetch()
                        : setFiltersOpen(true)
                    }
                  >
                    {listing.isError ? "Try again" : "Edit filters"}{" "}
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </section>
          </>
        )}
        {(mode === "gallery" || mode === "favorites") && (
          <>
            <section className="page-intro gallery-intro">
              <div>
                <div className="eyebrow">
                  <span className="mini-line" />{" "}
                  {mode === "favorites"
                    ? "SAVED BY YOU"
                    : "A WALL OF INSPIRATION"}
                </div>
                <h1>
                  {mode === "favorites" ? "Your favorites." : "Find your view."}{" "}
                  <span>
                    {mode === "favorites"
                      ? "All in one place."
                      : "A world of possibilities."}
                  </span>
                </h1>
                <p>
                  {mode === "favorites"
                    ? "Your collection is saved in this browser."
                    : "Landscapes, art, and little reasons to open your laptop."}
                </p>
              </div>
              <button className="button subtle" onClick={() => go("/")}>
                <ArrowLeft size={16} /> Back to my desk
              </button>
            </section>
            {mode === "gallery" && (
              <div className="gallery-controls">
                <form
                  className="search-field"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = new FormData(e.currentTarget).get(
                      "q",
                    ) as string;
                    applyFilters({ ...filters, q: value });
                  }}
                >
                  <Search size={18} />
                  <input
                    key={filters.q}
                    name="q"
                    placeholder="Search for a mood…"
                    defaultValue={filters.q}
                    aria-label="Search wallpapers"
                    maxLength={200}
                  />
                  <button className="icon-button" aria-label="Search">
                    <ArrowRight size={17} />
                  </button>
                </form>
                <div className="device-filters">
                  {[
                    ["", "All"],
                    ["landscape", "Desktop"],
                    ["portrait", "Phone"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={filters.ratios === value ? "active" : ""}
                      onClick={() =>
                        applyFilters({ ...filters, ratios: value, atleast: "" })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  className="button subtle"
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontal size={16} /> Filters
                  {count > 0 && <span className="badge">{count}</span>}
                </button>
                <button
                  className="icon-button"
                  aria-label="Shuffle collection"
                  onClick={shuffle}
                >
                  <Shuffle size={18} />
                </button>
              </div>
            )}
            {mode === "gallery" && filterSummary.length > 0 && (
              <div className="filter-summary">
                {filterSummary.map((s) => (
                  <span key={s}>{s}</span>
                ))}
                <button
                  className="text-button"
                  onClick={() => applyFilters({ ...defaults })}
                >
                  <X size={14} /> Reset
                </button>
              </div>
            )}
            {mode === "gallery" && listing.isPending ? (
              <div className="wall-grid">
                {Array.from({ length: 12 }, (_, i) => (
                  <div
                    key={i}
                    className="wall-card skeleton"
                    style={{ aspectRatio: i % 3 === 0 ? "3/4" : "4/3" }}
                  />
                ))}
              </div>
            ) : (
              <div className="wall-grid">
                {(mode === "favorites" ? favorites : wallpapers).map((w) => (
                  <article
                    className="wall-card"
                    key={w.id}
                    style={{
                      aspectRatio: `${w.dimension_x || 16}/${w.dimension_y || 9}`,
                    }}
                  >
                    <button
                      className="wall-image-button"
                      onClick={() => setModal(w)}
                      aria-label={`Open wallpaper ${w.id}`}
                    >
                      <WallpaperImage wallpaper={w} />
                    </button>
                    <div className="wall-card-meta">
                      <span>{w.resolution.replace("x", " × ")}</span>
                      <button
                        aria-label={
                          favorites.some((f) => f.id === w.id)
                            ? "Remove from favorites"
                            : "Save wallpaper"
                        }
                        aria-pressed={favorites.some((f) => f.id === w.id)}
                        className="icon-button"
                        onClick={() => toggleFavorite(w)}
                      >
                        <Heart
                          size={17}
                          fill={
                            favorites.some((f) => f.id === w.id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {((mode === "favorites" && !favorites.length) ||
              (mode === "gallery" &&
                !listing.isPending &&
                !wallpapers.length)) && (
              <div className="empty-state">
                {mode === "favorites" ? (
                  <Heart size={38} />
                ) : listing.isError ? (
                  <WifiOff size={38} />
                ) : (
                  <Search size={38} />
                )}
                <h2>
                  {mode === "favorites"
                    ? "Your favorites will live here"
                    : listing.isError
                      ? "Taking a short break"
                      : "No wallpapers found"}
                </h2>
                <p>
                  {mode === "favorites"
                    ? "Tap the heart on a wallpaper to save it here."
                    : listing.isError
                      ? error
                      : "Try removing a filter or changing your search."}
                </p>
                <button
                  className="button primary"
                  onClick={() =>
                    mode === "favorites"
                      ? go("/gallery")
                      : listing.isError
                        ? void listing.refetch()
                        : applyFilters({ ...defaults })
                  }
                >
                  {mode === "favorites"
                    ? "Explore wallpapers"
                    : listing.isError
                      ? "Try again"
                      : "Reset filters"}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            {mode === "gallery" && wallpapers.length > 0 && (
              <div ref={loadMarker} className="load-more">
                {listing.isFetchingNextPage ? (
                  <>
                    <LoaderCircle size={20} className="spin" /> Finding more
                    inspiration…
                  </>
                ) : listing.hasNextPage ? (
                  <button
                    className="button subtle"
                    onClick={() => void listing.fetchNextPage()}
                  >
                    {listing.isFetchNextPageError
                      ? "Could not load. Try again"
                      : "Load more"}
                    <ArrowDown size={16} />
                  </button>
                ) : (
                  <span>
                    You have seen the whole collection. Time to pick a favorite.
                  </span>
                )}
              </div>
            )}
          </>
        )}
        {mode === "phone" && (
          <>
            <section className="page-intro">
              <div>
                <div className="eyebrow">
                  <span className="mini-line" /> MADE FOR YOUR PHONE
                </div>
                <h1>
                  Your own little <span>personal world.</span>
                </h1>
              </div>
              <button className="button subtle" onClick={() => go("/")}>
                <ArrowLeft size={16} /> Back to my desk
              </button>
            </section>
            <PhonePreview
              wallpaper={selected}
              onDownload={() => void download()}
              downloading={downloading}
            />
          </>
        )}
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          still<span>.</span> <span>Less noise. More you.</span>
        </span>
        <span
          className={`connection-status ${listing.isError ? "offline" : ""}`}
        >
          <i />
          {listing.isPending
            ? "Connecting to Wallhaven"
            : listing.isError
              ? "Wallhaven unavailable"
              : "Wallpapers from Wallhaven"}
          <span className="footer-separator">/</span>
          <a href="https://wallhaven.cc" target="_blank" rel="noreferrer">
            wallhaven.cc <ExternalLink size={11} />
          </a>
        </span>
      </footer>
      {filtersOpen && (
        <FilterPanel
          value={filters}
          onApply={applyFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}
      {lightOpen && compact && (
        <Dialog title="Light your space" onClose={() => setLightOpen(false)}>
          <div id="lighting-settings" className="mobile-light-controls">
            {lightControls}
          </div>
        </Dialog>
      )}
      {wallpaperOpen && (
        <Dialog
          title="Wallpaper preview"
          onClose={() => setWallpaperOpen(false)}
          wide
        >
          <div className="full-wallpaper-preview">
            <WallpaperImage wallpaper={selected} full />
          </div>
          <div className="dialog-actions">
            <span className="muted">
              {selected.resolution.replace("x", " × ")} · Full image
            </span>
            <button
              className="button primary"
              disabled={downloading}
              onClick={() => void download()}
            >
              <Download size={16} />
              {downloading ? "Downloading…" : "Download original"}
            </button>
          </div>
        </Dialog>
      )}
      {expanded && (
        <Dialog title="Your space" onClose={() => setExpanded(false)} wide>
          <DeskScene
            image={displayedImage}
            lighting={lighting}
            fit={previewFit}
          />
          <div className="dialog-actions">
            <button
              className="button subtle"
              onClick={() => void step(-1)}
              disabled={selectedIndex <= 0}
            >
              <ChevronLeft size={18} /> Previous
            </button>
            <button
              className="button primary"
              onClick={() => void step(1)}
              disabled={!wallpapers.length}
            >
              Next wallpaper <ChevronRight size={18} />
            </button>
          </div>
        </Dialog>
      )}
      {modal && modalWallpaper && (
        <Dialog
          title={`Wallpaper #${modal.id}`}
          onClose={() => setModal(null)}
          wide
        >
          <div className="detail-layout">
            <div className="detail-image">
              <WallpaperImage wallpaper={modalWallpaper} full />
            </div>
            <div className="detail-controls">
              <div className="eyebrow">YOUR NEXT FAVORITE</div>
              <h3>{modalWallpaper.resolution.replace("x", " × ")}</h3>
              <p className="muted">
                {modalWallpaper.uploader
                  ? `Uploaded by ${modalWallpaper.uploader.username}`
                  : "Wallhaven collection"}
              </p>
              <div className="palette large">
                {modalWallpaper.colors.map((c, i) => (
                  <i key={i} style={{ background: c }} />
                ))}
              </div>
              <div className="detail-tags">
                {modalWallpaper.tags?.map((t) => (
                  <button
                    key={t.id}
                    className="chip"
                    onClick={() => {
                      applyFilters({ ...defaults, q: `id:${t.id}` });
                      setModal(null);
                      navigate(
                        "/gallery?q=" + encodeURIComponent(`id:${t.id}`),
                      );
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {detail.isError && (
                <small className="muted">
                  Tags are unavailable right now. You can still preview this
                  wallpaper.
                </small>
              )}
              <button
                className="button primary"
                onClick={() => {
                  pick(modalWallpaper);
                  goWithWallpaper("/", modalWallpaper);
                }}
              >
                <Monitor size={17} /> Preview on desk
              </button>
              <button
                className="button subtle"
                onClick={() => {
                  pick(modalWallpaper);
                  goWithWallpaper("/phone", modalWallpaper);
                }}
              >
                <Smartphone size={17} /> Preview on phone
              </button>
              <div className="detail-bottom">
                <button
                  className="button subtle"
                  disabled={downloading}
                  onClick={() => void download(modalWallpaper)}
                >
                  <Download size={16} />
                  {downloading ? "Downloading…" : "Download"}
                </button>
                <button
                  className="icon-button"
                  aria-label="Save to favorites"
                  aria-pressed={favorites.some(
                    (f) => f.id === modalWallpaper.id,
                  )}
                  onClick={() => toggleFavorite(modalWallpaper)}
                >
                  <Heart
                    size={19}
                    fill={
                      favorites.some((f) => f.id === modalWallpaper.id)
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
              </div>
              <a
                className="text-button"
                href={modalWallpaper.url}
                target="_blank"
                rel="noreferrer"
              >
                Open on Wallhaven <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <Sparkles size={17} />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
  function goWithWallpaper(path: string, w: Wallpaper) {
    if (mode === "gallery") galleryScroll.current = window.scrollY;
    const p = new URLSearchParams(params);
    p.set("wallpaper", w.id);
    navigate(path + "?" + p.toString());
    setModal(null);
  }
}
export default App;
