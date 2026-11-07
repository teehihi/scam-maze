import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// `base` can be overridden when deploying to GitHub Pages: VITE_BASE=/scam-maze/
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
});
