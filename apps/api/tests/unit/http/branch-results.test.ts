import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredSpecBranch } from "../../../src/domain/entities/index.js";
import { sendCreateBranchResult } from "../../../src/http/branch-results.js";

describe("create branch result responses", () => {
  test("serializes branch creation failures", () => {
    const cases = [
      {
        expectedStatus: 403,
        result: { status: "ACCESS_DENIED" as const },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 403,
        result: { status: "READ_ONLY" as const },
        title: "Editor role required to create branches"
      },
      {
        expectedStatus: 422,
        result: { branchName: "feature/payments", status: "NON_MAIN_BASE" as const },
        title: "MVP supports single-level branches from main only"
      },
      {
        expectedStatus: 422,
        result: { status: "NAME_COLLISION" as const, suggestedName: "feature-2" },
        title: "Branch name is already in use"
      },
      {
        expectedStatus: 404,
        result: { status: "PROJECT_BRANCH_NOT_FOUND" as const },
        title: "Project branch not found"
      },
      {
        expectedStatus: 500,
        result: {
          branchName: "feature/payments",
          exitCode: 5 as const,
          status: "SNAPSHOT_FAILED" as const
        },
        title: "Branch snapshot failed"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendCreateBranchResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes created branches with optional warnings", () => {
    const clean = reply();
    sendCreateBranchResult(clean.fastifyReply, {
      branch: branch(),
      status: "CREATED",
      suggestedNextActions: [{ command: "vspec usecase list", reason: "Inspect." }],
      warnings: []
    });

    expect(clean.statusCode).toBe(201);
    expect(clean.body).toEqual({
      branch: branch(),
      suggested_next_actions: [{ command: "vspec usecase list", reason: "Inspect." }]
    });

    const warned = reply();
    sendCreateBranchResult(warned.fastifyReply, {
      branch: branch(),
      status: "CREATED",
      suggestedNextActions: [],
      warnings: [{ merge_request_id: "merge-1", type: "IN_FLIGHT_MERGE_REQUEST" }]
    });

    expect(warned.body).toMatchObject({
      warnings: [{ merge_request_id: "merge-1", type: "IN_FLIGHT_MERGE_REQUEST" }]
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

function branch(): StoredSpecBranch {
  return {
    base_branch_id: "branch-main",
    base_revision_ids: {},
    head_revision_ids: {},
    id: "branch-1",
    name: "feature/payments",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1",
    status: "ACTIVE"
  };
}
