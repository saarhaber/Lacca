/**
 * When stdout/stderr are redirected to a file (e.g. `> logs/foo.log 2>&1`),
 * Node may block-buffer `console.log` — `tail -f` looks frozen for minutes.
 * Patch console to `writeSync` each line so logs flush immediately.
 */
import { writeSync } from "node:fs";
import { format } from "node:util";

let installed = false;

export function installSyncConsole(): void {
  if (installed) return;
  if (process.stdout.isTTY && process.stderr.isTTY) return;
  installed = true;

  const out = (...args: unknown[]) => {
    try {
      writeSync(1, format(...args) + "\n");
    } catch {
      /* ignore broken pipe */
    }
  };
  const err = (...args: unknown[]) => {
    try {
      writeSync(2, format(...args) + "\n");
    } catch {
      /* ignore */
    }
  };

  console.log = out;
  console.info = out;
  console.debug = out;
  console.warn = err;
  console.error = err;
}

installSyncConsole();
