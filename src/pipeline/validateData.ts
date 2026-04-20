import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createValidator, repoRoot } from "./ajv.js";
import type { OpiCatalogFile } from "./opiTypes.js";

type Check = { schemaId: string; dataPath: string };

const EXTERIOR_SCHEMA = "https://lacca.local/schemas/exterior-paints-v1.schema.json";
const OEM_SCOPE_SCHEMA = "https://lacca.local/schemas/oem-scope-v1.schema.json";

/**
 * Canonical list of `lab.source` values the pipeline knows about. Any paint
 * landing with a source outside this set is almost certainly a typo / new
 * scraper that forgot to register itself — catch those in CI rather than at
 * runtime. Add new scrapers here (and update prettySourceLabel in
 * web/src/main.ts) when extending the data layer.
 */
const ALLOWED_LAB_SOURCES = new Set([
  "paintref",
  "paintref_hex",
  "paintref_chip",
  "autocolorlibrary_swatch",
  "hex_derived",
  "ral_classic_hex",
  "oem_spec_sheet",
  "spectro_reread",
  "placeholder_prototype",
  "carapi",
  "nhtsa_vpic"
]);

type PaintRow = { code?: unknown; lab?: { source?: unknown } };
type ExteriorFile = { paints?: PaintRow[] };

/**
 * Shallow walk over `paints[]` asserting `lab.source` is in the allowlist.
 * Runs after schema validation so typos that pass the `"type": "string"`
 * constraint still get caught.
 */
function checkLabSourceAllowlist(dataPath: string, data: unknown, errors: string[]): void {
  if (!data || typeof data !== "object") return;
  const paints = (data as ExteriorFile).paints;
  if (!Array.isArray(paints)) return;

  const bad: Array<{ code: string; source: string }> = [];
  for (const p of paints) {
    const source = p?.lab?.source;
    if (typeof source !== "string") continue;
    if (!ALLOWED_LAB_SOURCES.has(source)) {
      const code = typeof p.code === "string" ? p.code : "<no-code>";
      bad.push({ code, source });
    }
  }
  if (bad.length) {
    errors.push(
      `${dataPath}: ${bad.length} paint(s) with unknown lab.source — ` +
        bad
          .slice(0, 5)
          .map((b) => `${b.code}→"${b.source}"`)
          .join(", ") +
        (bad.length > 5 ? `, … (+${bad.length - 5} more)` : "") +
        `. Allowed: ${[...ALLOWED_LAB_SOURCES].join(", ")}.`
    );
  }
}

/**
 * Walk `data/oem/*` and synthesize a check per scope folder. Every folder that
 * contains `oem-scope.json` and `exterior-paints-v1.json` is auto-registered,
 * so outputs of scripts/fetch-nhtsa / fetch-paintref / import-csv land in the
 * validation pipeline without hand-editing this file.
 */
function discoverOemChecks(): Check[] {
  const oemRoot = join(repoRoot, "data/oem");
  let entries: string[];
  try {
    entries = readdirSync(oemRoot);
  } catch {
    return [];
  }

  const checks: Check[] = [];
  for (const name of entries) {
    const scopeDir = join(oemRoot, name);
    let st;
    try {
      st = statSync(scopeDir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;

    const scopeFile = join(scopeDir, "oem-scope.json");
    const paintsFile = join(scopeDir, "exterior-paints-v1.json");
    let hasScope = false;
    let hasPaints = false;
    try {
      hasScope = statSync(scopeFile).isFile();
    } catch {}
    try {
      hasPaints = statSync(paintsFile).isFile();
    } catch {}

    if (hasScope) {
      checks.push({ schemaId: OEM_SCOPE_SCHEMA, dataPath: `data/oem/${name}/oem-scope.json` });
    }
    if (hasPaints) {
      checks.push({
        schemaId: EXTERIOR_SCHEMA,
        dataPath: `data/oem/${name}/exterior-paints-v1.json`
      });
    }
  }
  return checks;
}

const staticChecks: Check[] = [
  {
    schemaId: "https://lacca.local/schemas/opi-catalog-v1.schema.json",
    dataPath: "data/opi/catalog-1.2.0.json"
  },
  {
    schemaId: "https://lacca.local/schemas/interior-buckets-v1.schema.json",
    dataPath: "data/interior/interior-buckets-v1.json"
  }
];

function allChecks(): Check[] {
  return [...staticChecks, ...discoverOemChecks()];
}

export function validateAllDataFiles(): { ok: true } | { ok: false; errors: string[] } {
  const ajv = createValidator();
  const errors: string[] = [];

  for (const { schemaId, dataPath } of allChecks()) {
    const validate = ajv.getSchema(schemaId);
    if (!validate) {
      errors.push(`Missing schema id ${schemaId}`);
      continue;
    }
    const data = JSON.parse(readFileSync(join(repoRoot, dataPath), "utf8"));
    if (!validate(data)) {
      errors.push(`${dataPath}: ${ajv.errorsText(validate.errors)}`);
    }
    if (schemaId === EXTERIOR_SCHEMA) {
      checkLabSourceAllowlist(dataPath, data, errors);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function assertValidOpiCatalog(data: unknown): asserts data is OpiCatalogFile {
  const ajv = createValidator();
  const validate = ajv.getSchema("https://lacca.local/schemas/opi-catalog-v1.schema.json");
  if (!validate) {
    throw new Error("OPI catalog schema not registered");
  }
  if (!validate(data)) {
    throw new Error(ajv.errorsText(validate.errors));
  }
}
