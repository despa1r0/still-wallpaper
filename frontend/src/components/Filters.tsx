import { useState } from "react";
import { RotateCcw, Search, Check } from "lucide-react";
import { defaults, type Filters as FilterValues } from "../types";
import Dialog from "./Dialog";
const colors = [
  "660000",
  "990000",
  "cc0000",
  "cc3333",
  "ea4c88",
  "993399",
  "663399",
  "333399",
  "0066cc",
  "0099cc",
  "66cccc",
  "77cc33",
  "669900",
  "336600",
  "666600",
  "999900",
  "cccc33",
  "ffff00",
  "ffcc33",
  "ff9900",
  "ff6600",
  "cc6633",
  "996633",
  "663300",
  "000000",
  "999999",
  "cccccc",
  "ffffff",
  "424153",
];
export default function Filters({
  value,
  onApply,
  onClose,
}: {
  value: FilterValues;
  onApply: (f: FilterValues) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const set = (k: keyof FilterValues, v: string) =>
    setDraft((f) => ({ ...f, [k]: v }));
  return (
    <Dialog title="Find your mood" onClose={onClose}>
      <form
        className="filter-form"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
          onClose();
        }}
      >
        <label className="field-label">
          What are you looking for?
          <div className="search-field">
            <Search size={18} />
            <input
              value={draft.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Mountains, space, minimalism…"
              maxLength={200}
            />
          </div>
        </label>
        <fieldset>
          <legend>Categories</legend>
          <div className="chips">
            {["General", "Anime", "People"].map((name, i) => (
              <button
                type="button"
                key={name}
                className={draft.categories[i] === "1" ? "chip active" : "chip"}
                aria-pressed={draft.categories[i] === "1"}
                onClick={() => {
                  const next = draft.categories.split("");
                  next[i] = next[i] === "1" ? "0" : "1";
                  if (next.includes("1")) set("categories", next.join(""));
                }}
              >
                {draft.categories[i] === "1" && <Check size={14} />} {name}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="field-pair">
          <label className="field-label">
            Aspect ratio
            <select
              value={draft.ratios}
              onChange={(e) => set("ratios", e.target.value)}
            >
              <option value="">Any</option>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
              <option value="16x9">16:9 · Monitor</option>
              <option value="16x10">16:10 · Laptop</option>
              <option value="21x9">21:9 · Ultrawide</option>
              <option value="9x16">9:16 · Phone</option>
              <option value="9x18">9:18 · Phone</option>
              <option value="1x1">1:1 · Square</option>
            </select>
          </label>
          <label className="field-label">
            Minimum resolution
            <select
              value={draft.atleast}
              onChange={(e) => set("atleast", e.target.value)}
            >
              <option value="">Any</option>
              <option value="1920x1080">Full HD · 1920 × 1080</option>
              <option value="2560x1440">QHD · 2560 × 1440</option>
              <option value="3840x2160">4K · 3840 × 2160</option>
              <option value="1080x1920">Phone · 1080 × 1920</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>
            Color palette <span className="muted">/ optional</span>
          </legend>
          <div className="color-options">
            <button
              type="button"
              className={`color-swatch any ${!draft.colors ? "selected" : ""}`}
              onClick={() => set("colors", "")}
              aria-label="Any color"
              aria-pressed={!draft.colors}
            >
              ∅
            </button>
            {colors.map((c) => (
              <button
                type="button"
                key={c}
                className={`color-swatch ${draft.colors === c ? "selected" : ""}`}
                style={{ background: `#${c}` }}
                onClick={() => set("colors", draft.colors === c ? "" : c)}
                aria-label={`Color #${c}`}
                aria-pressed={draft.colors === c}
              />
            ))}
          </div>
        </fieldset>
        <div className="field-pair">
          <label className="field-label">
            Sort by
            <select
              value={draft.sorting}
              onChange={(e) => set("sorting", e.target.value)}
            >
              <option value="random">Random discoveries</option>
              <option value="date_added">Newest first</option>
              <option value="views">Most viewed</option>
              <option value="favorites">Most favorited</option>
              <option value="toplist">Top wallpapers</option>
              <option value="relevance">Relevance</option>
            </select>
          </label>
          {draft.sorting === "toplist" && (
            <label className="field-label">
              Time range
              <select
                value={draft.topRange}
                onChange={(e) => set("topRange", e.target.value)}
              >
                <option value="1d">Past day</option>
                <option value="3d">Past 3 days</option>
                <option value="1w">Past week</option>
                <option value="1M">Past month</option>
                <option value="3M">Past 3 months</option>
                <option value="6M">Past 6 months</option>
                <option value="1y">Past year</option>
              </select>
            </label>
          )}
        </div>
        <p className="filter-note">Wallhaven collections · SFW only</p>
        <div className="dialog-actions">
          <button
            type="button"
            className="button subtle"
            onClick={() => setDraft({ ...defaults })}
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button className="button primary" type="submit">
            Show wallpapers <span>↗</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
}
