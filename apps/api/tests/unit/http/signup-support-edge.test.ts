import { afterEach, describe, expect, test, vi } from "vitest";
import {
  fetchGithubProfile,
  fetchGithubProfileByAccessToken
} from "../../../src/http/signup-support.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const oauth = {
  authStub: false,
  githubOAuth: { clientId: "c", clientSecret: "s" }
} as const;

describe("signup support GitHub edge handling", () => {
  test("rethrows unexpected GitHub fetch failures", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("boom")));

    await expect(fetchGithubProfile(oauth, "code")).rejects.toThrow("boom");
    await expect(fetchGithubProfileByAccessToken(oauth, "token")).rejects.toThrow(
      "boom"
    );
  });

  test("returns undefined for non-OK GitHub responses", async () => {
    mockFetch(response({}, 500));
    await expect(fetchGithubProfile(oauth, "code")).resolves.toBeUndefined();

    mockFetch(response({ access_token: "token" }), response({}, 500));
    await expect(fetchGithubProfile(oauth, "code")).resolves.toBeUndefined();

    mockFetch(response({}, 500));
    await expect(
      fetchGithubProfileByAccessToken(oauth, "token")
    ).resolves.toBeUndefined();
  });

  test("builds stub GitHub profiles from access tokens", async () => {
    await expect(
      fetchGithubProfileByAccessToken({ authStub: true }, "stub-access-token-octo")
    ).resolves.toMatchObject({
      email: "octo@users.noreply.github.com",
      githubId: "octo"
    });
  });

  test("falls back to a generic GitHub profile name", async () => {
    mockFetch(
      response({ access_token: "token" }),
      response({ avatar_url: "", email: "", id: "github-1", login: "", name: "" })
    );

    await expect(fetchGithubProfile(oauth, "code")).resolves.toMatchObject({
      githubId: "github-1",
      name: "GitHub User"
    });
  });
});

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const item of responses) {
    fetchMock.mockResolvedValueOnce(item);
  }
  vi.stubGlobal("fetch", fetchMock);
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status
  });
}
