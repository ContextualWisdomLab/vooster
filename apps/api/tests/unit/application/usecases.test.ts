import { describe, expect, test } from "vitest";
import {
  authorUseCase,
  updateUseCaseMetadata
} from "../../../src/application/usecases.js";
import { titleLooksLikeVerbPhrase } from "../../../src/application/verb-phrases.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type {
  StoredActor,
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredStakeholderInterest,
  StoredUseCase
} from "../../../src/domain/entities/index.js";

describe("use case authoring application", () => {
  test("creates a draft use case with defaults and a first revision", async () => {
    const savedUseCases: StoredUseCase[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await authorUseCase(
      depsFor({ savedRevisions, savedUseCases }),
      input()
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected created result");
    }
    expect(result.usecase).toMatchObject({
      current_revision_id: "revision-1",
      format: "BRIEF",
      id: "usecase-1",
      key: "CHK-001",
      level: "USER_GOAL",
      primary_actor_id: "actor-1",
      priority: "P2",
      project_id: "project-1",
      scope: "chk",
      status: "DRAFT",
      title: "Places an order"
    });
    expect(result.revision).toMatchObject({
      entity_id: "usecase-1",
      entity_type: "USECASE",
      id: "revision-1",
      snapshot: result.usecase,
      version_number: 1
    });
    expect(result.suggestedNextActions).toContainEqual({
      command: "vspec usecase show CHK-001",
      reason: "Open the new use case."
    });
    expect(savedUseCases).toEqual([result.usecase]);
    expect(savedRevisions).toEqual([result.revision]);
  });

  test("skips the first allocated key when a collision is simulated", async () => {
    const result = await authorUseCase(
      depsFor(),
      input({ simulateKeyCollisionOnce: true })
    );

    expect(result).toMatchObject({
      status: "CREATED",
      usecase: { key: "CHK-002" }
    });
  });

  test.each([
    "Pin a use case",
    "Pull project specs",
    "Push local changes",
    "Start a session",
    "Lock a use case",
    "Unlock a use case",
    "Branch from main",
    "Merge a branch",
    "Sync markdown files",
    "Run diagnostics",
    "Author a use case",
    "Diagnose project drift",
    "Diff local changes",
    "Revert a revision",
    "Comment on a use case",
    "Export markdown",
    "Import markdown",
    "Inspect project health"
  ])("accepts vspec verb phrase title '%s'", async (title) => {
    await expect(authorUseCase(depsFor(), input({ title }))).resolves.toMatchObject({
      status: "CREATED",
      usecase: { title }
    });
  });

  test("accepts a Korean verb phrase title by default", async () => {
    await expect(
      authorUseCase(depsFor(), input({ title: "주문을 생성한다" }))
    ).resolves.toMatchObject({
      status: "CREATED",
      usecase: { title: "주문을 생성한다" }
    });
  });

  test.each(["User exports their expenses to CSV", "User logs a new expense"])(
    "accepts subject-first finite-verb title '%s'",
    async (title) => {
      await expect(authorUseCase(depsFor(), input({ title }))).resolves.toMatchObject({
        status: "CREATED",
        usecase: { title }
      });
    }
  );

  test("returns failure statuses without writing", async () => {
    await expect(
      authorUseCase(depsFor({ membership: undefined }), input())
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      authorUseCase(depsFor(), input({ force: false, title: "Order status" }))
    ).resolves.toEqual({
      offendingWord: "status",
      status: "TITLE_NOT_VERB_PHRASE",
      suggestedTitles: ["Review order status"]
    });
    await expect(
      authorUseCase(depsFor(), input({ force: false, title: "주문 상태" }))
    ).resolves.toMatchObject({
      status: "TITLE_NOT_VERB_PHRASE"
    });
    await expect(
      authorUseCase(depsFor({ project: undefined }), input())
    ).resolves.toEqual({ status: "PROJECT_NOT_FOUND" });
    await expect(
      authorUseCase(depsFor({ actor: undefined }), input())
    ).resolves.toEqual({
      actorName: "Customer",
      status: "PRIMARY_ACTOR_NOT_AVAILABLE"
    });
    await expect(
      authorUseCase(
        depsFor({ actor: actor({ archived_at: "2026-05-20T00:00:00.000Z" }) }),
        input()
      )
    ).resolves.toEqual({
      actorName: "Customer",
      status: "PRIMARY_ACTOR_NOT_AVAILABLE"
    });
  });

  test("returns only accepted suggestions for rejected titles", async () => {
    const result = await authorUseCase(
      depsFor(),
      input({ force: false, title: "Expense report" })
    );

    expect(result.status).toBe("TITLE_NOT_VERB_PHRASE");
    if (result.status !== "TITLE_NOT_VERB_PHRASE") {
      throw new Error("expected rejected title");
    }
    expect(result.offendingWord).toBe("report");
    expect(result.suggestedTitles).toEqual(["Review expense report"]);
    expect(
      result.suggestedTitles.every((title) => titleLooksLikeVerbPhrase(title))
    ).toBe(true);
  });
});

describe("use case update application", () => {
  test("blocks status transitions without stakeholder interests", async () => {
    const updates: StoredUseCase[] = [];

    await expect(
      updateUseCaseMetadata(updateDepsFor({ updates }), {
        status: "IN_REVIEW",
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "NEEDS_STAKEHOLDER_INTEREST" });
    expect(updates).toEqual([]);
  });

  test("updates allowed use case metadata after authorization", async () => {
    const updates: StoredUseCase[] = [];

    const result = await updateUseCaseMetadata(
      updateDepsFor({
        interests: [stakeholderInterest()],
        updates
      }),
      {
        status: "IN_REVIEW",
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      status: "UPDATED",
      usecase: usecase({ status: "IN_REVIEW" })
    });
    expect(updates).toEqual([usecase({ status: "IN_REVIEW" })]);
  });

  test("returns update failure statuses", async () => {
    await expect(
      updateUseCaseMetadata(updateDepsFor({ found: undefined }), {
        status: undefined,
        usecaseId: "missing",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "USECASE_NOT_FOUND" });
    await expect(
      updateUseCaseMetadata(updateDepsFor({ membership: undefined }), {
        status: "DRAFT",
        usecaseId: "usecase-1",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "FORBIDDEN" });
  });
});

function depsFor(
  options: {
    actor?: StoredActor;
    membership?: StoredMembership;
    project?: StoredProject;
    savedRevisions?: StoredRevision[];
    savedUseCases?: StoredUseCase[];
  } = {}
) {
  return {
    actorStore: actorStore("actor" in options ? options.actor : actor()),
    idFactory: ids("usecase-1", "revision-1"),
    membershipStore: membershipStore(
      "membership" in options ? options.membership : member()
    ),
    projectStore: projectStore("project" in options ? options.project : project()),
    revisionStore: revisionStore(options.savedRevisions ?? []),
    useCaseStore: useCaseStore(options.savedUseCases ?? [])
  };
}

function input(
  overrides: Partial<Parameters<typeof authorUseCase>[1]> = {}
): Parameters<typeof authorUseCase>[1] {
  return {
    force: false,
    level: "USER_GOAL",
    primaryActor: "Customer",
    priority: "P2",
    projectId: "project-1",
    scope: undefined,
    simulateKeyCollisionOnce: false,
    title: "Places an order",
    userId: "user-1",
    ...overrides
  };
}

function actorStore(foundActor: StoredActor | undefined): ActorStore {
  return {
    archiveActor: () => Promise.resolve(false),
    findActorById: () => Promise.resolve(undefined),
    findActorByName: () => Promise.resolve(foundActor),
    listActors: () => Promise.resolve([]),
    saveActor: () => Promise.resolve()
  };
}

function membershipStore(membership: StoredMembership | undefined): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(membership),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(foundProject: StoredProject | undefined): ProjectStore {
  return {
    findProjectById: () => Promise.resolve(foundProject),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    deleteProject: () => Promise.resolve("NOT_FOUND" as const),
    updateProjectName: () => Promise.resolve(undefined),
    saveProject: () => Promise.resolve()
  };
}

function revisionStore(savedRevisions: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve(savedRevisions),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: (revision) => {
      savedRevisions.push(revision);
      return Promise.resolve();
    }
  };
}

function useCaseStore(savedUseCases: StoredUseCase[]): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(undefined),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve(savedUseCases),
    saveUseCase: (usecase) => {
      savedUseCases.push(usecase);
      return Promise.resolve();
    },
    updateUseCase: () => Promise.resolve()
  };
}

function updateDepsFor(
  options: {
    found?: { projectId: string; usecase: StoredUseCase };
    interests?: StoredStakeholderInterest[];
    membership?: StoredMembership;
    updates?: StoredUseCase[];
  } = {}
) {
  return {
    membershipStore: membershipStore(
      "membership" in options ? options.membership : member()
    ),
    stakeholderInterestStore: stakeholderInterestStore(options.interests ?? []),
    useCaseStore: updatingUseCaseStore(
      "found" in options
        ? options.found
        : { projectId: "project-1", usecase: usecase() },
      options.updates ?? []
    )
  };
}

function stakeholderInterestStore(
  interests: StoredStakeholderInterest[]
): StakeholderInterestStore {
  return {
    deleteStakeholderInterest: () => Promise.resolve(),
    findStakeholderInterestById: () => Promise.resolve(undefined),
    findStakeholderInterestForStakeholder: () => Promise.resolve(undefined),
    listStakeholderInterests: () => Promise.resolve(interests),
    saveStakeholderInterest: () => Promise.resolve()
  };
}

function updatingUseCaseStore(
  found: { projectId: string; usecase: StoredUseCase } | undefined,
  updates: StoredUseCase[]
): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(found),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: (updated) => {
      updates.push(updated);
      return Promise.resolve();
    }
  };
}

function ids(...values: string[]) {
  let index = 0;
  return () => values[index++] ?? `id-${String(index)}`;
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

function member(): StoredMembership {
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
    priority: "P2",
    project_id: "project-1",
    scope: "chk",
    status: "DRAFT",
    title: "Places an order",
    ...overrides
  };
}

function stakeholderInterest(): StoredStakeholderInterest {
  return {
    id: "interest-1",
    interest: "Checkout revenue is protected.",
    protection_mechanism: "",
    stakeholder_id: "stakeholder-1",
    usecase_id: "usecase-1"
  };
}
