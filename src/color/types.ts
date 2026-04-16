/** CIELAB point under a stated illuminant/observer (see docs/GROUND_TRUTH.md). */
export type Lab = {
  L: number;
  a: number;
  b: number;
};

export type LabMeasurement = Lab & {
  illuminant: "D65" | "D50" | "C" | "other";
  observer: "2deg" | "10deg";
  source: string;
  confidence: "measured" | "spec" | "derived" | "estimated";
  recordedAt: string;
  validFrom?: string;
  validTo?: string;
  measurement?: { geometry?: string; instrument?: string };
  provenanceId?: string;
  notes?: string;
};
