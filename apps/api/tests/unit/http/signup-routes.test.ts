import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerSignupRoutes } from "../../../src/http/signup-routes.js";
import type { ServerOptions, SignupState } from "../../../src/http/signup-types.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { UserStore } from "../../../src/ports/user-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;
type RouteName = "callback" | "start";

describe("signup routes", () => {
  test("rejects malformed signup start requests", async () => {
    const captured = reply();

    await registeredRoutes().start(
      request({ body: { workspace: {} } }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid signup request" });
  });

  test("rejects malformed OAuth callbacks", async () => {
    const captured = reply();

    await registeredRoutes().callback(
      request({ query: { code: "", state: "state-1" } }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid OAuth callback" });
  });

  test("uses signup denial guidance when pending OAuth is absent", async () => {
    const captured = reply();

    await registeredRoutes().callback(
      request({ query: { error: "access_denied", state: "state-1" } }),
      captured.fastifyReply
    );

    expect(captured.headers["set-cookie"]).toContain("vspec_oauth_state=;");
    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "GitHub authorization denied" });
  });
});

function registeredRoutes(): Record<RouteName, Handler> {
  const handlers: Partial<Record<RouteName, Handler>> = {};
  const app = {
    get: (_path: string, handler: Handler) => {
      handlers.callback = handler;
    },
    post: (_path: string, handler: Handler) => {
      handlers.start = handler;
    }
  } as unknown as FastifyInstance;

  registerSignupRoutes(
    app,
    {} as ServerOptions,
    signupState(),
    {} as MembershipStore,
    {} as UserStore,
    {} as WorkspaceStore
  );

  if (handlers.callback === undefined || handlers.start === undefined) {
    throw new Error("expected signup routes");
  }
  return handlers as Record<RouteName, Handler>;
}

function request(options: { body?: unknown; query?: unknown }): FastifyRequest {
  return { body: options.body, headers: {}, query: options.query } as FastifyRequest;
}

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    headers: Record<string, string>;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply,
    headers: {}
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    header: (name: string, value: string) => {
      captured.headers[name.toLowerCase()] = value;
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
