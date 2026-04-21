import "./style.css";
import catalogPointer from "../../data/pipeline/catalog-pointer.json";
import type { MatchTier } from "../../src/color/deltaE.js";
import type { DeltaEVersion, OpiCatalogFile } from "../../src/pipeline/opiTypes.js";
import { labGamutReport, labToLinearSrgbD65 } from "../../src/color/gamut.js";
import { rankOpiMatches, type RankedOpi } from "./match";
import { GENERIC_PAINTS, isGenericPaintCode } from "./genericPaints";
import { t, applyTranslations, interpolate, setLocale, getLocale, onLocaleChange, LOCALE_LABELS } from "./i18n/index";
import { SUPPORTED_LOCALES, type Locale } from "./i18n/translations";
import { CAR_MATCH_GALLERY } from "./carMatchGalleryData";

type ExteriorPaint = OemExterior["paints"][number];
type SupportedVehicle = { make: string; model: string; paints: ExteriorPaint[] };

type OemScope = {
  scopeId: string;
  oem: string;
  models: string[];
  supersedes?: string[];
};
type OemExterior = {
  scopeId: string;
  paints: Array<{
    code: string;
    marketingName: string;
    finish: "solid" | "metallic" | "pearl" | "matte" | "other";
    lab: {
      L: number;
      a: number;
      b: number;
      illuminant: string;
      observer: string;
      source: string;
      confidence: "measured" | "spec" | "derived" | "estimated";
      recordedAt: string;
      notes?: string;
      provenanceId?: string;
    };
  }>;
};

// ------------------------------------------------------------------
// Catalog loading. The active catalog is declared in
// data/pipeline/catalog-pointer.json so a catalog bump never requires
// touching UI code. import.meta.glob keeps the resolution static enough
// for Vite to bundle every available catalog, then the pointer selects
// which one the app actually reads.
// ------------------------------------------------------------------
const CATALOGS = import.meta.glob<OpiCatalogFile>("../../data/opi/catalog-*.json", {
  eager: true,
  import: "default"
});
const POINTER_KEY = `../../${catalogPointer.activeCatalogPath}`;
const opiCatalog = CATALOGS[POINTER_KEY];
if (!opiCatalog) {
  throw new Error(
    `Catalog pointer → ${catalogPointer.activeCatalogPath} not bundled. ` +
      `Known keys: ${Object.keys(CATALOGS).join(", ")}`
  );
}

function scopeToVehicles(scope: OemScope, exterior: OemExterior): SupportedVehicle[] {
  const paints = exterior.paints.filter(
    (p) => !p.code.startsWith("TBD_") && !p.marketingName.includes("Reserved slot")
  );
  return scope.models.map((model) => ({ make: scope.oem, model, paints }));
}

function normalizePaintCodeKey(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

/** Merge paint rows; first occurrence wins per normalized code (stable scope order). */
function dedupePaints(paints: ExteriorPaint[]): ExteriorPaint[] {
  const byCode = new Map<string, ExteriorPaint>();
  for (const p of paints) {
    const k = normalizePaintCodeKey(p.code);
    if (!byCode.has(k)) byCode.set(k, p);
  }
  return [...byCode.values()].sort((a, b) => a.marketingName.localeCompare(b.marketingName));
}

/**
 * Normalize user / vPIC make labels to the keys used in `makeLevelCatalogByOem`
 * (`oem-scope.json` `oem`, lowercased, usually hyphenated).
 */
function resolveMakeCatalogKey(make: string): string {
  return make.trim().toLowerCase().replace(/\s+/g, "-");
}

// ------------------------------------------------------------------
// OEM discovery. Every data/oem/<id>/oem-scope.json + exterior-paints-v1.json
// pair is auto-registered at build time, so adding a new make only
// requires landing new JSON files — no UI edit.
// ------------------------------------------------------------------
const OEM_SCOPES = import.meta.glob<OemScope>("../../data/oem/*/oem-scope.json", {
  eager: true,
  import: "default"
});
const OEM_EXTERIORS = import.meta.glob<OemExterior>(
  "../../data/oem/*/exterior-paints-v1.json",
  { eager: true, import: "default" }
);

const supersededScopeIds: Set<string> = (() => {
  const s = new Set<string>();
  for (const [, scope] of Object.entries(OEM_SCOPES)) {
    for (const id of scope.supersedes ?? []) s.add(id);
  }
  return s;
})();

const supportedVehicles: SupportedVehicle[] = (() => {
  const out: SupportedVehicle[] = [];
  const scopes = Object.entries(OEM_SCOPES);

  for (const [scopePath, scope] of scopes) {
    if (supersededScopeIds.has(scope.scopeId)) continue;
    if (!scope.models || scope.models.length === 0) continue;
    const extPath = scopePath.replace("oem-scope.json", "exterior-paints-v1.json");
    const exterior = OEM_EXTERIORS[extPath];
    if (!exterior) continue;
    out.push(...scopeToVehicles(scope, exterior));
  }
  return out;
})();

/**
 * Per-make factory paint catalogs from scopes with `models: []` (PaintRef bulk imports,
 * Auto Color Library pilots, RAL, etc.). Surfaced when a vPIC model row has no paints.
 */
const makeLevelCatalogByOem: Map<string, ExteriorPaint[]> = (() => {
  const merged = new Map<string, ExteriorPaint[]>();
  for (const [scopePath, scope] of Object.entries(OEM_SCOPES)) {
    if (supersededScopeIds.has(scope.scopeId)) continue;
    if (scope.models && scope.models.length > 0) continue;
    const extPath = scopePath.replace("oem-scope.json", "exterior-paints-v1.json");
    const exterior = OEM_EXTERIORS[extPath];
    if (!exterior?.paints?.length) continue;
    const filtered = exterior.paints.filter(
      (p) => !p.code.startsWith("TBD_") && !p.marketingName.includes("Reserved slot")
    );
    if (filtered.length === 0) continue;
    const key = scope.oem.trim().toLowerCase();
    const prev = merged.get(key) ?? [];
    merged.set(key, [...prev, ...filtered]);
  }
  const out = new Map<string, ExteriorPaint[]>();
  for (const [k, arr] of merged) {
    out.set(k, dedupePaints(arr));
  }
  return out;
})();

const supportedMakes = [...new Set(supportedVehicles.map((v) => v.make))].sort();

function findSupported(make: string, model: string): SupportedVehicle | undefined {
  const a = make.toLowerCase();
  const b = model.toLowerCase();
  // A make/model can appear in multiple scopes (e.g. a curated scope with
  // real paints + a vPIC-seeded scope with an empty paint catalog). Pick
  // whichever entry has the richer paint list so the UI surfaces the
  // best-available colors.
  let best: SupportedVehicle | undefined;
  for (const v of supportedVehicles) {
    if (v.make.toLowerCase() !== a || v.model.toLowerCase() !== b) continue;
    if (!best || v.paints.length > best.paints.length) best = v;
  }
  return best;
}

function makeLevelPaints(make: string): ExteriorPaint[] {
  const normalized = resolveMakeCatalogKey(make);
  const candidates = [normalized, make.trim().toLowerCase()];
  /** vPIC lists both "Mercedes" and "Mercedes-Benz"; paint scopes use Mercedes-Benz. */
  if (normalized === "mercedes") candidates.push("mercedes-benz");
  const tried = new Set<string>();
  for (const q of candidates) {
    if (tried.has(q)) continue;
    tried.add(q);
    const paints = makeLevelCatalogByOem.get(q);
    if (paints?.length) return paints;
  }
  return [];
}

/** Paints shown in the Match color dropdown for a make/model pair. */
function paintsForMatchUi(make: string, model: string): ExteriorPaint[] {
  const vehicle = findSupported(make, model);
  if (vehicle && vehicle.paints.length > 0) return vehicle.paints;
  return makeLevelPaints(make);
}

// Split supported makes by whether any of their models carry a real paint
// catalog. "With paints" → curated/imported scopes (BMW X, Porsche, Tesla,
// Toyota Corolla, …). "Models only" → OEMs seeded from NHTSA vPIC where we
// know the model catalog but don't have factory paint rows yet. The UI
// uses this split to label optgroups honestly instead of claiming
// "measured paint data" for makes that only have model names.
const makesWithPaints = new Set<string>(
  supportedVehicles.filter((v) => v.paints.length > 0).map((v) => v.make.toLowerCase())
);
for (const m of supportedMakes) {
  if (makeLevelPaints(m).length > 0) makesWithPaints.add(m.toLowerCase());
}

// ------------------------------------------------------------------
// NHTSA vPIC — free public vehicle database with CORS enabled.
// Docs: https://vpic.nhtsa.dot.gov/api/
// We silently fall back to local-only data if the fetch fails.
// ------------------------------------------------------------------
const VPIC_MAKES =
  "https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json";
const VPIC_MODELS = (make: string) =>
  `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(
    make
  )}?format=json`;

type VpicMakeRow = { MakeName?: string; Make_Name?: string };
type VpicModelRow = { Model_Name?: string; ModelName?: string };

async function fetchMakes(): Promise<string[]> {
  try {
    const res = await fetch(VPIC_MAKES);
    if (!res.ok) return [];
    const json = (await res.json()) as { Results?: VpicMakeRow[] };
    const names = (json.Results ?? [])
      .map((r) => r.MakeName ?? r.Make_Name ?? "")
      .filter((n): n is string => n.length > 0);
    return [...new Set(names)].sort((x, y) => x.localeCompare(y));
  } catch {
    return [];
  }
}

async function fetchModels(make: string): Promise<string[]> {
  try {
    const res = await fetch(VPIC_MODELS(make));
    if (!res.ok) return [];
    const json = (await res.json()) as { Results?: VpicModelRow[] };
    const names = (json.Results ?? [])
      .map((r) => r.Model_Name ?? r.ModelName ?? "")
      .filter((n): n is string => n.length > 0);
    return [...new Set(names)].sort((x, y) => x.localeCompare(y));
  } catch {
    return [];
  }
}

// ------------------------------------------------------------------
// VIN decoding. NHTSA vPIC DecodeVinValues returns a single flat row
// with Make / Model / ModelYear. The VIN itself does NOT encode
// exterior color, so we only auto-fill make/model/year and still
// require the user to pick a paint below.
// ------------------------------------------------------------------
const VPIC_DECODE = (vin: string) =>
  `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(
    vin
  )}?format=json`;

type VpicDecodeRow = {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  ErrorCode?: string;
  ErrorText?: string;
};

type DecodedVin = { make: string; model: string; year: string };

/**
 * Strict VIN validator. Modern VINs are 17 ASCII chars, letters I/O/Q
 * are disallowed to avoid confusion with 1/0. We skip the check-digit
 * calc (position 9) because pre-1981 and some imports legitimately fail
 * it — vPIC will still decode what it can.
 */
function isPlausibleVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

async function decodeVin(vin: string): Promise<DecodedVin | null> {
  try {
    const res = await fetch(VPIC_DECODE(vin));
    if (!res.ok) return null;
    const json = (await res.json()) as { Results?: VpicDecodeRow[] };
    const row = json.Results?.[0];
    if (!row) return null;
    const make = (row.Make ?? "").trim();
    const model = (row.Model ?? "").trim();
    if (!make || !model) return null;
    return { make, model, year: (row.ModelYear ?? "").trim() };
  } catch {
    return null;
  }
}

/**
 * Find an <option> whose value matches (case-insensitive) and select it.
 * If not found, append a new option into an "auto-added from VIN" group
 * so the select can hold the value we just decoded.
 */
function selectOrInject(sel: HTMLSelectElement, value: string): void {
  const wanted = value.toLowerCase();
  for (const opt of Array.from(sel.options)) {
    if (opt.value.toLowerCase() === wanted) {
      sel.value = opt.value;
      return;
    }
  }
  let group = sel.querySelector<HTMLOptGroupElement>('optgroup[data-source="vin"]');
  if (!group) {
    group = document.createElement("optgroup");
    group.label = t("optgroup.fromVin");
    group.dataset.source = "vin";
    sel.appendChild(group);
  }
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = value;
  group.appendChild(opt);
  sel.value = value;
}

function showVinFeedback(
  message: string,
  tone: "info" | "success" | "error"
): void {
  vinFeedback.hidden = false;
  vinFeedback.className = `vin-feedback vin-feedback-${tone}`;
  vinFeedback.textContent = message;
}

async function handleVinDecode(): Promise<void> {
  const raw = vinInput.value.trim().toUpperCase();
  vinInput.value = raw;
  if (!raw) {
    vinFeedback.hidden = true;
    return;
  }
  if (!isPlausibleVin(raw)) {
    showVinFeedback(t("form.vin.invalid"), "error");
    return;
  }

  vinDecodeBtn.disabled = true;
  const originalLabel = vinDecodeBtn.textContent;
  vinDecodeBtn.textContent = t("form.vin.decoding");
  showVinFeedback(t("form.vin.decoding"), "info");

  try {
    const decoded = await decodeVin(raw);
    if (!decoded) {
      showVinFeedback(t("form.vin.notFound"), "error");
      return;
    }

    results.hidden = true;
    selectOrInject(makeSelect, decoded.make);
    await loadModelsFor(decoded.make);
    selectOrInject(modelSelect, decoded.model);
    loadPaintsFor(decoded.make, decoded.model);

    showVinFeedback(
      interpolate(t("form.vin.success"), {
        year: decoded.year || "—",
        make: decoded.make,
        model: decoded.model
      }),
      "success"
    );
  } finally {
    vinDecodeBtn.disabled = false;
    if (originalLabel !== null) vinDecodeBtn.textContent = originalLabel;
  }
}

// ------------------------------------------------------------------
// DOM
// ------------------------------------------------------------------
const makeSelect = document.querySelector<HTMLSelectElement>("#make")!;
const modelSelect = document.querySelector<HTMLSelectElement>("#model")!;
const paintSelect = document.querySelector<HTMLSelectElement>("#paint")!;
const form = document.querySelector<HTMLFormElement>("#match-form")!;
const submitBtn = document.querySelector<HTMLButtonElement>("#submit-btn")!;
const availability = document.querySelector<HTMLElement>("#availability")!;
const vinInput = document.querySelector<HTMLInputElement>("#vin")!;
const vinDecodeBtn = document.querySelector<HTMLButtonElement>("#vin-decode")!;
const vinFeedback = document.querySelector<HTMLElement>("#vin-feedback")!;
const results = document.querySelector<HTMLElement>("#results")!;
const carSummary = document.querySelector<HTMLElement>("#car-summary")!;
const matchList = document.querySelector<HTMLOListElement>("#match-list")!;
const catalogMeta = document.querySelector<HTMLElement>("#catalog-meta")!;
const picksSublabel = document.querySelector<HTMLElement>("#picks-sublabel")!;
const finishDisclaimer = document.querySelector<HTMLElement>("#finish-disclaimer")!;
const distantBanner = document.querySelector<HTMLElement>("#distant-banner")!;
const localePicker = document.querySelector<HTMLSelectElement>("#locale-picker")!;
const pageEl = document.querySelector<HTMLElement>(".page")!;
const tabMatch = document.querySelector<HTMLButtonElement>("#tab-match")!;
const tabGallery = document.querySelector<HTMLButtonElement>("#tab-gallery")!;
const viewMatch = document.querySelector<HTMLElement>("#view-match")!;
const viewGallery = document.querySelector<HTMLElement>("#view-gallery")!;
const galleryGrid = document.querySelector<HTMLElement>("#gallery-grid")!;
const galleryCountEl = document.querySelector<HTMLElement>("#gallery-count")!;
const galleryLightbox = document.querySelector<HTMLElement>("#gallery-lightbox")!;
const galleryLbBackdrop = document.querySelector<HTMLButtonElement>("#gallery-lb-backdrop")!;
const galleryLbClose = document.querySelector<HTMLButtonElement>("#gallery-lb-close")!;
const galleryLbPrev = document.querySelector<HTMLButtonElement>("#gallery-lb-prev")!;
const galleryLbNext = document.querySelector<HTMLButtonElement>("#gallery-lb-next")!;
const galleryLbImg = document.querySelector<HTMLImageElement>("#gallery-lb-img")!;
const galleryLbCaption = document.querySelector<HTMLElement>("#gallery-lb-caption")!;
const galleryLbCounter = document.querySelector<HTMLElement>("#gallery-lb-counter")!;

// Populate the language picker
for (const loc of SUPPORTED_LOCALES) {
  const opt = document.createElement("option");
  opt.value = loc;
  opt.textContent = LOCALE_LABELS[loc];
  localePicker.appendChild(opt);
}
localePicker.value = getLocale();
localePicker.addEventListener("change", () => {
  setLocale(localePicker.value as Locale);
});
onLocaleChange(() => {
  localePicker.value = getLocale();
  void initMakes();
  updateGalleryChrome();
  if (!galleryLightbox.hidden) syncLightboxStrings();
});

applyTranslations(document);
updateGalleryChrome();

function setMainView(which: "match" | "gallery"): void {
  const gallery = which === "gallery";
  tabMatch.setAttribute("aria-selected", String(!gallery));
  tabGallery.setAttribute("aria-selected", String(gallery));
  tabMatch.tabIndex = gallery ? -1 : 0;
  tabGallery.tabIndex = gallery ? 0 : -1;
  viewMatch.hidden = gallery;
  viewGallery.hidden = !gallery;
  pageEl.classList.toggle("page--wide", gallery);
}

const GALLERY_RENDER_VERSION = "17";

let galleryLightboxIndex = 0;
let galleryLightboxFocusReturn: HTMLElement | null = null;

function updateGalleryChrome(): void {
  galleryCountEl.textContent = interpolate(t("gallery.count"), {
    n: String(CAR_MATCH_GALLERY.length)
  });
}

function syncLightboxStrings(): void {
  const item = CAR_MATCH_GALLERY[galleryLightboxIndex];
  const n = CAR_MATCH_GALLERY.length;
  if (!item || n === 0) {
    galleryLbImg.removeAttribute("src");
    galleryLbImg.alt = "";
    galleryLbCaption.textContent = "";
    galleryLbCounter.textContent = "";
    return;
  }
  galleryLbImg.src = item.src;
  galleryLbImg.alt = item.caption;
  galleryLbCaption.textContent = item.caption;
  galleryLbCounter.textContent = interpolate(t("gallery.lbCounter"), {
    current: String(galleryLightboxIndex + 1),
    total: String(n)
  });
}

function openGalleryLightbox(index: number, focusReturn: HTMLElement): void {
  if (CAR_MATCH_GALLERY.length === 0) return;
  galleryLightboxFocusReturn = focusReturn;
  galleryLightboxIndex = Math.max(0, Math.min(index, CAR_MATCH_GALLERY.length - 1));
  syncLightboxStrings();
  galleryLightbox.hidden = false;
  document.body.classList.add("gallery-lightbox-open");
  galleryLbClose.focus();
}

function stepGalleryLightbox(delta: number): void {
  const n = CAR_MATCH_GALLERY.length;
  if (n === 0) return;
  galleryLightboxIndex = (galleryLightboxIndex + delta + n) % n;
  syncLightboxStrings();
}

function closeGalleryLightbox(): void {
  galleryLightbox.hidden = true;
  document.body.classList.remove("gallery-lightbox-open");
  const ret = galleryLightboxFocusReturn;
  galleryLightboxFocusReturn = null;
  // Gallery tiles live in a tab panel; don't focus them while that panel is hidden.
  if (ret && !viewGallery.hidden) ret.focus();
}

function renderGallery(): void {
  if (galleryGrid.dataset.renderVersion === GALLERY_RENDER_VERSION) return;
  galleryGrid.replaceChildren();
  updateGalleryChrome();
  CAR_MATCH_GALLERY.forEach(({ src, caption }, i) => {
    const card = document.createElement("article");
    card.className = "gallery-card";
    card.style.setProperty("--i", String(i));
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute(
      "aria-label",
      interpolate(t("gallery.openAria"), { caption })
    );
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.loading = i < 8 ? "eager" : "lazy";
    img.decoding = "async";
    const cap = document.createElement("figcaption");
    cap.className = "gallery-cap";
    cap.textContent = caption;
    figure.append(img, cap);
    card.append(figure);
    card.addEventListener("click", () => openGalleryLightbox(i, card));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openGalleryLightbox(i, card);
      }
    });
    galleryGrid.append(card);
  });
  galleryGrid.dataset.renderVersion = GALLERY_RENDER_VERSION;
}

galleryLbBackdrop.addEventListener("click", closeGalleryLightbox);
galleryLbClose.addEventListener("click", closeGalleryLightbox);
galleryLbPrev.addEventListener("click", () => stepGalleryLightbox(-1));
galleryLbNext.addEventListener("click", () => stepGalleryLightbox(1));

galleryLightbox.addEventListener("keydown", (e: Event) => {
  const ke = e as KeyboardEvent;
  if (galleryLightbox.hidden) return;
  if (ke.key === "ArrowLeft") {
    ke.preventDefault();
    stepGalleryLightbox(-1);
  } else if (ke.key === "ArrowRight") {
    ke.preventDefault();
    stepGalleryLightbox(1);
  }
});

/** Escape must work even when focus moved to Match tab / form (dialog keydown never fires). */
document.addEventListener(
  "keydown",
  (ke: KeyboardEvent) => {
    if (ke.key !== "Escape") return;
    if (galleryLightbox.hidden) return;
    ke.preventDefault();
    closeGalleryLightbox();
  },
  true
);

tabMatch.addEventListener("click", () => {
  closeGalleryLightbox();
  setMainView("match");
  tabMatch.focus();
});

tabGallery.addEventListener("click", () => {
  renderGallery();
  setMainView("gallery");
  tabGallery.focus();
});

document.querySelector(".app-tabs")?.addEventListener("keydown", (e: Event) => {
  const ke = e as KeyboardEvent;
  if (ke.key !== "ArrowRight" && ke.key !== "ArrowLeft") return;
  const t = ke.target as HTMLElement;
  if (t !== tabMatch && t !== tabGallery) return;
  ke.preventDefault();
  if (ke.key === "ArrowRight" && t === tabMatch) tabGallery.click();
  else if (ke.key === "ArrowLeft" && t === tabGallery) tabMatch.click();
});

// ------------------------------------------------------------------
// Populate the Make dropdown: supported ones (with paint data) first,
// then the full NHTSA list in a second optgroup.
// ------------------------------------------------------------------
async function initMakes() {
  const remoteMakes = await fetchMakes();

  const supportedSet = new Set(supportedMakes.map((m) => m.toLowerCase()));
  const others = remoteMakes.filter((m) => !supportedSet.has(m.toLowerCase()));

  makeSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("dropdown.selectMake");
  placeholder.disabled = true;
  placeholder.selected = true;
  makeSelect.appendChild(placeholder);

  const makesWithCatalog = supportedMakes.filter((m) =>
    makesWithPaints.has(m.toLowerCase())
  );
  const makesModelsOnly = supportedMakes.filter(
    (m) => !makesWithPaints.has(m.toLowerCase())
  );

  if (makesWithCatalog.length > 0) {
    const group = document.createElement("optgroup");
    group.label = t("optgroup.withData");
    for (const name of makesWithCatalog) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      group.appendChild(opt);
    }
    makeSelect.appendChild(group);
  }

  if (makesModelsOnly.length > 0) {
    const group = document.createElement("optgroup");
    group.label = t("optgroup.modelsOnly") ?? "Recognized models (generic colors)";
    for (const name of makesModelsOnly) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      group.appendChild(opt);
    }
    makeSelect.appendChild(group);
  }

  if (others.length > 0) {
    const group = document.createElement("optgroup");
    group.label = t("optgroup.allMakes");
    for (const name of others) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      group.appendChild(opt);
    }
    makeSelect.appendChild(group);
  }

  makeSelect.value = "";
  modelSelect.disabled = true;
  modelSelect.innerHTML = `<option disabled selected>${t("dropdown.pickMakeFirst")}</option>`;
  paintSelect.disabled = true;
  paintSelect.innerHTML = `<option disabled selected>${t("dropdown.pickModelFirst")}</option>`;
  submitBtn.disabled = true;
}

async function loadModelsFor(make: string) {
  modelSelect.disabled = true;
  modelSelect.innerHTML = `<option disabled selected>${t("dropdown.loadingModels")}</option>`;
  paintSelect.disabled = true;
  paintSelect.innerHTML = `<option disabled selected>${t("dropdown.pickModelFirst")}</option>`;
  submitBtn.disabled = true;
  availability.hidden = true;

  const supportedForMake = supportedVehicles.filter(
    (v) => v.make.toLowerCase() === make.toLowerCase()
  );
  // De-dupe by lowercased model name. When a model is listed by both a
  // curated scope (real paint rows) and a vPIC scope (no paints) we keep
  // the richer entry so the "With factory paint catalog" optgroup is
  // accurate.
  const seenByModel = new Map<string, SupportedVehicle>();
  for (const v of supportedForMake) {
    const k = v.model.toLowerCase();
    const prev = seenByModel.get(k);
    if (!prev || v.paints.length > prev.paints.length) seenByModel.set(k, v);
  }
  const modelsWithPaints: string[] = [];
  const modelsKnownOnly: string[] = [];
  for (const v of seenByModel.values()) {
    if (paintsForMatchUi(make, v.model).length > 0) modelsWithPaints.push(v.model);
    else modelsKnownOnly.push(v.model);
  }
  modelsWithPaints.sort((a, b) => a.localeCompare(b));
  modelsKnownOnly.sort((a, b) => a.localeCompare(b));

  const supportedSet = new Set(
    [...modelsWithPaints, ...modelsKnownOnly].map((m) => m.toLowerCase())
  );

  const remote = await fetchModels(make);
  const others = remote.filter((m) => !supportedSet.has(m.toLowerCase()));

  modelSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("dropdown.selectModel");
  placeholder.disabled = true;
  placeholder.selected = true;
  modelSelect.appendChild(placeholder);

  if (modelsWithPaints.length > 0) {
    const grp = document.createElement("optgroup");
    grp.label = t("optgroup.withData");
    for (const m of modelsWithPaints) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      grp.appendChild(opt);
    }
    modelSelect.appendChild(grp);
  }

  if (modelsKnownOnly.length > 0) {
    const grp = document.createElement("optgroup");
    grp.label = t("optgroup.modelsOnly") ?? "Recognized models (generic colors)";
    for (const m of modelsKnownOnly) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      grp.appendChild(opt);
    }
    modelSelect.appendChild(grp);
  }

  if (others.length > 0) {
    const grp = document.createElement("optgroup");
    grp.label = t("optgroup.allModels");
    for (const m of others) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      grp.appendChild(opt);
    }
    modelSelect.appendChild(grp);
  }

  modelSelect.disabled = false;

  modelSelect.value = "";
  paintSelect.disabled = true;
  paintSelect.innerHTML = `<option disabled selected>${t("dropdown.pickModelFirst")}</option>`;
  submitBtn.disabled = true;
}

function loadPaintsFor(make: string, model: string) {
  availability.hidden = true;
  availability.textContent = "";
  submitBtn.disabled = true;
  paintSelect.innerHTML = "";

  const paints = paintsForMatchUi(make, model);

  paintSelect.disabled = false;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("dropdown.selectColor");
  placeholder.disabled = true;
  placeholder.selected = true;
  paintSelect.appendChild(placeholder);

  if (paints.length > 0) {
    for (const p of paints) {
      const opt = document.createElement("option");
      opt.value = p.code;
      opt.textContent = `${p.marketingName} · ${p.finish}`;
      paintSelect.appendChild(opt);
    }

    paintSelect.value = "";
    submitBtn.disabled = true;
    return;
  }

  const group = document.createElement("optgroup");
  group.label = t("optgroup.genericColors");
  for (const p of GENERIC_PAINTS) {
    const opt = document.createElement("option");
    opt.value = p.code;
    opt.textContent = `${p.marketingName} · ${p.finish}`;
    group.appendChild(opt);
  }
  paintSelect.appendChild(group);

  availability.hidden = false;
  availability.innerHTML = interpolate(t("availability.noData"), { make, model });

  paintSelect.value = "";
  submitBtn.disabled = true;
}

function selectedPaint(): ExteriorPaint | undefined {
  const paints = paintsForMatchUi(makeSelect.value, modelSelect.value);
  const fromOem = paints.find((p) => p.code === paintSelect.value);
  if (fromOem) return fromOem;
  return GENERIC_PAINTS.find((p) => p.code === paintSelect.value) as
    | ExteriorPaint
    | undefined;
}

function labCss(lab: { L: number; a: number; b: number }): string {
  // Our pipeline stores CIELAB under D65/2deg. CSS `lab()` is D50-based, so
  // render via our explicit LAB(D65) -> linear sRGB transform to keep swatches
  // visually aligned with matching math and seeded data.
  const { r, g, b } = labToLinearSrgbD65(lab);
  const sr = linearToSrgb8(r);
  const sg = linearToSrgb8(g);
  const sb = linearToSrgb8(b);
  return `rgb(${sr} ${sg} ${sb})`;
}

function linearToSrgb8(c: number): number {
  const clamped = Math.min(1, Math.max(0, c));
  const encoded =
    clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

function tierCopy(tier: MatchTier): string {
  switch (tier) {
    case "perfect":
      return t("tier.perfect");
    case "close":
      return t("tier.close");
    case "explore":
      return t("tier.explore");
    case "distant":
      return t("tier.distant");
    default:
      return tier;
  }
}

/**
 * `confidence: "derived"` spans several physical meanings — published HEX,
 * PaintRef chip PNG averages, NHTSA rows, etc. Split badge copy so we never
 * label a chip average as "hex-derived".
 */
function derivedKindFromSource(source: string | undefined): "hex" | "chip" | "other" {
  const s = (source ?? "").trim().toLowerCase();
  if (
    s === "hex_derived" ||
    s === "paintref_hex" ||
    s === "ral_classic_hex" ||
    s === "autocolorlibrary_swatch"
  )
    return "hex";
  if (s === "paintref_chip") return "chip";
  return "other";
}

function confidenceTip(conf: string, source?: string): string {
  switch (conf) {
    case "measured":
      return t("confTip.measured");
    case "spec":
      return t("confTip.spec");
    case "derived": {
      const k = derivedKindFromSource(source);
      if (k === "hex") return t("confTip.derivedHex");
      if (k === "chip") return t("confTip.derivedChip");
      return t("confTip.derivedOther");
    }
    case "estimated":
      return t("confTip.estimated");
    default:
      return "";
  }
}

function prettySourceLabel(source: string): string {
  const normalized = source.trim().toLowerCase();
  switch (normalized) {
    case "placeholder_prototype":
      return "Lacca seed sample (pre-release)";
    case "hex_derived":
      return "HEX-derived reference";
    case "paintref":
      return "PaintRef catalog";
    case "paintref_hex":
      return "PaintRef HEX swatch";
    case "paintref_chip":
      return "PaintRef chip sample";
    case "autocolorlibrary_swatch":
      return "Auto Color Library sheet sample";
    case "ral_classic_hex":
      return "RAL Classic reference";
    case "oem_spec":
    case "oem_spec_sheet":
      return "OEM specification sheet";
    case "spectro_reread":
      return "Spectrophotometer measurement";
    case "carapi":
      return "CarAPI reference";
    case "nhtsa_vpic":
      return "NHTSA vPIC catalog";
    default:
      return "";
  }
}

/**
 * Compose the confidence-badge tooltip. Starts with the tier-level
 * description and appends a friendly "Source: …" line only when we have
 * a human-readable label for the underlying source. Internal IDs
 * (provenanceId, raw source keys) are intentionally omitted — they look
 * like debug noise to end users.
 */
function composeConfidenceTooltip(lab: OemExterior["paints"][number]["lab"]): string {
  const parts: string[] = [];
  const tier = confidenceTip(lab.confidence, lab.source);
  if (tier) parts.push(tier);
  if (lab.source) {
    const friendly = prettySourceLabel(lab.source);
    if (friendly) {
      parts.push(
        interpolate(t("tooltip.source") ?? "Source: {source}", {
          source: friendly
        })
      );
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

function confidenceBadgeText(conf: string, source?: string): string {
  switch (conf) {
    case "measured":
      return t("conf.measured");
    case "spec":
      return t("conf.spec");
    case "derived": {
      const k = derivedKindFromSource(source);
      if (k === "hex") return t("conf.derivedHex");
      if (k === "chip") return t("conf.derivedChip");
      return t("conf.derivedOther");
    }
    case "estimated":
      return t("conf.estimated");
    default:
      return conf;
  }
}

function tierTip(tier: MatchTier): string {
  switch (tier) {
    case "perfect":
      return t("tierTip.perfect");
    case "close":
      return t("tierTip.close");
    case "explore":
      return t("tierTip.explore");
    case "distant":
      return t("tierTip.distant");
    default:
      return "";
  }
}

/**
 * Compose the badge tooltip. Starts with the ΔE-tier explanation; appends
 * capped-by-confidence and finish-mismatch notes when applicable.
 */
function composeBadgeTip(row: RankedOpi): string {
  const parts = [tierTip(row.tier)];
  if (row.cappedByConfidence) {
    parts.push(t("tooltip.capped") ?? "");
  }
  if (row.finishPenalty > 0) {
    parts.push(t("tooltip.finishPenalty") ?? "");
  }
  return parts.filter(Boolean).join("\n\n");
}

function makeGamutCaption(): HTMLElement {
  const cap = document.createElement("small");
  cap.className = "gamut-warning";
  cap.textContent = t("results.gamutWarning") ?? "";
  return cap;
}

function render() {
  const paint = selectedPaint();
  if (!paint) return;

  const ranked = rankOpiMatches(paint.lab, opiCatalog.skus, 5, {
    deltaEVersion: opiCatalog.deltaEVersion as DeltaEVersion,
    sourceConfidence: paint.lab.confidence,
    sourceFinish: paint.finish
  });
  const make = makeSelect.value;
  const model = modelSelect.value;

  carSummary.innerHTML = "";
  const carGamut = labGamutReport(paint.lab);
  const sw = document.createElement("div");
  sw.className = "car-swatch" + (carGamut.outOfGamut ? " out-of-gamut" : "");
  sw.style.background = labCss(paint.lab);
  sw.title = t("swatch.carTitle");

  const copy = document.createElement("div");
  copy.className = "car-copy";

  const title = document.createElement("strong");
  title.textContent = `${make} ${model}`;

  const details = document.createElement("div");
  details.className = "car-details";

  const meta = document.createElement("span");
  meta.className = "car-details-meta";
  const codeEl = document.createElement("code");
  codeEl.textContent = paint.code;
  meta.append(
    document.createTextNode(`${paint.marketingName} · `),
    codeEl,
    document.createTextNode(` · ${paint.finish}`)
  );

  const conf = paint.lab.confidence;
  const confBadge = document.createElement("span");
  confBadge.className = `conf conf-${conf}`;
  confBadge.textContent = confidenceBadgeText(conf, paint.lab.source);

  const confWrap = document.createElement("span");
  confWrap.className = "conf-wrap";
  confWrap.append(confBadge);

  const confTip = composeConfidenceTooltip(paint.lab).trim();
  if (confTip) {
    const confHelp = document.createElement("button");
    confHelp.type = "button";
    confHelp.className = "conf-help";
    confHelp.textContent = "?";
    confHelp.setAttribute("aria-label", "About confidence level");
    confHelp.dataset.tip = confTip;
    confWrap.append(confHelp);
  }

  details.append(meta, document.createTextNode(" · "), confWrap);

  if (isGenericPaintCode(paint.code)) {
    const genericBadge = document.createElement("span");
    genericBadge.className = "conf conf-generic";
    genericBadge.textContent = t("conf.generic");
    genericBadge.title = t("confTip.generic");
    details.append(document.createTextNode(" · "), genericBadge);
  }

  copy.append(title, details);

  // Gamut honesty: if the source paint LAB falls outside sRGB, the on-screen
  // swatch was silently clipped. Surface that fact instead of pretending the
  // displayed color is accurate.
  if (carGamut.outOfGamut) {
    copy.append(makeGamutCaption());
  }

  carSummary.append(sw, copy);

  matchList.innerHTML = "";
  ranked.forEach((row, i) => {
    const li = document.createElement("li");
    li.className = "match-item" + (i === 0 ? " best" : "");

    const opiGamut = labGamutReport(row.opi.lab);
    const opiSw = document.createElement("div");
    opiSw.className = "opi-swatch" + (opiGamut.outOfGamut ? " out-of-gamut" : "");
    opiSw.style.background = labCss(row.opi.lab);
    opiSw.title = `${row.opi.name} (${row.opi.sku}) — approximate from LAB`;

    const body = document.createElement("div");
    body.className = "match-body";
    const coll = row.opi.collection ? ` · ${row.opi.collection}` : "";

    const nameEl: HTMLElement = row.opi.productUrl
      ? Object.assign(document.createElement("a"), {
          href: row.opi.productUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          textContent: row.opi.name
        })
      : Object.assign(document.createElement("strong"), { textContent: row.opi.name });
    if (row.opi.productUrl) nameEl.className = "opi-link";

    const nameWrap = document.createElement("strong");
    nameWrap.appendChild(nameEl);

    const meta = document.createElement("small");
    meta.textContent = `${row.opi.sku}${coll}`;

    body.append(nameWrap, meta);

    if (opiGamut.outOfGamut) {
      body.append(makeGamutCaption());
    }

    const badge = document.createElement("span");
    badge.className = `badge ${row.tier}`;
    badge.textContent = `${tierCopy(row.tier)} · ΔE ${row.deltaE.toFixed(2)}`;
    badge.title = composeBadgeTip(row);

    li.append(opiSw, body, badge);
    matchList.appendChild(li);
  });

  picksSublabel.textContent = t("results.picksSublabel");
  picksSublabel.hidden = ranked.length === 0;

  const isShifty = paint.finish === "metallic" || paint.finish === "pearl";
  finishDisclaimer.hidden = !isShifty;

  const bestTier = ranked[0]?.tier;
  distantBanner.hidden = bestTier !== "distant";

  catalogMeta.textContent = `Catalog ${opiCatalog.catalogVersion} · ${opiCatalog.deltaEVersion} · ${opiCatalog.illuminant} / ${opiCatalog.observer}`;

  results.hidden = false;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  render();
});

vinDecodeBtn.addEventListener("click", () => {
  void handleVinDecode();
});

vinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    // Avoid submitting the match form while the user is still typing the VIN;
    // pressing Enter in the VIN field should trigger decoding instead.
    e.preventDefault();
    void handleVinDecode();
  }
});

makeSelect.addEventListener("change", () => {
  results.hidden = true;
  void loadModelsFor(makeSelect.value);
});

modelSelect.addEventListener("change", () => {
  results.hidden = true;
  loadPaintsFor(makeSelect.value, modelSelect.value);
});

paintSelect.addEventListener("change", () => {
  submitBtn.disabled = paintSelect.value === "";
  if (!results.hidden) render();
});

void initMakes();
