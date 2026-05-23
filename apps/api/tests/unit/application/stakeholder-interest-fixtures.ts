import type {
  StoredMembership,
  StoredRevision,
  StoredStakeholder,
  StoredStakeholderInterest,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type DepsOptions = {
  deletedInterestIds?: string[];
  existingInterests?: StoredStakeholderInterest[];
  membership?: StoredMembership;
  savedInterests?: StoredStakeholderInterest[];
  savedRevisions?: StoredRevision[];
  stakeholders?: StoredStakeholder[];
  usecaseFound?: boolean;
};

export function depsFor(options: DepsOptions = {}) {
  let nextId = 0;
  return {
    idFactory: () => {
      nextId += 1;
      return `id-${String(nextId)}`;
    },
    membershipStore: membershipStore(
      "membership" in options ? options.membership : membership()
    ),
    revisionStore: revisionStore(options.savedRevisions ?? []),
    stakeholderInterestStore: stakeholderInterestStore(
      options.existingInterests ?? [],
      options.savedInterests ?? [],
      options.deletedInterestIds ?? []
    ),
    stakeholderStore: stakeholderStore(options.stakeholders ?? [productStakeholder()]),
    useCaseStore: useCaseStore(options.usecaseFound ?? true)
  };
}

export function interest(
  overrides: Partial<StoredStakeholderInterest> = {}
): StoredStakeholderInterest {
  return {
    id: "interest-1",
    interest: "Checkout revenue is protected.",
    protection_mechanism: "",
    stakeholder_id: "stakeholder-product",
    usecase_id: "usecase-1",
    ...overrides
  };
}

export function productStakeholder(
  overrides: Partial<StoredStakeholder> = {}
): StoredStakeholder {
  return stakeholder({
    id: "stakeholder-product",
    name: "Product Manager",
    type: "INTERNAL",
    ...overrides
  });
}

export function regulatoryStakeholder(): StoredStakeholder {
  return stakeholder({
    id: "stakeholder-regulatory",
    name: "Compliance Officer",
    type: "REGULATORY"
  });
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

function membershipStore(row: StoredMembership | undefined): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(row),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function useCaseStore(found: boolean): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve(
        found ? { projectId: "project-1", usecase: usecase() } : undefined
      ),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function stakeholderStore(stakeholders: StoredStakeholder[]): StakeholderStore {
  return {
    findStakeholderById: (_projectId, stakeholderId) =>
      Promise.resolve(stakeholders.find((row) => row.id === stakeholderId)),
    findStakeholderByName: (_projectId, name) =>
      Promise.resolve(stakeholders.find((row) => row.name === name)),
    listStakeholders: () => Promise.resolve(stakeholders),
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

function stakeholder(overrides: {
  id: string;
  name: string;
  type: StoredStakeholder["type"];
}): StoredStakeholder {
  return {
    archived_at: null,
    description: "",
    project_id: "project-1",
    ...overrides
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
