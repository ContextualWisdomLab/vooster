import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";

type ProjectResponse = {
  project: Record<
    "default_branch_id" | "id" | "key" | "name" | "visibility" | "workspace_id",
    string
  >;
  default_branch: Record<
    "id" | "name" | "owner_id" | "owner_type" | "project_id",
    string
  >;
  recommended_next_command: string;
};

type ProjectListResponse = {
  items: Array<Record<"id" | "key" | "name" | "visibility" | "workspace_id", string>>;
};

type ProblemResponse = {
  title: string;
  key_pattern?: string;
  example_keys?: string[];
  existing_project?: { id: string; key: string; name: string };
  request_id?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-004 - Create a project", () => {
  test("MAIN: workspace member creates a project with main branch", async () => {
    const signedUp = await signup(
      "Project Owner",
      "project-owner",
      "stub-project-owner"
    );

    const response = await createProject(signedUp, {
      name: "Payments",
      key: "PAY",
      visibility: "INTERNAL"
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as ProjectResponse;
    expect(body.project).toMatchObject({
      workspace_id: signedUp.workspaceId,
      name: "Payments",
      key: "PAY",
      visibility: "INTERNAL"
    });
    expect(body.default_branch).toMatchObject({
      project_id: body.project.id,
      name: "main",
      owner_type: "HUMAN"
    });
    expect(body.project.default_branch_id).toBe(body.default_branch.id);
    expect(body.default_branch.owner_id).toBe(signedUp.userId);
    expect(body.recommended_next_command).toBe("vspec actor create");
  });

  test("MAIN: signed-in member lists their projects for the web viewer", async () => {
    const signedUp = await signup("Project List", "project-list", "stub-project-list");
    const created = await createProject(signedUp, {
      name: "Support Desk",
      key: "SUP",
      visibility: "PRIVATE"
    });
    const createdBody = (await created.json()) as ProjectResponse;

    const response = await server.fetch("/v1/projects", {
      headers: { Cookie: signedUp.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as ProjectListResponse;
    expect(body.items).toContainEqual({
      id: createdBody.project.id,
      workspace_id: signedUp.workspaceId,
      name: "Support Desk",
      key: "SUP",
      visibility: "PRIVATE"
    });
  });

  test("2a: non-member cannot create a project in the workspace", async () => {
    const owner = await signup(
      "Member Workspace",
      "member-workspace",
      "stub-member-owner"
    );
    const outsider = await signup(
      "Outsider Workspace",
      "outsider-workspace",
      "stub-project-outsider"
    );

    const response = await createProject(
      { cookie: outsider.cookie, workspaceId: owner.workspaceId },
      { name: "Fraud", key: "FRD", visibility: "PRIVATE" }
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/request an invitation/i);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec workspace invitations request",
      reason: "Ask a workspace owner for access."
    });
  });

  test("3a: invalid project key returns pattern and examples", async () => {
    const signedUp = await signup("Invalid Key", "invalid-key", "stub-invalid-key");

    const response = await createProject(signedUp, {
      name: "Invalid Project",
      key: "pay",
      visibility: "PRIVATE"
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/invalid project key/i);
    expect(body.key_pattern).toBe("^[A-Z][A-Z0-9]{1,7}$");
    expect(body.example_keys).toEqual(["PAY", "PAY2", "OPS2026"]);
  });

  test("3b: duplicate project key reports existing project", async () => {
    const signedUp = await signup(
      "Duplicate Key",
      "duplicate-key",
      "stub-duplicate-key"
    );
    const first = await createProject(signedUp, {
      name: "Payments",
      key: "PAY",
      visibility: "PRIVATE"
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as ProjectResponse;

    const duplicate = await createProject(signedUp, {
      name: "Payouts",
      key: "PAY",
      visibility: "INTERNAL"
    });

    expect(duplicate.status).toBe(422);
    const body = (await duplicate.json()) as ProblemResponse;
    expect(body.title).toMatch(/project key.*already in use/i);
    expect(body.existing_project).toEqual({
      id: firstBody.project.id,
      key: "PAY",
      name: "Payments"
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec project show PAY",
      reason: "Verify whether the existing project is the intended target."
    });
  });

  test("6a: branch insert failure rolls back project creation", async () => {
    const signedUp = await signup("Rollback", "rollback", "stub-rollback");
    const failed = await createProject(signedUp, {
      name: "Catalog",
      key: "CAT",
      visibility: "PRIVATE",
      simulate_branch_insert_failure: true
    });

    expect(failed.status).toBe(500);
    const failure = (await failed.json()) as ProblemResponse;
    expect(failure.title).toMatch(/project creation failed/i);
    expect(failure.request_id?.length).toBeGreaterThan(0);

    const retry = await createProject(signedUp, {
      name: "Catalog",
      key: "CAT",
      visibility: "PRIVATE"
    });
    expect(retry.status).toBe(201);
  });

  test("MAIN: signed-in member renames a project", async () => {
    const signedUp = await signup("Renamer", "renamer", "stub-renamer");
    const created = await createProject(signedUp, {
      name: "Old Name",
      key: "OLD",
      visibility: "PRIVATE"
    });
    const createdBody = (await created.json()) as ProjectResponse;

    const response = await server.fetch(`/v1/projects/${createdBody.project.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      body: JSON.stringify({ name: "New Name" })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { project: { id: string; name: string } };
    expect(body.project).toMatchObject({
      id: createdBody.project.id,
      name: "New Name"
    });
  });

  test("MAIN: signed-in member deletes an empty project", async () => {
    const signedUp = await signup("Deleter", "deleter", "stub-deleter");
    const created = await createProject(signedUp, {
      name: "Trash",
      key: "TRASH",
      visibility: "PRIVATE"
    });
    const createdBody = (await created.json()) as ProjectResponse;

    const response = await server.fetch(`/v1/projects/${createdBody.project.id}`, {
      method: "DELETE",
      headers: { Cookie: signedUp.cookie }
    });

    expect(response.status).toBe(204);

    const after = await server.fetch("/v1/projects", {
      headers: { Cookie: signedUp.cookie }
    });
    const list = (await after.json()) as ProjectListResponse;
    expect(
      list.items.find((item) => item.id === createdBody.project.id)
    ).toBeUndefined();
  });

  test("MAIN: signed-in member creates a project in their default workspace", async () => {
    const signedUp = await signup(
      "Default Workspace",
      "default-workspace",
      "stub-default-workspace"
    );

    const response = await server.fetch("/v1/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      body: JSON.stringify({ name: "Quick Start", key: "QUICK", visibility: "PRIVATE" })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as ProjectResponse;
    expect(body.project).toMatchObject({
      workspace_id: signedUp.workspaceId,
      key: "QUICK",
      name: "Quick Start"
    });
  });

  test("rename: non-member cannot rename a project", async () => {
    const owner = await signup("Rename Owner", "rename-owner", "stub-rename-owner");
    const outsider = await signup(
      "Rename Outsider",
      "rename-outsider",
      "stub-rename-outsider"
    );
    const created = await createProject(owner, {
      name: "Locked",
      key: "LOCK",
      visibility: "PRIVATE"
    });
    const createdBody = (await created.json()) as ProjectResponse;

    const response = await server.fetch(`/v1/projects/${createdBody.project.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: outsider.cookie
      },
      body: JSON.stringify({ name: "Hijacked" })
    });

    expect(response.status).toBe(403);
  });

  test("delete: missing project returns 404", async () => {
    const signedUp = await signup("Missing", "missing-project", "stub-missing-project");

    const response = await server.fetch("/v1/projects/does-not-exist", {
      method: "DELETE",
      headers: { Cookie: signedUp.cookie }
    });

    expect(response.status).toBe(404);
  });

  test("*a: archived workspace aborts project creation", async () => {
    const signedUp = await signup("Archived", "archived", "stub-archived");
    await server.fetch(`/__test/workspaces/${signedUp.workspaceId}/archive`, {
      method: "POST"
    });
    const response = await createProject(signedUp, {
      key: "ARC",
      name: "Archive Attempt",
      visibility: "PRIVATE"
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/workspace.*archived/i);
  });
});

async function signup(name: string, slug: string, code: string) {
  const start = await server.fetch("/v1/auth/github/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace: { name, slug } })
  });
  const startBody = (await start.json()) as { state: string };
  const params = new URLSearchParams({ code, state: startBody.state });
  const callback = await server.fetch(`/v1/auth/github/callback?${params.toString()}`, {
    headers: { Cookie: start.headers.get("set-cookie") ?? "" }
  });
  const body = (await callback.json()) as SignedUp;

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    userId: body.user.id,
    workspaceId: body.workspace.id
  };
}

async function createProject(
  signedUp: { cookie: string; workspaceId: string },
  body: ProjectRequest
) {
  return server.fetch(`/v1/workspaces/${signedUp.workspaceId}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie
    },
    body: JSON.stringify(body)
  });
}

type SignedUp = { user: { id: string }; workspace: { id: string } };
type ProjectRequest = {
  key: string;
  name: string;
  simulate_branch_insert_failure?: boolean;
  visibility: string;
};
