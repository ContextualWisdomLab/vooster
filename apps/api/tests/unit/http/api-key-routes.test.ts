import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerApiKeyRoutes } from "../../../src/http/api-key-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { ApiKeyStore } from "../../../src/ports/api-key-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;
type RouteName = "create" | "list" | "revoke";

describe("api key routes", () => {
  test("rejects malformed API key requests", async () => {
    const routes = registeredRoutes();
    const cases: Array<{
      query?: unknown;
      body?: unknown;
      route: RouteName;
      title: string;
    }> = [
      {
        body: { name: "", scopes: [], workspace_id: "workspace-1" },
        route: "create",
        title: "Invalid API key request"
      },
      {
        query: {},
        route: "list",
        title: "Invalid API key list request"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      await routes[item.route](request(item), captured.fastifyReply);

      expect(captured.statusCode).toBe(400);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });
});

function registeredRoutes(): Record<RouteName, Handler> {
  const handlers = {} as Partial<Record<RouteName, Handler>>;
  const app = {
    delete: (_path: string, handler: Handler) => {
      handlers.revoke = handler;
    },
    get: (_path: string, handler: Handler) => {
      handlers.list = handler;
    },
    post: (_path: string, handler: Handler) => {
      handlers.create = handler;
    }
  } as unknown as FastifyInstance;

  registerApiKeyRoutes(app, signupState(), {} as MembershipStore, {} as ApiKeyStore);

  for (const name of routeNames) {
    if (handlers[name] === undefined) {
      throw new Error(`expected ${name} api key route`);
    }
  }
  return handlers as Record<RouteName, Handler>;
}

const routeNames = ["create", "list", "revoke"] as const;

function request(options: { body?: unknown; query?: unknown }): FastifyRequest {
  return {
    body: options.body,
    headers: {},
    params: { id: "key-1" },
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
