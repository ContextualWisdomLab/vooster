import { describe, expect, test } from "vitest";
import type { StoredUseCase } from "../../../src/domain/entities/index.js";
import {
  parseFileErrors,
  parseFilesProblem,
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
