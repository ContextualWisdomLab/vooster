import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("signup routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed signup start requests through real routing", async () => {
    const response = await server.fetch("/v1/auth/github/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: {} })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid signup request" });
  });

  test("rejects malformed OAuth callbacks through real routing", async () => {
    const response = await server.fetch("/v1/auth/github/callback?code=&state=state-1");

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid OAuth callback" });
  });

  test("uses signup denial guidance when pending OAuth is absent through real routing", async () => {
    const response = await server.fetch(
      "/v1/auth/github/callback?error=access_denied&state=state-1"
    );

    expect(response.headers.get("set-cookie")).toContain("vspec_oauth_state=;");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "GitHub authorization denied"
    });
  });
});
