import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["apps/api/src/infrastructure/prisma-*-store.ts"],
      include: ["apps/api/src/application/**/*.ts"],
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: process.env.VSPEC_COVERAGE_DIR ?? "coverage",
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    include: [
      "apps/api/tests/unit/**/*.test.ts",
      "apps/cli/tests/unit/**/*.test.ts",
      "apps/www/tests/unit/**/*.test.ts",
      "packages/contracts/tests/**/*.test.ts"
    ],
    maxWorkers: Number.parseInt(process.env.VSPEC_VITEST_MAX_WORKERS ?? "2", 10),
    passWithNoTests: false,
    testTimeout: 60_000
  }
});
