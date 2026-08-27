import vioraPreview from "@/assets/theme-previews/viora.png";
import { getCustomThemes } from "./custom-themes";

export type ThemePresetId =
  | "cool-grey"
  | "midnight"
  | "ember"
  | "graphite"
  | "plum"
  | "moss"
  | "daylight";

/**
 * One built-in layout. Themes are palettes; the navigation is not theirs to
 * replace. "custom" remains for a theme the viewer writes themselves in the
 * studio, which is the only place a different chrome can still come from.
 */
export type ThemeLayout = "sidebar" | "custom";
export type ThemeCardStyle = "flat" | "glass" | "stremio" | "minui" | "crunch" | "noir" | "custom";
export type ThemeButtonStyle = "flat" | "glossy" | "minui" | "crunch" | "noir" | "custom";

export type ActiveThemeId = ThemePresetId | "custom" | `user:${string}`;

export type FontPairId =
  | "sentient-switzer"
  | "fraunces-inter"
  | "general-sans"
  | "cabinet-switzer"
  | "plex"
  | "plus-jakarta"
  | "system";

export type ThemeBackground = {
  image: string;
  dim?: number;
};

export type ThemeLogo = {
  wordmark?: string;
  mark?: string;
};

export type ChromeNavId =
  | "home"
  | "movies"
  | "shows"
  | "anime"
  | "library"
  | "live"
  | "discover"
  | "calendar"
  | "settings";

export type ChromeConfig = {
  position: "sidebar" | "topbar";
  brand: string;
  items: ChromeNavId[];
  labels?: Partial<Record<ChromeNavId, string>>;
  icons?: Partial<Record<ChromeNavId, string>>;
};

export type ThemePreset = {
  id: ThemePresetId;
  name: string;
  blurb: string;
  swatch: [string, string, string];
  tokens: Record<string, string>;
  background?: ThemeBackground;
  logo?: ThemeLogo;
  layout?: ThemeLayout;
  cardStyle?: ThemeCardStyle;
  buttonStyle?: ThemeButtonStyle;
  bokeh?: boolean;
  chrome?: ChromeConfig;
  navCustomization?: {
    order: string[];
    hidden: string[];
    renamed: Record<string, string>;
  };
  previewImage?: string;
  fontPair?: FontPairId;
  css?: string;
  js?: string;
  html?: string;
};

export type FontPair = {
  id: FontPairId;
  name: string;
  blurb: string;
  display: string;
  sans: string;
};

/*
  One chrome, several palettes.

  Every theme here is a set of colours over the same navigation the app was
  measured and fixed against. Themes that brought their own rail each had to
  re-implement the focus rules, and none of them did — pressing towards the
  menu simply did nothing, which shut the viewer inside the content with no way
  back to Settings. A palette cannot break navigation, so palettes are all a
  theme is allowed to be.
*/
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  "cool-grey": {
    id: "cool-grey",
    name: "Viora default",
    blurb: "What ships out of the box.",
    previewImage: vioraPreview,
    swatch: ["#2c2e36", "#3a3d47", "#dcdde4"],
    tokens: {
      "--color-canvas": "oklch(0.18 0.004 260)",
      "--color-surface": "oklch(0.22 0.004 260)",
      "--color-elevated": "oklch(0.27 0.004 260)",
      "--color-raised": "oklch(0.32 0.004 260)",
      "--color-ink": "oklch(0.97 0.003 260)",
      "--color-ink-muted": "oklch(0.72 0.003 260)",
      "--color-ink-subtle": "oklch(0.50 0.003 260)",
      "--color-edge": "oklch(0.36 0.004 260 / 0.55)",
      "--color-edge-soft": "oklch(0.36 0.004 260 / 0.25)",
      "--color-accent": "oklch(0.78 0.13 60)",
      "--color-accent-soft": "oklch(0.78 0.13 60 / 0.18)",
      "--color-danger": "oklch(0.55 0.18 25)",
    },
  },
  "midnight": {
    id: "midnight",
    name: "Midnight",
    blurb: "Deep blue dark, lit with cyan.",
    swatch: ["#141a26", "#1e2838", "#7fd4e8"],
    tokens: {
      "--color-canvas": "oklch(0.16 0.020 255)",
      "--color-surface": "oklch(0.20 0.022 255)",
      "--color-elevated": "oklch(0.25 0.024 255)",
      "--color-raised": "oklch(0.30 0.026 255)",
      "--color-ink": "oklch(0.97 0.005 255)",
      "--color-ink-muted": "oklch(0.72 0.010 255)",
      "--color-ink-subtle": "oklch(0.50 0.012 255)",
      "--color-edge": "oklch(0.36 0.020 255 / 0.55)",
      "--color-edge-soft": "oklch(0.36 0.020 255 / 0.25)",
      "--color-accent": "oklch(0.80 0.120 215)",
      "--color-accent-soft": "oklch(0.80 0.120 215 / 0.18)",
      "--color-danger": "oklch(0.58 0.19 25)",
    },
  },
  "ember": {
    id: "ember",
    name: "Ember",
    blurb: "Warm charcoal with a low fire in it.",
    swatch: ["#221c16", "#332821", "#f0a05a"],
    tokens: {
      "--color-canvas": "oklch(0.17 0.012 50)",
      "--color-surface": "oklch(0.21 0.014 50)",
      "--color-elevated": "oklch(0.26 0.016 50)",
      "--color-raised": "oklch(0.31 0.018 50)",
      "--color-ink": "oklch(0.97 0.006 50)",
      "--color-ink-muted": "oklch(0.73 0.012 50)",
      "--color-ink-subtle": "oklch(0.51 0.014 50)",
      "--color-edge": "oklch(0.37 0.016 50 / 0.55)",
      "--color-edge-soft": "oklch(0.37 0.016 50 / 0.25)",
      "--color-accent": "oklch(0.74 0.160 45)",
      "--color-accent-soft": "oklch(0.74 0.160 45 / 0.18)",
      "--color-danger": "oklch(0.55 0.18 25)",
    },
  },
  "graphite": {
    id: "graphite",
    name: "Graphite",
    blurb: "No colour in the greys at all.",
    swatch: ["#1c1c1c", "#2b2b2b", "#7aa2f7"],
    tokens: {
      "--color-canvas": "oklch(0.17 0 0)",
      "--color-surface": "oklch(0.21 0 0)",
      "--color-elevated": "oklch(0.26 0 0)",
      "--color-raised": "oklch(0.31 0 0)",
      "--color-ink": "oklch(0.97 0 0)",
      "--color-ink-muted": "oklch(0.72 0 0)",
      "--color-ink-subtle": "oklch(0.50 0 0)",
      "--color-edge": "oklch(0.36 0 0 / 0.55)",
      "--color-edge-soft": "oklch(0.36 0 0 / 0.25)",
      "--color-accent": "oklch(0.72 0.140 250)",
      "--color-accent-soft": "oklch(0.72 0.140 250 / 0.18)",
      "--color-danger": "oklch(0.55 0.18 25)",
    },
  },
  "plum": {
    id: "plum",
    name: "Plum",
    blurb: "Aubergine dark, pink where it counts.",
    swatch: ["#211622", "#31212f", "#e58fc4"],
    tokens: {
      "--color-canvas": "oklch(0.17 0.020 325)",
      "--color-surface": "oklch(0.21 0.024 325)",
      "--color-elevated": "oklch(0.26 0.028 325)",
      "--color-raised": "oklch(0.31 0.030 325)",
      "--color-ink": "oklch(0.97 0.006 325)",
      "--color-ink-muted": "oklch(0.73 0.012 325)",
      "--color-ink-subtle": "oklch(0.51 0.014 325)",
      "--color-edge": "oklch(0.37 0.024 325 / 0.55)",
      "--color-edge-soft": "oklch(0.37 0.024 325 / 0.25)",
      "--color-accent": "oklch(0.76 0.150 345)",
      "--color-accent-soft": "oklch(0.76 0.150 345 / 0.18)",
      "--color-danger": "oklch(0.55 0.18 25)",
    },
  },
  "moss": {
    id: "moss",
    name: "Moss",
    blurb: "Green-grey, the quietest of the dark ones.",
    swatch: ["#151d19", "#212e27", "#7fd6a2"],
    tokens: {
      "--color-canvas": "oklch(0.17 0.015 155)",
      "--color-surface": "oklch(0.21 0.017 155)",
      "--color-elevated": "oklch(0.26 0.019 155)",
      "--color-raised": "oklch(0.31 0.021 155)",
      "--color-ink": "oklch(0.97 0.005 155)",
      "--color-ink-muted": "oklch(0.72 0.010 155)",
      "--color-ink-subtle": "oklch(0.50 0.012 155)",
      "--color-edge": "oklch(0.36 0.018 155 / 0.55)",
      "--color-edge-soft": "oklch(0.36 0.018 155 / 0.25)",
      "--color-accent": "oklch(0.76 0.140 150)",
      "--color-accent-soft": "oklch(0.76 0.140 150 / 0.18)",
      "--color-danger": "oklch(0.55 0.18 25)",
    },
  },
  "daylight": {
    id: "daylight",
    name: "Daylight",
    blurb: "Light, for a room with the curtains open.",
    swatch: ["#f5f6f8", "#e7e9ee", "#2f5ecb"],
    tokens: {
      "--color-canvas": "oklch(0.97 0.003 260)",
      "--color-surface": "oklch(0.99 0.002 260)",
      "--color-elevated": "oklch(0.94 0.004 260)",
      "--color-raised": "oklch(0.90 0.005 260)",
      "--color-ink": "oklch(0.22 0.006 260)",
      "--color-ink-muted": "oklch(0.45 0.006 260)",
      "--color-ink-subtle": "oklch(0.62 0.005 260)",
      "--color-edge": "oklch(0.55 0.006 260 / 0.55)",
      "--color-edge-soft": "oklch(0.55 0.006 260 / 0.25)",
      "--color-accent": "oklch(0.55 0.160 250)",
      "--color-accent-soft": "oklch(0.55 0.160 250 / 0.18)",
      "--color-danger": "oklch(0.52 0.19 25)",
    },
  },
};

/* Emptied with the alternative chromes they shipped: each carried its own
   navigation, and none of them implemented the focus rules. */
export const BETA_THEMES: ThemePreset[] = [];

/* Emptied for the same reason as BETA_THEMES. */
export const FEATURED_CUSTOM_THEMES: ThemePreset[] = [];

/* Emptied for the same reason as BETA_THEMES. */
export const TEMPLATE_THEMES: ThemePreset[] = [];

export const FONT_PAIRS: Record<FontPairId, FontPair> = {
  "sentient-switzer": {
    id: "sentient-switzer",
    name: "Sentient + Switzer",
    blurb: "Default. Humanist serif, warm sans.",
    display: '"Sentient", "Iowan Old Style", "Georgia", serif',
    sans: '"Switzer", "Inter", system-ui, sans-serif',
  },
  "fraunces-inter": {
    id: "fraunces-inter",
    name: "Fraunces + Inter",
    blurb: "Classic. Was Viora's original pair.",
    display: '"Fraunces", "Iowan Old Style", "Georgia", serif',
    sans: '"Inter", system-ui, sans-serif',
  },
  "general-sans": {
    id: "general-sans",
    name: "General Sans",
    blurb: "Clean modern. Sans across the board.",
    display: '"General Sans", "Inter", system-ui, sans-serif',
    sans: '"General Sans", "Inter", system-ui, sans-serif',
  },
  "cabinet-switzer": {
    id: "cabinet-switzer",
    name: "Cabinet Grotesk + Switzer",
    blurb: "Editorial. Headline-strong display.",
    display: '"Cabinet Grotesk", "Inter", system-ui, sans-serif',
    sans: '"Switzer", "Inter", system-ui, sans-serif',
  },
  plex: {
    id: "plex",
    name: "IBM Plex",
    blurb: "Technical. IBM's open family.",
    display: '"IBM Plex Sans", system-ui, sans-serif',
    sans: '"IBM Plex Sans", system-ui, sans-serif',
  },
  "plus-jakarta": {
    id: "plus-jakarta",
    name: "Plus Jakarta Sans",
    blurb: "Stremio's typeface. Geometric humanist sans.",
    display: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
    sans: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
  },
  system: {
    id: "system",
    name: "System UI",
    blurb: "Whatever your OS uses.",
    display: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
};

export type CustomColors = {
  canvas: string;
  surface: string;
  elevated: string;
  raised: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  edge: string;
  accent: string;
  danger: string;
};

export type ThemeSettings = {
  preset: ActiveThemeId;
  backgroundImage: string | null;
  backgroundDim: number;
  fontPair: FontPairId;
  customFontId?: string | null;
  customColors: CustomColors | null;
};

export const DEFAULT_CUSTOM_COLORS: CustomColors = {
  canvas: "#1f2128",
  surface: "#292c34",
  elevated: "#34373f",
  raised: "#3f424b",
  ink: "#f6f6f8",
  inkMuted: "#aaadb6",
  inkSubtle: "#6e7079",
  edge: "#70727b",
  accent: "#d3a064",
  danger: "#d35a3a",
};

export const DEFAULT_THEME: ThemeSettings = {
  preset: "cool-grey",
  backgroundImage: null,
  backgroundDim: 0.65,
  fontPair: "sentient-switzer",
  customColors: null,
};

export function customColorsToTokens(c: CustomColors): Record<string, string> {
  return {
    "--color-canvas": c.canvas,
    "--color-surface": c.surface,
    "--color-elevated": c.elevated,
    "--color-raised": c.raised,
    "--color-ink": c.ink,
    "--color-ink-muted": c.inkMuted,
    "--color-ink-subtle": c.inkSubtle,
    "--color-edge": `${c.edge}8c`,
    "--color-edge-soft": `${c.edge}40`,
    "--color-accent": c.accent,
    "--color-accent-soft": `${c.accent}2e`,
    "--color-danger": c.danger,
  };
}

export function getThemeById(id: string): ThemePreset | null {
  if (id in THEME_PRESETS) return THEME_PRESETS[id as ThemePresetId];
  const featured = FEATURED_CUSTOM_THEMES.find((t) => t.id === id);
  if (featured) return featured;
  const beta = BETA_THEMES.find((t) => t.id === id);
  if (beta) return beta;
  const template = TEMPLATE_THEMES.find((t) => t.id === id);
  if (template) return template;
  if (id.startsWith("user:")) {
    return (getCustomThemes().find((t) => t.id === id) as ThemePreset | undefined) ?? null;
  }
  return null;
}

export function isKnownPreset(id: string): boolean {
  return getThemeById(id) !== null;
}

const CYCLE_THEME_IDS: ThemePresetId[] = Object.keys(THEME_PRESETS) as ThemePresetId[];

export function nextColorTheme(current: string): ThemePresetId {
  const i = CYCLE_THEME_IDS.indexOf(current as ThemePresetId);
  return CYCLE_THEME_IDS[(i + 1) % CYCLE_THEME_IDS.length];
}

function resolveTokens(theme: ThemeSettings): Record<string, string> {
  if (theme.preset === "custom" && theme.customColors) {
    return customColorsToTokens(theme.customColors);
  }
  if (theme.preset !== "custom") {
    const found = getThemeById(theme.preset);
    if (found) return found.tokens;
  }
  return THEME_PRESETS["cool-grey"].tokens;
}

export function applyTheme(theme: ThemeSettings): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(resolveTokens(theme))) {
    root.style.setProperty(k, v);
  }
  const preset = theme.preset !== "custom" ? getThemeById(theme.preset) : null;
  const fontPairId = preset?.fontPair ?? theme.fontPair;
  const pair = FONT_PAIRS[fontPairId] ?? FONT_PAIRS["sentient-switzer"];
  if (theme.customFontId) {
    const custom = `"viora-font-${theme.customFontId}"`;
    root.style.setProperty("--font-display", `${custom}, ${pair.display}`);
    root.style.setProperty("--font-sans", `${custom}, ${pair.sans}`);
  } else {
    root.style.setProperty("--font-display", pair.display);
    root.style.setProperty("--font-sans", pair.sans);
  }
  const layout: ThemeLayout = preset?.layout ?? "sidebar";
  const cardStyle: ThemeCardStyle = preset?.cardStyle ?? "flat";
  const buttonStyle: ThemeButtonStyle = preset?.buttonStyle ?? "flat";
  root.dataset.themeLayout = layout;
  root.dataset.themeCard = cardStyle;
  root.dataset.themeButton = buttonStyle;
  root.dataset.themeBokeh = preset?.bokeh ? "on" : "off";
}

export function activeLayout(theme: ThemeSettings): ThemeLayout {
  const preset = theme.preset !== "custom" ? getThemeById(theme.preset) : null;
  return preset?.layout ?? "sidebar";
}

export function resolveChromeTheme(
  _theme: ThemeSettings,
  override: "auto" | "default" | "stremio",
): "default" | "stremio" {
  // The player skin is still the viewer's to choose; "auto" no longer has an
  // app layout to follow, so it means the default one.
  return override === "stremio" ? "stremio" : "default";
}

/** The one layout carries Back in its top bar, so no screen draws its own. */
export function layoutHasGlobalBack(): boolean {
  return true;
}

export function activeBokeh(theme: ThemeSettings): boolean {
  const preset = theme.preset !== "custom" ? getThemeById(theme.preset) : null;
  return !!preset?.bokeh;
}

export function applyCustomColorsPreview(c: CustomColors, fontPair: FontPairId): void {
  applyTheme({
    preset: "custom",
    customColors: c,
    backgroundImage: null,
    backgroundDim: 0,
    fontPair,
  });
}
