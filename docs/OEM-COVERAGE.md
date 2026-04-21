# OEM Paint Coverage

Last updated: 2026-04-21

This is the single source of truth for which manufacturers have real paint data in `data/oem/` vs model-only stubs. After adding data, update the counts in the table below.

---

## Coverage tiers

| Tier | Paint count | Meaning |
|------|-------------|---------|
| **Good** | 20+ | Broad historical catalog; useful for matching |
| **Decent** | 5–19 | Enough for basic matching; expand when possible |
| **Thin** | 1–4 | Seeded but needs work — one signature color |
| **Stub** | 0 | vPIC model list only; UI shows make/models but falls back to generic colors |

---

## Good coverage (20+ paints)

| OEM | Total | Sources |
|-----|-------|---------|
| Honda | 786 | ACL (179) + paintref (607) |
| Nissan | 756 | ACL (73) + paintref (683) |
| Hyundai | 511 | ACL (3) + paintref (508) |
| Dodge | 378 | paintref (378) |
| BMW | 336 | ACL (5) + paintref (317) + curated (14) |
| Kia | 331 | ACL (2) + curated (6) + paintref (323) |
| Acura | 298 | paintref (298) |
| Lincoln | 294 | curated (5) + paintref (289) |
| GMC | 268 | paintref (268) |
| Lexus | 219 | ACL (4) + paintref (215) |
| Audi | 212 | paintref (212) |
| Genesis | 206 | curated (6) + paintref (200) |
| Buick | 190 | paintref (190) |
| Chrysler | 172 | paintref (172) |
| Pontiac | 165 | ACL (3) + paintref (162) |
| Cadillac | 151 | paintref (151) |
| Jeep | 104 | curated (1) + paintref (103) |
| Mercedes-Benz | 104 | ACL (104) |
| Aston Martin | 81 | paintref (81) |
| Alfa Romeo | 79 | paintref (79) |
| Bentley | 68 | paintref (68) |
| Chevrolet | 60 | paintref (60) |
| Mitsubishi | 57 | ACL (57) |
| Maserati | 54 | ACL (3) + paintref (51) |
| Vauxhall | 49 | ACL (49) |
| RAL Classic | 40 | curated (reference standard) |
| Toyota | 35 | curated (20) + ACL (15) |

---

## Decent coverage (5–19 paints)

| OEM | Total | Sources | Next step |
|-----|-------|---------|-----------|
| Porsche | 19 | curated | Add more model-year variants |
| Volkswagen | 18 | ACL | Low-quality vintage ACL; needs PaintRef |
| Infiniti | 17 | ACL | Add modern Majestic White; expand |
| Volvo | 14 | ACL | ACL codes are model names, not paint codes; needs real data |
| Smart | 12 | ACL | Niche; lower priority |
| Tesla | 12 | curated | Add S/X/Cybertruck colors |
| Ford | 11 | paintref | PaintRef CGI down; add more curated |
| Land Rover | 10 | ACL | Add modern Defender/Discovery colors |
| Ram | 8 | curated (6) + paintref (2) | PaintRef CGI down; expand curated |
| Subaru | 8 | ACL | Add more WRB/WRX variants |
| Ferrari | 7 | paintref | Add Giallo Modena, Blu Tour de France, Nero Daytona |
| Lamborghini | 7 | paintref | Add Nero Nemesis, Verde Scandal, Blu Cepheus |
| Lucid | 6 | curated | Add Eureka Gold, Infinite Black |
| McLaren | 6 | paintref | Add Vision Blue, Storm Grey, Volcano Orange |
| Mini | 6 | curated | Add Chili Red, Midnight Black, Pepper White |
| Polestar | 6 | curated | Add Snow, Space, Midnight |
| Rivian | 6 | curated | Add Launch Green, Forest Green, Limestone |
| Rolls-Royce | 6 | curated | Add Midnight Sapphire, Arctic White, Black Badge colors |
| Suzuki | 6 | ACL | Mostly vintage; low priority |
| Desoto | 5 | ACL | 1950s vintage; low priority |
| Lotus | 5 | curated | Add Vivid Green, Hethel Yellow, Carbon Black |
| Mazda | 5 | ACL | Add more Soul Red Crystal variants |
| Saab | 5 | curated | Add Montana Black, Cosmic Blue |

---

## Thin coverage (1–4 paints) — needs expansion

### Modern / active brands (priority)

| OEM | Total | Notes |
|-----|-------|-------|
| Jaguar | 3 | Add Caldera Red, Santorini Black, British Racing Green variants |
| Renault | 3 | Add Flamme Rouge, Zanzibar Orange |
| Mercury | 3 | Defunct; lower priority |
| Plymouth | 2 | Defunct; lower priority |
| Hudson | 4 | Vintage ACL |
| Alpine | 1 | Add Blanc Solaire, Gris Tonnerre |
| Bugatti | 1 | Add EB110 Blue, Nocturne Black |
| Koenigsegg | 1 | Bespoke only; low priority |
| Lancia | 1 | Mostly historical; low priority |
| Maybach | 1 | Add Designo Manufaktur colors |
| Mini | 1 | *(see Decent tier above)* |
| Peugeot | 1 | Add Elixir Red, Selenium Grey |
| Seat / Cupra | 1 | Add Magnetic Tech, Graphene Grey |

### Vintage / defunct brands (low priority)

| OEM | Total | Notes |
|-----|-------|-------|
| Datsun | 1 | Defunct (→ Nissan) |
| Fiat | 1 | Very limited US presence; ACL data is vintage |
| Saturn | 1 | Defunct |
| Oldsmobile | 1 | Defunct |
| American Motors | 1 | Defunct |
| Opel | 1 | Not sold in US |
| Citroen | 1 | Not sold in US |

---

## Stub only — model list, no paints (expand if traffic warrants)

These have vPIC model catalogs so they appear in the make/model picker but fall back to generic colors for matching.

**Stubs with no paint scope at all:**
- Most of the above OEMs' vpic stubs coexist with real paint scopes — check `data/oem/` for `<slug>-vpic-v1` vs `<slug>-paintref-v1` / `<slug>-curated-v1`.

---

## Removed (niche / no US market)

Deliberately excluded — no scopes exist for these:

| OEM | Reason |
|-----|--------|
| BYD | China-market EV brand |
| Geely | China-market brand |
| NIO | China-market EV brand |
| Wuling | China commercial, no US presence |
| Mahindra | India-market brand |
| Daihatsu | Japan-only, no US presence |
| DS | Niche French premium, tiny US market |
| Fisker | Defunct (bankruptcy 2024) |
| Karma | Niche defunct |
| Hummer | Defunct (2010); GMC Hummer EV covered under GMC |
| MG | China-owned, no current US sales |
| VinFast | Vietnamese brand, negligible US market |

---

## Commands

```bash
# Validate all data files
npx tsx scripts/validate-data.ts

# Count paints per scope
for f in data/oem/*/exterior-paints-v1.json; do
  printf '%5s %s\n' "$(python3 -c "import json; print(len(json.load(open('$f')).get('paints',[])))")" "$f"
done | sort -n

# Re-fetch PaintRef for a specific OEM (when CGI is up)
npx tsx scripts/fetch-paintref-all.ts --oems "Toyota" --static-only

# Sanitize ACL OCR names
npx tsx scripts/acl-sanitize-autocolorlibrary-scopes.ts

# Seed vPIC model catalogs
npx tsx scripts/seed-vpic-all-oems.ts
```
