import { describe, expect, test } from "vitest";
import { compareUseCaseRevisions } from "../../../src/application/revision-diff.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type {
  StoredMembership,
  StoredRevision,
  StoredSpecBranch,
  StoredUseCase
} from "../../../src/domain/entities/index.js";

describe("compareUseCaseRevisions", () => {
  test("returns structural changes with summary and cross-branch warnings", async () => {
    const result = await compareUseCaseRevisions(depsFor(), {
      format: "json",
      fromRevisionId: "rev-branch",
      toRevisionId: "rev-main",
      usecaseId: "usecase-1",
      userId: "user-1"
    });

    expect(result.status).toBe("COMPARED");
    if (result.status !== "COMPARED") {
      throw new Error("expected revisions to be compared");
    }
    expect(result.diff).toMatchObject({
      cross_branch: true,
      format: "json",
      from_revision: "rev-branch",
      summary: { breaking: 1, cosmetic: 0, non_breaking: 0 },
      to_revision: "rev-main",
      usecase: { id: "usecase-1", key: "PAY-001" },
      warnings: [
        {
          from_branch: "feature/refund-review",
          to_branch: "main",
          type: "CROSS_BRANCH_DIFF"
        }
      ]
    });
    expect(result.diff.changes).toEqual([
      {
        change_type: "CHANGE",
        entity_type: "USECASE",
        path: "usecase.title",
        revision: "rev-main",
        severity: "BREAKING",
        source_branch: "main"
      }
    ]);
    expect(result.diff.suggested_next_actions).toContainEqual({
      command: "vspec impact PAY-001",
      reason: "Check dependent work before approving the change."
    });
  });

  test("hides revision details from users without project membership", async () => {
    const result = await compareUseCaseRevisions(depsFor({ member: false }), {
      format: "json",
      fromRevisionId: "rev-branch",
      toRevisionId: "rev-main",
      usecaseId: "usecase-1",
      userId: "outsider"
    });

    expect(result).toEqual({ status: "FORBIDDEN" });
  });

  test("returns the missing revision and use case for history guidance", async () => {
    const result = await compareUseCaseRevisions(depsFor(), {
      format: "human",
      fromRevisionId: "rev-missing",
      toRevisionId: "rev-main",
      usecaseId: "usecase-1",
      userId: "user-1"
    });

    expect(result).toEqual({
      missingRevision: "rev-missing",
      status: "MISSING_REVISION",
      usecase: usecase()
    });
  });
});

function depsFor(options: { member?: boolean } = {}) {
  return {
    branchStore: branchStore(),
    membershipStore: membershipStore(options.member ?? true),
    revisionStore: revisionStore(),
    useCaseStore: useCaseStore()
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
    saveUseCase: () => Promise.reject(new Error("diff must be read-only")),
    updateUseCase: () => Promise.reject(new Error("diff must be read-only"))
  };
}

function revisionStore(): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () =>
      Promise.resolve([
        revision("rev-base", 1, "Created use case", "NON_BREAKING"),
        revision("rev-branch", 2, "Branch edits title", "NON_BREAKING"),
        revision("rev-main", 3, "Main edits title", "BREAKING")
      ]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: () => Promise.reject(new Error("diff must be read-only"))
  };
}

function branchStore(): BranchStore {
  return {
    findBranchById: () => Promise.resolve(undefined),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () =>
      Promise.resolve([
        branch("branch-feature", "feature/refund-review", "rev-branch"),
        branch("branch-main", "main", "rev-main")
      ]),
    saveBranch: () => Promise.reject(new Error("diff must be read-only")),
    updateBranch: () => Promise.reject(new Error("diff must be read-only"))
  };
}

function revision(
  id: string,
  versionNumber: number,
  changeSummary: string,
  severity: StoredRevision["severity"]
): StoredRevision {
  return {
    change_summary: changeSummary,
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id,
    severity,
    snapshot: usecase(),
    version_number: versionNumber
  };
}

function branch(id: string, name: string, revisionId: string): StoredSpecBranch {
  return {
    base_branch_id: null,
    head_revision_ids: { "usecase-1": revisionId },
    id,
    name,
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1"
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "rev-main",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Reviews refund status"
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
