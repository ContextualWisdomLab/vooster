import type { FastifyReply } from "fastify";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  clearOAuthState,
  cookie,
  fetchGithubProfile,
  fetchGithubProfileByAccessToken,
  githubProfile,
  githubUnavailable,
  problem,
  readCookie,
  signupEntities,
  signupResponse
} from "../../../src/http/signup-support.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const oauth = {
  authStub: false,
  githubOAuth: { clientId: "c", clientSecret: "s" }
} as const;

describe("signup support", () => {
  test("builds signup entities and response payloads", () => {
    const entities = signupEntities(
      {
        avatarUrl: "https://example.com/avatar.png",
        email: "user@example.com",
        emailVerified: true,
        githubId: "github-1",
        name: "GitHub User"
      },
      { name: "Workspace", slug: "workspace" }
    );

    expect(entities.user).toMatchObject({
      avatar_url: "https://example.com/avatar.png",
      email: "user@example.com",
      github_id: "github-1",
      name: "GitHub User"
    });
    expect(entities.workspace).toMatchObject({
      archived_at: null,
      name: "Workspace",
      owner_id: entities.user.id,
      plan: "FREE",
      slug: "workspace"
    });
    expect(entities.membership).toMatchObject({
      role: "OWNER",
      user_id: entities.user.id,
      workspace_id: entities.workspace.id
    });
    expect(
      signupResponse(entities.user, entities.workspace, entities.membership)
    ).toMatchObject({ recommended_next_command: "vspec project create" });
  });

  test("handles cookies and problem responses", () => {
    const captured = reply();

    clearOAuthState(captured.fastifyReply);
    githubUnavailable(captured.fastifyReply, "signup");

    expect(captured.headers["set-cookie"]).toBe(
      "vspec_oauth_state=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax"
    );
    expect(captured.statusCode).toBe(502);
    expect(captured.body).toMatchObject({ title: "GitHub is unavailable" });
    expect(cookie("name", "value")).toBe("name=value; HttpOnly; Path=/; SameSite=Lax");
    expect(readCookie("a=1; vspec_session=token-1, other=2", "vspec_session")).toBe(
      "token-1"
    );
    expect(readCookie(undefined, "vspec_session")).toBeUndefined();
    expect(problem(409, "Conflict", { detail: "duplicate" })).toMatchObject({
      detail: "duplicate",
      status: 409,
      title: "Conflict"
    });
  });

  test("builds stub GitHub profiles", () => {
    expect(githubProfile({ authStub: true }, "stub-user")).toMatchObject({
      email: "stub-user@users.noreply.github.com",
      emailVerified: true,
      githubId: "stub-user"
    });
    expect(githubProfile({ authStub: true }, "stub-unverified-email")).toMatchObject({
      email: "",
      emailVerified: false
    });
    expect(() =>
      githubProfile({ authStub: true }, "stub-github-network-failure")
    ).toThrow("GitHub is unavailable.");
    expect(() => githubProfile({ authStub: false }, "stub-user")).toThrow(
      "GitHub OAuth is not configured."
    );
  });

  test("fetches real GitHub profiles through code exchange", async () => {
    mockFetch(
      jsonResponse({ access_token: "real-token" }),
      jsonResponse({ avatar_url: "", email: null, id: 123, login: "octo", name: "" })
    );

    await expect(fetchGithubProfile(oauth, "code-1")).resolves.toEqual({
      avatarUrl: "",
      email: "",
      emailVerified: false,
      githubId: "123",
      name: "octo"
    });
  });

  test("fetches real GitHub profiles by access token", async () => {
    mockFetch(
      jsonResponse({
        avatar_url: "https://example.com/avatar.png",
        email: "octo@example.com",
        id: "octo-id",
        name: "Octo"
      })
    );

    await expect(
      fetchGithubProfileByAccessToken(oauth, "real-token")
    ).resolves.toMatchObject({
      avatarUrl: "https://example.com/avatar.png",
      email: "octo@example.com",
      emailVerified: true,
      githubId: "octo-id",
      name: "Octo"
    });
  });

  test("returns undefined for GitHub network and payload failures", async () => {
    await expect(
      fetchGithubProfile({ authStub: false }, "code")
    ).resolves.toBeUndefined();
    await expect(
      fetchGithubProfileByAccessToken({ authStub: true }, "invalid-token")
    ).resolves.toBeUndefined();
    mockFetch(jsonResponse({}));
    await expect(fetchGithubProfile(oauth, "code")).resolves.toBeUndefined();
    mockFetch(jsonResponse({ access_token: "token" }), jsonResponse([]));
    await expect(fetchGithubProfile(oauth, "code")).resolves.toBeUndefined();
    mockFetch(jsonResponse({ id: null }));
    await expect(
      fetchGithubProfileByAccessToken(oauth, "token")
    ).resolves.toBeUndefined();
    await expect(
      fetchGithubProfileByAccessToken({ authStub: false }, "token")
    ).resolves.toBeUndefined();
  });
});

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    headers: Record<string, unknown>;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply,
    headers: {}
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    header: (name: string, value: unknown) => {
      captured.headers[name] = value;
      return captured.fastifyReply;
    },
    send: (body: unknown) => {
      captured.body = body;
      return body;
    }
  } as unknown as FastifyReply;
  return captured;
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}
