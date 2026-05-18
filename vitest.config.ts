import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/_template.test.ts"],
    globals: true,
    passWithNoTests: true
  }
});
