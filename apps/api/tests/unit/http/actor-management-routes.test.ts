import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredActor } from "../../../src/domain/entities/index.js";
import { patchActor } from "../../../src/http/actor-management-routes.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";

// NOTE: This defensive branch ("actor store has no updateActor configured")
// cannot be reproduced against the real server: the wired in-memory actor store
// always provides updateActor. It therefore stays a unit test. Every other
// actor-management behavior (list active only, show + 404, partial patch,
// invalid patch 400, patch missing 404, archive + 404) is covered by
// tests/integration/http/actor-management-route.test.ts.
describe("actor management routes", () => {
  test("rejects patches when updates are not configured", async () => {
    const captured = reply();

    await patchActor(
      request({ body: { description: "Updated" } }),
      captured.fastifyReply,
      actorStore([actor()])
    );

    expect(captured.statusCode).toBe(500);
    expect(captured.body).toMatchObject({
      title: "Actor updates are not configured"
    });
  });
});

function request(options: { body?: unknown } = {}): FastifyRequest {
  return {
    body: options.body,
    params: { actorId: "actor-1", projectId: "project-1" }
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

function actorStore(actors: StoredActor[]): ActorStore {
  return {
    archiveActor: () => Promise.resolve(false),
    findActorById: (_projectId, actorId) =>
      Promise.resolve(actors.find((actor) => actor.id === actorId)),
    findActorByName: () => Promise.resolve(undefined),
    listActors: () => Promise.resolve(actors),
    saveActor: () => Promise.resolve()
  };
}

function actor(): StoredActor {
  return {
    aliases: ["customer"],
    archived_at: null,
    description: "Places orders",
    id: "actor-1",
    is_human: true,
    name: "Buyer",
    project_id: "project-1",
    type: "PRIMARY"
  };
}
