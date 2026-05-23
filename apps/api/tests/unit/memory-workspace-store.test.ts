import { describe, expect, test } from "vitest";
import type { StoredWorkspace } from "../../src/domain/entities/index.js";
import { createMemoryWorkspaceStore } from "../../src/infrastructure/memory-workspace-store.js";

describe("memory workspace store", () => {
  test("stores, archives, and checks workspace slugs", async () => {
    const store = createMemoryWorkspaceStore();
    const workspace = storedWorkspace({ id: "workspace-1", slug: "team" });
    const colliding = storedWorkspace({ id: "workspace-2", slug: "team-2" });
    const secondCollision = storedWorkspace({ id: "workspace-3", slug: "team-3" });

    await store.saveWorkspace(workspace);
    await store.saveWorkspace(colliding);
    await store.saveWorkspace(secondCollision);

    expect(await store.findWorkspaceById("workspace-1")).toEqual(workspace);
    expect(await store.workspaceSlugExists("team")).toBe(true);
    expect(await store.workspaceSlugExists("missing")).toBe(false);
    expect(await store.nextAvailableWorkspaceSlug("team")).toBe("team-4");

    await store.archiveWorkspace("workspace-1", "2026-05-23T10:00:00Z");

    expect(await store.isWorkspaceArchived("workspace-1")).toBe(true);
    expect(await store.isWorkspaceArchived("workspace-missing")).toBe(false);
  });
});

function storedWorkspace(overrides: Partial<StoredWorkspace> = {}): StoredWorkspace {
  return {
    archived_at: null,
    id: "workspace-1",
    name: "Team",
    owner_id: "user-1",
    plan: "FREE",
    slug: "team",
    ...overrides
  };
}
