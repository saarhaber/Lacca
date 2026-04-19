/**
 * Heuristics for Auto Color Library OCR-derived marketing names.
 * Rejects concatenated rows, numeric debris, and low-signal garbage.
 */

const MAX_NAME_LEN = 52;
const MAX_WORDS = 7;

export function isPlausibleMarketingName(raw: string): boolean {
  const t = raw
    .trim()
    .replace(/^[=—\-_/]+\s*/, "")
    .replace(/\s+/g, " ");
  if (t.length < 2 || t.length > MAX_NAME_LEN) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > MAX_WORDS) return false;

  const singles = words.filter((w) => /^[A-Za-z]$/.test(w));
  if (singles.length > 3) return false;

  const digitChars = (t.match(/\d/g) ?? []).length;
  if (digitChars / t.length > 0.28) return false;

  const longDigitTokens = words.filter((w) => /^\d{4,}$/.test(w));
  if (longDigitTokens.length > 1) return false;

  if (/[&]{1,}/.test(t)) return false;
  if (/\boe\b|\bhy\b|\beal\b/i.test(t) && words.length >= 6) return false;
  if (/unknown|\(ocr\)/i.test(t)) return false;
  if (/^[=].{20,}/.test(t)) return false;

  // Model applicability lines: many short comma-separated tokens
  if ((t.match(/,/g) ?? []).length >= 3) return false;

  // Price-like token (catalog price OCR artifact: "$0499")
  if (/\$\d{2,}/.test(t)) return false;
  // Em/en dash → sentence fragment, not a color name
  if (/[—–]/.test(t)) return false;
  // Prose words that never appear in paint marketing names
  if (/\b(serial|showing|effected|effecten|will\s+be|tho\s+be|not\s+(?:be|to|the))\b/i.test(t)) return false;
  // Trailing verb → sentence cut off mid-thought
  if (/\b(?:will|are|were|was|be)\s*[,;:]?\s*$/.test(t)) return false;
  // Starts with a lowercase article/preposition (not a color name opener)
  if (/^(?:a|an|the|of|on|in|at|by)\s+[A-Z]/i.test(t) && !/^an?\s+\d/.test(t)) return false;
  // Short nonsense fragments — OCR artifacts without a recognizable color word
  // e.g. "aie a", "seal i" — short lowercase multi-word garbage
  if (t.length <= 7 && !/\d/.test(t) && words.length > 1 && singles.length >= words.length - 1) return false;
  // 1-2 letter all-alpha single token — model/spec fragment, not a color name (e.g. "JS", "BC")
  if (words.length === 1 && /^[A-Za-z]{1,2}$/.test(t)) return false;
  // All-lowercase single word ≤ 5 chars — OCR fragment (e.g. "etal" from "Metallic", "cryst")
  if (words.length === 1 && /^[a-z]{3,5}$/.test(t)) return false;
  // Starts with punctuation OCR artifact (e.g. "'risa", ".color")
  if (/^[^A-Za-z0-9]/.test(t)) return false;

  return true;
}

/** Short, UI-safe label when OCR name is unusable */
export function fallbackMarketingName(code: string): string {
  const c = code.trim().toUpperCase().replace(/^#/, "") || "UNKNOWN";
  return `Factory color ${c}`;
}

export function clampMarketingName(raw: string): string {
  const words = raw.trim().replace(/\s+/g, " ").split(/\s+/).filter(Boolean);
  const slice = words.slice(0, MAX_WORDS).join(" ");
  return slice.length > MAX_NAME_LEN ? slice.slice(0, MAX_NAME_LEN - 1).trimEnd() + "…" : slice;
}

export function finalizeMarketingName(code: string, raw: string): string {
  const clamped = clampMarketingName(raw);
  if (isPlausibleMarketingName(clamped)) return clamped;
  return fallbackMarketingName(code);
}
