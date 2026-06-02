import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createActor,
  createProject,
  createUseCase
} from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/usecases/:id/export/markdown integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects export of a stored use case without project membership through real routing", async () => {
    const owner = await createProject(
      server,
      "Markdown Owner",
      "markdown-owner",
      "markdown-owner"
    );
    const actor = await createActor(server, owner, "Customer");
    const usecase = await createUseCase(server, owner, actor.name, "Place an order");
    const outsider = await createProject(
      server,
      "Markdown Outsider",
      "markdown-outsider",
      "markdown-outsider"
    );

    const response = await server.fetch(`/v1/usecases/${usecase.id}/export/markdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: outsider.cookie },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      title: "Not authorized to export markdown"
    });
  });

  test("rejects malformed export requests through real routing", async () => {
    const response = await server.fetch("/v1/usecases/usecase-1/export/markdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: "yes" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Invalid markdown export request"
    });
  });

  test("reports missing use cases through real routing", async () => {
    const response = await server.fetch("/v1/usecases/usecase-1/export/markdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Use case not found" });
  });
});
