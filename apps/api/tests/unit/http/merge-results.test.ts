import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredMergeRequest,
  StoredSpecBranch
} from "../../../src/domain/entities/index.js";
import { sendOpenMergeResult } from "../../../src/http/merge-results.js";

describe("open merge result responses", () => {
  test("serializes lookup and access failures", () => {
    const cases = [
      {
        expectedStatus: 404,
        result: { status: "SOURCE_NOT_FOUND" as const },
        title: "Source branch not found"
      },
      {
        expectedStatus: 403,
        result: { status: "ACCESS_DENIED" as const },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 409,
        result: { status: "SOURCE_NOT_ACTIVE" as const },
        title: "Source branch is not active"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendOpenMergeResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes rejected fast-forward and hard-lock failures", () => {
    const fastForward = reply();
    sendOpenMergeResult(fastForward.fastifyReply, {
      mainHeadRevisionIds: { "goal-1": "revision-main" },
      sourceBranch: sourceBranch(),
      status: "FAST_FORWARD_REJECTED"
    });

    expect(fastForward.statusCode).toBe(422);
    expect(fastForward.body).toMatchObject({
      main_head_revision_ids: { "goal-1": "revision-main" },
      suggested_next_actions: [
        { command: "vspec merge open feature/conflict --strategy squash" }
      ],
      title: "Fast-forward rejected because main has advanced"
    });

    const hardLock = reply();
    sendOpenMergeResult(hardLock.fastifyReply, {
      holdingSession: "session-2",
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
  });

  test("serializes conflict and merged payloads", () => {
    const conflicts = reply();
    sendOpenMergeResult(conflicts.fastifyReply, {
      mainHeadRevisionIds: { "goal-1": "revision-main" },
      mergeRequest: mergeRequest(),
      sourceBranch: sourceBranch(),
      status: "CONFLICTS"
    });

    expect(conflicts.statusCode).toBe(201);
    expect(conflicts.body).toMatchObject({
      merge_request: { id: "merge-1" },
      suggested_next_actions: [{ command: "vspec merge resolve merge-1" }]
    });

    const merged = reply();
    sendOpenMergeResult(merged.fastifyReply, {
      mainHeadRevisionIds: { "goal-1": "revision-main" },
      mergeRequest: mergeRequest({ status: "MERGED" }),
      sourceBranch: sourceBranch({ status: "MERGED" }),
      status: "MERGED"
    });

    expect(merged.statusCode).toBe(201);
    expect(merged.body).toMatchObject({
      merge_request: { id: "merge-1", status: "MERGED" },
      source_branch: { id: "branch-source", status: "MERGED" },
      suggested_next_actions: [{ command: "vspec merge show merge-1" }]
    });
  });

  test("serializes write failures with retry guidance", () => {
    const captured = reply();
    sendOpenMergeResult(captured.fastifyReply, {
      exitCode: 5,
      mainHeadRevisionIds: { "goal-1": "revision-main" },
      mergeRequest: mergeRequest(),
      sourceBranch: sourceBranch(),
      status: "WRITE_FAILED"
    });

    expect(captured.statusCode).toBe(500);
    expect(captured.body).toMatchObject({
      exit_code: 5,
      suggested_next_actions: [
        { command: "vspec merge open feature/conflict --retry" }
      ],
      title: "Merge write failed"
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
