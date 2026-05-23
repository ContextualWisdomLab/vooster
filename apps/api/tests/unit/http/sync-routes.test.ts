import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerSyncRoutes } from "../../../src/http/sync-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;
type SyncRoute = "pull" | "push";

describe("sync routes", () => {
  test("rejects malformed sync requests", async () => {
    const routes = registeredRoutes();

    for (const check of [
      {
        body: { branch: 1 },
        route: "pull" as const,
        title: "Invalid sync pull request"
      },
      {
        body: { files: [] },
        route: "push" as const,
        title: "Invalid sync push request"
      }
    ]) {
      const captured = reply();

      await routes[check.route](request({ body: check.body }), captured.fastifyReply);

      expect(captured.statusCode).toBe(400);
      expect(captured.body).toMatchObject({ title: check.title });
    }
  });

  test("reports access problems when pulling without membership", async () => {
    const captured = reply();

    await registeredRoutes().pull(request({ body: {} }), captured.fastifyReply);

    expect(captured.statusCode).toBe(403);
    expect(captured.body).toMatchObject({ title: "Not authorized to sync files" });
  });
});

function registeredRoutes(): Record<SyncRoute, Handler> {
  const handlers = {} as Record<SyncRoute, Handler>;
  const app = {
    post: (path: string, routeHandler: Handler) => {
      handlers[routeFrom(path)] = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerSyncRoutes(
    app,
    signupState(),
    {} as ActorStore,
    {} as BranchStore,
    membershipStore(),
    {} as ProjectStore,
    {} as RevisionStore,
    {} as ScenarioStore,
    {} as StakeholderInterestStore,
    {} as StakeholderStore,
    {} as StepStore,
    {} as UseCaseStore
  );

  return handlers;
}

function routeFrom(path: string): SyncRoute {
  return path.endsWith("/pull") ? "pull" : "push";
}

function request(options: { body?: unknown }): FastifyRequest {
  return {
    body: options.body,
    headers: {},
    params: { projectId: "project-1" }
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

function membershipStore(): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined)
  } as unknown as MembershipStore;
}
