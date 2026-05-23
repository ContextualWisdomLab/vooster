import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerUseCaseTestRoutes } from "../../../src/http/usecase-test-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("usecase test routes", () => {
  test("reports missing use cases when archiving", async () => {
    const captured = reply();

    await registeredRoute()(
      request({ params: { usecaseId: "missing-usecase" } }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(404);
    expect(captured.body).toMatchObject({ title: "Use case not found" });
  });
});

function registeredRoute(): Handler {
  let handler: Handler | undefined;
  const app = {
    post: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerUseCaseTestRoutes(app, signupState(), useCaseStore());

  if (handler === undefined) {
    throw new Error("expected usecase test route");
  }
  return handler;
}

function request(options: { params?: unknown }): FastifyRequest {
  return {
    params: options.params
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
