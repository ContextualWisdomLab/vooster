import { describe, expect, test } from "vitest";
import { previewImpact } from "../../../src/application/impact-analysis.js";
import type {
  StoredMembership,
  StoredRevision,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/http/signup-types.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";

describe("impact analysis application", () => {
  test("previews impact, caches by input hash, and returns next actions", async () => {
    const cache = new Map();
    const first = await previewImpact(
      depsFor({ cache }),
      input({ baseRevision: "revision-breaking" })
    );
    const second = await previewImpact(
      depsFor({ cache }),
      input({ baseRevision: "revision-breaking" })
    );

    expect(first.status).toBe("PREVIEWED");
    expect(second.status).toBe("PREVIEWED");
    if (first.status !== "PREVIEWED" || second.status !== "PREVIEWED") {
      throw new Error("expected preview results");
    }
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.impact).toEqual(first.impact);
    expect(first.previewId).toBe("preview-1");
    expect(second.previewId).toBe("preview-1");
    expect(first.impact).toMatchObject({
      affected_branches: [],
      affected_sessions: [],
      affected_tests: [],
      confidence: 1,
      input_hash: "hash-revision-breaking",
      severity: "BREAKING"
    });
    expect(first.nextActions).toContainEqual({
      command: "vspec lock CHK-001",
      reason: "Lock the use case before applying a risky change."
    });
  });

  test("rolls active pinned sessions up to breaking severity", async () => {
    const result = await previewImpact(
      depsFor({
        sessions: [
          session({ pinned_revisions: { "usecase-1": "revision-current" } }),
          session({ id: "session-done", status: "COMPLETED" })
        ]
      }),
      input({ baseRevision: "revision-non-breaking" })
    );

    expect(result.status).toBe("PREVIEWED");
    if (result.status !== "PREVIEWED") {
      throw new Error("expected preview result");
    }
    expect(result.impact.severity).toBe("BREAKING");
    expect(result.impact.affected_sessions).toEqual([
      {
        agent_type: "CODEX",
        id: "session-1",
        owner: "user-1",
        pinned_revision: "revision-current"
      }
    ]);
  });

  test("returns failure statuses before computing impact", async () => {
    await expect(previewImpact(depsFor({ found: undefined }), input())).resolves.toEqual({
      status: "NOT_FOUND"
    });
    await expect(
      previewImpact(depsFor({ membership: undefined }), input())
    ).resolves.toEqual({ status: "ACCESS_DENIED" });
    await expect(
      previewImpact(depsFor(), input({ proposedChangeContent: "# Missing frontmatter" }))
    ).resolves.toEqual({
      path: "<inline>",
      status: "PROPOSED_CHANGE_PARSE_FAILED"
    });
    await expect(
      previewImpact(depsFor(), input({ proposedChangePath: "missing/usecase.md" }))
    ).resolves.toEqual({
      path: "missing/usecase.md",
      status: "PROPOSED_CHANGE_NOT_READABLE",
      usecase: usecase()
    });
    await expect(
      previewImpact(depsFor(), input({ baseRevision: "missing-revision" }))
    ).resolves.toEqual({ status: "REVISION_NOT_FOUND" });
  });
});

function depsFor(
  options: {
    cache?: Map<string, unknown>;
    found?: { projectId: string; usecase: StoredUseCase };
    membership?: StoredMembership;
    sessions?: StoredWorkSession[];
  } = {}
) {
  return {
    cache: options.cache ?? new Map(),
    hashFactory: (revision: StoredRevision) => `hash-${revision.id}`,
    idFactory: () => "preview-1",
    membershipStore: membershipStore(
      "membership" in options ? options.membership : membership()
    ),
    revisionStore: revisionStore(),
    useCaseStore: useCaseStore(
      "found" in options ? options.found : { projectId: "project-1", usecase: usecase() }
    ),
    workSessionStore: workSessionStore(options.sessions ?? [])
  };
}

function input(overrides: Partial<Parameters<typeof previewImpact>[1]> = {}) {
  return {
    baseRevision: "revision-current",
    entityId: "usecase-1",
    proposedChangeContent: undefined,
    proposedChangePath: undefined,
    userId: "user-1",
    ...overrides
  };
}

function membershipStore(value: StoredMembership | undefined): MembershipStore {
  return {
    membershipForProject: (_projectId, userId) =>
      Promise.resolve(userId === value?.user_id ? value : undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function revisionStore(): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () =>
      Promise.resolve([
        revision("revision-current", "NON_BREAKING"),
        revision("revision-non-breaking", "NON_BREAKING"),
        revision("revision-breaking", "BREAKING")
      ]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: () => Promise.resolve()
  };
}

function useCaseStore(
  found: { projectId: string; usecase: StoredUseCase } | undefined
): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(found),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function workSessionStore(sessions: StoredWorkSession[]): WorkSessionStore {
  return {
    findWorkSessionById: () => Promise.resolve(undefined),
    listWorkSessions: () => Promise.resolve([]),
    listWorkSessionsForUseCase: () => Promise.resolve(sessions),
    saveWorkSession: () => Promise.resolve(),
    updateWorkSession: () => Promise.resolve()
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

function revision(
  id: string,
  severity: NonNullable<StoredRevision["severity"]>
): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id,
    severity,
    snapshot: usecase(),
    version_number: 1
  };
}

function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    agent_type: "CODEX",
    id: "session-1",
    pinned_revisions: {},
    status: "ACTIVE",
    user_id: "user-1",
    ...overrides
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "CHK-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "vspec",
    status: "DRAFT",
    title: "Reviews a refund"
  };
}
