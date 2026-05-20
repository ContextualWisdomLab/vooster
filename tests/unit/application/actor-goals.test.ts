import { describe, expect, test } from "vitest";
import {
  createGoal,
  listGoals,
  patchGoal
} from "../../../src/application/actor-goals.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { GoalStore } from "../../../src/ports/goal-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";
import type {
  StoredActor,
  StoredGoal,
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredWorkspace
} from "../../../src/domain/entities/index.js";

describe("actor goal application", () => {
  test("creates a goal, appends revision, and reports near duplicates", async () => {
    const savedGoals: StoredGoal[] = [];
    const savedRevisions: StoredRevision[] = [];
    const duplicate = goal({ id: "goal-existing", description: "Places an order" });

    const result = await createGoal(
      depsFor({ existingGoals: [duplicate], savedGoals, savedRevisions }),
      {
        actorId: "actor-1",
        description: "Place an order",
        level: "USER_GOAL",
        priority: "P1",
        projectId: "project-1",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected goal to be created");
    }
    expect(result.goal).toMatchObject({
      actor_id: "actor-1",
      description: "Place an order",
      id: "id-1",
      level: "USER_GOAL",
      priority: "P1",
      project_id: "project-1",
      status: "IDENTIFIED"
    });
    expect(result.revision).toMatchObject({
      entity_id: "id-1",
      entity_type: "GOAL",
      id: "id-2",
      version_number: 1
    });
    expect(result.duplicateGoalId).toBe("goal-existing");
    expect(savedGoals).toEqual([result.goal]);
    expect(savedRevisions).toEqual([result.revision]);
  });

  test("rejects unavailable actors without writing goal or revision", async () => {
    const savedGoals: StoredGoal[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await createGoal(
      depsFor({ actor: null, savedGoals, savedRevisions }),
      {
        actorId: "missing-actor",
        description: "Reviews checkout exceptions",
        level: "USER_GOAL",
        priority: "P2",
        projectId: "project-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ actorId: "missing-actor", status: "ACTOR_UNAVAILABLE" });
    expect(savedGoals).toEqual([]);
    expect(savedRevisions).toEqual([]);
  });

  test("rejects goal creation when project access is missing", async () => {
    const result = await createGoal(
      depsFor({ member: false }),
      {
        actorId: "actor-1",
        description: "Places an order",
        level: "USER_GOAL",
        priority: "P1",
        projectId: "project-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "FORBIDDEN" });
  });

  test("rejects goal creation when the workspace is archived", async () => {
    const result = await createGoal(
      depsFor({ workspaceArchived: true }),
      {
        actorId: "actor-1",
        description: "Places an order",
        level: "USER_GOAL",
        priority: "P1",
        projectId: "project-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "WORKSPACE_ARCHIVED" });
  });

  test("patches a legal goal status and appends a revision", async () => {
    const savedRevisions: StoredRevision[] = [];
    const updatedGoals: StoredGoal[] = [];

    const result = await patchGoal(
      depsFor({
        existingGoals: [goal()],
        savedRevisions,
        updatedGoals
      }),
      {
        goalId: "goal-1",
        status: "IN_DESIGN",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("PATCHED");
    if (result.status !== "PATCHED") {
      throw new Error("expected goal to be patched");
    }
    expect(result.goal.status).toBe("IN_DESIGN");
    expect(result.revision).toMatchObject({
      entity_id: "goal-1",
      entity_type: "GOAL",
      id: "id-1",
      version_number: 2
    });
    expect(savedRevisions).toEqual([result.revision]);
    expect(updatedGoals).toEqual([result.goal]);
  });

  test("rejects illegal status transitions without updating the goal", async () => {
    const updatedGoals: StoredGoal[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await patchGoal(
      depsFor({
        existingGoals: [goal({ status: "IDENTIFIED" })],
        savedRevisions,
        updatedGoals
      }),
      {
        goalId: "goal-1",
        status: "PROMOTED",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "ILLEGAL_STATUS_TRANSITION" });
    expect(updatedGoals).toEqual([]);
    expect(savedRevisions).toEqual([]);
  });

  test("reports missing goals before patch authorization", async () => {
    const result = await patchGoal(
      depsFor(),
      {
        goalId: "missing-goal",
        status: "IN_DESIGN",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "GOAL_NOT_FOUND" });
  });

  test("rejects goal patches when project access is missing", async () => {
    const result = await patchGoal(
      depsFor({ existingGoals: [goal()], member: false }),
      {
        goalId: "goal-1",
        status: "IN_DESIGN",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "FORBIDDEN" });
  });

  test("rejects promoted goals before a use case is archived", async () => {
    const result = await patchGoal(
      depsFor({
        existingGoals: [goal({ linked_usecase_id: "usecase-1", status: "PROMOTED" })]
      }),
      {
        goalId: "goal-1",
        status: "REJECTED",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "PROMOTED_REJECT_REQUIRES_ARCHIVE" });
  });

  test("lists goals grouped by active actor without mutating stores", async () => {
    const result = await listGoals(
      depsFor({
        actors: [actor(), actor({ archived_at: "2026-01-01T00:00:00.000Z", id: "actor-archived" })],
        existingGoals: [goal(), goal({ actor_id: "actor-archived", id: "goal-archived" })]
      }),
      {
        actorId: "actor-1",
        projectId: "project-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      actors: [{ actor: actor(), goals: [goal()] }],
      status: "LISTED"
    });
  });

  test("rejects listing goals without project membership", async () => {
    const result = await listGoals(
      depsFor({ member: false }),
      {
        projectId: "project-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({ status: "FORBIDDEN" });
  });
});

function depsFor(options: {
  actor?: StoredActor | null;
  actors?: StoredActor[];
  existingGoals?: StoredGoal[];
  member?: boolean;
  savedGoals?: StoredGoal[];
  savedRevisions?: StoredRevision[];
  updatedGoals?: StoredGoal[];
  workspaceArchived?: boolean;
} = {}) {
  let nextId = 0;
  const savedGoals = options.savedGoals ?? [];
  const updatedGoals = options.updatedGoals ?? [];
  return {
    actorStore: actorStore(options.actor, options.actors),
    goalStore: goalStore(options.existingGoals ?? [], savedGoals, updatedGoals),
    idFactory: () => {
      nextId += 1;
      return `id-${String(nextId)}`;
    },
    membershipStore: membershipStore(options.member ?? true),
    projectStore: projectStore(),
    revisionStore: revisionStore(options.savedRevisions ?? []),
    workspaceStore: workspaceStore(options.workspaceArchived ?? false)
  };
}

function actorStore(
  actorOverride: StoredActor | null | undefined,
  actorsOverride: StoredActor[] | undefined
): ActorStore {
  const availableActor = actorOverride === undefined && actorsOverride === undefined
    ? actor()
    : actorOverride ?? undefined;
  return {
    archiveActor: () => Promise.resolve(false),
    findActorById: () => Promise.resolve(availableActor),
    findActorByName: () => Promise.resolve(undefined),
    listActors: () => Promise.resolve(actorsOverride ?? (availableActor === undefined ? [] : [availableActor])),
    saveActor: () => Promise.resolve()
  };
}

function goalStore(
  existingGoals: StoredGoal[],
  savedGoals: StoredGoal[],
  updatedGoals: StoredGoal[]
): GoalStore {
  return {
    findGoalById: (goalId) => Promise.resolve(existingGoals.find((item) => item.id === goalId)),
    listGoals: () => Promise.resolve(existingGoals.concat(savedGoals)),
    saveGoal: (item) => {
      savedGoals.push(item);
      return Promise.resolve();
    },
    updateGoal: (item) => {
      updatedGoals.push({ ...item });
      return Promise.resolve();
    }
  };
}

function membershipStore(member: boolean): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(member ? membership() : undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(): ProjectStore {
  return {
    findProjectById: () => Promise.resolve(project()),
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
    nextVersionNumber: () => Promise.resolve(2),
    saveRevision: (revision) => {
      savedRevisions.push(revision);
      return Promise.resolve();
    }
  };
}

function workspaceStore(archived: boolean): WorkspaceStore {
  return {
    archiveWorkspace: () => Promise.resolve(),
    findWorkspaceById: () => Promise.resolve(workspace()),
    isWorkspaceArchived: () => Promise.resolve(archived),
    nextAvailableWorkspaceSlug: (slug) => Promise.resolve(slug),
    saveWorkspace: () => Promise.resolve(),
    workspaceSlugExists: () => Promise.resolve(false)
  };
}

function actor(overrides: Partial<StoredActor> = {}): StoredActor {
  return {
    aliases: [],
    archived_at: null,
    description: "",
    id: "actor-1",
    is_human: true,
    name: "Customer",
    project_id: "project-1",
    type: "PRIMARY",
    ...overrides
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

function project(): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "PAY",
    name: "Payments",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}

function workspace(): StoredWorkspace {
  return {
    archived_at: null,
    id: "workspace-1",
    name: "Workspace",
    owner_id: "user-1",
    plan: "FREE",
    slug: "workspace"
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
