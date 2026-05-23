import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerImpactRoutes } from "../../../src/http/impact-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("impact routes", () => {
  test("rejects malformed impact preview requests", async () => {
    const captured = reply();

    await registeredRoute()(
      request({
        base_revision: "revision-1",
        entity_id: "usecase-1",
        entity_type: "PROJECT"
      }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({
      title: "Invalid impact preview request"
    });
  });
});

function registeredRoute(): Handler {
  let handler: Handler | undefined;
  const app = {
    post: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerImpactRoutes(
    app,
    signupState(),
    {} as LockStore,
    {} as MembershipStore,
    {} as RevisionStore,
    {} as WorkSessionStore,
    {} as UseCaseStore
  );

  if (handler === undefined) {
    throw new Error("expected impact route");
  }
  return handler;
}

function request(body: unknown): FastifyRequest {
  return { body, headers: {} } as FastifyRequest;
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
