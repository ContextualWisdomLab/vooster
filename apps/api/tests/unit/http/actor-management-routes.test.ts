import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredActor } from "../../../src/domain/entities/index.js";
import {
  archiveActor,
  listActors,
  patchActor,
  showActor
} from "../../../src/http/actor-management-routes.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";

describe("actor management routes", () => {
  test("lists only active actors", async () => {
    const captured = reply();

    await listActors(
      request(),
      captured.fastifyReply,
      actorStore([
        actor({ id: "actor-1", name: "Buyer" }),
        actor({ archived_at: "2026-05-23T00:00:00Z", id: "archived" })
      ])
    );

    expect(captured.body).toMatchObject({
      items: [{ id: "actor-1", name: "Buyer" }]
    });
  });

  test("shows actors and reports missing records", async () => {
    const shown = reply();
    await showActor(request(), shown.fastifyReply, actorStore([actor()]));

    expect(shown.body).toEqual({
      actor: {
        aliases: ["customer"],
        description: "Places orders",
        id: "actor-1",
        name: "Buyer",
        type: "PRIMARY"
      }
    });

    const missing = reply();
    await showActor(request(), missing.fastifyReply, actorStore([]));

    expect(missing.statusCode).toBe(404);
    expect(missing.body).toMatchObject({ title: "Actor not found" });
  });

  test("patches actors with partial updates", async () => {
    const captured = reply();
    const updatedActors: StoredActor[] = [];

    await patchActor(
      request({ body: { aliases: ["shopper"], is_human: false, type: "SUPPORTING" } }),
      captured.fastifyReply,
      actorStore([actor()], { updateActor: captureUpdates(updatedActors) })
    );

    expect(updatedActors).toEqual([
      {
        ...actor(),
        aliases: ["shopper"],
        is_human: false,
        type: "SUPPORTING"
      }
    ]);
    expect(captured.body).toMatchObject({
      actor: { aliases: ["shopper"], id: "actor-1", type: "SUPPORTING" }
    });
  });

  test("rejects invalid patch payloads", async () => {
    const captured = reply();

    await patchActor(
      request({ body: { name: "" } }),
      captured.fastifyReply,
      actorStore([actor()], { updateActor: () => Promise.resolve() })
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid actor update" });
  });

  test("requires existing actors and configured updates", async () => {
    const missing = reply();
    await patchActor(
      request({ body: { description: "Updated" } }),
      missing.fastifyReply,
      actorStore([])
    );

    expect(missing.statusCode).toBe(404);
    expect(missing.body).toMatchObject({ title: "Actor not found" });

    const disabled = reply();
    await patchActor(
      request({ body: { description: "Updated" } }),
      disabled.fastifyReply,
      actorStore([actor()])
    );

    expect(disabled.statusCode).toBe(500);
    expect(disabled.body).toMatchObject({
      title: "Actor updates are not configured"
    });
  });

  test("archives actors and reports missing archives", async () => {
    const archived = reply();

    await archiveActor(
      request(),
      archived.fastifyReply,
      actorStore([actor()], { archiveResult: true })
    );

    expect(archived.body).toEqual({ actor: { id: "actor-1" }, archived: true });

    const missing = reply();
    await archiveActor(request(), missing.fastifyReply, actorStore([]));

    expect(missing.statusCode).toBe(404);
    expect(missing.body).toMatchObject({ title: "Actor not found" });
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

function actorStore(
  actors: StoredActor[],
  options: Partial<ActorStore> & { archiveResult?: boolean } = {}
): ActorStore {
  return {
    archiveActor: () => Promise.resolve(options.archiveResult ?? false),
    findActorById: (_projectId, actorId) =>
      Promise.resolve(actors.find((actor) => actor.id === actorId)),
    findActorByName: () => Promise.resolve(undefined),
    listActors: () => Promise.resolve(actors),
    saveActor: () => Promise.resolve(),
    ...options
  };
}

function captureUpdates(target: StoredActor[]) {
  return (updated: StoredActor) => {
    target.push(updated);
    return Promise.resolve();
  };
}

function actor(overrides: Partial<StoredActor> = {}): StoredActor {
  return {
    aliases: ["customer"],
    archived_at: null,
    description: "Places orders",
    id: "actor-1",
    is_human: true,
    name: "Buyer",
    project_id: "project-1",
    type: "PRIMARY",
    ...overrides
  };
}
