import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("/__test branch revision helper routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  const malformed = [
    {
      path: "/__test/branches/branch-1/usecases/usecase-1/revisions",
      body: { severity: "NOPE", title: "Branch title" },
      title: "Invalid branch revision request"
    },
    {
      path: "/__test/branches/branch-1/usecases/usecase-1/extensions",
      body: { condition: "", extension_point: "1a" },
      title: "Invalid branch extension request"
    },
    {
      path: "/__test/usecases/usecase-1/revisions",
      body: { severity: "BREAKING", title: "" },
      title: "Invalid main revision request"
    },
    {
      path: "/__test/usecases/usecase-1/extensions",
      body: { condition: "Alternate flow", extension_point: "" },
      title: "Invalid main extension request"
    }
  ];

  for (const check of malformed) {
    test(`rejects ${check.title} through real routing`, async () => {
      const response = await server.fetch(check.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.body)
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ title: check.title });
    });
  }

  test("reports missing branch use cases through real routing", async () => {
    const response = await server.fetch(
      "/__test/branches/missing-branch/usecases/usecase-1/revisions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity: "BREAKING", title: "Missing branch use case" })
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      title: "Branch use case not found"
    });
  });
});
