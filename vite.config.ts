/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("@codemirror")) {
            return "vendor-codemirror";
          }
          if (id.includes("@tauri-apps")) {
            return "vendor-tauri";
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "vendor-react";
          }
          if (id.includes("marked")) {
            return "vendor-markdown";
          }

          return "vendor-misc";
        }
      }
    }
  }
});
