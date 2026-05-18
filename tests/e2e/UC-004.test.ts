import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";

type OAuthStart = {
  state: string;
};

type SignupResponse = {
  workspace: { id: string };
};

type ProjectResponse = {
  project: {
    id: string;
    workspace_id: string;
    name: string;
    key: string;
    visibility: string;
    default_branch_id: string;
  };
  default_branch: {
    id: string;
    project_id: string;
    name: string;
    owner_type: string;
    owner_id: string;
  };
  recommended_next_command: string;
};

type ProblemResponse = {
  title: string;
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
    const signedUp = await signup("Project Owner", "project-owner", "stub-project-owner");

    const response = await server.fetch(
      `/v1/workspaces/${signedUp.workspaceId}/projects`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: signedUp.cookie
        },
        body: JSON.stringify({
          name: "Payments",
          key: "PAY",
          visibility: "INTERNAL"
        })
      }
    );

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
    expect(body.recommended_next_command).toBe("vspec actor define");
  });

  test("2a: non-member cannot create a project in the workspace", async () => {
    const owner = await signup("Member Workspace", "member-workspace", "stub-member-owner");
    const outsider = await signup(
      "Outsider Workspace",
      "outsider-workspace",
      "stub-project-outsider"
    );

    const response = await server.fetch(`/v1/workspaces/${owner.workspaceId}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: outsider.cookie
      },
      body: JSON.stringify({
        name: "Fraud",
        key: "FRD",
        visibility: "PRIVATE"
      })
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as ProblemResponse;
    expect(body.title).toMatch(/request an invitation/i);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec workspace invitations request",
      reason: "Ask a workspace owner for access."
    });
  });
});

async function signup(name: string, slug: string, code: string) {
  const start = await server.fetch("/v1/auth/github/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace: { name, slug } })
  });
  const startBody = (await start.json()) as OAuthStart;
  const params = new URLSearchParams({ code, state: startBody.state });
  const callback = await server.fetch(
    `/v1/auth/github/callback?${params.toString()}`,
    { headers: { Cookie: start.headers.get("set-cookie") ?? "" } }
  );
  const body = (await callback.json()) as SignupResponse & { user: { id: string } };

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    userId: body.user.id,
    workspaceId: body.workspace.id
  };
}
