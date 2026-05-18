import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";

type StartSignupResponse = {
  authorization_url: string;
  state: string;
};

type SignupCallbackResponse = {
  user: {
    id: string;
    github_id: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    plan: string;
  };
  membership: {
    user_id: string;
    workspace_id: string;
    role: string;
  };
  recommended_next_command: string;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-001 - Sign up for a workspace", () => {
  test("MAIN: creates a user, workspace, owner membership, and session", async () => {
    const startResponse = await server.fetch("/v1/auth/github/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace: { name: "Acme Product", slug: "acme-product" }
      })
    });

    expect(startResponse.status).toBe(200);
    const startBody = (await startResponse.json()) as StartSignupResponse;
    expect(startBody.authorization_url).toContain("github.com/login/oauth/authorize");
    expect(startBody.state.length).toBeGreaterThan(0);

    const stateCookie = startResponse.headers.get("set-cookie");
    expect(stateCookie).toContain("vspec_oauth_state=");

    const params = new URLSearchParams({
      code: "stub-new-user",
      state: startBody.state
    });
    const callbackResponse = await server.fetch(
      `/v1/auth/github/callback?${params.toString()}`,
      { headers: { Cookie: stateCookie ?? "" } }
    );

    expect(callbackResponse.status).toBe(201);
    expect(callbackResponse.headers.get("set-cookie")).toContain("vspec_session=");

    const callbackBody = (await callbackResponse.json()) as SignupCallbackResponse;
    expect(callbackBody).toMatchObject({
      user: {
        github_id: "stub-new-user",
        email: "stub-new-user@users.noreply.github.com"
      },
      workspace: {
        name: "Acme Product",
        slug: "acme-product",
        plan: "FREE"
      },
      membership: { role: "OWNER" },
      recommended_next_command: "vspec project create"
    });
    expect(callbackBody.workspace.owner_id).toBe(callbackBody.user.id);
    expect(callbackBody.membership.user_id).toBe(callbackBody.user.id);
    expect(callbackBody.membership.workspace_id).toBe(callbackBody.workspace.id);
  });
});
