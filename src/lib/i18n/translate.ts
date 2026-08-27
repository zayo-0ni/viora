import en from "./locales/en";
import ar from "./locales/ar";
import pt from "./locales/pt";
import { getUiLanguage, useUiLanguage } from "./store";
import { isRtl, LANGUAGES, type UiLanguage } from "./languages";
import { APP_NAME } from "@/lib/brand";

type Vars = Record<string, string | number>;

const catalogs: Record<UiLanguage, Record<string, string>> = { en, ar, pt };

// The upstream product name is baked into hundreds of copy strings across three
// locale files. Rewriting every key would churn the translations and break the
// English fallback lookup, so the substitution happens once on the way out —
// every language is covered, and the keys stay stable.
const UPSTREAM_NAME = /\bViora\b/g;

function applyBrand(text: string): string {
  if (APP_NAME === "Viora") return text;
  return text.replace(UPSTREAM_NAME, APP_NAME);
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return applyBrand(template);
  let out = template;
  for (const [name, value] of Object.entries(vars)) {
    out = out.split(`{${name}}`).join(String(value));
  }
  return applyBrand(out);
}

function resolve(lang: UiLanguage, key: string): string {
  const active = catalogs[lang]?.[key];
  if (active !== undefined) return active;
  const fallback = catalogs.en[key];
  if (fallback !== undefined) return fallback;
  return key;
}

export function t(key: string, vars?: Vars): string {
  return interpolate(resolve(getUiLanguage(), key), vars);
}

export function useT(): (key: string, vars?: Vars) => string {
  const lang = useUiLanguage();
  return (key: string, vars?: Vars) => interpolate(resolve(lang, key), vars);
}

export { useUiLanguage, isRtl, LANGUAGES };
