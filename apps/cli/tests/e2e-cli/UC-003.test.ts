import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

type SignupResponse = {
  workspace: {
    id: string;
  };
};

type OAuthStartResponse = {
  state: string;
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-003 CLI - Invite a member", () => {
  test("MAIN: owner invites an editor", async () => {
    const server = await startNetworkServer("vspec-cli-uc003-");
    try {
      const owner = await signupOwner(server.apiUrl);
      const result = await runCli([
        "member",
        "invite",
        "--workspace-id",
        owner.workspaceId,
        "--email",
        "stub-cli-invitee@users.noreply.github.com",
        "--role",
        "EDITOR",
        "--session-cookie",
        owner.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("stub-cli-invitee@users.noreply.github.com");
      expect(result.stdout).toContain("EDITOR");
      expect(result.stdout).toContain("vspec member list");
    } finally {
      await server.stop();
    }
  });
});

async function signupOwner(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Invite",
        slug: "cli-invite"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-invite-owner");
  callbackUrl.searchParams.set("state", startBody.state);

  const callback = await fetch(callbackUrl, {
    headers: {
      Cookie: start.headers.get("set-cookie") ?? ""
    }
  });
  const callbackBody = (await callback.json()) as SignupResponse;

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    workspaceId: callbackBody.workspace.id
  };
}
