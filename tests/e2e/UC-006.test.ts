import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";

type ProjectResponse = { project: { id: string } };

type StakeholderResponse = {
  stakeholder: Record<"description" | "id" | "name" | "project_id" | "type", string> & {
    archived_at: null;
  };
  revision: { entity_id: string; entity_type: string; version_number: number };
  recommended_next_command: string;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-006 - Define a stakeholder", () => {
  test("MAIN: project member defines a stakeholder with an initial revision", async () => {
    const setup = await createProject("Stakeholder Project", "stakeholder-project", "stub-stakeholder-owner");

    const response = await createStakeholder(setup, {
      description: "Owns the checkout business outcome.",
      name: "Product Manager",
      type: "INTERNAL"
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as StakeholderResponse;
    expect(body.stakeholder).toMatchObject({
      archived_at: null,
      description: "Owns the checkout business outcome.",
      name: "Product Manager",
      project_id: setup.projectId,
      type: "INTERNAL"
    });
    expect(body.revision).toMatchObject({
      entity_id: body.stakeholder.id,
      entity_type: "STAKEHOLDER",
      version_number: 1
    });
    expect(body.recommended_next_command).toBe("vspec usecase add-stakeholder");
  });
});

async function createStakeholder(
  setup: { cookie: string; projectId: string },
  body: { attach_to_step?: boolean; description?: string; name: string; type: string }
) {
  return server.fetch(`/v1/projects/${setup.projectId}/stakeholders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({ description: "", ...body })
  });
}

async function createProject(name: string, slug: string, code: string) {
  const signedUp = await signup(name, slug, code);
  const response = await server.fetch(`/v1/workspaces/${signedUp.workspaceId}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: signedUp.cookie },
    body: JSON.stringify({ name: "Checkout", key: "CHK", visibility: "PRIVATE" })
  });
  const body = (await response.json()) as ProjectResponse;
  return { ...signedUp, projectId: body.project.id };
}

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
  const body = (await callback.json()) as { user: { id: string }; workspace: { id: string } };
  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    userId: body.user.id,
    workspaceId: body.workspace.id
  };
}
