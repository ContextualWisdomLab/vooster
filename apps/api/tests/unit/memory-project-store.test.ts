import { describe, expect, test } from "vitest";
import type { StoredProject } from "../../src/domain/entities/index.js";
import { createMemoryProjectStore } from "../../src/infrastructure/memory-project-store.js";

describe("memory project store", () => {
  test("stores, finds, updates, lists, and deletes projects", async () => {
    const store = createMemoryProjectStore();
    const first = project({ id: "project-1", key: "PAY" });
    const second = project({ id: "project-2", key: "CRM" });
    const otherWorkspace = project({
      id: "project-3",
      key: "PAY",
      workspace_id: "workspace-2"
    });

    await store.saveProject(first);
    await store.saveProject(second);
    await store.saveProject(otherWorkspace);

    expect(await store.findProjectById("project-1")).toEqual(first);
    expect(await store.findProjectByWorkspaceAndKey("workspace-1", "PAY")).toEqual(
      first
    );
    expect(await store.listProjectsForWorkspace("workspace-1")).toEqual([
      first,
      second
    ]);

    await expect(
      store.updateProjectName("project-missing", "Missing")
    ).resolves.toBeUndefined();
    await expect(store.updateProjectName("project-1", "Payments")).resolves.toEqual({
      ...first,
      name: "Payments"
    });
    await expect(store.deleteProject("project-missing")).resolves.toBe("NOT_FOUND");
    await expect(store.deleteProject("project-2")).resolves.toBe("DELETED");
    await expect(store.findProjectById("project-2")).resolves.toBeUndefined();
  });
});

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "PAY",
    name: "Payments",
    visibility: "PRIVATE",
    workspace_id: "workspace-1",
    ...overrides
  };
}
