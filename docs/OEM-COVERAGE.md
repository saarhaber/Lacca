# OEM coverage inventory (Lacca)

Purpose: single place for humans and AI to see **which manufacturers have landed data in this repo**, what is **models-only (vPIC)** vs **real exterior paint rows**, and **what is still missing**. When adding OEMs, start from §3 (canonical name lists in code) and §5 (gaps).

**Convention (grep-friendly):** many lines use `KEY: value | KEY: value` so you can search for `OEM: Ford` or `STATUS: paint-catalog`.

**Repo snapshot (auto-aligned 2026-04-18):** `data/oem` holds **138** scope folders; **16** scopes have **≥1** paint row (`paint-catalog`); **122** `*-vpic-v1` scopes have **`paints: []`** (models-only UI stubs).

---

## 1) Definitions

| Status | Meaning |
|--------|---------|
| `paint-catalog` | `data/oem/<scope>/exterior-paints-v1.json` has **≥1** paint row (LAB/hex-derived or curated). Surfaces in the web UI as a make with real paints. |
| `models-only` | `*-vpic-v1` scope exists; `paints` array is **empty**. vPIC model list only (placeholders for dropdowns until PaintRef merge or other source). |
| `paintref-imported` | `*-paintref-v1` scope with non-empty paints from the PaintRef pipeline (`scripts/fetch-paintref-all.ts`). |
| `curated` | Hand-maintained scope (e.g. `toyota-v1`, `porsche-v1`, `bmw-x-v1`, `tesla-model-3y-v1`, `ral-classic-v1`). |
| `missing-vpic-folder` | Listed in `PAINTREF_OEMS` or `VPIC_SEED_EXTRA_OEMS` but **no** `data/oem/<slug>-vpic-v1/` yet — run `npm run seed:vpic` (see §6). |
| `missing-paintref-import` | In PaintRef’s OEM list but **no** `*-paintref-v1` directory yet — run PaintRef fetch for that make (see §6). |

---

## 2) Scopes with a non-empty paint catalog (`paint-catalog`)

Inventory below: **`scopeId` | OEM label | paint count | kind** (counts from `exterior-paints-v1.json` → `paints.length`).

`SEARCH: paint-catalog | SCOPE: chevrolet-paintref-v1 | OEM: Chevrolet | PAINTS: 763 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: dodge-paintref-v1 | OEM: Dodge | PAINTS: 507 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: bmw-paintref-v1 | OEM: BMW | PAINTS: 374 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: audi-paintref-v1 | OEM: Audi | PAINTS: 341 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: acura-paintref-v1 | OEM: Acura | PAINTS: 326 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: cadillac-paintref-v1 | OEM: Cadillac | PAINTS: 254 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: buick-paintref-v1 | OEM: Buick | PAINTS: 250 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: chrysler-paintref-v1 | OEM: Chrysler | PAINTS: 179 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: bentley-paintref-v1 | OEM: Bentley | PAINTS: 77 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: alfa-romeo-paintref-v1 | OEM: Alfa Romeo | PAINTS: 45 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: aston-martin-paintref-v1 | OEM: Aston Martin | PAINTS: 44 | KIND: paintref-imported`
`SEARCH: paint-catalog | SCOPE: ral-classic-v1 | OEM: RAL | PAINTS: 40 | KIND: curated`
`SEARCH: paint-catalog | SCOPE: toyota-v1 | OEM: Toyota | PAINTS: 20 | KIND: curated`
`SEARCH: paint-catalog | SCOPE: porsche-v1 | OEM: Porsche | PAINTS: 18 | KIND: curated`
`SEARCH: paint-catalog | SCOPE: tesla-model-3y-v1 | OEM: Tesla | PAINTS: 15 | KIND: curated`
`SEARCH: paint-catalog | SCOPE: bmw-x-v1 | OEM: BMW | PAINTS: 14 | KIND: curated`

**Overlap note:** BMW appears both as broad `bmw-paintref-v1` (many models) and narrow curated `bmw-x-v1` (X line). Toyota, Porsche, and Tesla similarly have **curated** scopes alongside **vPIC** `*-vpic-v1` stubs. The UI loads every `data/oem/*/oem-scope.json` + `exterior-paints-v1.json` pair at build time (`web/src/main.ts`). **`ral-classic-v1`** uses OEM label **`RAL`** in JSON, **`models: []`** — not shown in the vehicle picker; paints are for RAL merge / reference workflows.

---

## 3) Canonical OEM name lists in source code

These are the **authoritative strings** for PaintRef and vPIC seeding:

- **`PAINTREF_OEMS`** — makes PaintRef documents on its homepage; array in `scripts/lib/paintref.ts` (export `PAINTREF_OEMS`, **54** entries as of this doc).
- **`VPIC_SEED_EXTRA_OEMS`** — extra makes seeded via NHTSA vPIC only (not necessarily on PaintRef’s list); `scripts/lib/vpic-seed-oems.ts` (**81** entries as of this doc).
- **`PAINTREF_HOMEPAGE_FORM_OEMS`** — pilot OEMs for the homepage-form CGI path; currently `["Ford"]` in `scripts/lib/paintref.ts`.

`SEARCH: canonical-list | NAME: PAINTREF_OEMS | FILE: scripts/lib/paintref.ts`
`SEARCH: canonical-list | NAME: VPIC_SEED_EXTRA_OEMS | FILE: scripts/lib/vpic-seed-oems.ts`

---

## 4) `PAINTREF_OEMS`: folder coverage in `data/oem/`

Each line: **`OEM:`** name | **`paintref-dir:`** yes/no | **`vpic-dir:`** yes/no | **`note`**

`SEARCH: PAINTREF_OEM | OEM: Acura | paintref-dir: yes | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Alfa Romeo | paintref-dir: yes | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Alpina | paintref-dir: no | vpic-dir: no | note: no dedicated scope; Alpina models appear inside BMW vPIC strings`
`SEARCH: PAINTREF_OEM | OEM: Aston Martin | paintref-dir: yes | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Audi | paintref-dir: yes | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Bentley | paintref-dir: yes | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: BMW | paintref-dir: yes | vpic-dir: yes | note: see also curated bmw-x-v1`
`SEARCH: PAINTREF_OEM | OEM: Bugatti | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Buick | paintref-dir: yes | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Cadillac | paintref-dir: yes | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Chevrolet | paintref-dir: yes | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Chrysler | paintref-dir: yes | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Dodge | paintref-dir: yes | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Ferrari | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Fiat | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Ford | paintref-dir: no | vpic-dir: yes | note: PAINTREF_HOMEPAGE_FORM_OEMS pilot`
`SEARCH: PAINTREF_OEM | OEM: Genesis | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: GMC | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Honda | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Hyundai | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Infiniti | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Jaguar | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Jeep | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Kia | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Lamborghini | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Land Rover | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Lexus | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Lincoln | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Lotus | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Lucid | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Maserati | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Mazda | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: McLaren | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Mercedes | paintref-dir: no | vpic-dir: yes | note: repo also has mercedes-benz-vpic-v1 (vPIC naming duplicate)`
`SEARCH: PAINTREF_OEM | OEM: Mercury | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: MINI | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Mitsubishi | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Nissan | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Pontiac | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Polestar | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Porsche | paintref-dir: no | vpic-dir: yes | note: see curated porsche-v1`
`SEARCH: PAINTREF_OEM | OEM: Ram | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Rivian | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Rolls-Royce | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Saab | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Saturn | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Scion | paintref-dir: no | vpic-dir: no | note: no slug; Scion models appear under Toyota vPIC`
`SEARCH: PAINTREF_OEM | OEM: Smart | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Subaru | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Suzuki | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Tesla | paintref-dir: no | vpic-dir: yes | note: see curated tesla-model-3y-v1`
`SEARCH: PAINTREF_OEM | OEM: Toyota | paintref-dir: no | vpic-dir: yes | note: see curated toyota-v1`
`SEARCH: PAINTREF_OEM | OEM: Volkswagen | paintref-dir: no | vpic-dir: yes`
`SEARCH: PAINTREF_OEM | OEM: Volvo | paintref-dir: no | vpic-dir: yes`

### 4a) PaintRef list members still **without** `*-paintref-v1` (largest paint gap)

These have vPIC stubs (except Alpina/Scion) but **no** PaintRef import directory yet — highest leverage for `fetch-paintref-all.ts`:

`SEARCH: missing-paintref-import | OEM: Bugatti`
`SEARCH: missing-paintref-import | OEM: Ferrari`
`SEARCH: missing-paintref-import | OEM: Fiat`
`SEARCH: missing-paintref-import | OEM: Ford`
`SEARCH: missing-paintref-import | OEM: Genesis`
`SEARCH: missing-paintref-import | OEM: GMC`
`SEARCH: missing-paintref-import | OEM: Honda`
`SEARCH: missing-paintref-import | OEM: Hyundai`
`SEARCH: missing-paintref-import | OEM: Infiniti`
`SEARCH: missing-paintref-import | OEM: Jaguar`
`SEARCH: missing-paintref-import | OEM: Jeep`
`SEARCH: missing-paintref-import | OEM: Kia`
`SEARCH: missing-paintref-import | OEM: Lamborghini`
`SEARCH: missing-paintref-import | OEM: Land Rover`
`SEARCH: missing-paintref-import | OEM: Lexus`
`SEARCH: missing-paintref-import | OEM: Lincoln`
`SEARCH: missing-paintref-import | OEM: Lotus`
`SEARCH: missing-paintref-import | OEM: Lucid`
`SEARCH: missing-paintref-import | OEM: Maserati`
`SEARCH: missing-paintref-import | OEM: Mazda`
`SEARCH: missing-paintref-import | OEM: McLaren`
`SEARCH: missing-paintref-import | OEM: Mercedes`
`SEARCH: missing-paintref-import | OEM: Mercury`
`SEARCH: missing-paintref-import | OEM: MINI`
`SEARCH: missing-paintref-import | OEM: Mitsubishi`
`SEARCH: missing-paintref-import | OEM: Nissan`
`SEARCH: missing-paintref-import | OEM: Pontiac`
`SEARCH: missing-paintref-import | OEM: Polestar`
`SEARCH: missing-paintref-import | OEM: Porsche`
`SEARCH: missing-paintref-import | OEM: Ram`
`SEARCH: missing-paintref-import | OEM: Rivian`
`SEARCH: missing-paintref-import | OEM: Rolls-Royce`
`SEARCH: missing-paintref-import | OEM: Saab`
`SEARCH: missing-paintref-import | OEM: Saturn`
`SEARCH: missing-paintref-import | OEM: Smart`
`SEARCH: missing-paintref-import | OEM: Subaru`
`SEARCH: missing-paintref-import | OEM: Suzuki`
`SEARCH: missing-paintref-import | OEM: Tesla`
`SEARCH: missing-paintref-import | OEM: Toyota`
`SEARCH: missing-paintref-import | OEM: Volkswagen`
`SEARCH: missing-paintref-import | OEM: Volvo`

`SEARCH: missing-paintref-import | OEM: Alpina | note: no slug; treat as BMW or extend PAINTREF + vPIC naming`
`SEARCH: missing-paintref-import | OEM: Scion | note: no slug; treat as Toyota or add vPIC make string if API supports`

---

## 5) `VPIC_SEED_EXTRA_OEMS`: vPIC folder status

Names from `scripts/lib/vpic-seed-oems.ts`. **`vpic-folder`** = `data/oem/<slug>-vpic-v1` exists (slug rule: lower case, non-alphanumerics → `-`). **`no`** means the folder is absent — usually because **`GetModelsForMake` returned zero models** for that exact string on the last `npm run seed:vpic` run (try alternate spelling or drop from the seed list).

`SEARCH: VPIC_EXTRA | OEM: Alpine | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: AM General | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: American Motors | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Automobili Pininfarina | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Avanti | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Bertone | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Bluecar | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Bollinger | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: BrightDrop | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Bugatti | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: BYD | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Canoo | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Checker | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Chery | vpic-folder: no | note: vPIC returned no models; no folder written`
`SEARCH: VPIC_EXTRA | OEM: Citroen | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Coda | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Cruise | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Cupra | vpic-folder: no | note: vPIC returned no models; no folder written`
`SEARCH: VPIC_EXTRA | OEM: Czinger | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Dacia | vpic-folder: no | note: vPIC returned no models; no folder written`
`SEARCH: VPIC_EXTRA | OEM: Daewoo | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Daihatsu | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Datsun | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: DeLorean | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Dongfeng | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: DS | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Eagle | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Fisker | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Geely | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Geo | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Glickenhaus | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Holden | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Hummer | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Humvee | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Ineos | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Isuzu | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Karma | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Koenigsegg | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Korando | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Lancia | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Li Auto | vpic-folder: no | note: vPIC returned no models; no folder written`
`SEARCH: VPIC_EXTRA | OEM: Lordstown | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Lotus | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Lucid | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Mahindra | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Maybach | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Merkur | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Mosler | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Mullen | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Nikola | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: NIO | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Oldsmobile | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Opel | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Pagani | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Panoz | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Peugeot | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Pininfarina | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Plymouth | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Polestar | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Proton | vpic-folder: no | note: vPIC returned no models; no folder written`
`SEARCH: VPIC_EXTRA | OEM: Renault | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Rimac | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Rivian | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Ruf | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Saleen | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Scout | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: SEAT | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Shelby | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Skoda | vpic-folder: no | note: vPIC returned no models; no folder written`
`SEARCH: VPIC_EXTRA | OEM: Spyker | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: SSC North America | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Tata | vpic-folder: no | note: vPIC returned no models; no folder written`
`SEARCH: VPIC_EXTRA | OEM: Triumph | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Vauxhall | vpic-folder: no | note: vPIC returned no models; no folder written`
`SEARCH: VPIC_EXTRA | OEM: VinFast | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Winnebago | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Workhorse | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Xpeng | vpic-folder: no | note: vPIC returned no models; no folder written`
`SEARCH: VPIC_EXTRA | OEM: Yugo | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Zeekr | vpic-folder: yes`
`SEARCH: VPIC_EXTRA | OEM: Zoox | vpic-folder: yes`

### 5a) Extra makes present in `data/oem` but **not** in `VPIC_SEED_EXTRA_OEMS`

Useful when searching for “we already have a scope”:

`SEARCH: adhoc-vpic | SCOPE: mercedes-benz-vpic-v1 | OEM: Mercedes-Benz | note: parallel to mercedes-vpic-v1`
`SEARCH: adhoc-vpic | SCOPE: mg-vpic-v1 | OEM: MG`
`SEARCH: adhoc-vpic | SCOPE: wuling-vpic-v1 | OEM: Wuling`

---

## 6) Commands (refreshing this inventory)

- **vPIC model seeds** (creates/updates `*-vpic-v1`): `npm run seed:vpic` — see `scripts/seed-vpic-all-oems.ts` (optional `--oems "Name1,Name2"`).
- **Merge `VPIC_SEED_EXTRA_OEMS` from vPIC vehicle-type APIs**: `npm run vpic:refresh-extras` — `scripts/refresh-vpic-extra-oems.ts` (optional `--dry-run`).
- **vPIC makes gap report** (noisy): `npm run vpic:makes-gap` — optional `--grep`, `--json`, `--force-refresh`.
- **PaintRef bulk fetch** (creates `*-paintref-v1`): `tsx scripts/fetch-paintref-all.ts` — optional `--oems "BMW,Audi"`.
- **Re-count paints** after data changes:

```bash
for f in data/oem/*/exterior-paints-v1.json; do
  printf '%5s %s\n' "$(jq '.paints | length' "$f")" "$f"
done | sort -n
```

---

## 7) `models-only` snapshot

There are **122** `*-vpic-v1` scopes with **`paints: []`** in `exterior-paints-v1.json`. They still register makes/models in the UI but do not claim measured factory paint catalogs until merged or imported (UI falls back to generic `GEN-*` colors).

`SEARCH: STATUS: models-only | PATTERN: *-vpic-v1 | PAINTS: 0 | COUNT: 122`

*(After large data changes, re-run the loop in §6 and refresh §2 / this section.)*

---

*Last aligned with repo: 2026-04-18 — `data/oem/*/oem-scope.json` + paint counts from `exterior-paints-v1.json`.*
