import { useState, type CSSProperties } from "react";
import {
  Camera,
  Flashlight,
  LockKeyhole,
  Sun,
  Moon,
  RotateCcw,
  Download,
  Mail,
  Phone,
  Music2,
  MessageCircle,
  CalendarDays,
  Image,
  Compass,
} from "lucide-react";
import { readStorage, writeStorage } from "../api";
import type { Wallpaper } from "../types";
interface PhoneSettings {
  mode: "lock" | "home";
  dark: boolean;
  x: number;
  y: number;
  zoom: number;
  fit: "contain" | "cover";
}
export default function PhonePreview({
  wallpaper,
  onDownload,
  downloading,
}: {
  wallpaper: Wallpaper;
  onDownload: () => void;
  downloading: boolean;
}) {
  const initial = () => {
    const s = readStorage<Partial<PhoneSettings>>("still-phone", {});
    return {
      fit: s?.fit === "cover" ? "cover" : "contain",
      mode: s?.mode === "home" ? "home" : "lock",
      dark: s?.dark === true,
      x: typeof s?.x === "number" ? Math.min(100, Math.max(0, s.x)) : 50,
      y: typeof s?.y === "number" ? Math.min(100, Math.max(0, s.y)) : 50,
      zoom:
        s?.fit && typeof s?.zoom === "number" ? Math.min(2, Math.max(0.5, s.zoom)) : 1,
    } as PhoneSettings;
  };
  const [settings, setSettings] = useState(initial);
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);
  function update(patch: Partial<PhoneSettings>) {
    setSettings((s) => {
      const next = { ...s, ...patch };
      writeStorage("still-phone", next);
      return next;
    });
  }
  const s = settings;
  return (
    <div className="phone-layout">
      <div className="phone-stage">
        <div className="phone-shadow" />
        <div className={`phone-device ${s.dark ? "dark-ink" : ""}`}>
          <div
            className="phone-screen"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ x: e.clientX, y: e.clientY, px: s.x, py: s.y });
            }}
            onPointerMove={(e) => {
              if (drag)
                update({
                  x: Math.max(
                    0,
                    Math.min(100, drag.px - (e.clientX - drag.x) / 2),
                  ),
                  y: Math.max(
                    0,
                    Math.min(100, drag.py - (e.clientY - drag.y) / 2),
                  ),
                });
            }}
            onPointerUp={() => setDrag(null)}
            onPointerCancel={() => setDrag(null)}
            style={
              {
                "--phone-x": `${s.x}%`,
                "--phone-y": `${s.y}%`,
                "--phone-zoom": s.zoom,
              } as CSSProperties
            }
          >
            <img
              src={wallpaper.path}
              alt="Selected wallpaper on the phone"
              className="phone-wallpaper"
              draggable={false}
              style={{ objectFit: s.fit }}
            />
            <div className="phone-shade" />
            <div className="phone-island" />
            <div className="phone-status">
              <span>9:41</span>
              <span>▂▄▆ ▰</span>
            </div>
            {s.mode === "lock" ? (
              <>
                <div className="lock-content">
                  <LockKeyhole size={19} />
                  <p>Sunday, October 4</p>
                  <strong>09:41</strong>
                </div>
                <div className="lock-shortcuts">
                  <span>
                    <Flashlight size={20} />
                  </span>
                  <span>
                    <Camera size={20} />
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="home-widget">
                  <span>YOUR SPACE</span>
                  <strong>
                    A good day
                    <br />
                    starts here.
                  </strong>
                  <span>Sunday · October 4</span>
                </div>
                <div className="phone-apps">
                  {[
                    CalendarDays,
                    Image,
                    Mail,
                    Compass,
                    Camera,
                    Music2,
                    MessageCircle,
                    Phone,
                  ].map((Icon, i) => (
                    <div key={i}>
                      <span
                        style={{
                          background: [
                            "#62799c",
                            "#ae8d76",
                            "#708294",
                            "#76839d",
                          ][i % 4],
                        }}
                      >
                        <Icon size={24} />
                      </span>
                      <small>
                        {
                          [
                            "Calendar",
                            "Photos",
                            "Mail",
                            "Browser",
                            "Camera",
                            "Music",
                            "Messages",
                            "Phone",
                          ][i]
                        }
                      </small>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="home-indicator" />
          </div>
        </div>
        <span className="phone-caption">
          Drag the wallpaper to adjust its position
        </span>
      </div>
      <aside className="phone-controls">
        <span className="eyebrow">SMALL SCREEN. SAME FEELING.</span>
        <h2>Take it with you.</h2>
        <p className="muted">
          See your wallpaper with a clock and icons. Keep the full image, or
          choose your own crop.
        </p>
        <fieldset>
          <legend>Image framing</legend>
          <div className="segmented">
            <button
              aria-pressed={s.fit === "contain"}
              className={s.fit === "contain" ? "active" : ""}
              onClick={() => update({ fit: "contain", zoom: 1, x: 50, y: 50 })}
            >
              Full image
            </button>
            <button
              aria-pressed={s.fit === "cover"}
              className={s.fit === "cover" ? "active" : ""}
              onClick={() => update({ fit: "cover", zoom: 1, x: 50, y: 50 })}
            >
              Fill screen
            </button>
          </div>
        </fieldset>
        <p className="muted preview-help">
          Full image preserves every edge. Fill screen crops to the phone’s
          shape.
        </p>
        <fieldset>
          <legend>Screen</legend>
          <div className="segmented">
            <button
              className={s.mode === "lock" ? "active" : ""}
              onClick={() => update({ mode: "lock" })}
            >
              Lock screen
            </button>
            <button
              className={s.mode === "home" ? "active" : ""}
              onClick={() => update({ mode: "home" })}
            >
              Home screen
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend>Interface color</legend>
          <div className="segmented">
            <button
              className={!s.dark ? "active" : ""}
              onClick={() => update({ dark: false })}
            >
              <Sun size={16} /> Light
            </button>
            <button
              className={s.dark ? "active" : ""}
              onClick={() => update({ dark: true })}
            >
              <Moon size={16} /> Dark
            </button>
          </div>
        </fieldset>
        <label className="range-label">
          Zoom <span>{Math.round(s.zoom * 100)}%</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step=".01"
            value={s.zoom}
            onChange={(e) => update({ zoom: Number(e.target.value) })}
          />
        </label>
        <label className="range-label">
          Horizontal position
          <input
            type="range"
            min="0"
            max="100"
            value={s.x}
            onChange={(e) => update({ x: Number(e.target.value) })}
          />
        </label>
        <label className="range-label">
          Vertical position
          <input
            type="range"
            min="0"
            max="100"
            value={s.y}
            onChange={(e) => update({ y: Number(e.target.value) })}
          />
        </label>
        <button
          className="text-button"
          onClick={() => update({ x: 50, y: 50, zoom: 1, fit: "contain" })}
        >
          <RotateCcw size={14} /> Reset framing
        </button>
        <button
          className="button primary download-phone"
          disabled={downloading}
          onClick={onDownload}
        >
          <Download size={17} />
          {downloading ? "Downloading…" : "Download original"}
        </button>
        <small className="muted">
          Framing only affects the preview. Downloads keep the original image.
        </small>
      </aside>
    </div>
  );
}
