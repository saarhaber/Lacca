import type { LabMeasurement } from "../color/types.js";

export type OpiSku = {
  sku: string;
  name: string;
  collection?: string;
  lab: LabMeasurement;
};

export type OpiCatalogFile = {
  catalogVersion: string;
  generatedAt: string;
  illuminant: "D65" | "D50" | "C" | "other";
  observer: "2deg" | "10deg";
  deltaEVersion: "deltaE76";
  skus: OpiSku[];
};

export type CatalogPointer = {
  /** Repo-relative POSIX path, e.g. data/opi/catalog-1.0.0.json */
  activeCatalogPath: string;
  catalogVersion: string;
};
