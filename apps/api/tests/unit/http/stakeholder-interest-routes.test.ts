import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerStakeholderInterestRoutes } from "../../../src/http/stakeholder-interest-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("stakeholder interest routes", () => {
  test("rejects malformed stakeholder interest requests", async () => {
    const captured = reply();

    await registeredRoute()(
      request({ interest: "", stakeholder: "Buyer" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({
      title: "Invalid stakeholder interest request"
    });
  });
});

function registeredRoute(): Handler {
  let handler: Handler | undefined;
  const app = {
    delete: () => undefined,
    post: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerStakeholderInterestRoutes(
    app,
    signupState(),
    {} as MembershipStore,
    {} as RevisionStore,
    {} as StakeholderInterestStore,
    {} as StakeholderStore,
    {} as UseCaseStore
  );

  if (handler === undefined) {
    throw new Error("expected stakeholder interest route");
  }
  return handler;
}

function request(body: unknown): FastifyRequest {
  return {
    body,
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
