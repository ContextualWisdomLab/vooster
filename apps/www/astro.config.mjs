import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://v2.vooster.ai",
  vite: {
    plugins: [tailwindcss()],
  },
});
