import type { LabMeasurement } from "../color/types.js";

/**
 * Physical finish family. Shared across OEM exterior paints and OPI SKUs so
 * the composite matcher can penalize finish mismatches (e.g. a solid creme
 * polish matching a metallic car paint).
 */
export type PaintFinish = "solid" | "metallic" | "pearl" | "matte" | "other";

export type OpiSku = {
  sku: string;
  name: string;
  collection?: string;
  /** Canonical OPI.com (or distributor) product URL. Optional: only populated for rows with a known, stable link. */
  productUrl?: string;
  /** Licensed swatch image URL. Optional. */
  imageUrl?: string;
  /**
   * Physical finish of the polish. Optional: when present on both the input
   * paint and the SKU, the matcher adds a finish penalty to ΔE. When absent,
   * ranking falls back to color-only distance.
   */
  finish?: PaintFinish;
  lab: LabMeasurement;
};

export type DeltaEVersion = "deltaE76" | "deltaE00";

export type OpiCatalogFile = {
  catalogVersion: string;
  generatedAt: string;
  illuminant: "D65" | "D50" | "C" | "other";
  observer: "2deg" | "10deg";
  deltaEVersion: DeltaEVersion;
  skus: OpiSku[];
};

export type CatalogPointer = {
  /** Repo-relative POSIX path, e.g. data/opi/catalog-1.0.0.json */
  activeCatalogPath: string;
  catalogVersion: string;
};
