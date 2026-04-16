import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { srgbToLabD65 } from "../src/color/rgbToLab.js";
import type { OpiCatalogFile, OpiSku, PaintFinish } from "../src/pipeline/opiTypes.js";
import { assertValidOpiCatalog } from "../src/pipeline/validateData.js";

/**
 * Seed a denser OPI catalog from HEX references.
 *
 * HEX values come from OPI.com swatches, press kits, and swatch enthusiast
 * references. They are NOT spectro measurements — each SKU is stored with
 * confidence: "derived" and source: "hex_derived" per docs/GROUND_TRUTH.md.
 *
 * Replace any row with measured LAB (confidence: "measured", source:
 * "spectro_reread") before making production "Perfect Match" claims.
 *
 * Coverage emphasis is on the families the v1.0.0 placeholder catalog missed:
 * mid greys / gunmetal / graphite, taupes & greige, olives, navies & blues,
 * whites & creams, reds, and nudes / pinks. This is what lifts queries like
 * BMW Brooklyn Grey (#3C3E3E) out of the "distant" tier.
 *
 * `productUrl` is only populated for shades whose canonical OPI.com URL has
 * been verified to resolve at authoring time. Every other row intentionally
 * leaves the field off so the UI falls back to a plain label instead of a
 * broken link. `finish` is populated on every seed so the finish-penalty
 * matrix in web/src/match.ts can rank against OEM metallic / pearl paints
 * instead of being dead code.
 */

type Seed = {
  sku: string;
  name: string;
  collection: string;
  hex: string;
  finish: PaintFinish;
  productUrl?: string;
  imageUrl?: string;
  note?: string;
};

const RECORDED_AT = "2026-04-16";
const CATALOG_VERSION = "1.1.0";
const GENERATED_AT = "2026-04-16T12:00:00.000Z";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) throw new Error(`Bad hex: ${hex}`);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ];
}

function round(n: number, digits = 2): number {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

// ------------------------------------------------------------------
// Seeds. Each row is a real OPI shade; HEX is an approximation from
// public swatch references. SKU codes follow the NL[A-Z][0-9]{2} pattern
// of the Nail Lacquer line — rows with fabricated-looking codes (lowercase
// suffixes, three-digit numerics, "II" duplicates of existing shades) have
// been retired in the v1.1 audit so productUrl anchors stay stable.
// ------------------------------------------------------------------

const OPI_PRODUCT_BASE = "https://www.opi.com/products/nail-lacquer-";

const SEEDS: Seed[] = [
  // --- Greys / Gunmetal / Graphite (primary gap for automotive greys) ---
  {
    sku: "NLT02",
    name: "My Gondola or Yours",
    collection: "Greys",
    hex: "#3C3B39",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}my-gondola-or-yours`
  },
  { sku: "NLI56", name: "Suzi & the Arctic Fox", collection: "Greys", hex: "#6D6F70", finish: "solid" },
  { sku: "NLI55", name: "Krona-logical Order", collection: "Greys", hex: "#4E4E4F", finish: "solid" },
  { sku: "NLB59", name: "Berlin There Done That", collection: "Greys", hex: "#6A6B6E", finish: "solid" },
  { sku: "NLT76", name: "Embrace the Gray", collection: "Greys", hex: "#A4A4A6", finish: "solid" },
  { sku: "NLT75", name: "I Cannoli Wear OPI", collection: "Neutrals", hex: "#DAD2C6", finish: "solid" },
  { sku: "NLH63", name: "French Quarter for Your Thoughts", collection: "Greys", hex: "#888578", finish: "solid" },
  { sku: "NLF79", name: "Squeaker of the House", collection: "Greys", hex: "#6B7072", finish: "solid" },
  { sku: "NLG26", name: "Lucerne-tainly Look Marvelous", collection: "Greys", hex: "#B7B4AE", finish: "solid" },
  { sku: "NLW57", name: "Nein! Nein! Nein! OK Fine!", collection: "Greys", hex: "#5B5958", finish: "solid" },
  {
    sku: "NLT31",
    name: "Taupe-less Beach",
    collection: "Taupes",
    hex: "#C8AE95",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}taupe-less-beach`
  },
  { sku: "GCT76", name: "Embrace the Gray (Gel)", collection: "Greys", hex: "#A2A2A3", finish: "solid" },
  { sku: "NLB83", name: "Asphalt Attitude", collection: "Greys", hex: "#43444A", finish: "solid" },
  { sku: "NLG45", name: "Cement the Deal", collection: "Greys", hex: "#7D7B77", finish: "solid" },
  { sku: "NLG44", name: "Silver on Ice", collection: "Silvers", hex: "#C4C7CA", finish: "metallic" },
  { sku: "NLL27", name: "Steel Waters Run Deep", collection: "Greys", hex: "#3F4347", finish: "solid" },
  { sku: "NLC79", name: "Center of the You-niverse", collection: "Greys", hex: "#898686", finish: "solid" },
  { sku: "NLT77", name: "It's in the Cloud", collection: "Greys", hex: "#C5C4C2", finish: "solid" },
  { sku: "NLL95", name: "Graffiti Sweetie", collection: "Greys", hex: "#4B4B4D", finish: "solid" },

  // --- Taupes / Greige / Warm neutrals ---
  { sku: "NLP38", name: "Icelanded a Bottle of OPI", collection: "Taupes", hex: "#CFC2B3", finish: "solid" },
  { sku: "NLT74", name: "You Don't Know Jacques!", collection: "Taupes", hex: "#8A7462", finish: "solid" },
  { sku: "NLB85", name: "Over the Taupe", collection: "Taupes", hex: "#A59283", finish: "solid" },
  { sku: "NLT41", name: "Did You 'ear About Van Gogh?", collection: "Taupes", hex: "#6E5F54", finish: "solid" },
  { sku: "NLP39", name: "Sand in My Suit", collection: "Neutrals", hex: "#C3A68E", finish: "solid" },

  // --- Olive / Khaki / Cape-Yorks ---
  {
    sku: "NLU15",
    name: "Suzi — The First Lady of Nails",
    collection: "Greens",
    hex: "#4C533D",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}suzi-the-first-lady-of-nails`
  },
  { sku: "NLF89", name: "Olive for Green", collection: "Greens", hex: "#5A6138", finish: "solid" },
  { sku: "NLT27", name: "Stranger Tides", collection: "Greens", hex: "#3F4A3E", finish: "solid" },
  { sku: "NLH68", name: "Things I've Seen in Aber-green", collection: "Greens", hex: "#2F4432", finish: "solid" },
  { sku: "NLC75", name: "Cape York Harbour", collection: "Greens", hex: "#2D4437", finish: "solid" },
  { sku: "NLG19", name: "Is That a Spear in Your Pocket?", collection: "Greens", hex: "#4E5B3D", finish: "solid" },

  // --- Navies / Deep blues ---
  { sku: "NLI47", name: "Less Is Norse", collection: "Blues", hex: "#253047", finish: "solid" },
  { sku: "NLI58", name: "Turn On the Northern Lights!", collection: "Blues", hex: "#1C2B4A", finish: "pearl" },
  { sku: "NLW59", name: "Tile Art to Warm Your Heart", collection: "Blues", hex: "#2A4768", finish: "solid" },
  { sku: "NLT91", name: "Yoga-ta Get This Blue!", collection: "Blues", hex: "#274E7A", finish: "solid" },
  { sku: "NLL87", name: "Alpaca My Bags", collection: "Blues", hex: "#2C4260", finish: "solid" },
  { sku: "NLB24", name: "OPI Ink", collection: "Blues", hex: "#1D2538", finish: "solid" },

  // --- Mid blues / Teals ---
  { sku: "NLE75", name: "Suzi Sells Sushi by the Seashore", collection: "Blues", hex: "#3E6FA0", finish: "solid" },
  { sku: "NLF87", name: "Boys Be Thistle-Ing at Me", collection: "Blues", hex: "#5776A2", finish: "solid" },
  { sku: "NLL26", name: "Rich Girls & Po-Boys", collection: "Teals", hex: "#3E7A84", finish: "solid" },
  { sku: "NLH74", name: "This Color's Making Waves", collection: "Teals", hex: "#2C6878", finish: "solid" },
  { sku: "NLN79", name: "Mexico City Move-mint", collection: "Teals", hex: "#7AC0B1", finish: "solid" },
  { sku: "NLE80", name: "Blue My Mind", collection: "Blues", hex: "#3C7E9F", finish: "solid" },

  // --- Whites / Creams ---
  {
    sku: "NLT71",
    name: "Alpine Snow",
    collection: "Whites",
    hex: "#F1EEE9",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}alpine-snow`
  },
  {
    sku: "NLS86",
    name: "Bubble Bath",
    collection: "Pinks",
    hex: "#ECD9CF",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}bubble-bath`
  },
  { sku: "NLS96", name: "Sweet Heart", collection: "Pinks", hex: "#F4D9CF", finish: "pearl" },
  {
    sku: "NLH22",
    name: "Funny Bunny",
    collection: "Whites",
    hex: "#F1EAE0",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}funny-bunny`
  },
  { sku: "NLV31", name: "Be There in a Prosecco", collection: "Nudes", hex: "#EFDCC8", finish: "solid" },
  { sku: "NLS79", name: "Passion", collection: "Pinks", hex: "#F0D5CD", finish: "pearl" },

  // --- Nudes / Pinks ---
  { sku: "NLH19", name: "Pastel Pink", collection: "Pinks", hex: "#EFC6C7", finish: "solid" },
  { sku: "NLB56", name: "Mod About You", collection: "Pinks", hex: "#EBB7BC", finish: "solid" },
  { sku: "NLR30", name: "Aloha from OPI", collection: "Pinks", hex: "#E79098", finish: "solid" },
  { sku: "NLR44", name: "Cozu-melted in the Sun", collection: "Pinks", hex: "#D17378", finish: "solid" },
  { sku: "NLN51", name: "Let Me Bayou a Drink", collection: "Nudes", hex: "#CDA28C", finish: "solid" },
  { sku: "NLP61", name: "Samoan Sand", collection: "Nudes", hex: "#D7BEA2", finish: "pearl" },
  { sku: "NLH39", name: "Cosmo-Not Tonight Honey!", collection: "Nudes", hex: "#B48B78", finish: "solid" },
  { sku: "NLV25", name: "Coconuts Over OPI", collection: "Nudes", hex: "#DBB299", finish: "solid" },
  { sku: "NLT65", name: "Put It in Neutral", collection: "Nudes", hex: "#E1C5B0", finish: "solid" },
  { sku: "NLN52", name: "Humidi-Tea", collection: "Nudes", hex: "#C59F83", finish: "solid" },

  // --- Reds / Crimsons / Burgundies ---
  {
    sku: "NLN25",
    name: "Big Apple Red",
    collection: "Reds",
    hex: "#9B1B1E",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}big-apple-red`
  },
  {
    sku: "NLH02",
    name: "Chick Flick Cherry",
    collection: "Reds",
    hex: "#8B1A2B",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}chick-flick-cherry`
  },
  { sku: "NLL64", name: "Red Hot Rio", collection: "Reds", hex: "#B3222A", finish: "solid" },
  {
    sku: "NLH08",
    name: "I'm Not Really a Waitress",
    collection: "Reds",
    hex: "#6F1220",
    finish: "pearl",
    productUrl: `${OPI_PRODUCT_BASE}im-not-really-a-waitress`
  },
  { sku: "NLA16", name: "The Thrill of Brazil", collection: "Reds", hex: "#85182A", finish: "solid" },
  { sku: "NLR53", name: "An Affair in Red Square", collection: "Reds", hex: "#A01A24", finish: "solid" },
  { sku: "NLM21", name: "Amore at the Grand Canal", collection: "Reds", hex: "#7E141F", finish: "solid" },
  { sku: "NLW63", name: "Madam President", collection: "Burgundies", hex: "#5D1B23", finish: "solid" },
  { sku: "NLW52", name: "Got the Blues for Red", collection: "Burgundies", hex: "#4D1218", finish: "solid" },
  { sku: "NLF52", name: "Bogota Blackberry", collection: "Burgundies", hex: "#3B1520", finish: "solid" },
  {
    sku: "NLZ13",
    name: "Malaga Wine",
    collection: "Burgundies",
    hex: "#651423",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}malaga-wine`
  },
  { sku: "NLA12", name: "Color So Hot It Berns", collection: "Pinks", hex: "#C72540", finish: "solid" },

  // --- Deep darks / Blacks ---
  {
    sku: "NLT06",
    name: "Black Onyx",
    collection: "Blacks",
    hex: "#0D0D0F",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}black-onyx`
  },
  {
    sku: "NLW42",
    name: "Lincoln Park After Dark",
    collection: "Burgundies",
    hex: "#2A1620",
    finish: "solid",
    productUrl: `${OPI_PRODUCT_BASE}lincoln-park-after-dark`
  },
  { sku: "NLF16", name: "Suzi Skis in the Pyrenees", collection: "Blacks", hex: "#1B2026", finish: "solid" },

  // --- Silvers / Metallics (ranked visually; flake behavior is disclaimed) ---
  { sku: "NLL15", name: "This Silver's Mine", collection: "Silvers", hex: "#B7BAC0", finish: "metallic" },
  { sku: "NLT55", name: "Tinker, Thinker, Winker?", collection: "Silvers", hex: "#C9CDD3", finish: "metallic" },
  { sku: "NLH73", name: "My Signature Is DC", collection: "Silvers", hex: "#96999F", finish: "metallic" },
  { sku: "NLB78", name: "OPI by Popular Vote", collection: "Silvers", hex: "#A8AEB7", finish: "metallic" },

  // --- Browns / Chocolates ---
  { sku: "NLI42", name: "Espresso Your Inner Self", collection: "Browns", hex: "#3D2A22", finish: "solid" },
  { sku: "NLV35", name: "Chocolate Moose", collection: "Browns", hex: "#6B4A36", finish: "solid" },

  // --- Oranges / Rusts (BMW Sunset Orange neighborhood) ---
  { sku: "NLH43", name: "A Good Man-darin Is Hard to Find", collection: "Oranges", hex: "#D56A3A", finish: "solid" },
  { sku: "NLV26", name: "Toucan Do It if You Try", collection: "Oranges", hex: "#E0652F", finish: "solid" },
  { sku: "NLL21", name: "Santa Monica Beach Peach", collection: "Oranges", hex: "#E38E6D", finish: "solid" },

  // --- Yellows / Golds ---
  { sku: "NLL23", name: "Sun, Sea, and Sand in My Pants", collection: "Yellows", hex: "#F2D27A", finish: "solid" },
  { sku: "NLA65", name: "Never a Dulles Moment", collection: "Yellows", hex: "#EAC45F", finish: "solid" },
  { sku: "NLN58", name: "Exotic Birds Do Not Tweet", collection: "Yellows", hex: "#C79A3A", finish: "solid" },

  // --- Purples / Mauves (useful for pearl/plum OEM paints) ---
  { sku: "NLC09", name: "Don't Touch My Tutu!", collection: "Pinks", hex: "#E5C2CC", finish: "solid" },
  { sku: "NLI63", name: "Suzi — Nails for President", collection: "Purples", hex: "#5D3E5F", finish: "solid" }
];

function buildCatalog(seeds: Seed[]): OpiCatalogFile {
  const skus: OpiSku[] = seeds.map((s) => {
    const [r, g, b] = hexToRgb(s.hex);
    const lab = srgbToLabD65(r, g, b);
    const sku: OpiSku = {
      sku: s.sku,
      name: s.name,
      collection: s.collection,
      finish: s.finish,
      lab: {
        L: round(lab.L),
        a: round(lab.a),
        b: round(lab.b),
        illuminant: "D65",
        observer: "2deg",
        source: "hex_derived",
        confidence: "derived",
        recordedAt: RECORDED_AT,
        notes:
          s.note ??
          `Derived from ${s.hex} (OPI swatch reference). Replace with spectro bottle-chip LAB before production claims.`
      }
    };
    if (s.productUrl) sku.productUrl = s.productUrl;
    if (s.imageUrl) sku.imageUrl = s.imageUrl;
    return sku;
  });

  return {
    catalogVersion: CATALOG_VERSION,
    generatedAt: GENERATED_AT,
    illuminant: "D65",
    observer: "2deg",
    deltaEVersion: "deltaE00",
    skus
  };
}

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..");
}

const catalog = buildCatalog(SEEDS);

assertValidOpiCatalog(catalog);

const fileBody = { $schema: "../../schemas/opi-catalog-v1.schema.json", ...catalog };
const outPath = join(repoRoot(), "data/opi", `catalog-${CATALOG_VERSION}.json`);
writeFileSync(outPath, `${JSON.stringify(fileBody, null, 2)}\n`, "utf8");

console.log(`Wrote ${catalog.skus.length} OPI SKUs → data/opi/catalog-${CATALOG_VERSION}.json`);
