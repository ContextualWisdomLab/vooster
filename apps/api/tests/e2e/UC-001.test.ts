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

type ProblemResponse = {
  title: string;
  suggested_alternative_slug?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
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
    const started = await startSignup("Acme Product", "acme-product");
    expect(started.authorizationUrl).toContain("github.com/login/oauth/authorize");
    expect(started.state.length).toBeGreaterThan(0);
    expect(started.cookie).toContain("vspec_oauth_state=");

    const params = new URLSearchParams({
      code: "stub-new-user",
      state: started.state
    });
    const callbackResponse = await server.fetch(
      `/v1/auth/github/callback?${params.toString()}`,
      { headers: { Cookie: started.cookie } }
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

  test("2a: denied GitHub authorization clears signup state", async () => {
    const started = await startSignup("Denied Workspace", "denied-workspace");

    const deniedParams = new URLSearchParams({
      error: "access_denied",
      state: started.state
    });
    const deniedResponse = await server.fetch(
      `/v1/auth/github/callback?${deniedParams.toString()}`,
      { headers: { Cookie: started.cookie } }
    );

    expect(deniedResponse.status).toBe(400);
    expect(deniedResponse.headers.get("set-cookie")).toContain("vspec_oauth_state=;");
    expect(deniedResponse.headers.get("set-cookie")).toContain("Max-Age=0");

    const deniedBody = (await deniedResponse.json()) as ProblemResponse;
    expect(deniedBody.title).toMatch(/authorization denied/i);
    expect(deniedBody.suggested_next_actions).toContainEqual({
      command: "vspec login",
      reason: "Retry signup."
    });

    const retryParams = new URLSearchParams({
      code: "stub-denied-user",
      state: started.state
    });
    const retryResponse = await server.fetch(
      `/v1/auth/github/callback?${retryParams.toString()}`,
      { headers: { Cookie: started.cookie } }
    );

    expect(retryResponse.status).toBe(400);
    expect(retryResponse.headers.get("set-cookie")).not.toContain("vspec_session=");
  });

  test("4a: unverified GitHub email aborts signup", async () => {
    const started = await startSignup("Unverified Email", "unverified-email");

    const params = new URLSearchParams({
      code: "stub-unverified-email",
      state: started.state
    });
    const callbackResponse = await server.fetch(
      `/v1/auth/github/callback?${params.toString()}`,
      { headers: { Cookie: started.cookie } }
    );

    expect(callbackResponse.status).toBe(422);
    expect(callbackResponse.headers.get("set-cookie")).toContain("vspec_oauth_state=;");
    expect(callbackResponse.headers.get("set-cookie")).not.toContain("vspec_session=");

    const body = (await callbackResponse.json()) as ProblemResponse;
    expect(body.title).toMatch(/verify.*github email/i);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec login",
      reason: "Retry signup."
    });
  });

  test("6a: duplicate workspace slug rolls back signup", async () => {
    const firstStart = await startSignup("First Duplicate", "duplicate-slug");
    const firstCallback = await completeSignup(
      "stub-first-duplicate",
      firstStart.state,
      firstStart.cookie
    );
    expect(firstCallback.status).toBe(201);

    const secondStart = await startSignup("Second Duplicate", "duplicate-slug");
    const secondCallback = await completeSignup(
      "stub-second-duplicate",
      secondStart.state,
      secondStart.cookie
    );

    expect(secondCallback.status).toBe(422);
    expect(secondCallback.headers.get("set-cookie")).toContain("vspec_oauth_state=;");
    expect(secondCallback.headers.get("set-cookie")).not.toContain("vspec_session=");

    const body = (await secondCallback.json()) as ProblemResponse;
    expect(body.title).toMatch(/workspace slug.*taken/i);
    expect(body.suggested_alternative_slug).toBe("duplicate-slug-2");
  });

  test("*a: GitHub network failure aborts signup with retry guidance", async () => {
    const started = await startSignup("Network Failure", "network-failure");
    const callbackResponse = await completeSignup(
      "stub-github-network-failure",
      started.state,
      started.cookie
    );

    expect(callbackResponse.status).toBe(502);
    expect(callbackResponse.headers.get("set-cookie")).toContain("vspec_oauth_state=;");
    expect(callbackResponse.headers.get("set-cookie")).not.toContain("vspec_session=");

    const body = (await callbackResponse.json()) as ProblemResponse;
    expect(body.title).toMatch(/github.*unavailable/i);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec login",
      reason: "Retry signup after GitHub is reachable."
    });
  });
});

async function startSignup(name: string, slug: string) {
  const response = await server.fetch("/v1/auth/github/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace: { name, slug } })
  });
  const body = (await response.json()) as StartSignupResponse;

  return {
    authorizationUrl: body.authorization_url,
    state: body.state,
    cookie: response.headers.get("set-cookie") ?? ""
  };
}

async function completeSignup(code: string, state: string, cookieHeader: string) {
  const params = new URLSearchParams({ code, state });

  return server.fetch(`/v1/auth/github/callback?${params.toString()}`, {
    headers: { Cookie: cookieHeader }
  });
}
