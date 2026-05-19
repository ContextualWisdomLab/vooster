import { afterEach, describe, expect, test, vi } from "vitest";
import { createServer } from "../../src/http/server.js";

type StartSignupResponse = {
  authorization_url: string;
  state: string;
};

type SignupCallbackResponse = {
  access_token?: string;
  user: {
    email: string;
    github_id: string;
    id: string;
  };
  workspace: {
    name: string;
    owner_id: string;
    slug: string;
  };
};

const originalClientId = process.env.GITHUB_CLIENT_ID;
const originalClientSecret = process.env.GITHUB_CLIENT_SECRET;

afterEach(() => {
  restoreEnv("GITHUB_CLIENT_ID", originalClientId);
  restoreEnv("GITHUB_CLIENT_SECRET", originalClientSecret);
  vi.unstubAllGlobals();
});

describe("UC-001 real GitHub OAuth", () => {
  test("MAIN: exchanges code for token, fetches profile, creates workspace and session", async () => {
    process.env.GITHUB_CLIENT_ID = "fixture-client-id";
    process.env.GITHUB_CLIENT_SECRET = "fixture-client-secret";
    const fetchMock = vi.fn(fetchGithubResponse);
    vi.stubGlobal("fetch", fetchMock);
    const app = await createServer({ authStub: false });

    try {
      const started = await app.inject({
        method: "POST",
        url: "/v1/auth/github/start",
        payload: {
          workspace: {
            name: "Real OAuth Workspace",
            slug: "real-oauth-workspace"
          }
        }
      });
      const startBody = JSON.parse(started.payload) as StartSignupResponse;
      const oauthCookie = cookieFrom(started, "vspec_oauth_state");

      expect(startBody.authorization_url).toContain("github.com/login/oauth/authorize");
      expect(startBody.authorization_url).toContain("client_id=fixture-client-id");
      expect(oauthCookie).toContain("vspec_oauth_state=");

      const callback = await app.inject({
        method: "GET",
        url: `/v1/auth/github/callback?code=real-code&state=${startBody.state}`,
        headers: { cookie: oauthCookie }
      });
      const callbackBody = JSON.parse(callback.payload) as SignupCallbackResponse;

      expect(callback.statusCode).toBe(201);
      expect(callback.headers["set-cookie"]).toEqual(
        expect.arrayContaining([expect.stringContaining("vspec_session=")])
      );
      expect(callbackBody).toMatchObject({
        user: {
          email: "real-user@example.com",
          github_id: "98765"
        },
        workspace: {
          name: "Real OAuth Workspace",
          slug: "real-oauth-workspace"
        }
      });
      expect(callbackBody.workspace.owner_id).toBe(callbackBody.user.id);
      expect(callbackBody.access_token).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        "https://github.com/login/oauth/access_token",
        expect.objectContaining({
          body: expect.stringContaining("client_secret=fixture-client-secret"),
          method: "POST"
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/user",
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: "Bearer fixture-access-token"
          }),
          method: "GET"
        })
      );
    } finally {
      await app.close();
    }
  });
});

function fetchGithubResponse(input: string | URL | Request, init?: RequestInit) {
  const url = typeof input === "string" ? input : input.url;

  if (url === "https://github.com/login/oauth/access_token") {
    expect(init?.body).toContain("code=real-code");
    expect(init?.body).toContain("client_id=fixture-client-id");
    return Promise.resolve(
      Response.json({
        access_token: "fixture-access-token",
        token_type: "bearer"
      })
    );
  }

  if (url === "https://api.github.com/user") {
    return Promise.resolve(
      Response.json({
        avatar_url: "https://github.com/images/real-user.png",
        email: "real-user@example.com",
        id: 98765,
        name: "Real GitHub User"
      })
    );
  }

  throw new Error(`Unexpected GitHub request: ${url}`);
}

function cookieFrom(response: { headers: Record<string, string | string[] | undefined> }, name: string) {
  const raw = response.headers["set-cookie"];
  const entries = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return entries.find((entry) => entry.startsWith(`${name}=`)) ?? "";
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
