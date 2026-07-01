import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // set VITE_BASE=/chefshub/ when building for a GitHub Pages project site
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    host: true,
  },
});
