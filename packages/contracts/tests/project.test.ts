import { describe, expect, test } from "vitest";
import {
  projectCreateQuerySchema,
  projectCreateRequestSchema,
  projectCreateResponseSchema,
  projectListResponseSchema,
  projectParamsSchema,
  projectRenameRequestSchema,
  projectRenameResponseSchema,
  projectWorkspaceParamsSchema
} from "../src/index.js";

describe("project contracts", () => {
  test("parses project request boundaries", () => {
    expect(
      projectCreateRequestSchema.parse({
        key: "PAY",
        name: "Payments"
      })
    ).toEqual({
      key: "PAY",
      name: "Payments",
      visibility: "PRIVATE"
    });
    expect(
      projectCreateRequestSchema.parse({
        key: "OPS",
        name: "Operations",
        simulate_branch_insert_failure: true,
        visibility: "INTERNAL"
      })
    ).toMatchObject({
      simulate_branch_insert_failure: true,
      visibility: "INTERNAL"
    });
    expect(projectRenameRequestSchema.parse({ name: "Billing" })).toEqual({
      name: "Billing"
    });
    expect(projectWorkspaceParamsSchema.parse({ workspaceId: "workspace-1" })).toEqual({
      workspaceId: "workspace-1"
    });
    expect(projectParamsSchema.parse({ projectId: "project-1" })).toEqual({
      projectId: "project-1"
    });
    expect(projectCreateQuerySchema.parse({ dry_run: "true" })).toBe(true);
    expect(projectCreateQuerySchema.parse(undefined)).toBe(false);
  });

  test("rejects malformed project request boundaries", () => {
    expect(() => projectCreateRequestSchema.parse({ key: "PAY" })).toThrow();
    expect(() =>
      projectCreateRequestSchema.parse({
        key: "PAY",
        name: "Payments",
        visibility: "PUBLIC"
      })
    ).toThrow();
    expect(() => projectRenameRequestSchema.parse({ name: "" })).toThrow();
    expect(() => projectParamsSchema.parse({ projectId: "" })).toThrow();
    expect(() => projectWorkspaceParamsSchema.parse({ workspaceId: "" })).toThrow();
  });

  test("parses project success responses", () => {
    const created = projectCreateResponseSchema.parse({
      default_branch: branch(),
      project: project(),
      recommended_next_command: "vspec actor create"
    });

    expect(created.project.key).toBe("PAY");
    expect(created.default_branch.name).toBe("main");
    expect(
      projectRenameResponseSchema.parse({ project: project({ name: "Billing" }) })
        .project.name
    ).toBe("Billing");
    expect(
      projectListResponseSchema.parse({ items: [projectListItem()] }).items
    ).toEqual([projectListItem()]);
  });
});

function project(overrides: Partial<ReturnType<typeof projectListItem>> = {}) {
  return {
    ...projectListItem(),
    default_branch_id: "branch-1",
    ...overrides
  };
}

function projectListItem() {
  return {
    id: "project-1",
    key: "PAY",
    name: "Payments",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}

function branch() {
  return {
    base_branch_id: null,
    id: "branch-1",
    name: "main",
    owner_id: "user-1",
    owner_type: "HUMAN",
    project_id: "project-1"
  };
}
