import { translations, type Locale } from "./translations";

/**
 * Detects the locale from the OS/browser language once at module load.
 * In Tauri, navigator.language correctly reflects the OS locale.
 */
const locale: Locale = (navigator.language ?? "en").toLowerCase().startsWith("pt") ? "pt" : "en";

/**
 * Translates a key with optional variable interpolation.
 * Variables are replaced using {{varName}} syntax.
 * Falls back to the 'en' locale if the key is not found in the current locale.
 * Falls back to the key itself if not found in either locale.
 */
function t(key: string, vars?: Record<string, string | number>): string {
  let str = translations[locale][key] ?? translations["en"][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{{${k}}}`, String(v));
    }
  }
  return str;
}

/**
 * Translates a key with pluralization support.
 * Selects between `key_one` (count === 1) and `key_other` (count !== 1).
 * Automatically passes `count` as an interpolation variable.
 */
function tp(key: string, count: number, vars?: Record<string, string | number>): string {
  const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
  return t(pluralKey, { count, ...vars });
}

/** Hook that exposes t, tp and the detected locale. */
export function useTranslation() {
  return { t, tp, locale };
}
