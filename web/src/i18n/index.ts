import { translations, SUPPORTED_LOCALES, type Locale, type TranslationKeys } from "./translations";

function detectLocale(): Locale {
  const lang = (typeof navigator !== "undefined" ? navigator.language : "") ?? "en";
  // navigator.language can be "fr", "fr-CA", "zh-Hans-CN", etc.
  const base = lang.split("-")[0].toLowerCase() as Locale;
  return SUPPORTED_LOCALES.includes(base) ? base : "en";
}

const locale: Locale = detectLocale();
const dict: TranslationKeys = translations[locale];
const rtlLocales = new Set<Locale>(["he"]);

/**
 * Translate a key. Returns the English fallback if the key is missing in the
 * active locale (should not happen, but guards against future key drift).
 */
export function t(key: keyof TranslationKeys): string {
  return (dict[key] ?? translations.en[key]) as string;
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

export { locale };
