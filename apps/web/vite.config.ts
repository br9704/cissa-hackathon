import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  /*
    5273, not the Vite default 5173. Another project on this machine already holds 5173,
    and strictPort means a collision fails loudly instead of silently moving the app to a
    port that the Supabase redirect allow list and the Tauri devUrl do not know about.
  */
  server: { port: 5273, strictPort: true },
  /*
    Vite 8 runs on Rolldown, so bundler options live under rolldownOptions. The Vite 7
    spelling, rollupOptions, is silently ignored rather than rejected.
  */
  build: {
    outDir: "dist",
    sourcemap: true,
    rolldownOptions: {},
  },
});
