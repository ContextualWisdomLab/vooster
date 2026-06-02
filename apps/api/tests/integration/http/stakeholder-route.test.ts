import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createProject, type ProjectSetup } from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;
let setup: ProjectSetup;

type StakeholderListBody = { items: Array<{ name: string; type: string }> };

describe("POST /v1/projects/:projectId/stakeholders integration", () => {
  beforeEach(async () => {
    server = await startServer();
    setup = await createProject(
      server,
      "Stakeholders",
      "stakeholder-routes",
      "stub-sh"
    );
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects stakeholder creation without membership", async () => {
    const response = await server.fetch(
      `/v1/projects/${setup.projectId}/stakeholders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Product Manager", type: "INTERNAL" })
      }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      title: "Contact the workspace owner for access"
    });
  });

  test("rejects malformed stakeholder creation requests", async () => {
    const response = await server.fetch(
      `/v1/projects/${setup.projectId}/stakeholders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: setup.cookie },
        body: JSON.stringify({ name: "", type: "INTERNAL" })
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Invalid stakeholder request"
    });
  });

  test("creates stakeholders with default description and honors dry runs", async () => {
    const created = await server.fetch(`/v1/projects/${setup.projectId}/stakeholders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ name: "Product Manager", type: "INTERNAL" })
    });

    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      recommended_next_command: "vspec usecase add-stakeholder",
      stakeholder: { description: "", name: "Product Manager", type: "INTERNAL" }
    });

    const afterCreate = await listStakeholders();
    expect(afterCreate.items.map((item) => item.name)).toEqual(["Product Manager"]);

    const dryRun = await server.fetch(
      `/v1/projects/${setup.projectId}/stakeholders?dry_run=true`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: setup.cookie },
        body: JSON.stringify({ name: "Risk Officer", type: "INTERNAL" })
      }
    );

    expect(dryRun.status).toBe(201);
    const afterDryRun = await listStakeholders();
    expect(afterDryRun.items.map((item) => item.name)).toEqual(["Product Manager"]);
  });

  async function listStakeholders(): Promise<StakeholderListBody> {
    const response = await server.fetch(
      `/v1/projects/${setup.projectId}/stakeholders`,
      { headers: { Cookie: setup.cookie } }
    );
    return (await response.json()) as StakeholderListBody;
  }
});
