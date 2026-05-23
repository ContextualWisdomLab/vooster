import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerMarkdownExportRoutes } from "../../../src/http/markdown-export-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import { depsFor } from "../application/markdown-export-fixtures.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("markdown export routes", () => {
  test("rejects malformed export requests", async () => {
    const routes = registeredRoutes();
    const captured = reply();

    await routes.post(
      request({ body: { force: "yes" }, cookie: "vspec_session=token-1" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({
      title: "Invalid markdown export request"
    });
  });

  test("rejects export without project membership", async () => {
    const routes = registeredRoutes();
    const captured = reply();

    await routes.post(request({}), captured.fastifyReply);

    expect(captured.statusCode).toBe(403);
    expect(captured.body).toMatchObject({
      title: "Not authorized to export markdown"
    });
  });

  test("reports missing use cases", async () => {
    const routes = registeredRoutes({ usecase: null });
    const captured = reply();

    await routes.post(
      request({ body: {}, cookie: "vspec_session=token-1" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(404);
    expect(captured.body).toMatchObject({ title: "Use case not found" });
  });
});

function registeredRoutes(options: Parameters<typeof depsFor>[0] = {}) {
  const handlers: { post?: Handler } = {};
  const app = {
    post: (_path: string, handler: Handler) => {
      handlers.post = handler;
    }
  } as unknown as FastifyInstance;
  const deps = depsFor(options);

  registerMarkdownExportRoutes(
    app,
    signupState(),
    deps.actorStore,
    deps.membershipStore,
    deps.revisionStore,
    deps.useCaseStore,
    deps.scenarioStore,
    deps.stakeholderInterestStore,
    deps.stakeholderStore,
    deps.stepStore
  );

  if (handlers.post === undefined) {
    throw new Error("expected markdown export POST route");
  }
  return { post: handlers.post };
}

function request(options: { body?: unknown; cookie?: string }): FastifyRequest {
  return {
    body: options.body,
    headers: { cookie: options.cookie },
    params: { id: "usecase-1" }
  } as FastifyRequest;
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
    sessionsByToken: new Map([["token-1", "user-1"]])
  };
}
