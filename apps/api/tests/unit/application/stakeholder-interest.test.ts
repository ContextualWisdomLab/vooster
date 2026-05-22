import { describe, expect, test } from "vitest";
import {
  addStakeholderInterest,
  removeStakeholderInterest
} from "../../../src/application/stakeholder-interest.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type {
  StoredMembership,
  StoredRevision,
  StoredStakeholder,
  StoredStakeholderInterest,
  StoredUseCase
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
      status: "DUPLICATE_INTEREST"
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

function depsFor(
  options: {
    deletedInterestIds?: string[];
    existingInterests?: StoredStakeholderInterest[];
    savedInterests?: StoredStakeholderInterest[];
    savedRevisions?: StoredRevision[];
  } = {}
) {
  let nextId = 0;
  return {
    idFactory: () => {
      nextId += 1;
      return `id-${String(nextId)}`;
    },
    membershipStore: membershipStore(),
    revisionStore: revisionStore(options.savedRevisions ?? []),
    stakeholderInterestStore: stakeholderInterestStore(
      options.existingInterests ?? [],
      options.savedInterests ?? [],
      options.deletedInterestIds ?? []
    ),
    stakeholderStore: stakeholderStore(),
    useCaseStore: useCaseStore()
  };
}

function membershipStore(): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(membership()),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function useCaseStore(): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve({
        projectId: "project-1",
        usecase: usecase()
      }),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function stakeholderStore(): StakeholderStore {
  return {
    findStakeholderById: (_projectId, stakeholderId) =>
      Promise.resolve(
        stakeholderId === "stakeholder-product" ? productStakeholder() : undefined
      ),
    findStakeholderByName: (_projectId, name) =>
      Promise.resolve(name === "Product Manager" ? productStakeholder() : undefined),
    listStakeholders: () => Promise.resolve([productStakeholder()]),
    saveStakeholder: () => Promise.resolve()
  };
}

function stakeholderInterestStore(
  existingInterests: StoredStakeholderInterest[],
  savedInterests: StoredStakeholderInterest[],
  deletedInterestIds: string[]
): StakeholderInterestStore {
  return {
    deleteStakeholderInterest: (interestId) => {
      deletedInterestIds.push(interestId);
      return Promise.resolve();
    },
    findStakeholderInterestById: (_usecaseId, interestId) =>
      Promise.resolve(existingInterests.find((row) => row.id === interestId)),
    findStakeholderInterestForStakeholder: (_usecaseId, stakeholderId) =>
      Promise.resolve(
        existingInterests.find((row) => row.stakeholder_id === stakeholderId)
      ),
    listStakeholderInterests: () =>
      Promise.resolve(
        existingInterests
          .filter((row) => !deletedInterestIds.includes(row.id))
          .concat(savedInterests)
      ),
    saveStakeholderInterest: (row) => {
      savedInterests.push(row);
      return Promise.resolve();
    }
  };
}

function revisionStore(savedRevisions: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(2),
    saveRevision: (revision) => {
      savedRevisions.push(revision);
      return Promise.resolve();
    }
  };
}

function interest(): StoredStakeholderInterest {
  return {
    id: "interest-1",
    interest: "Checkout revenue is protected.",
    protection_mechanism: "",
    stakeholder_id: "stakeholder-product",
    usecase_id: "usecase-1"
  };
}

function productStakeholder(): StoredStakeholder {
  return {
    archived_at: null,
    description: "",
    id: "stakeholder-product",
    name: "Product Manager",
    project_id: "project-1",
    type: "INTERNAL"
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Places an order"
  };
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}
