import { describe, expect, test } from "vitest";
import { exportMarkdown } from "../../../src/application/markdown-export.js";
import { depsFor, step, usecase } from "./markdown-export-fixtures.js";

describe("markdown export application", () => {
  test("renders canonical markdown with sorted extensions", async () => {
    const result = await exportMarkdown(depsFor(), {
      revisionId: "revision-1",
      usecaseId: "usecase-1",
      userId: "user-1"
    });

    expect(result.status).toBe("EXPORTED");
    if (result.status !== "EXPORTED") {
      throw new Error("expected markdown to export");
    }
    expect(result.markdown).toContain("primary_actor: Customer");
    expect(result.markdown).toContain(
      "## Stakeholders and Interests\n\n- **Product Manager**: Checkout revenue is protected."
    );
    expect(result.markdown).toContain(
      "## Main Success Scenario\n\n1. **Customer** Places an order."
    );
    expect(result.markdown).toContain(
      "### 1a. Payment is declined.\n\n- 1a1. **Customer** Uses a backup card."
    );
    expect(result.markdown.indexOf("### 1a. Payment is declined.")).toBeLessThan(
      result.markdown.indexOf("### 1b. Address is incomplete.")
    );
    expect(result.markdown.indexOf("### 1b. Address is incomplete.")).toBeLessThan(
      result.markdown.indexOf("### *a. Network is unavailable.")
    );
  });

  test("renders invocation annotations on scenario steps", async () => {
    const stepsByScenario = new Map([
      [
        "scenario-main",
        [
          {
            ...step("scenario-main", 1, "Validates the cart."),
            invokes: ["CHK-006", "CHK-007"]
          }
        ]
      ]
    ]);

    const result = await exportMarkdown(depsFor({ stepsByScenario }), {
      revisionId: "revision-1",
      usecaseId: "usecase-1",
      userId: "user-1"
    });

    expect(result.status).toBe("EXPORTED");
    if (result.status !== "EXPORTED") {
      throw new Error("expected markdown to export");
    }
    expect(result.markdown).toContain(
      "1. **Customer** Validates the cart. _(includes: CHK-006, CHK-007)_"
    );
  });

  test("renders implementation annotations on scenario steps", async () => {
    const stepsByScenario = new Map([
      [
        "scenario-main",
        [
          {
            ...step("scenario-main", 1, "Validates the cart."),
            implements: ["tests/UC-013.feature:scenario_login", "src/auth/login.ts"]
          }
        ]
      ]
    ]);

    const result = await exportMarkdown(depsFor({ stepsByScenario }), {
      revisionId: "revision-1",
      usecaseId: "usecase-1",
      userId: "user-1"
    });

    expect(result.status).toBe("EXPORTED");
    if (result.status !== "EXPORTED") {
      throw new Error("expected markdown to export");
    }
    expect(result.markdown).toContain(
      "1. **Customer** Validates the cart. _(implements: tests/UC-013.feature:scenario_login, src/auth/login.ts)_"
    );
  });

  test("rejects missing use cases", async () => {
    await expect(
      exportMarkdown(depsFor({ usecase: null }), {
        revisionId: undefined,
        usecaseId: "missing-usecase",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "USECASE_NOT_FOUND" });
  });

  test("guards revision reads behind project membership", async () => {
    const readEntityIds: string[] = [];

    const result = await exportMarkdown(depsFor({ membership: null, readEntityIds }), {
      revisionId: "revision-1",
      usecaseId: "usecase-1",
      userId: "outsider"
    });

    expect(result).toEqual({ status: "FORBIDDEN" });
    expect(readEntityIds).toEqual([]);
  });

  test("rejects missing requested revisions", async () => {
    await expect(
      exportMarkdown(depsFor(), {
        revisionId: "revision-missing",
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      revisionId: "revision-missing",
      status: "REVISION_NOT_FOUND",
      usecase: usecase()
    });
  });

  test("rejects incomplete main scenarios", async () => {
    await expect(
      exportMarkdown(depsFor({ stepsByScenario: new Map([["scenario-main", []]]) }), {
        revisionId: undefined,
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      status: "INCOMPLETE_USECASE",
      usecase: usecase()
    });
  });
});
