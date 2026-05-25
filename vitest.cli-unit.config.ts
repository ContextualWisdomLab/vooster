import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: [
        "apps/cli/src/config-store.ts",
        "apps/cli/src/domain/envelope.ts",
        "apps/cli/src/flag-values.ts",
        "apps/cli/src/http-client.ts",
        "apps/cli/src/infrastructure/http/**/*.ts"
      ],
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: process.env.VSPEC_CLI_COVERAGE_DIR ?? "coverage/cli-unit",
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    include: ["apps/cli/tests/unit/**/*.test.ts"],
    maxWorkers: Number.parseInt(process.env.VSPEC_VITEST_MAX_WORKERS ?? "2", 10),
    testTimeout: 60_000
  }
});
