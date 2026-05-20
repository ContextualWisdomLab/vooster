import { describe, expect, test } from "vitest";
import { listRevisionHistory } from "../../../src/application/revision-history.js";
import type {
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredUseCase
} from "../../../src/http/signup-types.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

describe("revision history application", () => {
  test("lists newest revisions with truncation metadata and guidance", async () => {
    const result = await listRevisionHistory(
      depsFor(),
      {
        limit: 2,
        projectId: undefined,
        simulateReadFailure: false,
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result.status).toBe("LISTED");
    if (result.status !== "LISTED") {
      throw new Error("expected history to be listed");
    }
    expect(result.history).toEqual({
      limit: 2,
      revisions: [
        {
          author: "user-1",
          change_summary: "Added step 1 to main success scenario",
          entity_id: "usecase-1",
          entity_type: "USECASE",
          revision: "revision-4",
          timestamp: "2026-05-20T00:00:00.000Z",
          version_number: 4
        },
        {
          author: "user-1",
          change_summary: "Added main success scenario",
          entity_id: "usecase-1",
          entity_type: "USECASE",
          revision: "revision-3",
          timestamp: "2026-05-20T00:00:00.000Z",
          version_number: 3
        }
      ],
      suggested_next_actions: [
        {
          command: "vspec usecase show PAY-001 --revision=revision-4",
          reason: "Inspect the selected revision."
        },
        {
          command: "vspec diff",
          reason: "Compare two revisions before reverting."
        },
        {
          command: "vspec history PAY-001 --limit 4",
          reason: "Rerun with a larger limit to include suppressed rows."
        }
      ],
      suppressed_count: 2,
      truncated: true,
      usecase: { id: "usecase-1", key: "PAY-001" }
    });
  });

  test("returns project guidance when the use case is missing", async () => {
    await expect(
      listRevisionHistory(
        depsFor({ usecase: null }),
        {
          limit: 50,
          projectId: "project-1",
          simulateReadFailure: false,
          usecaseId: "missing-usecase",
          userId: "user-1"
        }
      )
    ).resolves.toEqual({
      projectKey: "PAY",
      status: "USECASE_NOT_FOUND"
    });
  });

  test("rejects callers without membership before reading revisions", async () => {
    const readEntityIds: string[] = [];

    const result = await listRevisionHistory(
      depsFor({ membership: null, readEntityIds }),
      {
        limit: 50,
        projectId: undefined,
        simulateReadFailure: false,
        usecaseId: "usecase-1",
        userId: "outsider"
      }
    );

    expect(result).toEqual({ status: "FORBIDDEN" });
    expect(readEntityIds).toEqual([]);
  });

  test("returns read failure guidance without mutating history", async () => {
    const result = await listRevisionHistory(
      depsFor(),
      {
        limit: 50,
        projectId: undefined,
        simulateReadFailure: true,
        usecaseId: "usecase-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      status: "READ_FAILED",
      usecase: usecase()
    });
  });
});

function depsFor(
  options: {
    membership?: StoredMembership | null;
    readEntityIds?: string[];
    usecase?: StoredUseCase | null;
  } = {}
) {
  return {
    membershipStore: membershipStore(
      "membership" in options ? options.membership ?? null : membership()
    ),
    now: () => new Date("2026-05-20T00:00:00.000Z"),
    projectStore: projectStore(),
    revisionStore: revisionStore(options.readEntityIds ?? []),
    useCaseStore: useCaseStore("usecase" in options ? options.usecase ?? null : usecase())
  };
}

function membershipStore(value: StoredMembership | null): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(value ?? undefined),
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

function revisionStore(readEntityIds: string[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: (entityId) => {
      readEntityIds.push(entityId);
      return Promise.resolve([
        revision("revision-1", 1, "Created use case"),
        revision("revision-3", 3, "Added main success scenario"),
        revision("revision-2", 2, "Added stakeholder interest"),
        revision("revision-4", 4, "Added step 1 to main success scenario")
      ]);
    },
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: () => Promise.reject(new Error("history must be read-only"))
  };
}

function useCaseStore(value: StoredUseCase | null): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve(value === null ? undefined : { projectId: value.project_id, usecase: value }),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.reject(new Error("history must be read-only")),
    updateUseCase: () => Promise.reject(new Error("history must be read-only"))
  };
}

function revision(id: string, versionNumber: number, changeSummary: string): StoredRevision {
  return {
    change_summary: changeSummary,
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id,
    snapshot: usecase(),
    version_number: versionNumber
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

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-4",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Reviews payment history"
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
