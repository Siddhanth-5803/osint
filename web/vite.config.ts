import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the same build works when loaded from file:// inside the
// Android WebView (Capacitor) as well as from a web server.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: { outDir: "dist", sourcemap: false },
});
