import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerRevisionDiffRoutes } from "../../../src/http/revision-diff-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("revision diff routes", () => {
  test("rejects malformed diff requests", async () => {
    const captured = reply();

    await registeredRoute()(request({ from: "rev-1", to: "" }), captured.fastifyReply);

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid diff request" });
  });

  test("reports missing use cases", async () => {
    const captured = reply();

    await registeredRoute()(
      request({ format: "json", from: "rev-1", to: "rev-2" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(404);
    expect(captured.body).toMatchObject({ title: "Use case not found" });
  });
});

function registeredRoute(): Handler {
  let handler: Handler | undefined;
  const app = {
    get: (_path: string, next: Handler) => {
      handler = next;
    }
  } as unknown as FastifyInstance;

  registerRevisionDiffRoutes(
    app,
    signupState(),
    {} as BranchStore,
    {} as MembershipStore,
    {} as RevisionStore,
    useCaseStore()
  );

  if (handler === undefined) {
    throw new Error("expected revision diff route");
  }
  return handler;
}

function request(query: unknown): FastifyRequest {
  return {
    headers: {},
    params: { usecaseId: "missing-usecase" },
    query
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
