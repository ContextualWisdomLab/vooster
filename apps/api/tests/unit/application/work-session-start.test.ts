import { describe, expect, test } from "vitest";
import { startWorkSession } from "../../../src/application/work-session-start.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";
import type {
  StoredMembership,
  StoredProject,
  StoredSpecBranch,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";

describe("startWorkSession", () => {
  test("creates an active session pinned to latest use case revisions", async () => {
    const savedSessions: StoredWorkSession[] = [];
    const deps = depsFor({ savedSessions });

    const result = await startWorkSession(deps, {
      agentIdentifier: "codex-cli",
      agentType: "CODEX",
      autoBranch: false,
      intent: "Implement checkout validation",
      pins: ["UC-001"],
      projectId: "project-1",
      userId: "user-1"
    });

    expect(result.status).toBe("STARTED");
    if (result.status !== "STARTED") {
      throw new Error("expected session to start");
    }
    expect(result.session).toMatchObject({
      agent_identifier: "codex-cli",
      agent_type: "CODEX",
      branch_id: null,
      id: "id-1",
      intent: "Implement checkout validation",
      pinned_revisions: { "usecase-1": "revision-latest" },
      project_id: "project-1",
      status: "ACTIVE",
      user_id: "user-1"
    });
    expect(result.pinnedKeys).toEqual(["UC-001"]);
    expect(savedSessions).toEqual([result.session]);
  });

  test("stores unrecognized agent types as OTHER with the raw identifier", async () => {
    const result = await startWorkSession(depsFor(), {
      agentIdentifier: "ignored-header",
      agentType: "NEURAL_WEAVER",
      autoBranch: false,
      intent: "Work from an unknown agent",
      pins: ["UC-001"],
      projectId: "project-1",
      userId: "user-1"
    });

    expect(result.status).toBe("STARTED");
    if (result.status !== "STARTED") {
      throw new Error("expected session to start");
    }
    expect(result.session.agent_type).toBe("OTHER");
    expect(result.session.agent_identifier).toBe("NEURAL_WEAVER");
    expect(result.warning).toEqual({
      message: "Stored unrecognized agent_type NEURAL_WEAVER as OTHER.",
      type: "UNKNOWN_AGENT_TYPE"
    });
  });

  test("rejects auto-branch sessions when a pinned use case has a semantic lock", async () => {
    const savedBranches: StoredSpecBranch[] = [];
    const savedSessions: StoredWorkSession[] = [];
    const result = await startWorkSession(
      depsFor({
        lockMode: "SEMANTIC",
        savedBranches,
        savedSessions
      }),
      {
        agentIdentifier: "codex-cli",
        agentType: "CODEX",
        autoBranch: true,
        branchName: "agent/session-work",
        intent: "Work on a locked use case",
        pins: ["UC-001"],
        projectId: "project-1",
        userId: "user-1"
      }
    );

    expect(result).toEqual({
      holder: "session-lock-holder",
      key: "UC-001",
      status: "SEMANTIC_LOCKED"
    });
    expect(savedBranches).toEqual([]);
    expect(savedSessions).toEqual([]);
  });
});

function depsFor(options: {
  lockMode?: "HARD" | "SEMANTIC" | "SOFT";
  savedBranches?: StoredSpecBranch[];
  savedSessions?: StoredWorkSession[];
} = {}) {
  const savedBranches = options.savedBranches ?? [];
  const savedSessions = options.savedSessions ?? [];
  let id = 0;

  return {
    branchStore: branchStore(savedBranches),
    clock: () => "2026-05-19T00:00:00.000Z",
    idFactory: () => {
      id += 1;
      return `id-${String(id)}`;
    },
    lockStore: lockStore(options.lockMode),
    membershipStore: membershipStore(),
    projectStore: projectStore(),
    revisionStore: revisionStore(),
    useCaseStore: useCaseStore(),
    workSessionStore: workSessionStore(savedSessions)
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

function branchStore(savedBranches: StoredSpecBranch[]): BranchStore {
  return {
    findBranchById: () => Promise.resolve(undefined),
    findBranchByProjectAndName: () => Promise.resolve(undefined),
    listBranches: () => Promise.resolve([]),
    saveBranch: (branch) => {
      savedBranches.push(branch);
      return Promise.resolve();
    },
    updateBranch: () => Promise.resolve()
  };
}

function lockStore(mode: "HARD" | "SEMANTIC" | "SOFT" | undefined): LockStore {
  return {
    deleteLock: () => Promise.resolve(),
    deleteLockForUseCase: () => Promise.resolve(),
    findLockById: () => Promise.resolve(undefined),
    findLockForUseCase: () =>
      Promise.resolve(
        mode === undefined
          ? undefined
          : {
              expires_at: "2026-06-01T00:00:00.000Z",
              holder: "session-lock-holder",
              mode,
              reason: "Locked for testing",
              usecase_id: "usecase-1"
            }
      ),
    listLocksForUseCase: () => Promise.resolve([]),
    listLocksHeldBySession: () => Promise.resolve([]),
    saveLock: () => Promise.resolve(),
    updateLock: () => Promise.resolve()
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

function revisionStore(): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () =>
      Promise.resolve({
        entity_id: "usecase-1",
        entity_type: "USECASE",
        id: "revision-latest",
        snapshot: usecase(),
        version_number: 2
      }),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: () => Promise.resolve()
  };
}

function useCaseStore(): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(undefined),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([usecase()]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function workSessionStore(savedSessions: StoredWorkSession[]): WorkSessionStore {
  return {
    findWorkSessionById: () => Promise.resolve(undefined),
    listWorkSessions: () => Promise.resolve([]),
    listWorkSessionsForUseCase: () => Promise.resolve([]),
    saveWorkSession: (session) => {
      savedSessions.push(session);
      return Promise.resolve();
    },
    updateWorkSession: () => Promise.resolve()
  };
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "OWNER",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

function project(): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "SES",
    name: "Sessions",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "UC-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "vspec",
    status: "DRAFT",
    title: "Reviews checkout validation"
  };
}
