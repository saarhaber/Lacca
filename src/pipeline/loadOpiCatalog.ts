import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogPointer, OpiCatalogFile } from "./opiTypes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

export function loadCatalogPointer(): CatalogPointer {
  const raw = readFileSync(join(repoRoot, "data/pipeline/catalog-pointer.json"), "utf8");
  return JSON.parse(raw) as CatalogPointer;
}

export function loadOpiCatalogFromPointer(): OpiCatalogFile {
  const pointer = loadCatalogPointer();
  const path = join(repoRoot, pointer.activeCatalogPath);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as OpiCatalogFile;
}

export function loadOpiCatalogAt(repoRelativePath: string): OpiCatalogFile {
  const path = join(repoRoot, repoRelativePath);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as OpiCatalogFile;
}
