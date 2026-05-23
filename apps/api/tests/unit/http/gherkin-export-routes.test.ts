import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerGherkinExportRoutes } from "../../../src/http/gherkin-export-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("Gherkin export routes", () => {
  test("rejects malformed export requests", async () => {
    const captured = reply();

    await registeredRoute()(request({ force: "yes" }), captured.fastifyReply);

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({
      title: "Invalid Gherkin export request"
    });
  });
});

function registeredRoute(): Handler {
  let handler: Handler | undefined;
  const app = {
    post: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerGherkinExportRoutes(
    app,
    signupState(),
    {} as ActorStore,
    {} as MembershipStore,
    {} as RevisionStore,
    {} as UseCaseStore,
    {} as ScenarioStore,
    {} as StepStore
  );

  if (handler === undefined) {
    throw new Error("expected Gherkin export route");
  }
  return handler;
}

function request(body: unknown): FastifyRequest {
  return {
    body,
    headers: {},
    params: { id: "usecase-1" }
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
