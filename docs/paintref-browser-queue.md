# PaintRef browser harvest — live queue

**Skill:** `.cursor/skills/lacca-paintref/SKILL.md` (Browser-only).  
**Gaps source:** `docs/OEM-COVERAGE.md` + `data/oem/*-vpic-v1/oem-scope.json`.

The agent **edits this file** after every OEM (or logical batch) it finishes in the Browser. The user **stops the run manually** (Stop / new instruction); until then, the agent **does not wait for permission** to start the next queued OEM.

---

## Session

| Field | Value |
|--------|--------|
| **Started** | 2026-04-18 |
| **Last OEM completed** | Ford |
| **Last updated** | 2026-04-18T18:31:25Z |
| **Note** | Queue reordered volume-first (Toyota first). **New** `colorcodedisplay.cgi` requests still **503** (2026-04-18 retry): 2024 Ford F-150, 2024 Toyota Camry (fresh tab + tab that still had cached 2020 Mustang HTML — new submit still 503). Advanced Search already confirmed same handler. **45s** wait on 503 page: no recovery. Header **paint** link hits `colorcodedisplay.cgi` (e.g. 1964 Mustang) → **503**. Lower duplicate Y/M/M block on homepage exposes **label** refs only in a11y tree — not a second operable `<select>` set via MCP. No `toyota-paintref-v1` until server recovers. |

---

## Queue (pending — top is next)

One line per OEM or per `(OEM, model)` if splitting work:

```text
<!-- AGENT: pop from top when starting; do not delete until that unit is fully harvested and written to repo -->
<!-- Reordered 2026-04-18: most common makers first (user request). Next: Toyota by vPIC model list, each year newest-first once CGI works. -->
Toyota
Honda
Nissan
Hyundai
Kia
Volkswagen
Subaru
GMC
Mercedes
Mazda
Jeep
Ram
Lexus
Tesla
Volvo
Mitsubishi
Lincoln
Infiniti
Genesis
Land Rover
Porsche
MINI
Fiat
Jaguar
Maserati
Ferrari
Lamborghini
Lotus
Lucid
McLaren
Mercury
Pontiac
Polestar
Rivian
Rolls-Royce
Saab
Saturn
Smart
Suzuki
```

---

## Completed (newest last)

```text
<!-- AGENT: append: ISO date | OEM | notes (e.g. rows written, path under data/oem/) -->
2026-04-18T17:46Z | Ford | ford-paintref-v1: 10 paints (2024 F150), Browser form + snapshot + chip pairing; exterior-paints-v1.json + oem-scope.json; live CGI 503 from server-side fetch — chips sampled by URL from Browser network log

```

---

## Blocked / skip

```text
<!-- AGENT: append if PaintRef has no data, ToS block, login wall, or site error -->
2026-04-18 | Bugatti | 2024 query: direct CGI URL returned HTTP 508 Insufficient Resource; homepage "Get Paint Codes" click blocked by Google ad iframe (aswift_2). Retry later or scroll/privacy mode.

2026-04-18 | PaintRef (site) | `https://www.paintref.com/cgi-bin/colorcodedisplay.cgi` returns **HTTP 503 Service Unavailable** in Browser for Toyota Camry (2025, 2024) and Honda Civic (2024) after homepage form submit; static homepage loads. Blocks all homepage-form harvests until server-side recovers. Retries with backoff recommended.

2026-04-18 | PaintRef (site) | **Advanced Search** path: `paintsearch.cgi` filled (2024 / Toyota / Toyota / Camry) → submit **search paint database** → redirects to `colorcodedisplay.cgi?...action=search+paint+database` → **HTTP 503** (same failure as main form). Confirms results handler is down, not entry UI only.

2026-04-18 | PaintRef (site) | **Retry round (Browser):** 2024 **Ford F-150** main form → **503**; **45s** wait on error page → still **503**; header **paint** → `colorcodedisplay.cgi` sample query → **503**; **2024 Toyota Camry** from homepage after `browser_navigate` to root (including from a tab that still displayed **cached** 2020 Mustang results) → **503** on new request. Indicates backend failure for fresh CGI responses, not only specific makes.

```

---

## How to seed the queue

If **Queue** is empty, the agent MUST:

1. Open `docs/OEM-COVERAGE.md` and find OEMs with `paintref-dir: no` or `missing-paintref-import` (§1, §4, §5).
2. Skip OEMs with no vPIC folder if models are required — note in Blocked or run `npm run seed:vpic` only if the user already asked (this skill is **Browser-primary** for PaintRef pages; vPIC seeding is out-of-band unless user says otherwise).
3. Append OEM names to **Queue** (dedupe against **Completed**).

---

*Template version: 2026-04-18*
