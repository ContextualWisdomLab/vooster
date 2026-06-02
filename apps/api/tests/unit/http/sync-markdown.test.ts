import { describe, expect, test } from "vitest";
import type { StoredUseCase } from "../../../src/domain/entities/index.js";
import {
  parseStepAction,
  parseFileErrors,
  parseFilesProblem,
  serializeStepAction,
  titleFrom,
  usecasePath
} from "../../../src/http/sync-markdown.js";

describe("sync markdown helpers", () => {
  test("reports missing and unclosed frontmatter", () => {
    expect(
      parseFileErrors({ content: "# Place an order\n", path: "specs/PAY-001.md" })
    ).toEqual([
      {
        line: 1,
        message: "Missing frontmatter",
        path: "specs/PAY-001.md"
      }
    ]);

    expect(
      parseFileErrors({ content: "---\ntitle: Place an order\n", path: "bad.md" })
    ).toEqual([{ line: 1, message: "Unclosed frontmatter", path: "bad.md" }]);
  });

  test("accepts closed frontmatter and builds parse problems", () => {
    expect(
      parseFileErrors({
        content: "---\ntitle: Place an order\n---\n# Place an order\n",
        path: "specs/PAY-001.md"
      })
    ).toEqual([]);

    expect(
      parseFilesProblem([
        { line: 2, message: "Missing title", path: "specs/PAY-001.md" }
      ])
    ).toMatchObject({
      offending_files: [
        { line: 2, message: "Missing title", path: "specs/PAY-001.md" }
      ],
      suggested_next_actions: [{ command: "vspec doctor specs/PAY-001.md" }],
      title: "Sync file parse failed"
    });
  });

  test("extracts titles from markdown body", () => {
    expect(titleFrom("---\n---\n\n# Place an order\n")).toBe("Place an order");
    expect(titleFrom("---\n---\nBody only\n")).toBe("Untitled use case");
  });

  test("parses trailing includes annotations case-insensitively", () => {
    expect(
      parseStepAction("Validates the cart. _(includes: CHECKOUT-006, CHECKOUT-007)_")
    ).toEqual({
      action: "Validates the cart.",
      implements: [],
      invokes: ["CHECKOUT-006", "CHECKOUT-007"]
    });
    expect(parseStepAction("Processes payment. _(INCLUDES: PAY-001)_")).toEqual({
      action: "Processes payment.",
      implements: [],
      invokes: ["PAY-001"]
    });
    expect(parseStepAction("Mentions _(includes: PAY-001)_ in the middle.")).toEqual({
      action: "Mentions _(includes: PAY-001)_ in the middle.",
      implements: [],
      invokes: []
    });
  });

  test("round-trips includes and implements annotations through step action parse and serialize", () => {
    const line =
      "Validates the cart. _(includes: CHECKOUT-006, CHECKOUT-007)_ _(implements: tests/UC-013.feature:scenario_login, src/auth/login.ts)_";

    expect(parseStepAction(line)).toEqual({
      action: "Validates the cart.",
      implements: ["tests/UC-013.feature:scenario_login", "src/auth/login.ts"],
      invokes: ["CHECKOUT-006", "CHECKOUT-007"]
    });
    expect(serializeStepAction(parseStepAction(line))).toBe(line);
    expect(serializeStepAction(parseStepAction("Validates the cart."))).toBe(
      "Validates the cart."
    );
  });

  test("renders use case paths", () => {
    const usecase = storedUseCase();

    expect(usecasePath(usecase)).toBe("specs/PAY-001.md");
  });
});

function storedUseCase(): StoredUseCase {
  return {
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    priority: "P1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Place an order"
  } as StoredUseCase;
}
