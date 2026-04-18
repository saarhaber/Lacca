#!/usr/bin/env bash
# Orchestrate the full PaintRef chip-sampling pipeline end-to-end:
#   1. Poll paintref.com until it stops returning 5xx.
#   2. Run fetch-paintref-all.ts for every OEM (scan-years + scan-models + sample-chips).
#   3. Retry any failed OEMs (up to MAX_RETRIES passes, with site-up poll between).
#   4. Run validate:data.
#   5. Merge BMW curated + PaintRef scopes (acceptance criterion).
#   6. Print acceptance spot-check for BMW X3 Brooklyn Grey Metallic.
#
# Designed to be kicked off once and left to run for hours without manual
# intervention. All output goes to logs/ so you can tail and pick up mid-run.

set -uo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" || exit 1

LOG_DIR="${LOG_DIR:-logs}"
mkdir -p "$LOG_DIR"

# Year + per-model PaintRef queries (needs vPIC scopes under data/oem/*-vpic-v1/).
# PAINTREF_SCAN_MODELS=0 → year-range only (faster; use post-fetch model pass or re-run with 1).
PAINTREF_SCAN_MODELS="${PAINTREF_SCAN_MODELS:-1}"
SCRAPE_MODEL_FLAG=""
if [ "$PAINTREF_SCAN_MODELS" = "1" ]; then
  SCRAPE_MODEL_FLAG="--scan-models"
fi

STATE_FILE="$LOG_DIR/paintref-pipeline.state"
MAIN_LOG="$LOG_DIR/paintref-pipeline.log"
SCRAPE_LOG="$LOG_DIR/paintref-scrape.log"

log() {
  local msg="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
  echo "$msg" | tee -a "$MAIN_LOG"
}

set_state() {
  echo "$1" > "$STATE_FILE"
  log "STATE=$1"
}

# ---- 1. Poll PaintRef availability ---------------------------------------

PROBE_URL="https://www.paintref.com/cgi-bin/colorcodedisplay.cgi?make=BMW&year=2023&rows=20&page=1"
# Poll every 10 minutes to be polite to a server already returning 503s.
# Cap is effectively 2 days — paintref.com's CGI backend has been observed
# down for multi-hour stretches; we want this orchestrator to survive that.
POLL_INTERVAL="${POLL_INTERVAL:-600}"
POLL_MAX_ATTEMPTS="${POLL_MAX_ATTEMPTS:-300}"  # 300 * 600s = 50 hours cap

wait_for_site() {
  set_state "waiting-for-site"
  local attempt=0
  while true; do
    attempt=$((attempt + 1))
    local tmp; tmp=$(mktemp)
    local code
    code=$(curl -sS -o "$tmp" -w "%{http_code}" \
      -A "lacca-color-pipeline/1.0" \
      --max-time 45 \
      "$PROBE_URL" 2>/dev/null || echo "000")
    local size; size=$(wc -c < "$tmp" 2>/dev/null || echo 0)
    local body_bad=0
    if grep -qE "508 Insufficient Resource|503 Service Unavailable|Service Unavailable" "$tmp" 2>/dev/null; then
      body_bad=1
    fi
    local body_good=0
    if grep -qiE "<table|paintref|colorcodedisplay" "$tmp" 2>/dev/null; then
      body_good=1
    fi
    rm -f "$tmp"

    if [ "$code" = "200" ] && [ "$body_bad" -eq 0 ] && [ "$body_good" -eq 1 ]; then
      log "site-up: HTTP=$code size=$size (attempt $attempt)"
      return 0
    fi

    log "site-down: HTTP=$code size=$size body_bad=$body_bad body_good=$body_good (attempt $attempt/$POLL_MAX_ATTEMPTS)"
    if [ "$attempt" -ge "$POLL_MAX_ATTEMPTS" ]; then
      log "poll cap reached; giving up on paintref.com"
      return 1
    fi
    sleep "$POLL_INTERVAL"
  done
}

# ---- 2. Full scrape ------------------------------------------------------

run_scrape() {
  set_state "scraping"
  log "starting full scrape -> $SCRAPE_LOG (PAINTREF_SCAN_MODELS=${PAINTREF_SCAN_MODELS})"
  npx tsx scripts/fetch-paintref-all.ts \
    --scan-years --sample-chips \
    ${SCRAPE_MODEL_FLAG:+"$SCRAPE_MODEL_FLAG"} \
    --concurrency 1 --delay-ms 2500 \
    --year-from 2000 --year-to 2026 \
    >"$SCRAPE_LOG" 2>&1
  local rc=$?
  log "scrape pass exited rc=$rc"
  return $rc
}

# Append to scrape log — use after a killed run so completed OEMs (scopes on
# disk) are skipped and the rest continue without truncating the log.
run_scrape_resume() {
  set_state "scraping"
  log "resume: appending fetch to $SCRAPE_LOG (year-only runs skip complete OEMs; --scan-models re-enriches existing scopes)"
  {
    echo ""
    echo "[resume] ===== $(date -u +%Y-%m-%dT%H:%M:%SZ) fetch-paintref-all (append) ====="
  } >>"$SCRAPE_LOG"
  npx tsx scripts/fetch-paintref-all.ts \
    --scan-years --sample-chips \
    ${SCRAPE_MODEL_FLAG:+"$SCRAPE_MODEL_FLAG"} \
    --concurrency 1 --delay-ms 2500 \
    --year-from 2000 --year-to 2026 \
    >>"$SCRAPE_LOG" 2>&1
  local rc=$?
  log "resume scrape exited rc=$rc — next: bash scripts/run-paintref-pipeline.sh post-fetch"
  return $rc
}

run_model_scan() {
  set_state "model-scan"
  local log_file="$LOG_DIR/paintref-model-scan.log"
  log "starting model enrichment pass -> $log_file"
  # Model scan is an additive enrichment pass. Raw HTML cache from the year
  # scan means many model URLs will already be warm. No --force-refresh.
  npx tsx scripts/fetch-paintref-all.ts \
    --scan-years --scan-models --sample-chips \
    --concurrency 1 --delay-ms 3500 \
    --year-from 2000 --year-to 2026 \
    >"$log_file" 2>&1
  local rc=$?
  log "model scan pass exited rc=$rc"
  return $rc
}

# ---- 3. Retry failed OEMs ------------------------------------------------

extract_failed_oems() {
  awk '/^Failed OEMs:/{flag=1; next} flag && /^  - /{sub(/^  - /,""); sub(/:.*$/,""); print}' "$SCRAPE_LOG"
}

retry_failed() {
  local max_passes="${1:-3}"
  for pass in $(seq 1 "$max_passes"); do
    local failed; failed=$(extract_failed_oems | paste -sd, -)
    if [ -z "$failed" ]; then
      log "no failed OEMs; retry loop done"
      return 0
    fi
    set_state "retry-pass-$pass"
    log "retry pass $pass/$max_passes for: $failed"

    if ! wait_for_site; then
      log "site still down on retry pass $pass; aborting"
      return 1
    fi

    local retry_log="$LOG_DIR/paintref-retry-$pass.log"
    npx tsx scripts/fetch-paintref-all.ts \
      --oems "$failed" \
      --scan-years --sample-chips \
      ${SCRAPE_MODEL_FLAG:+"$SCRAPE_MODEL_FLAG"} \
      --concurrency 1 --delay-ms 2500 \
      --year-from 2000 --year-to 2026 \
      --force-refresh \
      >"$retry_log" 2>&1
    log "retry pass $pass exited rc=$?; log at $retry_log"
    # Append retry log to main scrape log so extract_failed_oems sees the
    # freshest failure list (awk's flag resets each invocation, so the last
    # "Failed OEMs:" block in the concatenated log wins).
    cat "$retry_log" >> "$SCRAPE_LOG"
  done
  local still_failed; still_failed=$(extract_failed_oems | paste -sd, -)
  if [ -n "$still_failed" ]; then
    log "after $max_passes retry passes, still failing: $still_failed"
  fi
  return 0
}

# ---- 4. Validate ---------------------------------------------------------

run_validate() {
  set_state "validating"
  log "running validate:data"
  if npx tsx scripts/validate-data.ts >>"$MAIN_LOG" 2>&1; then
    log "validate:data PASSED"
    return 0
  else
    log "validate:data FAILED (see $MAIN_LOG)"
    return 1
  fi
}

# ---- 5. Merge BMW (acceptance) ------------------------------------------

run_merge_bmw() {
  set_state "merge-bmw"
  if [ ! -d "data/oem/bmw-paintref-v1" ]; then
    log "bmw-paintref-v1 missing; skipping BMW merge"
    return 0
  fi
  if [ ! -d "data/oem/bmw-x-v1" ]; then
    log "bmw-x-v1 missing; skipping BMW merge"
    return 0
  fi
  log "merging bmw-x-v1 + bmw-paintref-v1 -> bmw-v1"
  npx tsx scripts/merge-oem-scopes.ts \
    --output bmw-v1 --oem BMW \
    --inputs "bmw-x-v1,bmw-paintref-v1" \
    --year-from 2000 --year-to 2026 \
    >>"$MAIN_LOG" 2>&1
  log "merge rc=$?"
}

# ---- 6. Acceptance spot-check -------------------------------------------

acceptance_check() {
  set_state "acceptance"
  log "acceptance: looking for Brooklyn Grey Metallic in BMW scopes"
  local hits
  hits=$(grep -rlniE "brooklyn.grey|brooklyn grey" data/oem/bmw-paintref-v1/ data/oem/bmw-v1/ 2>/dev/null || true)
  if [ -n "$hits" ]; then
    log "hits: $hits"
    grep -niE "brooklyn" $hits >>"$MAIN_LOG" 2>&1 || true
  else
    log "NO hits for Brooklyn Grey — check BMW scrape coverage"
  fi
  log "counts:"
  for dir in data/oem/bmw-paintref-v1 data/oem/bmw-v1; do
    if [ -f "$dir/exterior-paints-v1.json" ]; then
      local n; n=$(grep -c '"code":' "$dir/exterior-paints-v1.json" || echo 0)
      log "  $dir paints=$n"
    fi
  done
}

# ---- Main ---------------------------------------------------------------

pipeline_post_fetch() {
  retry_failed 3 || true

  if [ "$PAINTREF_SCAN_MODELS" = "1" ]; then
    log "skipping separate model-scan pass (already included in main scrape via --scan-models)"
  else
    run_model_scan || true
  fi

  run_validate
  validate_rc=$?

  run_merge_bmw || true
  acceptance_check

  if [ "$validate_rc" -ne 0 ]; then
    set_state "done-with-validation-errors"
    exit 1
  fi

  set_state "done"
  log "================ paintref pipeline done ================"
}

run_pipeline_all() {
  log "================ paintref pipeline start ================"
  log "cwd=$(pwd)"
  log "node=$(node --version 2>&1) npm=$(npm --version 2>&1)"

  # We used to wait for paintref.com's CGI to come up before scraping, but the
  # static-shtml fallback (baked into fetch-paintref-all.ts via
  # paintrefStaticShtml.ts) makes CGI availability optional. Each OEM attempt
  # now tries the live CGI first, fails fast if 503, and falls back to the
  # LiteSpeed-served static /model/*.shtml pages which stay up even when the
  # CGI backend is down. We do still do ONE quick probe so the log records the
  # current backend state, but we don't block on it.
  SKIP_WAIT="${SKIP_WAIT:-1}"
  if [ "$SKIP_WAIT" != "1" ]; then
    if ! wait_for_site; then
      log "site poll cap hit; proceeding anyway (static-shtml fallback)"
    fi
  else
    log "skipping live-CGI poll (static-shtml fallback available)"
  fi

  run_scrape || true
  pipeline_post_fetch
}

case "${1:-all}" in
  all)
    run_pipeline_all
    ;;
  resume-fetch)
    log "================ resume fetch (append log, skip completed OEMs) ================"
    run_scrape_resume || true
    ;;
  post-fetch)
    log "================ post-fetch (retry → model scan → validate → merge) ================"
    pipeline_post_fetch
    ;;
  *)
    echo "Usage: $0 [all|resume-fetch|post-fetch]" >&2
    echo "  all          — full run (truncates scrape log)" >&2
    echo "  resume-fetch — append-only fetch (year-only skips finished OEMs; with PAINTREF_SCAN_MODELS=1 re-enriches)" >&2
    echo "  post-fetch   — retries, model scan, validate:data, BMW merge, acceptance" >&2
    echo "Env: PAINTREF_SCAN_MODELS=1 (default) adds --scan-models; needs vPIC scopes. PAINTREF_SCAN_MODELS=0 is year-only + separate model pass." >&2
    exit 1
    ;;
esac
