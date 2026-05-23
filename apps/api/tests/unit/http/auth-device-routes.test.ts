import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import type { StoredWorkspace } from "../../../src/domain/entities/index.js";
import { registerDeviceAuthRoutes } from "../../../src/http/auth-device-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import { createMemoryMembershipStore } from "../../../src/infrastructure/memory-membership-store.js";
import { createMemoryUserStore } from "../../../src/infrastructure/memory-user-store.js";
import { createMemoryWorkspaceStore } from "../../../src/infrastructure/memory-workspace-store.js";

let currentApp: FastifyInstance | undefined;

afterEach(async () => {
  await currentApp?.close();
  currentApp = undefined;
});

describe("device auth routes", () => {
  test("rejects malformed token requests", async () => {
    const context = routeContext();
    const response = await context.app.inject({
      method: "POST",
      url: "/v1/auth/github/token",
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<ProblemBody>()).toMatchObject({
      status: 400,
      title: "Invalid device token request"
    });
  });

  test("reports unavailable GitHub profiles", async () => {
    const context = routeContext();
    const response = await context.app.inject({
      method: "POST",
      url: "/v1/auth/github/token",
      payload: { access_token: "not-a-stub-token" }
    });

    expect(response.statusCode).toBe(502);
    expect(response.json<ProblemBody>()).toMatchObject({
      status: 502,
      title: "GitHub is unavailable"
    });
  });

  test("signs up explicit workspace requests", async () => {
    const context = routeContext();
    const response = await context.app.inject({
      method: "POST",
      url: "/v1/auth/github/token",
      payload: {
        access_token: "stub-access-token-device-user",
        workspace: { name: "Device Workspace", slug: "device-workspace" }
      }
    });

    const body = response.json<SignupBody>();
    expect(response.statusCode).toBe(201);
    expect(body.workspace.slug).toBe("device-workspace");
    expect(body.recommended_next_command).toBe("vspec project create");
    expect(context.state.sessionsByToken.size).toBe(1);
  });

  test("creates a default workspace when device login finds no user", async () => {
    const context = routeContext();
    const response = await context.app.inject({
      method: "POST",
      url: "/v1/auth/github/token",
      payload: { access_token: "stub-access-token-First.User" }
    });

    const body = response.json<LoginBody>();
    expect(response.statusCode).toBe(200);
    expect(body.user.github_id).toBe("First.User");
    expect(body.workspaces[0]?.slug).toBe("github-first-user");
    expect(context.state.sessionsByToken.size).toBe(1);
  });

  test("reports fallback workspace slug conflicts", async () => {
    const context = routeContext();
    await context.workspaceStore.saveWorkspace(storedWorkspace("github-first-user"));

    const response = await context.app.inject({
      method: "POST",
      url: "/v1/auth/github/token",
      payload: { access_token: "stub-access-token-First.User" }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json<ProblemBody>().title).toBe("Workspace slug is already taken");
  });

  test("clears the current session on logout", async () => {
    const context = routeContext();
    context.state.sessionsByToken.set("session-1", "user-1");
    const response = await context.app.inject({
      headers: { cookie: "other=value; vspec_session=session-1" },
      method: "POST",
      url: "/v1/auth/logout"
    });

    expect(response.statusCode).toBe(204);
    expect(context.state.sessionsByToken.has("session-1")).toBe(false);

    const noSession = await context.app.inject({
      method: "POST",
      url: "/v1/auth/logout"
    });
    expect(noSession.statusCode).toBe(204);
  });
});

type ProblemBody = {
  status: number;
  title: string;
};

type SignupBody = {
  recommended_next_command: string;
  workspace: { slug: string };
};

type LoginBody = {
  user: { github_id: string; id: string };
  workspaces: Array<{ id: string; role: string; slug: string }>;
};

function routeContext() {
  const app = Fastify();
  currentApp = app;
  const state: SignupState = {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map()
  };
  const membershipStore = createMemoryMembershipStore(() => Promise.resolve(undefined));
  const userStore = createMemoryUserStore();
  const workspaceStore = createMemoryWorkspaceStore();
  registerDeviceAuthRoutes(
    app,
    { authStub: true },
    state,
    membershipStore,
    userStore,
    workspaceStore
  );
  return { app, membershipStore, state, userStore, workspaceStore };
}

function storedWorkspace(slug: string): StoredWorkspace {
  return {
    archived_at: null,
    id: "workspace-1",
    name: "Existing Workspace",
    owner_id: "user-1",
    plan: "FREE",
    slug
  };
}
