import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { signup } from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("device auth routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed token requests through real routing", async () => {
    const response = await server.fetch("/v1/auth/github/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      status: 400,
      title: "Invalid device token request"
    });
  });

  test("reports unavailable GitHub profiles through real routing", async () => {
    const response = await server.fetch("/v1/auth/github/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: "not-a-stub-token" })
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      status: 502,
      title: "GitHub is unavailable"
    });
  });

  test("signs up explicit workspace requests through real routing", async () => {
    const response = await server.fetch("/v1/auth/github/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: "stub-access-token-device-user",
        workspace: { name: "Device Workspace", slug: "device-workspace" }
      })
    });

    const body = (await response.json()) as {
      recommended_next_command: string;
      workspace: { slug: string };
    };
    expect(response.status).toBe(201);
    expect(body.workspace.slug).toBe("device-workspace");
    expect(body.recommended_next_command).toBe("vspec project create");
    expect(response.headers.get("set-cookie")).toContain("vspec_session=");
  });

  test("creates a default workspace when device login finds no user through real routing", async () => {
    const response = await server.fetch("/v1/auth/github/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: "stub-access-token-First.User" })
    });

    const body = (await response.json()) as {
      user: { github_id: string };
      workspaces: Array<{ slug: string }>;
    };
    expect(response.status).toBe(200);
    expect(body.user.github_id).toBe("First.User");
    expect(body.workspaces[0]?.slug).toBe("github-first-user");
    expect(response.headers.get("set-cookie")).toContain("vspec_session=");
  });

  test("reports fallback workspace slug conflicts through real routing", async () => {
    await signup(server, "Existing Workspace", "github-first-user", "other-user");

    const response = await server.fetch("/v1/auth/github/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: "stub-access-token-First.User" })
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      title: "Workspace slug is already taken"
    });
  });

  test("clears the current session on logout through real routing", async () => {
    const login = await server.fetch("/v1/auth/github/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: "stub-access-token-First.User" })
    });
    const cookie = login.headers.get("set-cookie") ?? "";
    const sessionCookie = cookie.split(";")[0] ?? "";
    expect(sessionCookie).toContain("vspec_session=");

    const response = await server.fetch("/v1/auth/logout", {
      method: "POST",
      headers: { cookie: sessionCookie }
    });
    expect(response.status).toBe(204);

    const noSession = await server.fetch("/v1/auth/logout", { method: "POST" });
    expect(noSession.status).toBe(204);
  });
});
