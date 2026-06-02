import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createActor,
  createProject,
  createUseCase
} from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/changes/preview integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed change proposals after marker detection through real routing", async () => {
    const response = await server.fetch("/v1/changes/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch: {}, usecase_key: "PAY-001" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid change proposal" });
  });

  test("previews valid change proposals for the authenticated member through real routing", async () => {
    const setup = await createProject(
      server,
      "Change Preview Int",
      "change-preview-int",
      "change-preview-int"
    );
    const actor = await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, actor.name, "Place an order");

    const response = await server.fetch("/v1/changes/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        auto_commit: true,
        base_revision: usecase.current_revision_id,
        patch: {
          entity_id: usecase.id,
          entity_type: "USECASE",
          fields: { title: "Place an order quickly" }
        },
        usecase_key: usecase.key
      })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      diff: Array<{ after: string; before: string }>;
      impact: { affected_sessions: unknown[]; severity: string };
      preview_id: string;
      severity: string;
      warnings: Array<{ type: string }>;
    };
    expect(typeof body.preview_id).toBe("string");
    expect(body.severity).toBe("NON_BREAKING");
    expect(body.impact.severity).toBe("NON_BREAKING");
    expect(body.diff[0]).toMatchObject({
      after: "Place an order quickly",
      before: "Place an order"
    });
    expect(body.warnings).toContainEqual({
      message: "NON_BREAKING changes require explicit human commit.",
      type: "AUTO_COMMIT_REFUSED"
    });
  });

  test("rejects change proposals from non-members through real routing", async () => {
    const owner = await createProject(
      server,
      "Preview Owner",
      "preview-owner",
      "preview-owner"
    );
    const actor = await createActor(server, owner, "Customer");
    const usecase = await createUseCase(server, owner, actor.name, "Place an order");
    const outsider = await createProject(
      server,
      "Preview Outsider",
      "preview-outsider",
      "preview-outsider"
    );

    const response = await server.fetch("/v1/changes/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: outsider.cookie },
      body: JSON.stringify({
        base_revision: usecase.current_revision_id,
        patch: {
          entity_id: usecase.id,
          entity_type: "USECASE",
          fields: { title: "Place an order quickly" }
        },
        usecase_key: usecase.key
      })
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Use case not found" });
  });
});
