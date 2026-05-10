import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://fotonoza.vercel.app",
  output: "static",
  trailingSlash: "ignore",
  redirects: {
    "/": "/en/",
    "/progress/": "/en/news/"
  },
  vite: {
    plugins: [tailwindcss()]
  },
  adapter: vercel({
    entrypointResolution: "auto"
  })
});
