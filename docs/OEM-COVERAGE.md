# OEM Paint Coverage

Last updated: 2026-04-19

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
| Honda | 865 | paintref (685) + ACL (180) |
| Hyundai | 629 | paintref (626) + ACL (3) |
| Dodge | 507 | paintref (507) |
| BMW | 391 | paintref (372) + curated BMW-X (14) + ACL (5) |
| GMC | 381 | paintref (381) |
| Acura | 326 | paintref (326) |
| Buick | 243 | paintref (243) |
| Audi | 241 | paintref (241) |
| Cadillac | 220 | paintref (220) |
| Chrysler | 179 | paintref (179) |
| Aston Martin | 139 | paintref (139) |
| Jeep | 122 | paintref (121) + curated (1) |
| Mercedes-Benz | 104 | ACL (104) |
| Chevrolet | 83 | paintref (83) |
| Alfa Romeo | 81 | paintref (81) |
| Bentley | 77 | paintref (77) |
| Nissan | 73 | ACL (73) |
| Mitsubishi | 57 | ACL (57) |
| Vauxhall | 49 | ACL (49) |
| RAL Classic | 40 | curated (reference standard) |
| Toyota | 35 | curated (20) + ACL (15) |

---

## Decent coverage (5–19 paints)

| OEM | Total | Sources | Next step |
|-----|-------|---------|-----------|
| Porsche | 19 | curated | Add more model-year variants |
| Volkswagen | 18 | ACL | Low-quality vintage ACL; needs PaintRef |
| Infiniti | 17 | ACL + curated | Add modern Majestic White; expand |
| Tesla | 15 | curated (Model 3/Y) | Add S/X/Cybertruck colors |
| Volvo | 14 | ACL + curated | ACL codes are model names, not paint codes; needs real data |
| Smart | 12 | ACL | Niche; lower priority |
| Ford | 11 | paintref | PaintRef CGI down; add more curated |
| Land Rover | 10 | ACL + curated | Add modern Defender/Discovery colors |
| Subaru | 8 | ACL + curated | Add more WRB/WRX variants |
| Suzuki | 6 | ACL | Mostly vintage; low priority |
| Mazda | 5 | ACL + curated | Add more Soul Red Crystal variants |

---

## Thin coverage (1–4 paints) — needs expansion

### Modern / active brands (priority)

| OEM | Total | Notes |
|-----|-------|-------|
| Lexus | 4 | Add signature colors: Infrared, Nori Green, Ultra White |
| Jaguar | 3 | Add Caldera Red, Santorini Black, British Racing Green variants |
| Maserati | 3 | Add Blu Nettuno, Rosso Vincente, Grigio Cangiante |
| Kia | 2 | Add Aurora Black, Runway Red |
| Renault | 3 | Add Flamme Rouge, Zanzibar Orange |
| Lincoln | 1 | Add Pristine White, Infinite Black |
| Ram | 1 | Add Flame Red, Granite Crystal |
| Genesis | 1 | Add Uyuni White, Verbena Blue |
| Ferrari | 1 | Add Giallo Modena, Blu Tour de France, Nero Daytona |
| Lamborghini | 1 | Add Nero Nemesis, Verde Scandal, Blu Cepheus |
| McLaren | 1 | Add Vision Blue, Storm Grey, Volcano Orange |
| Mini | 1 | Add Chili Red, Midnight Black, Pepper White |
| Rolls-Royce | 1 | Add Midnight Sapphire, Arctic White, Black Badge colors |
| Lotus | 1 | Add Vivid Green, Hethel Yellow, Carbon Black |
| Rivian | 1 | Add Launch Green, Forest Green, Limestone |
| Polestar | 1 | Add Snow, Space, Midnight |
| Lucid | 1 | Add Eureka Gold, Infinite Black |
| Saab | 1 | Add Montana Black, Cosmic Blue |
| Maybach | 1 | Add Designo Manufaktur colors |
| Peugeot | 1 | Add Elixir Red, Selenium Grey |
| Lancia | 1 | Mostly historical; low priority |
| Seat / Cupra | 1 | Add Magnetic Tech, Graphene Grey |
| Bugatti | 1 | Add EB110 Blue, Nocturne Black |
| Koenigsegg | 1 | Bespoke only; low priority |
| Alpine | 1 | Add Blanc Solaire, Gris Tonnerre |
| Pontiac | 3 | Vintage/defunct; lower priority |
| Mercury | 3 | Defunct; lower priority |

### Vintage / defunct brands (low priority)

| OEM | Total | Notes |
|-----|-------|-------|
| Desoto | 5 | 1950s vintage ACL |
| Hudson | 4 | Vintage ACL |
| Datsun | 1 | Defunct (→ Nissan) |
| Fiat | 1 | Very limited US presence; ACL data is vintage |
| Saturn | 1 | Defunct |
| Oldsmobile | 1 | Defunct |
| American Motors | 1 | Defunct |
| Plymouth | 2 | Defunct |
| Opel | 1 | Not sold in US |
| Citroen | 1 | Not sold in US |

---

## Stub only — model list, no paints (expand if traffic warrants)

These have vPIC model catalogs so they appear in the make/model picker but fall back to generic colors for matching.

- Acura *(has paintref — vpic stub is supplementary)*
- Alfa Romeo *(has paintref — vpic stub supplementary)*
- All other major OEMs above also have vpic stubs coexisting with paint scopes

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
