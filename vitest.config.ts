import { defineConfig } from "vitest/config"
import path from "node:path"

/**
 * Pure logic only — distance maths, camera fitting, URL building, answer parsing.
 * Anything that renders or touches a native module needs a device, not a test runner.
 */
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
})
