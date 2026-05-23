import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerUseCaseUpdateRoutes } from "../../../src/http/usecase-update-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("use case update routes", () => {
  test("rejects malformed use case updates", async () => {
    const captured = reply();

    await registeredRoute()(
      request({ body: { status: "UNKNOWN" } }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid use case update" });
  });
});

function registeredRoute(): Handler {
  let handler: Handler | undefined;
  const app = {
    patch: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerUseCaseUpdateRoutes(
    app,
    signupState(),
    {} as BranchStore,
    {} as MembershipStore,
    {} as ProjectStore,
    {} as RevisionStore,
    {} as StakeholderInterestStore,
    {} as UseCaseStore
  );

  if (handler === undefined) {
    throw new Error("expected use case update route");
  }
  return handler;
}

function request(options: { body?: unknown }): FastifyRequest {
  return {
    body: options.body,
    headers: {},
    params: { usecaseId: "usecase-1" }
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
