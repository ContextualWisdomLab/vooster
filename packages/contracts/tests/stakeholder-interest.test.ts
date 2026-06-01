import { describe, expect, test } from "vitest";
import {
  stakeholderInterestAddResponseSchema,
  stakeholderInterestDeleteParamsSchema,
  stakeholderInterestRemoveResponseSchema,
  stakeholderInterestRequestSchema,
  stakeholderInterestUsecaseParamsSchema
} from "../src/index.js";

describe("stakeholder-interest contracts", () => {
  test("request applies protection_mechanism default and rejects blanks", () => {
    expect(
      stakeholderInterestRequestSchema.parse({
        interest: "Fast checkout",
        stakeholder: "Customer"
      })
    ).toEqual({
      interest: "Fast checkout",
      protection_mechanism: "",
      stakeholder: "Customer"
    });

    expect(() =>
      stakeholderInterestRequestSchema.parse({ interest: "", stakeholder: "Customer" })
    ).toThrow();
    expect(() =>
      stakeholderInterestRequestSchema.parse({ interest: "x", stakeholder: "" })
    ).toThrow();
  });

  test("params schemas validate usecase and delete ids", () => {
    expect(stakeholderInterestUsecaseParamsSchema.parse({ usecaseId: "uc-1" })).toEqual(
      { usecaseId: "uc-1" }
    );
    expect(
      stakeholderInterestDeleteParamsSchema.parse({
        stakeholderInterestId: "si-1",
        usecaseId: "uc-1"
      })
    ).toEqual({ stakeholderInterestId: "si-1", usecaseId: "uc-1" });
    expect(() =>
      stakeholderInterestDeleteParamsSchema.parse({ usecaseId: "uc-1" })
    ).toThrow();
  });

  test("parse add and remove responses including enriched listings", () => {
    const storedInterest = {
      id: "si-1",
      interest: "Fast checkout",
      protection_mechanism: "Encryption",
      stakeholder_id: "sh-1",
      usecase_id: "uc-1"
    };
    const listing = [{ interest: storedInterest, stakeholder: { name: "Customer" } }];

    const add = stakeholderInterestAddResponseSchema.parse({
      next_missing_role_hint: "No regulatory stakeholder yet.",
      revision: { id: "rev-1", severity: "NON_BREAKING", version_number: 2 },
      stakeholder_interest: storedInterest,
      stakeholder_interests: listing
    });
    expect(add.stakeholder_interest.interest).toBe("Fast checkout");
    expect(add.stakeholder_interests[0]?.stakeholder.name).toBe("Customer");
    expect(add.revision.version_number).toBe(2);

    const remove = stakeholderInterestRemoveResponseSchema.parse({
      removed_stakeholder_interest_id: "si-1",
      revision: { id: "rev-2", severity: "BREAKING", version_number: 3 },
      stakeholder_interests: [],
      warnings: [{ message: "Cannot leave DRAFT", type: "NO_STAKEHOLDER_INTERESTS" }]
    });
    expect(remove.removed_stakeholder_interest_id).toBe("si-1");
    expect(remove.warnings?.[0]?.type).toBe("NO_STAKEHOLDER_INTERESTS");
  });
});
