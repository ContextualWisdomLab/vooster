import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import type {
  StoredProject,
  StoredSpecBranch
} from "../../../src/domain/entities/index.js";
import {
  authHeaders,
  project,
  projectApp,
  projectPayload,
  type ProjectRouteOptions
} from "./project-routes-fixtures.js";

let currentApp: FastifyInstance | undefined;

afterEach(() => currentApp?.close());

describe("project routes", () => {
  test("requires authentication before list and default create", async () => {
    const app = routeApp();

    const list = await app.inject({ method: "GET", url: "/v1/projects" });
    const create = await app.inject({
      method: "POST",
      payload: projectPayload(),
      url: "/v1/projects"
    });

    expect(list.statusCode).toBe(401);
    expect(list.json<ProblemBody>().title).toBe("Sign in to list projects");
    expect(create.statusCode).toBe(401);
    expect(create.json<ProblemBody>().title).toBe("Sign in to create a project");
  });

  test("lists member projects sorted by key", async () => {
    const response = await routeApp({
      memberships: [
        membership("workspace-1"),
        membership("workspace-2", "membership-2")
      ],
      projectsByWorkspace: {
        "workspace-1": [project({ key: "OPS" })],
        "workspace-2": [project({ id: "project-2", key: "BILL" })]
      }
    }).inject({
      headers: authHeaders(),
      method: "GET",
      url: "/v1/projects"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<ProjectListBody>().items.map((item) => item.key)).toEqual([
      "BILL",
      "OPS"
    ]);
  });

  test.each(projectValidationCases)(
    "rejects invalid create requests",
    async (url, payload, title) => {
      const response = await routeApp().inject({
        headers: authHeaders(),
        method: "POST",
        payload,
        url
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<ProblemBody>().title).toBe(title);
    }
  );

  test("creates projects in the default workspace and honors dry runs", async () => {
    const savedProjects: StoredProject[] = [];
    const savedBranches: StoredSpecBranch[] = [];
    const response = await routeApp({ savedBranches, savedProjects }).inject({
      headers: authHeaders(),
      method: "POST",
      payload: projectPayload({ key: "OPS" }),
      url: "/v1/projects?dry_run=true"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<ProjectCreateBody>().project).toMatchObject({
      key: "OPS",
      workspace_id: "workspace-1"
    });
    expect(savedProjects).toEqual([]);
    expect(savedBranches).toEqual([]);
  });

  test("creates projects in an explicit workspace without dry-run query", async () => {
    const savedProjects: StoredProject[] = [];
    const savedBranches: StoredSpecBranch[] = [];
    const response = await routeApp({ savedBranches, savedProjects }).inject({
      headers: authHeaders(),
      method: "POST",
      payload: projectPayload({ key: "OPS" }),
      url: "/v1/workspaces/workspace-9/projects"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<ProjectCreateBody>().project.workspace_id).toBe("workspace-9");
    expect(savedProjects).toHaveLength(1);
    expect(savedBranches).toHaveLength(1);
  });

  test("rejects unauthenticated and malformed project mutations", async () => {
    const app = routeApp();

    const renameAuth = await app.inject({
      method: "PATCH",
      payload: { name: "Billing" },
      url: "/v1/projects/project-9"
    });
    const renameBody = await app.inject({
      headers: authHeaders(),
      method: "PATCH",
      payload: { name: "" },
      url: "/v1/projects/project-9"
    });
    const deleteAuth = await app.inject({
      method: "DELETE",
      url: "/v1/projects/project-9"
    });

    expect(renameAuth.statusCode).toBe(401);
    expect(renameAuth.json<ProblemBody>().title).toBe("Sign in to rename a project");
    expect(renameBody.statusCode).toBe(400);
    expect(renameBody.json<ProblemBody>().title).toBe("Invalid rename request");
    expect(deleteAuth.statusCode).toBe(401);
    expect(deleteAuth.json<ProblemBody>().title).toBe("Sign in to delete a project");
  });

  test("renames, deletes, and archives through routed parameters", async () => {
    const app = routeApp();

    const renamed = await app.inject({
      headers: authHeaders(),
      method: "PATCH",
      payload: { name: "Billing" },
      url: "/v1/projects/project-9"
    });
    const deleted = await app.inject({
      headers: authHeaders(),
      method: "DELETE",
      url: "/v1/projects/project-9"
    });
    const archived = await app.inject({
      method: "POST",
      url: "/__test/workspaces/workspace-9/archive"
    });

    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<ProjectCreateBody>().project).toMatchObject({
      id: "project-9",
      name: "Billing"
    });
    expect(deleted.statusCode).toBe(204);
    expect(archived.statusCode).toBe(200);
    expect(archived.json<{ archived: boolean }>().archived).toBe(true);
  });
});

type ProblemBody = { title: string };
type ProjectCreateBody = { project: StoredProject };
type ProjectListBody = { items: Array<{ key: string }> };

const projectValidationCases: Array<[string, Record<string, unknown>, string]> = [
  ["/v1/projects", { key: "OPS" }, "Invalid project request"],
  ["/v1/projects", projectPayload({ key: "bad" }), "Invalid project key"],
  ["/v1/workspaces/workspace-1/projects", { key: "OPS" }, "Invalid project request"],
  [
    "/v1/workspaces/workspace-1/projects",
    projectPayload({ key: "TOO-LONG" }),
    "Invalid project key"
  ]
];

function routeApp(options: ProjectRouteOptions = {}) {
  currentApp = projectApp(options);
  return currentApp;
}

function membership(workspaceId: string, id = "membership-1") {
  return {
    id,
    role: "OWNER" as const,
    user_id: "user-1",
    workspace_id: workspaceId
  };
}
