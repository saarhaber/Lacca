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
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: [resolve(__dirname, "..")]
    }
  }
});
