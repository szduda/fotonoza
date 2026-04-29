import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://fotonoza.vercel.app",
  output: "static",
  vite: {
    plugins: [tailwindcss()]
  },
  adapter: vercel()
});
