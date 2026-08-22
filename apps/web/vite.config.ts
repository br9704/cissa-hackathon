import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { devApi } from "./dev-api-plugin";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  /*
    Load the repo-root .env.local into process.env so the dev API routes see
    CLAUDE_BRIDGE_URL. Vite only exposes VITE_ prefixed variables to the client, by
    design, and these are server-only values that must never reach the bundle.
  */
  Object.assign(process.env, loadEnv(mode, join(here, "..", ".."), ""));

  return {
  plugins: [react(), devApi(join(here, "..", "..", "api"))],
  /*
    5273, not the Vite default 5173. Another project on this machine already holds 5173,
    and strictPort means a collision fails loudly instead of silently moving the app to a
    port that the Supabase redirect allow list and the Tauri devUrl do not know about.
  */
  server: {
    port: 5273,
    strictPort: true,
    /*
      The same two headers vercel.json sets in production, so local development is not
      measurably slower than the deploy for a reason nobody would think to look for.
      They enable SharedArrayBuffer, which is what lets ONNX Runtime use more than one
      WASM thread: measured, it takes numThreads from 1 to 4 and roughly halves inference
      time for both the transcription model and the embedding search.

      credentialless rather than require-corp, so the Hugging Face CDN fetch for model
      weights still succeeds without CORP headers on their side.
    */
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  /*
    Vite 8 runs on Rolldown, so bundler options live under rolldownOptions. The Vite 7
    spelling, rollupOptions, is silently ignored rather than rejected.
  */
  build: {
    outDir: "dist",
    sourcemap: true,
    rolldownOptions: {},
  },
  };
});
