import { unlink, writeFile } from "node:fs/promises";
import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

describe("Goal 2 boundary config", () => {
  test("rejects upward imports while allowing declared architecture arrows", async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const cases = [
      {
        code: [
          'import type { StoredUser } from "../http/signup-types.js";',
          "export type BoundaryFixture = StoredUser;"
        ].join("\n"),
        expectedBoundaryErrors: 1,
        filePath: "src/ports/__boundary_rejects_http.test-fixture.ts"
      },
      {
        code: [
          'import type { StartGithubOAuthResult } from "../application/signup.js";',
          "export type BoundaryFixture = StartGithubOAuthResult;"
        ].join("\n"),
        expectedBoundaryErrors: 0,
        filePath: "src/cli/__boundary_allows_application.test-fixture.ts"
      }
    ];

    try {
      await Promise.all(cases.map((lintCase) => writeFile(lintCase.filePath, lintCase.code)));

      const results = await Promise.all(cases.map((lintCase) => eslint.lintFiles([lintCase.filePath])));

      for (const [index, result] of results.entries()) {
        const boundaryErrors = result[0]?.messages.filter(
          (message) => message.ruleId === "boundaries/element-types"
        );
        expect(boundaryErrors).toHaveLength(cases[index]?.expectedBoundaryErrors);
      }
    } finally {
      await Promise.all(cases.map((lintCase) => unlink(lintCase.filePath).catch(() => undefined)));
    }
  });
});
