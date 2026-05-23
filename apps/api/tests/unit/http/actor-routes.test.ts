import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { registerActorRoutes } from "../../../src/http/actor-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("actor routes", () => {
  test("rejects malformed actor create requests", async () => {
    for (const check of [
      {
        body: { is_human: true, name: "", type: "PRIMARY" },
        title: "Invalid actor request"
      },
      {
        body: validActor({ type: "UNKNOWN" }),
        title: "Invalid actor type"
      }
    ]) {
      const captured = reply();

      await registeredRoute()(request({ body: check.body }), captured.fastifyReply);

      expect(captured.statusCode).toBe(400);
      expect(captured.body).toMatchObject({ title: check.title });
    }
  });

  test("parses dry run queries while checking access", async () => {
    for (const query of [undefined, { dry_run: "false" }]) {
      const captured = reply();

      await registeredRoute()(
        request({ body: validActor(), query }),
        captured.fastifyReply
      );

      expect(captured.statusCode).toBe(403);
      expect(captured.body).toMatchObject({
        title: "Contact the workspace owner for access"
      });
    }
  });
});

function registeredRoute(): Handler {
  let handler: Handler | undefined;
  const app = {
    delete: () => undefined,
    get: () => undefined,
    patch: () => undefined,
    post: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerActorRoutes(
    app,
    signupState(),
    {} as ActorStore,
    {} as MembershipStore,
    {} as RevisionStore
  );

  if (handler === undefined) {
    throw new Error("expected actor create route");
  }
  return handler;
}

function request(options: { body?: unknown; query?: unknown }): FastifyRequest {
  return {
    body: options.body,
    headers: {},
    params: { projectId: "project-1" },
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

function validActor(overrides: { type?: string } = {}) {
  return {
    is_human: true,
    name: "Customer",
    type: overrides.type ?? "PRIMARY"
  };
}
