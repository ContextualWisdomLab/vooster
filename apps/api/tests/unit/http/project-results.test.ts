import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredProject,
  StoredSpecBranch
} from "../../../src/domain/entities/index.js";
import {
  sendProjectCreationResult,
  sendProjectDeletionResult,
  sendProjectRenameResult
} from "../../../src/http/project-results.js";

describe("project result responses", () => {
  test("serializes project creation successes and failures", () => {
    const created = reply();
    sendProjectCreationResult(created.fastifyReply, {
      defaultBranch: branch(),
      project: project(),
      status: "CREATED"
    });

    expect(created.statusCode).toBe(201);
    expect(created.body).toMatchObject({
      default_branch: { id: "branch-1" },
      project: { key: "PAY" },
      recommended_next_command: "vspec actor create"
    });

    const cases = [
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Request an invitation to this workspace"
      },
      {
        expectedStatus: 409,
        result: { status: "WORKSPACE_ARCHIVED" as const },
        title: "Workspace has been archived"
      },
      {
        expectedStatus: 422,
        result: { existingProject: project(), status: "DUPLICATE_KEY" as const },
        title: "Project key is already in use"
      },
      {
        expectedStatus: 500,
        result: { requestId: "request-1", status: "CREATE_FAILED" as const },
        title: "Project creation failed"
      },
      {
        expectedStatus: 409,
        result: { status: "NO_WORKSPACE" as const },
        title: "No workspace available"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendProjectCreationResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes project rename results", () => {
    const renamed = reply();
    const renamedProject = project({ name: "Billing" });
    sendProjectRenameResult(renamed.fastifyReply, {
      project: renamedProject,
      status: "RENAMED"
    });

    expect(renamed.statusCode).toBeUndefined();
    expect(renamed.body).toEqual({ project: renamedProject });

    const cases = [
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Not a member of this workspace"
      },
      {
        expectedStatus: 404,
        result: { status: "NOT_FOUND" as const },
        title: "Project not found"
      },
      {
        expectedStatus: 409,
        result: { status: "WORKSPACE_ARCHIVED" as const },
        title: "Workspace has been archived"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendProjectRenameResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes project deletion results", () => {
    const deleted = reply();
    sendProjectDeletionResult(deleted.fastifyReply, { status: "DELETED" });

    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBeUndefined();

    const cases = [
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Not a member of this workspace"
      },
      {
        expectedStatus: 404,
        result: { status: "NOT_FOUND" as const },
        title: "Project not found"
      },
      {
        expectedStatus: 409,
        result: { status: "WORKSPACE_ARCHIVED" as const },
        title: "Workspace has been archived"
      },
      {
        expectedStatus: 409,
        result: { status: "HAS_DEPENDENCIES" as const },
        title: "Project still has use cases, actors, or other data"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendProjectDeletionResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });
});

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    send: (body?: unknown) => unknown;
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

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    default_branch_id: "branch-1",
    id: "project-1",
    key: "PAY",
    name: "Payments",
    visibility: "PRIVATE",
    workspace_id: "workspace-1",
    ...overrides
  };
}

function branch(): StoredSpecBranch {
  return {
    base_branch_id: null,
    id: "branch-1",
    name: "main",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1"
  };
}
