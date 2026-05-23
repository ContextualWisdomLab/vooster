import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredMergeRequest,
  StoredRevision,
  StoredSpecBranch
} from "../../../src/domain/entities/index.js";
import { sendResolveMergeResult } from "../../../src/http/merge-resolution-results.js";

describe("merge resolution result responses", () => {
  test("serializes lookup and access failures", () => {
    const cases = [
      {
        expectedStatus: 404,
        result: { status: "MERGE_NOT_FOUND" as const },
        title: "Merge request not found"
      },
      {
        expectedStatus: 404,
        result: { status: "BRANCH_NOT_FOUND" as const },
        title: "Merge branch not found"
      },
      {
        expectedStatus: 403,
        result: { status: "ACCESS_DENIED" as const },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 409,
        result: { mergeRequest: mergeRequest(), status: "NO_OPEN_CONFLICTS" as const },
        title: "Merge request has no open conflicts"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendResolveMergeResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes validation failures with merge context", () => {
    const stale = reply();
    sendResolveMergeResult(stale.fastifyReply, {
      mergeRequest: mergeRequest(),
      status: "STALE_BASE"
    });

    expect(stale.statusCode).toBe(409);
    expect(stale.body).toMatchObject({
      current_revision: "revision-current",
      title: "Merge request base revision is stale"
    });

    const manual = reply();
    sendResolveMergeResult(manual.fastifyReply, {
      mergeRequest: mergeRequest(),
      resolution: { entity_id: "goal-1", field: "description", strategy: "MANUAL" },
      status: "MISSING_MANUAL_VALUE"
    });

    expect(manual.statusCode).toBe(400);
    expect(manual.body).toMatchObject({
      field: "description",
      offending_entity_id: "goal-1",
      title: "Manual resolution requires a value"
    });

    const uncovered = reply();
    sendResolveMergeResult(uncovered.fastifyReply, {
      mergeRequest: mergeRequest(),
      status: "UNCOVERED_CONFLICTS",
      uncovered: [{ entity_id: "goal-2" }]
    });

    expect(uncovered.statusCode).toBe(422);
    expect(uncovered.body).toMatchObject({
      title: "Resolution list must cover every conflict",
      uncovered_conflicts: [{ entity_id: "goal-2" }]
    });
  });

  test("serializes hard lock and write failures", () => {
    const hardLock = reply();
    sendResolveMergeResult(hardLock.fastifyReply, {
      holdingSession: "session-2",
      mainHeadRevisionIds: { "goal-1": "revision-main" },
      mergeRequest: mergeRequest(),
      status: "HARD_LOCK",
      useCaseKey: "PAY-001"
    });

    expect(hardLock.statusCode).toBe(409);
    expect(hardLock.body).toMatchObject({
      holding_session: "session-2",
      suggested_next_actions: [{ command: "vspec who PAY-001" }],
      title: "Target entity has a hard lock"
    });

    const writeFailed = reply();
    sendResolveMergeResult(writeFailed.fastifyReply, {
      exitCode: 5,
      mainHeadRevisionIds: { "goal-1": "revision-main" },
      mergeRequest: mergeRequest(),
      sourceBranch: sourceBranch(),
      status: "WRITE_FAILED"
    });

    expect(writeFailed.statusCode).toBe(500);
    expect(writeFailed.body).toMatchObject({
      exit_code: 5,
      suggested_next_actions: [{ command: "vspec merge resolve merge-1 --retry" }],
      title: "Conflict resolution write failed"
    });
  });

  test("serializes successful merge payloads", () => {
    const captured = reply();
    sendResolveMergeResult(captured.fastifyReply, {
      mainHeadRevisionIds: { "goal-1": "revision-new" },
      mergeRequest: mergeRequest({ status: "MERGED" }),
      newRevisions: [revision()],
      sourceBranch: sourceBranch({ status: "MERGED" }),
      status: "MERGED",
      suggestedNextActions: []
    });

    expect(captured.statusCode).toBeUndefined();
    expect(captured.body).toMatchObject({
      main_head_revision_ids: { "goal-1": "revision-new" },
      merge_request: { id: "merge-1", status: "MERGED" },
      new_revisions: [{ id: "revision-new" }],
      source_branch: { id: "branch-source", status: "MERGED" }
    });
  });
});

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    send: (body: unknown) => unknown;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply,
    send: (body) => {
      captured.body = body;
      return body;
    }
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: captured.send
  } as unknown as FastifyReply;
  return captured;
}

function mergeRequest(overrides: Partial<StoredMergeRequest> = {}): StoredMergeRequest {
  return {
    conflicts: [{ entity_id: "goal-1", field: "description" }],
    current_revision_id: "revision-current",
    id: "merge-1",
    impact: { affected_branches: [], affected_sessions: [], severity_by_entity: {} },
    source_branch_id: "branch-source",
    status: "OPEN",
    strategy: "SQUASH",
    target_branch_id: "branch-main",
    ...overrides
  };
}

function sourceBranch(overrides: Partial<StoredSpecBranch> = {}): StoredSpecBranch {
  return {
    base_branch_id: "branch-main",
    id: "branch-source",
    name: "feature/conflict",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE",
    ...overrides
  };
}

function revision(): StoredRevision {
  return {
    entity_id: "goal-1",
    entity_type: "GOAL",
    id: "revision-new",
    snapshot: {} as StoredRevision["snapshot"],
    version_number: 2
  };
}
