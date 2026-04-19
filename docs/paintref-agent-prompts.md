# PaintRef agent prompts (Lacca)

**Primary hands-off workflow:** read `.cursor/skills/lacca-paintref/SKILL.md` — **Browser-only**, continuous queue in **`docs/paintref-browser-queue.md`**, gaps from **`docs/OEM-COVERAGE.md`**. *(User may say **PEM** → means **OEM**.)*

Copy, adjust bracketed parts, and paste into a new chat when continuing this work.

---

## Browser-only: keep going until I stop

```text
Use the lacca-paintref skill. @Browser only for PaintRef. Seed or continue
docs/paintref-browser-queue.md from docs/OEM-COVERAGE.md for OEMs/models we
don't have. After each OEM: update the queue, then immediately start the next.
Do not ask to continue; I will stop you manually.
```

---

## Run Ford pilot (form CGI, one year smoke test)

```text
Run the PaintRef Ford pilot for a single model-year window to verify live CGI:

npx tsx scripts/fetch-paintref-all.ts --oems Ford --form-year-model-scan \
  --year-from 2020 --year-to 2020 --sample-chips false --delay-ms 600 \
  --concurrency 1 --force-refresh

Do not pipe through tail. Summarize seed counts and any 503/overload behavior.
Update docs/paintref-coverage-backlog.md with results.
```

---

## Expand homepage form pilot to another OEM

```text
Add [OEM_NAME] to PAINTREF_HOMEPAGE_FORM_OEMS in scripts/lib/paintref.ts.

Requirements:
- PaintRef homepage uses the same make string as our PAINTREF_OEMS entry.
- vPIC scope exists at data/oem/[slug]-vpic-v1/oem-scope.json with models.
- Optional: mirror fetch-paintref-all --form-year-model-scan in docs if behavior differs.

Update docs/paintref-coverage-backlog.md (pilot list and gaps).
Run a one-year smoke test with --oems [OEM_NAME] --form-year-model-scan.
```

---

## Full Ford window (production-style, no chips)

```text
Run Ford form-year-model-scan for [YEAR_FROM]–[YEAR_TO] with polite delays,
concurrency 1, sample-chips false unless I say otherwise. Afterward update
docs/paintref-coverage-backlog.md and note merge-oem-scopes if relevant.
```

---

## When live PaintRef is down

```text
PaintRef live CGI is returning 503 bodies. Outline options in Lacca: Wayback
fallback (already in paintref.ts), --static-only / .shtml merge in
fetch-paintref-all.ts, or defer. Update docs/paintref-coverage-backlog.md with
the outage note and what we used instead.
```

---

## Browser automation (last resort)

```text
We only use Cursor Browser automation for PaintRef if the user explicitly wants
it and ToS allow it. Summarize: ad iframes block some clicks; form submission
URL shape is implemented in paintref.ts as homepage form CGI. Prefer the CLI
pipeline first.
```
