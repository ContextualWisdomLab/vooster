import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerChangeCommitRoutes } from "../../../src/http/change-commit-routes.js";
import {
  previews,
  type ChangePreview
} from "../../../src/http/change-preview-support.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;
type RouteName = "commit" | "expire";

// NOTE: This defensive branch ("commit references a preview whose use case has
// vanished from the store") cannot be reproduced against the real server: the
// in-memory use case store has no delete operation, and archiving keeps the use
// case findable via findUseCaseWithProject. It therefore stays a unit test.
// The other change-commit behaviors are covered by:
//   tests/integration/http/change-commit-route.test.ts (malformed 400, expire 404)
//   tests/e2e/UC-035.test.ts (valid commit, unknown/expired preview)
describe("change commit routes", () => {
  test("rejects commit when the preview use case no longer exists", async () => {
    const state = signupState();
    previews(state).set("preview-1", preview());
    const captured = reply();

    await registeredRoutes(state).commit(
      request({}, { confirmed: true, preview_id: "preview-1" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(404);
    expect(captured.body).toMatchObject({ title: "Use case not found" });
  });
});

function registeredRoutes(state: SignupState): Record<RouteName, Handler> {
  const handlers: Partial<Record<RouteName, Handler>> = {};
  const app = {
    post: (path: string, handler: Handler) => {
      if (path === "/v1/changes/commit") {
        handlers.commit = handler;
      }
      if (path === "/__test/changes/previews/:previewId/expire") {
        handlers.expire = handler;
      }
    }
  } as unknown as FastifyInstance;

  registerChangeCommitRoutes(
    app,
    state,
    {} as BranchStore,
    {} as ProjectStore,
    {} as RevisionStore,
    useCaseStore()
  );

  if (handlers.commit === undefined || handlers.expire === undefined) {
    throw new Error("expected change commit routes");
  }
  return handlers as Record<RouteName, Handler>;
}

function request(params: Record<string, string>, body: unknown): FastifyRequest {
  return { body, headers: {}, params } as unknown as FastifyRequest;
}

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: (body: unknown) => {
      captured.body = body;
      return body;
    }
  } as unknown as FastifyReply;
  return captured;
}

function signupState(): SignupState {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map()
  };
}

function useCaseStore(): UseCaseStore {
  return {
    findUseCaseWithProject: () => Promise.resolve(undefined)
  } as unknown as UseCaseStore;
}

function preview(): ChangePreview {
  return {
    base_revision: "revision-1",
    diff: [
      {
        after: "Updated title",
        before: "Original title",
        entity_id: "usecase-1",
        entity_type: "USECASE",
        path: "title",
        severity: "NON_BREAKING"
      }
    ],
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    id: "preview-1",
    severity: "NON_BREAKING",
    usecase_id: "usecase-1"
  };
}
