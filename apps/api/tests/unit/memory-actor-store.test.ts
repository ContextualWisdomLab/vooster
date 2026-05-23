import { describe, expect, test } from "vitest";
import type { StoredActor } from "../../src/domain/entities/index.js";
import { createMemoryActorStore } from "../../src/infrastructure/memory-actor-store.js";

describe("memory actor store", () => {
  test("returns empty results and failed archives for unknown projects", async () => {
    const store = createMemoryActorStore();

    await expect(store.listActors("project-1")).resolves.toEqual([]);
    await expect(store.findActorById("project-1", "actor-1")).resolves.toBeUndefined();
    await expect(store.findActorByName("project-1", "Buyer")).resolves.toBeUndefined();
    await expect(
      store.archiveActor("project-1", "actor-1", "2026-05-23T10:00:00Z")
    ).resolves.toBe(false);
  });

  test("stores, finds, lists, updates, and archives actors within a project", async () => {
    const store = createMemoryActorStore();
    const buyer = actor({ id: "actor-1", name: "Buyer" });
    const support = actor({ id: "actor-2", name: "Support" });
    const otherProject = actor({
      id: "actor-3",
      name: "Buyer",
      project_id: "project-2"
    });

    await store.saveActor(buyer);
    await store.saveActor(support);
    await store.saveActor(otherProject);

    expect(await store.listActors("project-1")).toEqual([buyer, support]);
    expect(await store.findActorById("project-1", "actor-1")).toEqual(buyer);
    expect(await store.findActorByName("project-1", "Buyer")).toEqual(buyer);
    expect(await store.findActorByName("project-2", "Buyer")).toEqual(otherProject);

    const updated = { ...buyer, aliases: ["customer"] };
    const updateActor = store.updateActor;
    expect(updateActor).toBeDefined();
    if (updateActor === undefined) {
      throw new Error("memory store must support actor updates");
    }
    await updateActor(updated);

    expect(await store.listActors("project-1")).toEqual([updated, support]);
    await expect(
      store.archiveActor("project-1", "actor-1", "2026-05-23T10:00:00Z")
    ).resolves.toBe(true);
    expect(await store.findActorById("project-1", "actor-1")).toMatchObject({
      archived_at: "2026-05-23T10:00:00Z"
    });
  });

  test("ignores updates for missing actors", async () => {
    const store = createMemoryActorStore();
    const buyer = actor({ id: "actor-1", name: "Buyer" });

    await store.saveActor(buyer);
    const updateActor = store.updateActor;
    expect(updateActor).toBeDefined();
    if (updateActor === undefined) {
      throw new Error("memory store must support actor updates");
    }
    await updateActor(actor({ id: "actor-missing", name: "Missing" }));
    await updateActor(
      actor({ id: "actor-other-project", name: "Other", project_id: "project-missing" })
    );

    expect(await store.listActors("project-1")).toEqual([buyer]);
    expect(await store.listActors("project-missing")).toEqual([]);
  });
});

function actor(overrides: Partial<StoredActor> = {}): StoredActor {
  return {
    aliases: [],
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
