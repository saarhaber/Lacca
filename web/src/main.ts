import "./style.css";
import teslaScope from "../../data/oem/tesla-model-3y-v1/oem-scope.json";
import teslaExterior from "../../data/oem/tesla-model-3y-v1/exterior-paints-v1.json";
import bmwXScope from "../../data/oem/bmw-x-v1/oem-scope.json";
import bmwXExterior from "../../data/oem/bmw-x-v1/exterior-paints-v1.json";
import opiCatalog from "../../data/opi/catalog-1.0.0.json";
import type { MatchTier } from "../../src/color/deltaE.js";
import { rankOpiMatches } from "./match";
import { GENERIC_PAINTS, isGenericPaintCode } from "./genericPaints";

type ExteriorPaint = (typeof teslaExterior.paints)[number];
type SupportedVehicle = { make: string; model: string; paints: ExteriorPaint[] };

type OemScope = { oem: string; models: string[] };
type OemExterior = { paints: ExteriorPaint[] };

function scopeToVehicles(scope: OemScope, exterior: OemExterior): SupportedVehicle[] {
  const paints = exterior.paints.filter(
    (p) => !p.code.startsWith("TBD_") && !p.marketingName.includes("Reserved slot")
  );
  return scope.models.map((model) => ({ make: scope.oem, model, paints }));
}

const supportedVehicles: SupportedVehicle[] = [
  ...scopeToVehicles(teslaScope, teslaExterior),
  ...scopeToVehicles(bmwXScope, bmwXExterior)
];

const supportedMakes = [...new Set(supportedVehicles.map((v) => v.make))].sort();

function findSupported(make: string, model: string): SupportedVehicle | undefined {
  const a = make.toLowerCase();
  const b = model.toLowerCase();
  return supportedVehicles.find(
    (v) => v.make.toLowerCase() === a && v.model.toLowerCase() === b
  );
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
// DOM
// ------------------------------------------------------------------
const makeSelect = document.querySelector<HTMLSelectElement>("#make")!;
const modelSelect = document.querySelector<HTMLSelectElement>("#model")!;
const paintSelect = document.querySelector<HTMLSelectElement>("#paint")!;
const form = document.querySelector<HTMLFormElement>("#match-form")!;
const submitBtn = document.querySelector<HTMLButtonElement>("#submit-btn")!;
const availability = document.querySelector<HTMLElement>("#availability")!;
const results = document.querySelector<HTMLElement>("#results")!;
const carSummary = document.querySelector<HTMLElement>("#car-summary")!;
const matchList = document.querySelector<HTMLOListElement>("#match-list")!;
const catalogMeta = document.querySelector<HTMLElement>("#catalog-meta")!;

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
  placeholder.textContent = "Select a make…";
  placeholder.disabled = true;
  placeholder.selected = true;
  makeSelect.appendChild(placeholder);

  if (supportedMakes.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "● With measured paint data";
    for (const name of supportedMakes) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      group.appendChild(opt);
    }
    makeSelect.appendChild(group);
  }

  if (others.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "All makes (NHTSA vPIC)";
    for (const name of others) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      group.appendChild(opt);
    }
    makeSelect.appendChild(group);
  }

  // Default to first supported make for an instant path to a match.
  const first = supportedMakes[0];
  if (first) {
    makeSelect.value = first;
    makeSelect.dispatchEvent(new Event("change"));
  }
}

async function loadModelsFor(make: string) {
  modelSelect.disabled = true;
  modelSelect.innerHTML = "<option disabled selected>Loading models…</option>";
  paintSelect.disabled = true;
  paintSelect.innerHTML = "<option disabled selected>Pick a model first</option>";
  submitBtn.disabled = true;
  availability.hidden = true;

  const supportedForMake = supportedVehicles.filter(
    (v) => v.make.toLowerCase() === make.toLowerCase()
  );
  const supportedNames = supportedForMake.map((v) => v.model);
  const supportedSet = new Set(supportedNames.map((m) => m.toLowerCase()));

  const remote = await fetchModels(make);
  const others = remote.filter((m) => !supportedSet.has(m.toLowerCase()));

  modelSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a model…";
  placeholder.disabled = true;
  placeholder.selected = true;
  modelSelect.appendChild(placeholder);

  if (supportedNames.length > 0) {
    const grp = document.createElement("optgroup");
    grp.label = "● With measured paint data";
    for (const m of supportedNames) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      grp.appendChild(opt);
    }
    modelSelect.appendChild(grp);
  }

  if (others.length > 0) {
    const grp = document.createElement("optgroup");
    grp.label = "All models (NHTSA)";
    for (const m of others) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      grp.appendChild(opt);
    }
    modelSelect.appendChild(grp);
  }

  modelSelect.disabled = false;

  const firstSupported = supportedNames[0];
  if (firstSupported) {
    modelSelect.value = firstSupported;
    modelSelect.dispatchEvent(new Event("change"));
  }
}

function loadPaintsFor(make: string, model: string) {
  availability.hidden = true;
  availability.textContent = "";
  submitBtn.disabled = true;
  paintSelect.innerHTML = "";

  const vehicle = findSupported(make, model);

  paintSelect.disabled = false;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a color…";
  placeholder.disabled = true;
  placeholder.selected = true;
  paintSelect.appendChild(placeholder);

  if (vehicle) {
    for (const p of vehicle.paints) {
      const opt = document.createElement("option");
      opt.value = p.code;
      opt.textContent = `${p.marketingName} · ${p.finish}`;
      paintSelect.appendChild(opt);
    }

    const firstPaint = vehicle.paints[0];
    if (firstPaint) {
      paintSelect.value = firstPaint.code;
      submitBtn.disabled = false;
    }
    return;
  }

  const group = document.createElement("optgroup");
  group.label = "Generic automotive colors (approximate)";
  for (const p of GENERIC_PAINTS) {
    const opt = document.createElement("option");
    opt.value = p.code;
    opt.textContent = `${p.marketingName} · ${p.finish}`;
    group.appendChild(opt);
  }
  paintSelect.appendChild(group);

  availability.hidden = false;
  availability.innerHTML = `No factory paint data for <strong>${make} ${model}</strong> yet — matching against <strong>generic automotive colors</strong>. Expect lower accuracy than a named OEM.`;

  const firstGeneric = GENERIC_PAINTS[0];
  if (firstGeneric) {
    paintSelect.value = firstGeneric.code;
    submitBtn.disabled = false;
  }
}

function selectedPaint(): ExteriorPaint | undefined {
  const vehicle = findSupported(makeSelect.value, modelSelect.value);
  const fromOem = vehicle?.paints.find((p) => p.code === paintSelect.value);
  if (fromOem) return fromOem;
  return GENERIC_PAINTS.find((p) => p.code === paintSelect.value) as
    | ExteriorPaint
    | undefined;
}

function labCss(lab: { L: number; a: number; b: number }): string {
  return `lab(${lab.L} ${lab.a} ${lab.b})`;
}

function tierCopy(t: MatchTier): string {
  switch (t) {
    case "perfect":
      return "Excellent";
    case "close":
      return "Close";
    case "explore":
      return "Explore";
    case "distant":
      return "Distant";
    default:
      return t;
  }
}

function confidenceTip(c: string): string {
  switch (c) {
    case "measured":
      return "Spectrophotometer reading on a physical chip — highest confidence.";
    case "spec":
      return "From an OEM or licensed paint spec sheet.";
    case "derived":
      return "Converted from a published HEX value (industry touch-up reference). Prototype-grade.";
    case "estimated":
      return "Hand-picked placeholder until a real measurement is loaded.";
    default:
      return "";
  }
}

function tierTip(t: MatchTier): string {
  switch (t) {
    case "perfect":
      return "ΔE under 1 — visually identical to most people.";
    case "close":
      return "ΔE 1–2 — very close match, subtle shift.";
    case "explore":
      return "ΔE 2–4 — noticeable difference, same family.";
    case "distant":
      return "ΔE 4+ — clearly different hue or lightness.";
    default:
      return "";
  }
}

function render() {
  const paint = selectedPaint();
  if (!paint) return;

  const ranked = rankOpiMatches(paint.lab, opiCatalog.skus, 5);
  const make = makeSelect.value;
  const model = modelSelect.value;

  carSummary.innerHTML = "";
  const sw = document.createElement("div");
  sw.className = "car-swatch";
  sw.style.background = labCss(paint.lab);
  sw.title =
    "Approximate color rendered from measured L*a*b* values. Actual appearance varies by screen and finish.";

  const copy = document.createElement("div");
  copy.className = "car-copy";
  copy.innerHTML = `<strong>${make} ${model}</strong><span>${paint.marketingName} · <code>${paint.code}</code> · ${paint.finish}</span>`;

  const conf = paint.lab.confidence;
  const confBadge = document.createElement("span");
  confBadge.className = `conf conf-${conf}`;
  confBadge.textContent = conf;
  confBadge.title = confidenceTip(conf);
  copy.appendChild(confBadge);

  if (isGenericPaintCode(paint.code)) {
    const genericBadge = document.createElement("span");
    genericBadge.className = "conf conf-generic";
    genericBadge.textContent = "generic";
    genericBadge.title =
      "Approximate color from a universal hex-derived palette. Not a factory measurement — add an OEM scope for accuracy.";
    copy.appendChild(genericBadge);
  }

  carSummary.append(sw, copy);

  matchList.innerHTML = "";
  ranked.forEach((row, i) => {
    const li = document.createElement("li");
    li.className = "match-item" + (i === 0 ? " best" : "");

    const opiSw = document.createElement("div");
    opiSw.className = "opi-swatch";
    opiSw.style.background = labCss(row.opi.lab);
    opiSw.title = `${row.opi.name} (${row.opi.sku}) — approximate from LAB`;

    const body = document.createElement("div");
    body.className = "match-body";
    const coll = row.opi.collection ? ` · ${row.opi.collection}` : "";
    body.innerHTML = `<strong>${row.opi.name}</strong><small>${row.opi.sku}${coll}</small>`;

    const badge = document.createElement("span");
    badge.className = `badge ${row.tier}`;
    badge.textContent = `${tierCopy(row.tier)} · ΔE ${row.deltaE.toFixed(2)}`;
    badge.title = tierTip(row.tier);

    li.append(opiSw, body, badge);
    matchList.appendChild(li);
  });

  catalogMeta.textContent = `Catalog ${opiCatalog.catalogVersion} · ${opiCatalog.deltaEVersion} · ${opiCatalog.illuminant} / ${opiCatalog.observer}`;

  results.hidden = false;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  render();
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
