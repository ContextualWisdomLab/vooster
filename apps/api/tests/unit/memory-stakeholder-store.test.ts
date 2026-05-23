import { describe, expect, test } from "vitest";
import type { StoredStakeholder } from "../../src/domain/entities/index.js";
import { createMemoryStakeholderStore } from "../../src/infrastructure/memory-stakeholder-store.js";

describe("memory stakeholder store", () => {
  test("returns empty results for unknown projects", async () => {
    const store = createMemoryStakeholderStore();

    await expect(store.listStakeholders("project-1")).resolves.toEqual([]);
    await expect(
      store.findStakeholderById("project-1", "stakeholder-1")
    ).resolves.toBeUndefined();
    await expect(
      store.findStakeholderByName("project-1", "Compliance")
    ).resolves.toBeUndefined();
  });

  test("stores, finds, lists, and updates stakeholders within a project", async () => {
    const store = createMemoryStakeholderStore();
    const compliance = stakeholder({ id: "stakeholder-1", name: "Compliance" });
    const support = stakeholder({ id: "stakeholder-2", name: "Support" });
    const otherProject = stakeholder({
      id: "stakeholder-3",
      name: "Compliance",
      project_id: "project-2"
    });

    await store.saveStakeholder(compliance);
    await store.saveStakeholder(support);
    await store.saveStakeholder(otherProject);

    expect(await store.listStakeholders("project-1")).toEqual([compliance, support]);
    expect(await store.findStakeholderById("project-1", "stakeholder-1")).toEqual(
      compliance
    );
    expect(await store.findStakeholderByName("project-1", "Compliance")).toEqual(
      compliance
    );
    expect(await store.findStakeholderByName("project-2", "Compliance")).toEqual(
      otherProject
    );

    const updated = { ...compliance, description: "Reviews payment compliance" };
    const updateStakeholder = store.updateStakeholder;
    expect(updateStakeholder).toBeDefined();
    if (updateStakeholder === undefined) {
      throw new Error("memory store must support stakeholder updates");
    }
    await updateStakeholder(updated);

    expect(await store.listStakeholders("project-1")).toEqual([updated, support]);
  });

  test("ignores updates for missing stakeholders", async () => {
    const store = createMemoryStakeholderStore();
    const compliance = stakeholder({ id: "stakeholder-1", name: "Compliance" });

    await store.saveStakeholder(compliance);
    const updateStakeholder = store.updateStakeholder;
    expect(updateStakeholder).toBeDefined();
    if (updateStakeholder === undefined) {
      throw new Error("memory store must support stakeholder updates");
    }
    await updateStakeholder(
      stakeholder({ id: "stakeholder-missing", name: "Missing" })
    );
    await updateStakeholder(
      stakeholder({
        id: "stakeholder-other-project",
        name: "Other project",
        project_id: "project-missing"
      })
    );

    expect(await store.listStakeholders("project-1")).toEqual([compliance]);
    expect(await store.listStakeholders("project-missing")).toEqual([]);
  });
});

function stakeholder(overrides: Partial<StoredStakeholder> = {}): StoredStakeholder {
  return {
    archived_at: null,
    description: "Reviews checkout requirements",
    id: "stakeholder-1",
    name: "Compliance",
    project_id: "project-1",
    type: "INTERNAL",
    ...overrides
  };
}
