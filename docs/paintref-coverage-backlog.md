# PaintRef coverage backlog

**Purpose**: Single place for humans and agents to record what the PaintRef pipeline has **not** done yet or what should be re-checked. **Update this file** after pilot runs, OEM additions, or outages.

Last updated: 2026-04-18 (initial)

## Homepage form CGI pilot (`PAINTREF_HOMEPAGE_FORM_OEMS`)

| OEM   | Status | Notes |
|-------|--------|--------|
| Ford  | **Pilot (code live)** | `paintref.ts` tries homepage form query before paginated advanced-search when `year`+`model` are set. `fetch-paintref-all.ts --form-year-model-scan` drives vPIC model × year for Ford only. |

## OEMs not yet on homepage form pilot

All other `PAINTREF_OEMS` entries still use **paginated advanced-search only** (unless extended). Candidates to add after manual verification on paintref.com:

- Acura, Alfa Romeo, Alpina, Aston Martin, Audi, Bentley, BMW, Bugatti, Buick, Cadillac, Chevrolet, Chrysler, Dodge, Ferrari, Fiat, Genesis, GMC, Honda, Hyundai, Infiniti, Jaguar, Jeep, Kia, Lamborghini, Land Rover, Lexus, Lincoln, Lotus, Lucid, Maserati, Mazda, McLaren, Mercedes, Mercury, MINI, Mitsubishi, Nissan, Pontiac, Polestar, Porsche, Ram, Rivian, Rolls-Royce, Saab, Saturn, Scion, Smart, Subaru, Suzuki, Tesla, Toyota, Volkswagen, Volvo

(Add rows above as makes graduate from “not yet” → “pilot”.)

## Tooling / process gaps

- [ ] **Browser-only harvest** (see `.cursor/skills/lacca-paintref/SKILL.md` and `docs/paintref-browser-queue.md`) — preferred when CLI CGI is blocked; agent loops OEMs until user stops.
- [ ] Confirm a full **Ford** `--form-year-model-scan` run end-to-end on a healthy PaintRef day; record approximate request count and wall time here.
- [ ] Decide whether to expose a **max-models** / **model allowlist** flag for faster dev runs (not implemented).
- [ ] Document typical **Wayback** latency when live CGI is 503 (operational note).
- [ ] **Browser automation**: not part of the repo pipeline; use only if explicitly requested; fragile vs ads and iframes.

## Cache / outputs (reference)

- Raw parsed rows: `data/sources/paintref/raw/`
- Scopes: `data/oem/<slug>-paintref-v1/`

## Changelog

- **2026-04-18**: Added homepage form CGI path and `--form-year-model-scan`; Ford-only pilot; this backlog file created.
- **2026-04-18**: Smoke test from dev environment: `fetchPaintRefEntries("Ford", { year: 2020, model: "Mustang" })` issued **homepage form-CGI first**, then paginated advanced-search; both returned PaintRef overload HTML and Wayback had no snapshot for that exact form query — behavior matches expectations when the site is in a bad window.
