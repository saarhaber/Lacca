/**
 * Shared HTTP dispatcher for PaintRef-facing fetches.
 *
 * Node's built-in `fetch` uses undici with a 10-second default connect
 * timeout. PaintRef (`www.paintref.com`) frequently responds in 15-20s
 * under load — under the stock dispatcher, `fetch()` throws "Connect
 * Timeout Error" before the server even replies, so the batch driver
 * thinks every page is unreachable.
 *
 * This module installs a custom undici `Agent` with a 60s connect budget
 * and 90s header/body timeouts, matching the politeness strategy already
 * baked into `fetch-paintref-all.ts` (`--delay-ms 2500`, exponential
 * backoff). Import this module once from the top of any script that
 * talks to PaintRef; the dispatcher is global so later `fetch()` calls
 * automatically use it.
 */

import { Agent, setGlobalDispatcher } from "undici";

let installed = false;

export function installPaintRefDispatcher(): void {
  if (installed) return;
  setGlobalDispatcher(
    new Agent({
      connect: { timeout: 60_000 },
      headersTimeout: 90_000,
      bodyTimeout: 90_000,
      keepAliveTimeout: 10_000,
      keepAliveMaxTimeout: 60_000
    })
  );
  installed = true;
}

installPaintRefDispatcher();
