import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repository root (two levels up from `src/pipeline`). */
export const repoRoot = join(__dirname, "..", "..");

const schemaFiles = [
  "lab-measurement-v1.schema.json",
  "opi-catalog-v1.schema.json",
  "exterior-paints-v1.schema.json",
  "oem-scope-v1.schema.json",
  "interior-buckets-v1.schema.json"
];

export function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const applyFormats = addFormats as unknown as (instance: Ajv2020) => Ajv2020;
  applyFormats(ajv);

  for (const name of schemaFiles) {
    const schema = JSON.parse(readFileSync(join(repoRoot, "schemas", name), "utf8")) as object;
    ajv.addSchema(schema);
  }

  return ajv;
}
