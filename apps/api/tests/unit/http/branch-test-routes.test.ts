import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerBranchTestRoutes } from "../../../src/http/branch-test-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;
type RouteName = "branchExtension" | "branchUseCase" | "mainExtension" | "mainUseCase";

describe("branch test routes", () => {
  test("rejects malformed helper requests", async () => {
    const routes = registeredRoutes();
    const cases: Array<{
      body: unknown;
      route: RouteName;
      title: string;
    }> = [
      {
        body: { severity: "NOPE", title: "Branch title" },
        route: "branchUseCase",
        title: "Invalid branch revision request"
      },
      {
        body: { condition: "", extension_point: "1a" },
        route: "branchExtension",
        title: "Invalid branch extension request"
      },
      {
        body: { severity: "BREAKING", title: "" },
        route: "mainUseCase",
        title: "Invalid main revision request"
      },
      {
        body: { condition: "Alternate flow", extension_point: "" },
        route: "mainExtension",
        title: "Invalid main extension request"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      await routes[item.route](request(item.body), captured.fastifyReply);

      expect(captured.statusCode).toBe(400);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("reports missing branch use cases", async () => {
    const routes = registeredRoutes();
    const captured = reply();

    await routes.branchUseCase(
      request({ severity: "BREAKING", title: "Missing branch use case" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(404);
    expect(captured.body).toMatchObject({ title: "Branch use case not found" });
  });
});

function registeredRoutes(): Record<RouteName, Handler> {
  const handlers = {} as Partial<Record<RouteName, Handler>>;
  const app = {
    post: (path: string, handler: Handler) => {
      handlers[routeName(path)] = handler;
    }
  } as unknown as FastifyInstance;

  registerBranchTestRoutes(
    app,
    signupState(),
    branchStore(),
    {} as ProjectStore,
    {} as RevisionStore,
    useCaseStore()
  );

  for (const name of routeNames) {
    if (handlers[name] === undefined) {
      throw new Error(`expected ${name} route`);
    }
  }
  return handlers as Record<RouteName, Handler>;
}

const routeNames = [
  "branchExtension",
  "branchUseCase",
  "mainExtension",
  "mainUseCase"
] as const;

function routeName(path: string): RouteName {
  if (path.includes("/branches/") && path.endsWith("/extensions")) {
    return "branchExtension";
  }
  if (path.includes("/branches/")) {
    return "branchUseCase";
  }
  if (path.endsWith("/extensions")) {
    return "mainExtension";
  }
  return "mainUseCase";
}

function request(body: unknown): FastifyRequest {
  return {
    body,
    params: { branchId: "missing-branch", usecaseId: "usecase-1" }
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

function branchStore(): BranchStore {
  return {
    findBranchById: () => Promise.resolve(undefined)
  } as unknown as BranchStore;
}

function useCaseStore(): UseCaseStore {
  return {
    findUseCaseWithProject: () => Promise.resolve(undefined)
  } as unknown as UseCaseStore;
}

function signupState(): SignupState {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map()
  };
}
