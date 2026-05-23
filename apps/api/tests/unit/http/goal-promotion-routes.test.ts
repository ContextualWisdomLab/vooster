import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerGoalPromotionRoutes } from "../../../src/http/goal-promotion-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { GoalStore } from "../../../src/ports/goal-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("goal promotion routes", () => {
  test("rejects malformed promotion requests", async () => {
    const captured = reply();

    await registeredRoute()(
      request({ body: { simulate_usecase_insert_failure: "yes" } }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid promotion request" });
  });
});

function registeredRoute(): Handler {
  let handler: Handler | undefined;
  const app = {
    post: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerGoalPromotionRoutes(
    app,
    signupState(),
    {} as GoalStore,
    {} as MembershipStore,
    {} as ProjectStore,
    {} as RevisionStore,
    {} as UseCaseStore
  );

  if (handler === undefined) {
    throw new Error("expected goal promotion route");
  }
  return handler;
}

function request(options: { body?: unknown }): FastifyRequest {
  return {
    body: options.body,
    headers: {},
    params: { goalId: "goal-1" }
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
