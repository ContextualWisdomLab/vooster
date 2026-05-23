import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerScenarioRoutes } from "../../../src/http/scenario-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;
type RouteName = "create" | "step";

describe("scenario routes", () => {
  test("rejects malformed scenario and step requests", async () => {
    const routes = registeredRoutes();
    const cases: Array<{
      body: unknown;
      route: RouteName;
      title: string;
    }> = [
      {
        body: { type: "SIDE_QUEST" },
        route: "create",
        title: "Invalid scenario request"
      },
      {
        body: { action: "Pay invoice", actor: "" },
        route: "step",
        title: "Invalid step request"
      },
      {
        body: { action: "   ", actor: "Customer" },
        route: "step",
        title: "Step action is required"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      await routes[item.route](request({ body: item.body }), captured.fastifyReply);

      expect(captured.statusCode).toBe(400);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("parses absent dry run query before reporting missing use cases", async () => {
    for (const body of [{ type: "MAIN_SUCCESS" }, { type: "EXTENSION" }]) {
      const captured = reply();

      await registeredRoutes().create(
        request({ body, query: null }),
        captured.fastifyReply
      );

      expect(captured.statusCode).toBe(404);
      expect(captured.body).toMatchObject({ title: "Use case not found" });
    }
  });
});

function registeredRoutes(): Record<RouteName, Handler> {
  const handlers = {} as Partial<Record<RouteName, Handler>>;
  const app = {
    post: (path: string, handler: Handler) => {
      handlers[path.includes("/steps") ? "step" : "create"] = handler;
    }
  } as unknown as FastifyInstance;

  registerScenarioRoutes(
    app,
    signupState(),
    {} as ActorStore,
    {} as MembershipStore,
    {} as ScenarioStore,
    {} as RevisionStore,
    {} as StakeholderInterestStore,
    {} as StepStore,
    useCaseStore()
  );

  for (const name of routeNames) {
    if (handlers[name] === undefined) {
      throw new Error(`expected ${name} scenario route`);
    }
  }
  return handlers as Record<RouteName, Handler>;
}

const routeNames = ["create", "step"] as const;

function request(options: { body?: unknown; query?: unknown }): FastifyRequest {
  return {
    body: options.body,
    headers: {},
    params: { scenarioId: "scenario-1", usecaseId: "missing-usecase" },
    query: options.query
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

function useCaseStore(): UseCaseStore {
  return {
    findUseCaseWithProject: () => Promise.resolve(undefined)
  } as unknown as UseCaseStore;
}
