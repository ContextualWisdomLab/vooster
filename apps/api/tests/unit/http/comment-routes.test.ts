import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerCommentRoutes } from "../../../src/http/comment-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { CommentStore } from "../../../src/ports/comment-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;
type RouteName = "add" | "delete" | "list" | "patch";

describe("comment routes", () => {
  test("rejects malformed comment bodies", async () => {
    const routes = registeredRoutes();
    const cases: Array<{ body: unknown; route: "add" | "patch" }> = [
      { body: {}, route: "add" },
      { body: { resolved: false }, route: "patch" }
    ];

    for (const item of cases) {
      const captured = reply();

      await routes[item.route](request({ body: item.body }), captured.fastifyReply);

      expect(captured.statusCode).toBe(422);
      expect(captured.body).toMatchObject({ code: "empty_body" });
    }
  });

  test("parses absent dry run query before reporting missing use cases", async () => {
    const captured = reply();

    await registeredRoutes().add(
      request({ body: { body: "Needs review" }, query: null }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(404);
    expect(captured.body).toMatchObject({ title: "Use case not found" });
  });
});

function registeredRoutes(): Record<RouteName, Handler> {
  const handlers = {} as Partial<Record<RouteName, Handler>>;
  const app = {
    delete: (_path: string, handler: Handler) => {
      handlers.delete = handler;
    },
    get: (_path: string, handler: Handler) => {
      handlers.list = handler;
    },
    patch: (_path: string, handler: Handler) => {
      handlers.patch = handler;
    },
    post: (_path: string, handler: Handler) => {
      handlers.add = handler;
    }
  } as unknown as FastifyInstance;

  registerCommentRoutes(
    app,
    signupState(),
    {} as CommentStore,
    {} as MembershipStore,
    useCaseStore()
  );

  for (const name of routeNames) {
    if (handlers[name] === undefined) {
      throw new Error(`expected ${name} comment route`);
    }
  }
  return handlers as Record<RouteName, Handler>;
}

const routeNames = ["add", "delete", "list", "patch"] as const;

function request(options: { body?: unknown; query?: unknown }): FastifyRequest {
  return {
    body: options.body,
    headers: {},
    params: { commentId: "comment-1", usecaseId: "missing-usecase" },
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
