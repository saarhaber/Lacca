import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertValidOpiCatalog } from "./validateData.js";
import type { OpiCatalogFile } from "./opiTypes.js";
import { repoRoot } from "./ajv.js";

/**
 * Writes `data/opi/catalog-{version}.json` and updates `data/pipeline/catalog-pointer.json`.
 * Ensures JSON Schema validation before persisting so ΔE runs stay reproducible.
 */
export function publishOpiCatalog(catalog: OpiCatalogFile): {
  catalogRelativePath: string;
  pointerRelativePath: string;
} {
  assertValidOpiCatalog(catalog);

  const filename = `catalog-${catalog.catalogVersion}.json`;
  const catalogRelativePath = join("data", "opi", filename).split("\\").join("/");
  const fullCatalogPath = join(repoRoot, catalogRelativePath);

  writeFileSync(fullCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  const pointerRelativePath = join("data", "pipeline", "catalog-pointer.json").split("\\").join("/");
  const pointer = {
    activeCatalogPath: catalogRelativePath,
    catalogVersion: catalog.catalogVersion
  };
  writeFileSync(join(repoRoot, pointerRelativePath), `${JSON.stringify(pointer, null, 2)}\n`, "utf8");

  return { catalogRelativePath, pointerRelativePath };
}
