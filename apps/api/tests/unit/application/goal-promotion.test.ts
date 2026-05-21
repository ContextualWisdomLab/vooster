import { describe, expect, test } from "vitest";
import {
  promoteGoal,
  promoteLoadedGoal
} from "../../../src/application/goal-promotion.js";
import type {
  StoredGoal,
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import type { GoalStore } from "../../../src/ports/goal-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

describe("goal promotion application", () => {
  test("promotes an identified goal into a seeded use case and revision", async () => {
    const savedUseCases: StoredUseCase[] = [];
    const savedRevisions: StoredRevision[] = [];
    const updatedGoals: StoredGoal[] = [];

    const result = await promoteGoal(
      depsFor({ savedRevisions, savedUseCases, updatedGoals }),
      {
        goalId: "goal-1",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("PROMOTED");
    if (result.status !== "PROMOTED") {
      throw new Error("expected goal to be promoted");
    }
    expect(result.usecase).toMatchObject({
      current_revision_id: "id-2",
      format: "BRIEF",
      id: "id-1",
      key: "CHK-001",
      level: "USER_GOAL",
      primary_actor_id: "actor-1",
      project_id: "project-1",
      scope: "chk",
      status: "DRAFT",
      title: "Places an order"
    });
    expect(result.revision).toMatchObject({
      change_summary: "Promoted from goal goal-1",
      entity_id: "id-1",
      entity_type: "USECASE",
      id: "id-2",
      version_number: 1
    });
    expect(result.goal).toMatchObject({
      linked_usecase_id: "id-1",
      status: "PROMOTED"
    });
    expect(result.titleWarning).toBeUndefined();
    expect(savedUseCases).toEqual([result.usecase]);
    expect(savedRevisions).toEqual([result.revision]);
    expect(updatedGoals).toEqual([result.goal]);
  });

  test("rejects missing or unauthorized goals without writes", async () => {
    const savedUseCases: StoredUseCase[] = [];

    await expect(
      promoteGoal(depsFor({ goal: null, savedUseCases }), {
        goalId: "missing",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "GOAL_NOT_FOUND" });

    await expect(
      promoteGoal(depsFor({ membership: null, savedUseCases }), {
        goalId: "goal-1",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "FORBIDDEN" });

    expect(savedUseCases).toEqual([]);
  });

  test("reports already promoted goals with the existing use case key", async () => {
    const result = await promoteGoal(
      depsFor({
        existingUseCases: [usecase({ id: "usecase-existing", key: "CHK-002" })],
        goal: goal({ linked_usecase_id: "usecase-existing", status: "PROMOTED" })
      }),
      {
        goalId: "goal-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      existingUseCaseKey: "CHK-002",
      status: "ALREADY_PROMOTED"
    });
  });

  test("rejects rejected goals and simulated insert failures without writes", async () => {
    const savedUseCases: StoredUseCase[] = [];

    await expect(
      promoteGoal(depsFor({ goal: goal({ status: "REJECTED" }), savedUseCases }), {
        goalId: "goal-1",
        userId: "user-1"
      })
    ).resolves.toEqual({
      goalId: "goal-1",
      status: "REJECTED_GOAL"
    });

    await expect(
      promoteGoal(depsFor({ savedUseCases }), {
        goalId: "goal-1",
        simulateUseCaseInsertFailure: true,
        userId: "user-1"
      })
    ).resolves.toEqual({
      goalId: "goal-1",
      status: "PROMOTION_FAILED"
    });

    expect(savedUseCases).toEqual([]);
  });

  test("promotes weak titles with a warning", async () => {
    const result = await promoteGoal(
      depsFor({ goal: goal({ description: "Order status" }) }),
      {
        goalId: "goal-1",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("PROMOTED");
    if (result.status !== "PROMOTED") {
      throw new Error("expected weak title to still promote");
    }
    expect(result.titleWarning).toEqual({
      field: "title",
      message: "Title may not be a verb phrase."
    });
  });

  test("promotes an already loaded goal for use case creation flows", async () => {
    const result = await promoteLoadedGoal(
      depsFor(),
      {
        goal: goal(),
        projectId: "project-1"
      }
    );

    expect(result.status).toBe("PROMOTED");
    if (result.status !== "PROMOTED") {
      throw new Error("expected loaded goal to be promoted");
    }
    expect(result.usecase.key).toBe("CHK-001");
  });
});

function depsFor(options: {
  existingUseCases?: StoredUseCase[];
  goal?: StoredGoal | null;
  membership?: StoredMembership | null;
  project?: StoredProject | null;
  savedRevisions?: StoredRevision[];
  savedUseCases?: StoredUseCase[];
  updatedGoals?: StoredGoal[];
} = {}) {
  let nextId = 0;
  const useCases = options.existingUseCases ?? [];
  return {
    goalStore: goalStore(options.goal === undefined ? goal() : options.goal, options.updatedGoals ?? []),
    idFactory: () => {
      nextId += 1;
      return `id-${String(nextId)}`;
    },
    membershipStore: membershipStore(
      options.membership === undefined ? membership() : options.membership
    ),
    projectStore: projectStore(options.project === undefined ? project() : options.project),
    revisionStore: revisionStore(options.savedRevisions ?? []),
    useCaseStore: useCaseStore(useCases, options.savedUseCases ?? [])
  };
}

function goalStore(foundGoal: StoredGoal | null, updatedGoals: StoredGoal[]): GoalStore {
  return {
    findGoalById: () => Promise.resolve(foundGoal ?? undefined),
    listGoals: () => Promise.resolve(foundGoal === null ? [] : [foundGoal]),
    saveGoal: () => Promise.resolve(),
    updateGoal: (updatedGoal) => {
      updatedGoals.push({ ...updatedGoal });
      return Promise.resolve();
    }
  };
}

function membershipStore(foundMembership: StoredMembership | null): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(foundMembership ?? undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(foundProject: StoredProject | null): ProjectStore {
  return {
    findProjectById: () => Promise.resolve(foundProject ?? undefined),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    saveProject: () => Promise.resolve()
  };
}

function revisionStore(savedRevisions: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: (revision) => {
      savedRevisions.push(revision);
      return Promise.resolve();
    }
  };
}

function useCaseStore(
  existingUseCases: StoredUseCase[],
  savedUseCases: StoredUseCase[]
): UseCaseStore {
  return {
    findUseCaseById: (_projectId, usecaseId) =>
      Promise.resolve(
        existingUseCases.concat(savedUseCases).find((item) => item.id === usecaseId)
      ),
    findUseCaseWithProject: () => Promise.resolve(undefined),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve(existingUseCases.concat(savedUseCases)),
    saveUseCase: (newUseCase) => {
      savedUseCases.push(newUseCase);
      return Promise.resolve();
    },
    updateUseCase: () => Promise.resolve()
  };
}

function goal(overrides: Partial<StoredGoal> = {}): StoredGoal {
  return {
    actor_id: "actor-1",
    archived_at: null,
    description: "Places an order",
    id: "goal-1",
    level: "USER_GOAL",
    linked_usecase_id: null,
    priority: "P1",
    project_id: "project-1",
    status: "IDENTIFIED",
    ...overrides
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

function project(): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "CHK",
    name: "Checkout",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}

function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "CHK-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "chk",
    status: "DRAFT",
    title: "Places an order",
    ...overrides
  };
}
