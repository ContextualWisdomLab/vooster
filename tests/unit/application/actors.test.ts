import { describe, expect, test } from "vitest";
import { defineActor } from "../../../src/application/actors.js";
import type { StoredActor, StoredRevision } from "../../../src/http/signup-types.js";
import { actor, actorInput, depsFor } from "./actors-fixtures.js";

describe("actor definition application", () => {
  test("creates an actor with an initial revision", async () => {
    const savedActors: StoredActor[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await defineActor(
      depsFor({ savedActors, savedRevisions }),
      actorInput()
    );

    expect(result).toEqual({
      actor: {
        aliases: ["Buyer"],
        archived_at: null,
        description: "Person buying a product.",
        id: "id-1",
        is_human: true,
        name: "Customer",
        project_id: "project-1",
        type: "PRIMARY"
      },
      recommendedNextCommand: "vspec stakeholder create",
      revision: {
        entity_id: "id-1",
        entity_type: "ACTOR",
        id: "id-2",
        snapshot: {
          aliases: ["Buyer"],
          archived_at: null,
          description: "Person buying a product.",
          id: "id-1",
          is_human: true,
          name: "Customer",
          project_id: "project-1",
          type: "PRIMARY"
        },
        version_number: 1
      },
      status: "CREATED"
    });
    expect(savedActors).toHaveLength(1);
    expect(savedRevisions).toHaveLength(1);
  });

  test("rejects callers without project membership before checking name conflicts", async () => {
    const nameLookups: string[] = [];

    const result = await defineActor(
      depsFor({ membership: null, nameLookups }),
      actorInput({ userId: "outsider" })
    );

    expect(result).toEqual({ status: "FORBIDDEN" });
    expect(nameLookups).toEqual([]);
  });

  test("rejects read-only members without writes", async () => {
    const savedActors: StoredActor[] = [];

    const result = await defineActor(
      depsFor({
        readOnlyMemberships: new Set(["user-1:workspace-1"]),
        savedActors
      }),
      actorInput()
    );

    expect(result).toEqual({ status: "READ_ONLY" });
    expect(savedActors).toEqual([]);
  });

  test("rejects the reserved System actor name", async () => {
    await expect(
      defineActor(depsFor(), actorInput({ name: "System" }))
    ).resolves.toEqual({
      status: "SYSTEM_RESERVED"
    });
  });

  test("rejects active duplicate actor names", async () => {
    const existingActor = actor({ id: "actor-existing" });

    await expect(
      defineActor(depsFor({ existingActor }), actorInput())
    ).resolves.toEqual({
      existingActor,
      requestedName: "Customer",
      status: "ACTIVE_NAME_CONFLICT"
    });
  });

  test("rejects archived duplicate actor names", async () => {
    const existingActor = actor({
      archived_at: "2026-05-20T00:00:00.000Z",
      id: "actor-archived"
    });

    await expect(
      defineActor(depsFor({ existingActor }), actorInput())
    ).resolves.toEqual({
      existingActor,
      status: "ARCHIVED_NAME_CONFLICT"
    });
  });
});
