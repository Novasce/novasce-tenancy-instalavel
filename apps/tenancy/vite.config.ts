import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1432, strictPort: true, fs: { allow: ["../.."] } },
  test: { environment: "jsdom" },
});
