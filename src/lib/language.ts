import { normalizeLang } from "@/lib/subtitles/language";

/**
 * One list of languages, and everything that used to be asked separately.
 *
 * There were eight language settings and three switches, on three different
 * screens, and they did not agree with one another: subtitles defaulted to
 * English, audio to English and Japanese, artwork to English and Original, and
 * the metadata language to nothing at all. Four places decided what language the
 * app was in and none of them knew about the others.
 *
 * Now the viewer says it once. This is where that one answer becomes the
 * particular shapes the rest of the application already speaks — subtitle names,
 * audio names, a TMDB locale, an ordered list for artwork, the ranking the
 * add-ons are scored against.
 *
 * An empty list is not "English". It means no preference at all: every subtitle
 * is offered and the viewer picks, every source is shown and none is demoted,
 * artwork comes in the title's own language, and metadata arrives as TMDB
 * publishes it. That is the behaviour asked for, and it is why nothing here
 * falls back to a default language.
 */

/**
 * TMDB wants a locale, not a language: `ar` alone returns nothing. Which
 * dialect is not a question worth asking a viewer, so each language gets the
 * variant TMDB actually carries translations for — measured with the owner's
 * own key, where `ar-SA` answered for six titles out of six and `ar-AE` for
 * four.
 */
const TMDB_LOCALE: Record<string, string> = {
  ar: "ar-SA",
  pt: "pt-BR",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  tr: "tr-TR",
  ru: "ru-RU",
  hi: "hi-IN",
  pl: "pl-PL",
  nl: "nl-NL",
  uk: "uk-UA",
  en: "",
};

export type DerivedLanguages = {
  preferredLanguages: string[];
  requirePreferredLanguage: boolean;
  homeLanguages: string[];
  preferredSubLangs: string[];
  preferredAudioLangs: string[];
  tmdbLanguage: string;
  tmdbImageLangs: string[];
  translateTitles: boolean;
  translateDescriptions: boolean;
};

export function deriveLanguages(contentLanguages: string[]): DerivedLanguages {
  const names = contentLanguages.filter((n) => typeof n === "string" && n.trim().length > 0);

  if (names.length === 0) {
    return {
      // Nothing is preferred, so nothing is demoted and nothing is hidden.
      preferredLanguages: [],
      requirePreferredLanguage: false,
      homeLanguages: [],
      preferredSubLangs: [],
      preferredAudioLangs: [],
      tmdbLanguage: "",
      // The title's own language, which is what "no preference" means for art.
      tmdbImageLangs: ["Original"],
      translateTitles: false,
      translateDescriptions: false,
    };
  }

  const codes: string[] = [];
  for (const n of names) {
    const c = normalizeLang(n).split("-")[0];
    if (c && !codes.includes(c)) codes.push(c);
  }
  const first = codes[0] ?? "";

  return {
    preferredLanguages: names,
    // Ranking, never hiding. A viewer who names a language wants it first, not
    // alone — the switch that dropped everything else was one of the three the
    // owner asked to be rid of.
    requirePreferredLanguage: false,
    homeLanguages: codes,
    preferredSubLangs: names,
    preferredAudioLangs: names,
    tmdbLanguage: TMDB_LOCALE[first] ?? "",
    // Their languages first, then whatever the title itself is in.
    tmdbImageLangs: [...names, "Original"],
    translateTitles: true,
    translateDescriptions: true,
  };
}

/**
 * What to seed the single list with for someone who has been using the app.
 *
 * Their old answers are spread across four keys; subtitles are the one they
 * were most likely to have set on purpose, then the stream ranking. Anything
 * found is carried over so nobody's preference is silently dropped on upgrade.
 */
export function seedContentLanguages(old: {
  preferredSubLangs?: unknown;
  preferredLanguages?: unknown;
  preferredAudioLangs?: unknown;
}): string[] {
  const pick = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const subs = pick(old.preferredSubLangs);
  if (subs.length) return subs;
  const streams = pick(old.preferredLanguages);
  if (streams.length) return streams;
  return pick(old.preferredAudioLangs);
}
