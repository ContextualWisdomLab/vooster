import { describe, expect, test } from "vitest";
import {
  authCallbackQuerySchema,
  authDeviceTokenRequestSchema,
  authLoginResponseSchema,
  authSignupResponseSchema,
  authStartRequestSchema,
  authStartResponseSchema
} from "../src/index.js";

describe("auth contracts", () => {
  test("parses OAuth and device request boundaries", () => {
    expect(
      authStartRequestSchema.parse({
        workspace: { name: "Workspace", slug: "workspace" }
      })
    ).toEqual({ workspace: { name: "Workspace", slug: "workspace" } });
    expect(authStartRequestSchema.parse({ flow: "login" })).toEqual({
      flow: "login"
    });
    expect(authCallbackQuerySchema.parse({ code: "code-1", state: "state-1" })).toEqual(
      { code: "code-1", state: "state-1" }
    );
    expect(
      authCallbackQuerySchema.parse({ error: "access_denied", state: "state-1" })
    ).toEqual({ error: "access_denied", state: "state-1" });
    expect(
      authDeviceTokenRequestSchema.parse({
        access_token: "token-1",
        workspace: { name: "Workspace", slug: "workspace" }
      })
    ).toMatchObject({ access_token: "token-1" });
  });

  test("rejects malformed auth request boundaries", () => {
    expect(() =>
      authStartRequestSchema.parse({ workspace: { name: "", slug: "workspace" } })
    ).toThrow();
    expect(() =>
      authCallbackQuerySchema.parse({ code: "", state: "state-1" })
    ).toThrow();
    expect(() => authDeviceTokenRequestSchema.parse({ access_token: "" })).toThrow();
  });

  test("parses auth success responses", () => {
    const started = authStartResponseSchema.parse({
      authorization_url: "https://github.com/login/oauth/authorize",
      state: "state-1"
    });
    expect(started.state).toBe("state-1");

    const signup = authSignupResponseSchema.parse({
      membership: {
        role: "OWNER",
        user_id: "user-1",
        workspace_id: "workspace-1"
      },
      recommended_next_command: "vspec project create",
      user: {
        email: "user@example.com",
        github_id: "github-1",
        id: "user-1"
      },
      workspace: {
        id: "workspace-1",
        name: "Workspace",
        slug: "workspace"
      }
    });
    expect(signup.workspace.slug).toBe("workspace");

    const login = authLoginResponseSchema.parse({
      recommended_next_command: "vspec project create",
      user: {
        github_id: "github-1",
        id: "user-1"
      },
      workspaces: [{ id: "workspace-1", role: "OWNER", slug: "workspace" }]
    });
    expect(login.workspaces[0]?.role).toBe("OWNER");
  });
});
