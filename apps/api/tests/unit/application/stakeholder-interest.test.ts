import { describe, expect, test } from "vitest";
import {
  addStakeholderInterest,
  removeStakeholderInterest
} from "../../../src/application/stakeholder-interest.js";
import {
  depsFor,
  interest,
  productStakeholder
} from "./stakeholder-interest-fixtures.js";
import type {
  StoredRevision,
  StoredStakeholderInterest
} from "../../../src/domain/entities/index.js";

describe("stakeholder interest application", () => {
  test("adds an interest and appends a non-breaking use case revision", async () => {
    const savedInterests: StoredStakeholderInterest[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await addStakeholderInterest(
      depsFor({ savedInterests, savedRevisions }),
      {
        interest: "Checkout revenue is protected.",
        protectionMechanism: "Success guarantee",
        stakeholderName: "Product Manager",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("ADDED");
    if (result.status !== "ADDED") {
      throw new Error("expected interest to be added");
    }
    expect(result.stakeholderInterest).toEqual({
      id: "id-1",
      interest: "Checkout revenue is protected.",
      protection_mechanism: "Success guarantee",
      stakeholder_id: "stakeholder-product",
      usecase_id: "usecase-1"
    });
    expect(result.revision).toMatchObject({
      change_summary: "Added stakeholder interest id-1",
      entity_id: "usecase-1",
      entity_type: "USECASE",
      id: "id-2",
      severity: "NON_BREAKING",
      version_number: 2
    });
    expect(result.stakeholderInterests).toEqual([
      { interest: result.stakeholderInterest, stakeholder: productStakeholder() }
    ]);
    expect(result.nextMissingRoleHint).toBe("No regulatory stakeholder yet.");
    expect(savedInterests).toEqual([result.stakeholderInterest]);
    expect(savedRevisions).toEqual([result.revision]);
  });

  test("rejects duplicate stakeholder interests without writing", async () => {
    const savedInterests: StoredStakeholderInterest[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await addStakeholderInterest(
      depsFor({
        existingInterests: [interest()],
        savedInterests,
        savedRevisions
      }),
      {
        interest: "Checkout revenue remains protected.",
        protectionMechanism: "",
        stakeholderName: "Product Manager",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      existingInterest: "Checkout revenue is protected.",
      status: "DUPLICATE_INTEREST",
      usecaseId: "usecase-1"
    });
    expect(savedInterests).toEqual([]);
    expect(savedRevisions).toEqual([]);
  });

  test("returns unknown-stakeholder candidates without writing", async () => {
    const savedInterests: StoredStakeholderInterest[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await addStakeholderInterest(
      depsFor({ savedInterests, savedRevisions }),
      {
        interest: "Launch risk is protected.",
        protectionMechanism: "",
        stakeholderName: "Product",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      candidateStakeholders: ["Product Manager"],
      stakeholderName: "Product",
      status: "STAKEHOLDER_NOT_FOUND"
    });
    expect(savedInterests).toEqual([]);
    expect(savedRevisions).toEqual([]);
  });

  test("removes the final interest with a breaking revision and warning", async () => {
    const deletedInterestIds: string[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await removeStakeholderInterest(
      depsFor({
        deletedInterestIds,
        existingInterests: [interest()],
        savedRevisions
      }),
      {
        stakeholderInterestId: "interest-1",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("REMOVED");
    if (result.status !== "REMOVED") {
      throw new Error("expected interest to be removed");
    }
    expect(result.removedStakeholderInterestId).toBe("interest-1");
    expect(result.revision).toMatchObject({
      change_summary: "Removed stakeholder interest interest-1",
      entity_id: "usecase-1",
      entity_type: "USECASE",
      id: "id-1",
      severity: "BREAKING",
      version_number: 2
    });
    expect(result.stakeholderInterests).toEqual([]);
    expect(result.noStakeholderInterests).toBe(true);
    expect(deletedInterestIds).toEqual(["interest-1"]);
    expect(savedRevisions).toEqual([result.revision]);
  });
});
