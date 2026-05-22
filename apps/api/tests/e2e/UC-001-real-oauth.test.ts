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
  test("*a: missing GitHub credentials do not prevent server boot", async () => {
    restoreEnv("GITHUB_CLIENT_ID", undefined);
    restoreEnv("GITHUB_CLIENT_SECRET", undefined);

    const app = await createServer({ authStub: false });

    try {
      const health = await app.inject({ method: "GET", url: "/healthz" });

      expect(health.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

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
      const calls = fetchMock.mock.calls;
      const tokenCall = calls.find(
        ([url]) => requestUrl(url) === "https://github.com/login/oauth/access_token"
      );
      expect(tokenCall?.[1]?.method).toBe("POST");
      expect(bodyText(tokenCall?.[1]?.body)).toContain(
        "client_secret=fixture-client-secret"
      );

      const profileCall = calls.find(
        ([url]) => requestUrl(url) === "https://api.github.com/user"
      );
      expect(profileCall?.[1]?.method).toBe("GET");
      expect(headerValue(profileCall?.[1]?.headers, "authorization")).toBe(
        "Bearer fixture-access-token"
      );
    } finally {
      await app.close();
    }
  });
});

function fetchGithubResponse(input: string | URL | Request, init?: RequestInit) {
  const url = requestUrl(input);

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

function cookieFrom(
  response: { headers: Record<string, number | string | string[] | undefined> },
  name: string
) {
  const raw = response.headers["set-cookie"];
  const entries = Array.isArray(raw) ? raw : raw === undefined ? [] : [String(raw)];
  return entries.find((entry) => entry.startsWith(`${name}=`)) ?? "";
}

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : input.toString();
}

function bodyText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof URLSearchParams) {
    return value.toString();
  }

  return "";
}

function headerValue(headers: unknown, name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  if (isHeaderPairs(headers)) {
    return headers.find(([key]) => key.toLowerCase() === name)?.[1];
  }
  if (isStringRecord(headers)) {
    return headers[name];
  }

  return undefined;
}

function isHeaderPairs(value: unknown): value is Array<[string, string]> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "string"
    )
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function restoreEnv(
  name: "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET",
  value: string | undefined
) {
  if (value === undefined) {
    if (name === "GITHUB_CLIENT_ID") {
      delete process.env.GITHUB_CLIENT_ID;
    } else {
      delete process.env.GITHUB_CLIENT_SECRET;
    }
  } else {
    process.env[name] = value;
  }
}
