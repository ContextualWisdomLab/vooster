import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

type SignupResponse = {
  user: { id: string };
  workspace: { id: string };
};
type OAuthStartResponse = { state: string };

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-032 CLI - Issue and manage API keys", () => {
  test("MAIN: owner creates, lists, and revokes a scoped API key", async () => {
    const server = await startNetworkServer("vspec-cli-uc032-");
    try {
      const owner = await signupOwner(server.apiUrl);
      const created = await runCli([
        "api-key",
        "create",
        "--workspace-id",
        owner.workspaceId,
        "--name",
        "ci pipeline",
        "--scopes",
        "read,write",
        "--session-cookie",
        owner.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(created.stderr).toBe("");
      expect(created.status).toBe(0);
      expect(created.stdout).toContain("ApiKey ");
      expect(created.stdout).toContain("Name ci pipeline");
      expect(created.stdout).toContain("Scopes read, write");
      expect(created.stdout).toMatch(/Token vsp_[A-Za-z0-9]{32,}/);
      expect(created.stdout).toContain("Only shown once");
      expect(created.stdout).toContain("vspec api-key list");
      const keyId = created.stdout.match(/ApiKey ([^\s]+)/)?.[1] ?? "";
      const token = created.stdout.match(/Token (vsp_[A-Za-z0-9]{32,})/)?.[1] ?? "";

      const listed = await runCli([
        "api-key",
        "list",
        "--workspace-id",
        owner.workspaceId,
        "--session-cookie",
        owner.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(listed.stderr).toBe("");
      expect(listed.status).toBe(0);
      expect(listed.stdout).toContain(`ApiKey ${keyId}`);
      expect(listed.stdout).toContain("Name ci pipeline");
      expect(listed.stdout).toContain("Scopes read, write");
      expect(listed.stdout).not.toContain(token);
      expect(listed.stdout).not.toContain("$argon2id$");

      const revoked = await runCli([
        "api-key",
        "revoke",
        keyId,
        "--session-cookie",
        owner.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(revoked.stderr).toBe("");
      expect(revoked.status).toBe(0);
      expect(revoked.stdout).toContain(`ApiKey ${keyId}`);
      expect(revoked.stdout).toMatch(/Revoked \d{4}-\d{2}-\d{2}T/);
      expect(revoked.stdout).toContain("vspec api-key list");
    } finally {
      await server.stop();
    }
  });
});

async function signupOwner(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI API Keys",
        slug: "cli-api-keys"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-api-key-owner");
  callbackUrl.searchParams.set("state", startBody.state);

  const callback = await fetch(callbackUrl, {
    headers: {
      Cookie: start.headers.get("set-cookie") ?? ""
    }
  });
  const callbackBody = (await callback.json()) as SignupResponse;

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    userId: callbackBody.user.id,
    workspaceId: callbackBody.workspace.id
  };
}
