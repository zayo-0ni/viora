import {
  DEFAULT_THEME,
  FONT_PAIRS,
  isKnownPreset,
  type CustomColors,
  type ThemeSettings,
} from "@/lib/theme";
import { sanitizeSeekStep } from "@/lib/seek-step";
import { migrateModelId } from "@/lib/ai-models";
import { DEFAULT, STORAGE_KEY } from "./defaults";
import type { Settings } from "./types";
import { deriveLanguages, seedContentLanguages } from "@/lib/language";

const HEX_RE = /^#[0-9a-f]{6}$/i;

function legacySeekStep(direction: "back" | "forward"): number | undefined {
  try {
    const raw = localStorage.getItem(`harbor.seek-step.${direction}`);
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeCustomColors(c: unknown): CustomColors | null {
  if (!c || typeof c !== "object") return null;
  const obj = c as Partial<CustomColors>;
  const keys: Array<keyof CustomColors> = [
    "canvas",
    "surface",
    "elevated",
    "raised",
    "ink",
    "inkMuted",
    "inkSubtle",
    "edge",
    "accent",
    "danger",
  ];
  const out = {} as CustomColors;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v !== "string" || !HEX_RE.test(v)) return null;
    out[k] = v;
  }
  return out;
}

export function sanitizeTheme(t: Partial<ThemeSettings> | undefined): ThemeSettings {
  if (!t) return DEFAULT_THEME;
  const isBuiltIn = typeof t.preset === "string" && t.preset !== "custom" && isKnownPreset(t.preset);
  const isUserPreset = typeof t.preset === "string" && t.preset.startsWith("user:");
  const isPreset = isBuiltIn || isUserPreset;
  const isCustom = t.preset === "custom";
  const fontOk = typeof t.fontPair === "string" && t.fontPair in FONT_PAIRS;
  const dimOk = typeof t.backgroundDim === "number" && t.backgroundDim >= 0 && t.backgroundDim <= 1;
  const imgOk = t.backgroundImage == null || (typeof t.backgroundImage === "string" && t.backgroundImage.length < 3_000_000);
  const customColors = sanitizeCustomColors(t.customColors);
  const preset: ThemeSettings["preset"] = isPreset
    ? (t.preset as ThemeSettings["preset"])
    : isCustom && customColors
      ? "custom"
      : DEFAULT_THEME.preset;
  return {
    preset,
    fontPair: fontOk ? (t.fontPair as ThemeSettings["fontPair"]) : DEFAULT_THEME.fontPair,
    backgroundDim: dimOk ? (t.backgroundDim as number) : DEFAULT_THEME.backgroundDim,
    backgroundImage: imgOk ? (t.backgroundImage ?? null) : null,
    customColors,
    customFontId: typeof t.customFontId === "string" ? t.customFontId : null,
  };
}

// Rebuilding the settings object on every call is what made this the second
// hottest function on the television. The parse is only the beginning of it:
// what follows is thirty-odd object spreads and two array maps through
// languageName. It is called from the metadata mappers, once per title, so a
// screen of a hundred cards rebuilt the whole thing a hundred times over to
// read one boolean.
//
// The stored string is the cache key, which is what makes the memo safe: every
// write to settings produces a different string, so a hit can only mean nothing
// has changed. Reading that string back is itself a copy of a blob that runs to
// tens of kilobytes, so within a burst the store is not consulted again either;
// a quarter of a second of staleness is invisible here, because the interface
// renders from the provider's own state and these callers are data mappers.
const RECHECK_MS = 250;
type Cached = { raw: string | null; value: Settings; checkedAt: number };
const cache = new Map<string, Cached>();

export function invalidateStoredSettings(): void {
  cache.clear();
}

export function loadStoredSettings(rawKey: string = STORAGE_KEY): Settings {
  const now = Date.now();
  const hit = cache.get(rawKey);
  if (hit && now - hit.checkedAt < RECHECK_MS) return hit.value;
  const raw = localStorage.getItem(rawKey);
  if (hit && hit.raw === raw) {
    hit.checkedAt = now;
    return hit.value;
  }
  const value = buildStoredSettings(raw);
  cache.set(rawKey, { raw, value, checkedAt: now });
  return value;
}

function buildStoredSettings(raw: string | null): Settings {
  if (!raw) {
    return {
      ...DEFAULT,
      seekBackStepSec: sanitizeSeekStep(legacySeekStep("back"), DEFAULT.seekBackStepSec),
      seekForwardStepSec: sanitizeSeekStep(legacySeekStep("forward"), DEFAULT.seekForwardStepSec),
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Settings> & {
      _subStyleV2?: boolean;
      _subAssForceV1?: boolean;
      _subAssRespectV2?: boolean;
      _mpvEmbedV2?: boolean;
      _mpvEmbedV3?: boolean;
      _mpvEmbedV4?: boolean;
      _pickerLayoutStremio?: boolean;
      _pickerLayoutStremioV2?: boolean;
      _stremioDeeplinkOnByDefault?: boolean;
      _rememberLastStreamOnV1?: boolean;
      _streamSortAddonV1?: boolean;
      scrapers?: unknown;
      scrapersAcknowledged?: boolean;
      _scrapersV2?: boolean;
    };
    if (!parsed._pickerLayoutStremioV2) {
      if (parsed.pickerLayout === "condensed") parsed.pickerLayout = "stremio";
      parsed._pickerLayoutStremio = true;
      parsed._pickerLayoutStremioV2 = true;
    }
    if (!parsed._stremioDeeplinkOnByDefault) {
      parsed.stremioDeeplinkInstall = true;
      parsed._stremioDeeplinkOnByDefault = true;
    }
    if (!parsed._rememberLastStreamOnV1) {
      parsed.rememberLastStream = true;
      parsed._rememberLastStreamOnV1 = true;
    }
    if (!parsed._streamSortAddonV1) {
      if (parsed.streamSort === "harbor") parsed.streamSort = "addon";
      parsed._streamSortAddonV1 = true;
    }
    if (parsed.aiSearchModel) parsed.aiSearchModel = migrateModelId(parsed.aiSearchModel);
    // The web player is gone. A setting still pointing at it would name an
    // engine that cannot be built, so it falls back to the automatic choice.
    if ((parsed.playerEngine as string) === "html5") parsed.playerEngine = "auto";
    if (!parsed._mpvEmbedV3) {
      parsed.playerMpvEmbed = true;
      parsed._mpvEmbedV3 = true;
    }
    if (!parsed._mpvEmbedV4) {
      parsed.playerMpvEmbed = true;
      parsed._mpvEmbedV4 = true;
    }
    if (!parsed._subStyleV2) {
      if (parsed.subFontSize === 55) parsed.subFontSize = DEFAULT.subFontSize;
      if (parsed.subBorderSize === 3) parsed.subBorderSize = DEFAULT.subBorderSize;
      if (parsed.subMarginY === 22) parsed.subMarginY = DEFAULT.subMarginY;
      parsed._subStyleV2 = true;
    }
    delete parsed.scrapers;
    delete parsed.scrapersAcknowledged;
    delete parsed._scrapersV2;
    return {
      ...DEFAULT,
      ...parsed,
      streaming: { ...DEFAULT.streaming, ...(parsed.streaming ?? {}) },
      subProvidersEnabled: {
        ...DEFAULT.subProvidersEnabled,
        ...(parsed.subProvidersEnabled ?? {}),
        wyzie: false,
        opensubtitles: true,
      },
      hideContent: {
        ...DEFAULT.hideContent,
        ...(parsed.hideContent ?? {}),
      },
      homeRows: {
        ...DEFAULT.homeRows,
        ...(parsed.homeRows ?? {}),
      },
      navCustomization: {
        ...DEFAULT.navCustomization,
        ...(parsed.navCustomization ?? {}),
      },
      letterboxd: {
        ...DEFAULT.letterboxd,
        ...(parsed.letterboxd ?? {}),
      },
      badgePlacement:
        parsed.badgePlacement === "top" || parsed.badgePlacement === "bottom"
          ? parsed.badgePlacement
          : DEFAULT.badgePlacement,
      harborColor:
        typeof parsed.harborColor === "string" && HEX_RE.test(parsed.harborColor)
          ? parsed.harborColor
          : DEFAULT.harborColor,
      traktClientId: parsed.traktClientId ?? DEFAULT.traktClientId,
      traktAccessToken: parsed.traktAccessToken ?? DEFAULT.traktAccessToken,
      traktRefreshToken: parsed.traktRefreshToken ?? DEFAULT.traktRefreshToken,
      traktExpiresAt: parsed.traktExpiresAt ?? DEFAULT.traktExpiresAt,
      traktUsername: parsed.traktUsername ?? DEFAULT.traktUsername,
      seekBackStepSec: sanitizeSeekStep(
        parsed.seekBackStepSec ?? legacySeekStep("back"),
        DEFAULT.seekBackStepSec,
      ),
      seekForwardStepSec: sanitizeSeekStep(
        parsed.seekForwardStepSec ?? legacySeekStep("forward"),
        DEFAULT.seekForwardStepSec,
      ),
      theme: sanitizeTheme(parsed.theme),
      webhooks: {
        ...DEFAULT.webhooks,
        ...(parsed.webhooks ?? {}),
        sources: {
          ...DEFAULT.webhooks.sources,
          ...(parsed.webhooks?.sources ?? {}),
        },
      },
      customCalendar: {
        ...DEFAULT.customCalendar,
        ...(parsed.customCalendar ?? {}),
        trackedPeople: Array.isArray(parsed.customCalendar?.trackedPeople)
          ? parsed.customCalendar.trackedPeople
          : [],
        genres: Array.isArray(parsed.customCalendar?.genres) ? parsed.customCalendar.genres : [],
        watchProviders: Array.isArray(parsed.customCalendar?.watchProviders)
          ? parsed.customCalendar.watchProviders
          : [],
        originCountries: Array.isArray(parsed.customCalendar?.originCountries)
          ? parsed.customCalendar.originCountries
          : [],
        mediaTypes: {
          movie: parsed.customCalendar?.mediaTypes?.movie !== false,
          tv: parsed.customCalendar?.mediaTypes?.tv !== false,
        },
      },
      webhookRules: Array.isArray(parsed.webhookRules) ? parsed.webhookRules : [],
      customStreamFilters: Array.isArray(parsed.customStreamFilters) ? parsed.customStreamFilters : DEFAULT.customStreamFilters,
      // Every language field but one is computed, never read from storage.
      //
      // The viewer answers once, in `contentLanguages`; subtitles, audio,
      // artwork, metadata, add-on ranking and the home rows are all shapes of
      // that same answer. Anyone upgrading keeps what they had — their old
      // subtitle list, or failing that their stream languages, is carried into
      // the single list the first time these settings are read.
      ...(() => {
        const stored = Array.isArray(parsed.contentLanguages)
          ? parsed.contentLanguages.filter((l): l is string => typeof l === "string")
          : seedContentLanguages(parsed as Record<string, unknown>);
        return { contentLanguages: stored, ...deriveLanguages(stored) };
      })(),
    };
  } catch {
    return DEFAULT;
  }
}
