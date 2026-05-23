import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerGoalRoutes } from "../../../src/http/goal-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { GoalStore } from "../../../src/ports/goal-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("goal routes", () => {
  test("rejects malformed goal create requests", async () => {
    const captured = reply();

    await registeredRoutes().create(
      request({ projectId: "project-1" }, { actor_id: "", priority: "P1" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid goal request" });
  });

  test("rejects malformed goal update requests", async () => {
    const captured = reply();

    await registeredRoutes().patch(
      request({ goalId: "goal-1" }, { status: "UNKNOWN" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid goal update" });
  });
});

function registeredRoutes(): Record<"create" | "patch", Handler> {
  const handlers: Partial<Record<"create" | "patch", Handler>> = {};
  const app = {
    get: () => undefined,
    patch: (_path: string, handler: Handler) => {
      handlers.patch = handler;
    },
    post: (_path: string, handler: Handler) => {
      handlers.create = handler;
    }
  } as unknown as FastifyInstance;

  registerGoalRoutes(
    app,
    signupState(),
    {} as ActorStore,
    {} as GoalStore,
    {} as MembershipStore,
    {} as ProjectStore,
    {} as RevisionStore,
    {} as WorkspaceStore
  );

  if (handlers.create === undefined || handlers.patch === undefined) {
    throw new Error("expected goal routes");
  }
  return handlers as Record<"create" | "patch", Handler>;
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
