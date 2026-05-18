import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";

type OAuthStart = {
  authorization_url: string;
  state: string;
};

type SignupResponse = {
  user: { id: string; github_id: string };
  workspace: { id: string; slug: string };
};

type LoginResponse = {
  user: {
    id: string;
    github_id: string;
    last_login_at: string;
  };
  workspaces: Array<{
    id: string;
    slug: string;
    role: string;
  }>;
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

describe("UC-002 - Log in", () => {
  test("MAIN: existing user gets a fresh session and workspace list", async () => {
    const signupStart = await startSignup("Login Workspace", "login-workspace");
    const signup = await completeOAuth("stub-returning-user", signupStart);
    expect(signup.status).toBe(201);
    const signedUp = (await signup.json()) as SignupResponse;

    const loginStart = await startLogin();
    expect(loginStart.status).toBe(200);
    expect(loginStart.authorizationUrl).toContain("github.com/login/oauth/authorize");
    expect(loginStart.cookie).toContain("vspec_oauth_state=");

    const login = await completeOAuth("stub-returning-user", loginStart);
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toContain("vspec_session=");

    const body = (await login.json()) as LoginResponse;
    expect(body.user.github_id).toBe("stub-returning-user");
    expect(body.user.id).toBe(signedUp.user.id);
    expect(body.user.last_login_at.length).toBeGreaterThan(0);
    expect(body.workspaces).toContainEqual({
      id: signedUp.workspace.id,
      slug: "login-workspace",
      role: "OWNER"
    });
  });

  test("4a: unknown GitHub identity is told to sign up", async () => {
    const loginStart = await startLogin();
    const login = await completeOAuth("stub-unknown-login", loginStart);

    expect(login.status).toBe(404);
    expect(login.headers.get("set-cookie")).not.toContain("vspec_session=");

    const body = (await login.json()) as ProblemResponse;
    expect(body.title).toMatch(/no vspec user/i);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec login",
      reason: "Sign up before logging in."
    });
  });
});

async function startSignup(name: string, slug: string) {
  return startOAuth({ workspace: { name, slug } });
}

async function startLogin() {
  return startOAuth({ flow: "login" });
}

async function startOAuth(body: unknown) {
  const response = await server.fetch("/v1/auth/github/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as OAuthStart;

  return {
    authorizationUrl: payload.authorization_url,
    status: response.status,
    state: payload.state,
    cookie: response.headers.get("set-cookie") ?? ""
  };
}

async function completeOAuth(code: string, start: { cookie: string; state: string }) {
  const params = new URLSearchParams({ code, state: start.state });

  return server.fetch(`/v1/auth/github/callback?${params.toString()}`, {
    headers: { Cookie: start.cookie }
  });
}
