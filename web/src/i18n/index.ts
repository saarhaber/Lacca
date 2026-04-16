import { translations, SUPPORTED_LOCALES, type Locale, type TranslationKeys } from "./translations";

const LOCALE_STORAGE_KEY = "lacca-locale";
const rtlLocales = new Set<Locale>(["he"]);

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  he: "עברית",
};

function detectLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  const lang = (typeof navigator !== "undefined" ? navigator.language : "") ?? "en";
  const base = lang.split("-")[0].toLowerCase() as Locale;
  return SUPPORTED_LOCALES.includes(base) ? base : "en";
}

let locale: Locale = detectLocale();
let dict: TranslationKeys = translations[locale];

/**
 * Translate a key. Returns the English fallback if the key is missing in the
 * active locale (should not happen, but guards against future key drift).
 */
export function t(key: keyof TranslationKeys): string {
  return (dict[key] ?? translations.en[key]) as string;
}

/**
 * Switch the active locale at runtime. Persists the choice to localStorage,
 * re-applies every data-i18n attribute in the document, and calls any
 * registered listeners so imperative UI (dropdowns etc.) can refresh too.
 */
export function setLocale(next: Locale): void {
  if (!SUPPORTED_LOCALES.includes(next) || next === locale) return;
  locale = next;
  dict = translations[locale];
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  applyTranslations(document);
  for (const cb of localeChangeListeners) cb(locale);
}

const localeChangeListeners: Array<(l: Locale) => void> = [];
export function onLocaleChange(cb: (l: Locale) => void): void {
  localeChangeListeners.push(cb);
}

/**
 * Interpolate {make} and {model} placeholders in a translated string.
 * Usage: interpolate(t("availability.noData"), { make: "Toyota", model: "Camry" })
 */
export function interpolate(str: string, vars: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/**
 * Walk the DOM and apply translations declared via data attributes.
 *
 *   data-i18n="key"         → el.textContent = t(key)
 *   data-i18n-html="key"    → el.innerHTML   = t(key)
 *   data-i18n-tip="key"     → el.dataset.tip = t(key)
 *   data-i18n-title="key"   → el.title       = t(key)
 *   data-i18n-label="key"   → el.ariaLabel   = t(key)
 *   data-i18n-ph="key"      → (input/select) placeholder or first disabled option text
 */
export function applyTranslations(root: Document | Element = document): void {
  // Plain text content
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as keyof TranslationKeys;
    if (key) el.textContent = t(key);
  });

  // HTML content (contains markup like <abbr>, <strong>)
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => {
    const key = el.dataset.i18nHtml as keyof TranslationKeys;
    if (key) el.innerHTML = t(key);
  });

  // data-tip tooltip attribute
  root.querySelectorAll<HTMLElement>("[data-i18n-tip]").forEach((el) => {
    const key = el.dataset.i18nTip as keyof TranslationKeys;
    if (key) el.dataset.tip = t(key);
  });

  // title attribute
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle as keyof TranslationKeys;
    if (key) el.title = t(key);
  });

  // aria-label attribute
  root.querySelectorAll<HTMLElement>("[data-i18n-label]").forEach((el) => {
    const key = el.dataset.i18nLabel as keyof TranslationKeys;
    if (key) el.setAttribute("aria-label", t(key));
  });

  // Update <html lang="..."> to the detected locale
  const htmlEl = root instanceof Document ? root.documentElement : root.ownerDocument?.documentElement;
  if (htmlEl) {
    htmlEl.lang = locale;
    htmlEl.dir = rtlLocales.has(locale) ? "rtl" : "ltr";
  }

  // Update <title>
  const titleEl = root instanceof Document ? root.querySelector("title") : null;
  if (titleEl) titleEl.textContent = t("meta.title");

  // Update <meta name="description">
  const descEl = root instanceof Document
    ? root.querySelector<HTMLMetaElement>('meta[name="description"]')
    : null;
  if (descEl) descEl.content = t("meta.description");
}

export function getLocale(): Locale { return locale; }
