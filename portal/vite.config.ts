import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base '/app/' karena portal ini di-deploy ke subpath /app/ di GitHub Pages,
// terpisah dari landing page statis yang tetap di root.
export default defineConfig({
  plugins: [react()],
  base: "/app/",
  build: {
    outDir: "dist",
  },
});
