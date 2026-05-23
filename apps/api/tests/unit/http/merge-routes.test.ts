import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerMergeRoutes } from "../../../src/http/merge-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("merge routes", () => {
  test("rejects malformed open merge requests", async () => {
    const route = registeredRoute();
    const captured = reply();

    await route(request({ source_branch_id: "" }), captured.fastifyReply);

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid merge request" });
  });
});

function registeredRoute() {
  let handler: Handler | undefined;
  const unreachableStore = {} as never;
  const app = {
    post: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerMergeRoutes(
    app,
    signupState(),
    unreachableStore,
    unreachableStore,
    unreachableStore,
    unreachableStore,
    unreachableStore,
    unreachableStore,
    unreachableStore
  );

  if (handler === undefined) {
    throw new Error("expected merge POST route");
  }
  return handler;
}

function request(body: unknown): FastifyRequest {
  return {
    body,
    headers: {}
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
