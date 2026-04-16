import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createValidator, repoRoot } from "./ajv.js";
import type { OpiCatalogFile } from "./opiTypes.js";

const checks: { schemaId: string; dataPath: string }[] = [
  {
    schemaId: "https://lacca.local/schemas/opi-catalog-v1.schema.json",
    dataPath: "data/opi/catalog-1.0.0.json"
  },
  {
    schemaId: "https://lacca.local/schemas/exterior-paints-v1.schema.json",
    dataPath: "data/oem/tesla-model-3y-v1/exterior-paints-v1.json"
  },
  {
    schemaId: "https://lacca.local/schemas/oem-scope-v1.schema.json",
    dataPath: "data/oem/tesla-model-3y-v1/oem-scope.json"
  },
  {
    schemaId: "https://lacca.local/schemas/exterior-paints-v1.schema.json",
    dataPath: "data/oem/bmw-x-v1/exterior-paints-v1.json"
  },
  {
    schemaId: "https://lacca.local/schemas/oem-scope-v1.schema.json",
    dataPath: "data/oem/bmw-x-v1/oem-scope.json"
  },
  {
    schemaId: "https://lacca.local/schemas/interior-buckets-v1.schema.json",
    dataPath: "data/interior/interior-buckets-v1.json"
  }
];

export function validateAllDataFiles(): { ok: true } | { ok: false; errors: string[] } {
  const ajv = createValidator();
  const errors: string[] = [];

  for (const { schemaId, dataPath } of checks) {
    const validate = ajv.getSchema(schemaId);
    if (!validate) {
      errors.push(`Missing schema id ${schemaId}`);
      continue;
    }
    const data = JSON.parse(readFileSync(join(repoRoot, dataPath), "utf8"));
    if (!validate(data)) {
      errors.push(`${dataPath}: ${ajv.errorsText(validate.errors)}`);
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
