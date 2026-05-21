import { describe, expect, test } from "vitest";
import { exportGherkin } from "../../../src/application/gherkin-export.js";
import { depsFor, scenarios, usecase } from "./gherkin-export-fixtures.js";

describe("Gherkin export application", () => {
  test("renders deterministic feature text with sorted extensions", async () => {
    const result = await exportGherkin(depsFor(), {
      revisionId: "revision-1",
      usecaseId: "usecase-1",
      userId: "user-1"
    });

    expect(result.status).toBe("EXPORTED");
    if (result.status !== "EXPORTED") {
      throw new Error("expected Gherkin to export");
    }
    expect(result.feature).toBe(`Feature: Places an order

Background:
  Given the use case is in scope chk

Scenario: Main success
  When Customer Places an order.

Scenario: 1a Payment is declined.
  Given main success reaches step 1
  When Customer Uses a backup card.
  Then outcome is FAILURE

Scenario: 1b Address is incomplete.
  Given main success reaches step 1
  When Customer Adds an address.
  Then outcome is FAILURE
`);
  });

  test("rejects missing use cases and non-members before reading revisions", async () => {
    const readRevisionEntityIds: string[] = [];

    await expect(
      exportGherkin(depsFor({ usecase: null }), {
        revisionId: undefined,
        usecaseId: "missing",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "USECASE_NOT_FOUND" });

    await expect(
      exportGherkin(depsFor({ membership: null, readRevisionEntityIds }), {
        revisionId: "revision-1",
        usecaseId: "usecase-1",
        userId: "outsider"
      })
    ).resolves.toEqual({ status: "FORBIDDEN" });
    expect(readRevisionEntityIds).toEqual([]);
  });

  test("rejects archived use cases and missing requested revisions", async () => {
    await expect(
      exportGherkin(depsFor({ usecase: usecase({ archived_at: "2026-05-20" }) }), {
        revisionId: undefined,
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      status: "ARCHIVED_USECASE",
      usecase: usecase({ archived_at: "2026-05-20" })
    });

    await expect(
      exportGherkin(depsFor(), {
        revisionId: "missing-revision",
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      revisionId: "missing-revision",
      status: "REVISION_NOT_FOUND",
      usecase: usecase()
    });
  });

  test("rejects missing main scenario and empty main scenario", async () => {
    await expect(
      exportGherkin(
        depsFor({
          scenarios: scenarios().filter((scenario) => scenario.type !== "MAIN_SUCCESS")
        }),
        {
          revisionId: undefined,
          usecaseId: "usecase-1",
          userId: "user-1"
        }
      )
    ).resolves.toEqual({
      missingRequiredField: "main_success",
      status: "INCOMPLETE_USECASE",
      usecase: usecase()
    });

    await expect(
      exportGherkin(depsFor({ stepsByScenario: new Map([["scenario-main", []]]) }), {
        revisionId: undefined,
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      missingRequiredField: "main_success.steps",
      status: "INCOMPLETE_USECASE",
      usecase: usecase()
    });
  });
});
