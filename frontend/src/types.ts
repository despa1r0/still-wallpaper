export interface Wallpaper {
  id: string;
  url: string;
  path: string;
  thumbs: { large: string; original: string; small: string };
  resolution: string;
  dimension_x: number;
  dimension_y: number;
  colors: string[];
  category?: string;
  purity?: string;
  tags?: { id: number; name: string }[];
  uploader?: { username: string };
}
export interface Listing {
  data: Wallpaper[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    seed?: string;
  };
}
export interface Filters {
  q: string;
  categories: string;
  sorting: string;
  topRange: string;
  atleast: string;
  ratios: string;
  colors: string;
}
export interface Lighting {
  temperature: "warm" | "neutral" | "cool";
  brightness: number;
  lamp: boolean;
  garland: boolean;
}
export const defaults: Filters = {
  q: "",
  categories: "111",
  sorting: "random",
  topRange: "1M",
  atleast: "",
  ratios: "",
  colors: "",
};
export const starter: Wallpaper = {
  id: "local",
  url: "",
  path: "/art/quiet-valley.svg",
  thumbs: {
    large: "/art/quiet-valley.svg",
    small: "/art/quiet-valley.svg",
    original: "/art/quiet-valley.svg",
  },
  resolution: "1920x1080",
  dimension_x: 1920,
  dimension_y: 1080,
  colors: ["#263c55", "#74999c", "#d2b0a1"],
  category: "general",
};
