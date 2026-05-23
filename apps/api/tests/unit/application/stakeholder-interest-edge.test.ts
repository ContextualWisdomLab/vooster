import { describe, expect, test } from "vitest";
import {
  addStakeholderInterest,
  removeStakeholderInterest
} from "../../../src/application/stakeholder-interest.js";
import {
  depsFor,
  interest,
  productStakeholder,
  regulatoryStakeholder
} from "./stakeholder-interest-fixtures.js";
import type {
  StoredRevision,
  StoredStakeholderInterest
} from "../../../src/domain/entities/index.js";

describe("stakeholder interest edge cases", () => {
  test("returns use case and authorization failures before writing", async () => {
    const savedInterests: StoredStakeholderInterest[] = [];
    const savedRevisions: StoredRevision[] = [];

    const missingAdd = await addStakeholderInterest(
      depsFor({ savedInterests, savedRevisions, usecaseFound: false }),
      addInput()
    );
    const forbiddenAdd = await addStakeholderInterest(
      depsFor({ membership: undefined, savedInterests, savedRevisions }),
      addInput()
    );
    const missingRemove = await removeStakeholderInterest(
      depsFor({ savedRevisions, usecaseFound: false }),
      removeInput()
    );
    const forbiddenRemove = await removeStakeholderInterest(
      depsFor({ membership: undefined, savedRevisions }),
      removeInput()
    );

    expect(missingAdd).toEqual({ status: "USECASE_NOT_FOUND" });
    expect(forbiddenAdd).toEqual({ status: "FORBIDDEN" });
    expect(missingRemove).toEqual({ status: "USECASE_NOT_FOUND" });
    expect(forbiddenRemove).toEqual({ status: "FORBIDDEN" });
    expect(savedInterests).toEqual([]);
    expect(savedRevisions).toEqual([]);
  });

  test("rejects removing an unknown interest without appending a revision", async () => {
    const deletedInterestIds: string[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await removeStakeholderInterest(
      depsFor({ deletedInterestIds, savedRevisions }),
      removeInput()
    );

    expect(result).toEqual({ status: "INTEREST_NOT_FOUND" });
    expect(deletedInterestIds).toEqual([]);
    expect(savedRevisions).toEqual([]);
  });

  test("suggests stakeholders when the requested name contains a candidate", async () => {
    const result = await addStakeholderInterest(
      depsFor({ stakeholders: [productStakeholder({ name: "Product" })] }),
      addInput({ stakeholderName: "Product Manager" })
    );

    expect(result).toMatchObject({
      candidateStakeholders: ["Product"],
      status: "STAKEHOLDER_NOT_FOUND"
    });
  });

  test("omits orphaned rows and suppresses the hint for regulatory stakeholders", async () => {
    const savedInterests: StoredStakeholderInterest[] = [];

    const result = await addStakeholderInterest(
      depsFor({
        existingInterests: [interest({ id: "orphan", stakeholder_id: "missing" })],
        savedInterests,
        stakeholders: [regulatoryStakeholder()]
      }),
      addInput({ stakeholderName: "Compliance Officer" })
    );

    expect(result.status).toBe("ADDED");
    if (result.status !== "ADDED") {
      throw new Error("expected interest to be added");
    }
    expect(result.nextMissingRoleHint).toBe("");
    expect(result.stakeholderInterests).toEqual([
      { interest: savedInterests[0], stakeholder: regulatoryStakeholder() }
    ]);
  });
});

function addInput(overrides: { stakeholderName?: string } = {}) {
  return {
    interest: "Compliance risk is protected.",
    protectionMechanism: "Regulatory review",
    stakeholderName: overrides.stakeholderName ?? "Product Manager",
    usecaseId: "usecase-1",
    userId: "user-1"
  };
}

function removeInput() {
  return {
    stakeholderInterestId: "missing-interest",
    usecaseId: "usecase-1",
    userId: "user-1"
  };
}
