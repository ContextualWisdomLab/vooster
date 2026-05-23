import { describe, expect, test } from "vitest";
import type {
  StoredStakeholder,
  StoredStakeholderInterest
} from "../../../src/domain/entities/index.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";
import {
  activeStakeholderNamed,
  existingInterestForStakeholder,
  interestsWithStakeholders,
  missingRoleHint,
  stakeholderNameCandidates,
  unresolvedStakeholderProblem,
  usecaseIdFrom
} from "../../../src/http/stakeholder-interest-support.js";

describe("stakeholder interest support", () => {
  test("pairs interests with active stakeholder records and drops missing rows", async () => {
    const interests = [
      interest({ id: "interest-1", stakeholder_id: "stakeholder-1" }),
      interest({ id: "interest-2", stakeholder_id: "missing-stakeholder" })
    ];
    const stakeholder = storedStakeholder({ id: "stakeholder-1", name: "Risk" });

    await expect(
      interestsWithStakeholders(
        interestStore({ interests }),
        stakeholderStore({ stakeholders: [stakeholder] }),
        "usecase-1",
        "project-1"
      )
    ).resolves.toEqual([{ interest: interests[0], stakeholder }]);
  });

  test("returns the regulatory role hint only when no regulatory stakeholder exists", async () => {
    await expect(
      missingRoleHint(
        interestStore({
          interests: [interest({ stakeholder_id: "stakeholder-1" })]
        }),
        stakeholderStore({
          stakeholders: [storedStakeholder({ id: "stakeholder-1", type: "INTERNAL" })]
        }),
        "usecase-1",
        "project-1"
      )
    ).resolves.toBe("No regulatory stakeholder yet.");

    await expect(
      missingRoleHint(
        interestStore({
          interests: [interest({ stakeholder_id: "stakeholder-2" })]
        }),
        stakeholderStore({
          stakeholders: [storedStakeholder({ id: "stakeholder-2", type: "REGULATORY" })]
        }),
        "usecase-1",
        "project-1"
      )
    ).resolves.toBe("");
  });

  test("delegates duplicate interest lookup to the store", async () => {
    const existing = interest({ id: "interest-existing" });

    await expect(
      existingInterestForStakeholder(
        interestStore({ existing }),
        "usecase-1",
        "stakeholder-1"
      )
    ).resolves.toBe(existing);
  });

  test("finds only active stakeholders by name", async () => {
    await expect(
      activeStakeholderNamed(
        stakeholderStore({
          named: storedStakeholder({ archived_at: null, name: "Legal" })
        }),
        "project-1",
        "Legal"
      )
    ).resolves.toMatchObject({ name: "Legal" });
    await expect(
      activeStakeholderNamed(
        stakeholderStore({
          named: storedStakeholder({
            archived_at: "2026-05-23T00:00:00Z",
            name: "Legal"
          })
        }),
        "project-1",
        "Legal"
      )
    ).resolves.toBeUndefined();
  });

  test("suggests active stakeholders whose normalized names overlap", async () => {
    await expect(
      stakeholderNameCandidates(
        stakeholderStore({
          stakeholders: [
            storedStakeholder({ name: "Payments Risk" }),
            storedStakeholder({ archived_at: "2026-05-23T00:00:00Z", name: "Risk" }),
            storedStakeholder({ name: "Support" })
          ]
        }),
        "project-1",
        " risk "
      )
    ).resolves.toEqual(["Payments Risk"]);
  });

  test("serializes unresolved stakeholder problems and validates route params", () => {
    expect(unresolvedStakeholderProblem(["Legal"], "Legl")).toMatchObject({
      candidate_stakeholders: ["Legal"],
      stakeholder_name: "Legl",
      status: 422,
      title: "Stakeholder name does not resolve"
    });
    expect(usecaseIdFrom({ usecaseId: "usecase-1" })).toBe("usecase-1");
    expect(() => usecaseIdFrom({ usecaseId: "" })).toThrow();
  });
});

function interest(
  overrides: Partial<StoredStakeholderInterest> = {}
): StoredStakeholderInterest {
  return {
    id: "interest-1",
    interest: "Avoid failed payouts",
    protection_mechanism: "Audit trail",
    stakeholder_id: "stakeholder-1",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function storedStakeholder(
  overrides: Partial<StoredStakeholder> = {}
): StoredStakeholder {
  return {
    archived_at: null,
    description: "",
    id: "stakeholder-1",
    name: "Risk",
    project_id: "project-1",
    type: "INTERNAL",
    ...overrides
  };
}

function interestStore(options: {
  existing?: StoredStakeholderInterest;
  interests?: StoredStakeholderInterest[];
}): StakeholderInterestStore {
  return {
    findStakeholderInterestForStakeholder: () => Promise.resolve(options.existing),
    listStakeholderInterests: () => Promise.resolve(options.interests ?? [])
  } as unknown as StakeholderInterestStore;
}

function stakeholderStore(options: {
  named?: StoredStakeholder;
  stakeholders?: StoredStakeholder[];
}): StakeholderStore {
  const stakeholders = options.stakeholders ?? [];
  return {
    findStakeholderById: (_projectId: string, stakeholderId: string) =>
      Promise.resolve(
        stakeholders.find((stakeholder) => stakeholder.id === stakeholderId)
      ),
    findStakeholderByName: () => Promise.resolve(options.named),
    listStakeholders: () => Promise.resolve(stakeholders)
  } as unknown as StakeholderStore;
}
