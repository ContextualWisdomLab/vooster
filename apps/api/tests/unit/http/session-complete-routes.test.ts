import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerSessionCompleteRoutes } from "../../../src/http/session-complete-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { MergeRequestStore } from "../../../src/ports/merge-request-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("session completion routes", () => {
  test("rejects malformed completion requests", async () => {
    const captured = reply();

    await registeredRoute()(request({ no_merge: "yes" }), captured.fastifyReply);

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({
      title: "Invalid session completion request"
    });
  });
});

function registeredRoute(): Handler {
  let handler: Handler | undefined;
  const app = {
    post: (_path: string, next: Handler) => {
      handler = next;
    }
  } as unknown as FastifyInstance;

  registerSessionCompleteRoutes(
    app,
    signupState(),
    {} as BranchStore,
    {} as LockStore,
    {} as MembershipStore,
    {} as MergeRequestStore,
    {} as ProjectStore,
    {} as WorkSessionStore
  );

  if (handler === undefined) {
    throw new Error("expected session completion route");
  }
  return handler;
}

function request(body: unknown): FastifyRequest {
  return {
    body,
    params: { sessionId: "session-1" }
  } as unknown as FastifyRequest;
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
