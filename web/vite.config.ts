import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const base =
  process.env.VITE_BASE_PATH && process.env.VITE_BASE_PATH.length > 0
    ? process.env.VITE_BASE_PATH.endsWith("/")
      ? process.env.VITE_BASE_PATH
      : `${process.env.VITE_BASE_PATH}/`
    : "/";

export default defineConfig({
  root: __dirname,
  base,
  publicDir: "public",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  build: {
    // OEM + OPI JSON is embedded for offline-first matching; a single chunk
    // will always exceed Rollup’s default 500 kB warning.
    chunkSizeWarningLimit: 2300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
          if (id.includes("data/oem/")) {
            return "oem-data";
          }
          if (id.includes("data/opi/")) {
            return "opi-catalog";
          }
          if (id.includes("/i18n/translations")) {
            return "i18n";
          }
          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: [resolve(__dirname, "..")]
    }
  }
});
