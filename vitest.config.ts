import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["apps/api/src/infrastructure/prisma-*-store.ts"],
      include: ["apps/api/src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: process.env.VSPEC_COVERAGE_DIR ?? "coverage",
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "apps/api/tests/e2e/_template.test.ts",
      "apps/app/tests/e2e-web/**"
    ],
    globals: true,
    maxWorkers: Number.parseInt(process.env.VSPEC_VITEST_MAX_WORKERS ?? "2", 10),
    passWithNoTests: true,
    testTimeout: 60_000
  }
});
