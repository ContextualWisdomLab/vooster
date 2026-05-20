import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

describe("Goal 2 boundary config", () => {
  test("rejects upward imports while allowing declared architecture arrows", async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const cases = [
      {
        code: [
          'import type { StoredUser } from "../http/signup-types.ts";',
          "export type BoundaryFixture = StoredUser;"
        ].join("\n"),
        expectedBoundaryErrors: 1,
        filePath: "src/ports/user-store.ts"
      },
      {
        code: [
          'import type { StartGithubOAuthResult } from "../application/signup.ts";',
          "export type BoundaryFixture = StartGithubOAuthResult;"
        ].join("\n"),
        expectedBoundaryErrors: 0,
        filePath: "src/cli/index.ts"
      }
    ];

    const results = await Promise.all(
      cases.map((lintCase) => eslint.lintText(lintCase.code, { filePath: lintCase.filePath }))
    );

    for (const [index, result] of results.entries()) {
      const lintCase = cases[index];
      if (lintCase === undefined) {
        throw new Error(`Missing lint case for result ${String(index)}`);
      }
      const boundaryErrors = result[0]?.messages.filter(
        (message) => message.ruleId === "boundaries/element-types"
      );
      expect(boundaryErrors).toHaveLength(lintCase.expectedBoundaryErrors);
    }
  });
});
