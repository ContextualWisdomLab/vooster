import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type AgentEnvelope<TData> = {
  context: {
    branch: null | string;
    project_key: null | string;
    revision: null | string;
    session_id: null | string;
  };
  data: TData;
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

type MemberInviteData = {
  invitation: {
    email: string;
    role: string;
  };
};

type ApiKeyData = {
  api_key: {
    id: string;
    name: string;
    revoked_at: null | string;
  };
  plaintext_token?: string;
};

type ApiKeyListData = {
  api_keys: Array<{
    id: string;
    name: string;
    revoked_at: null | string;
  }>;
};

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI member/API-key --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-member-api-key-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "ADM",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent member and api-key admin lifecycle", async () => {
    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");

    const invited = await expectOk(
      runCli(
        [
          "member",
          "invite",
          "--email",
          "teammate@example.test",
          "--role",
          "editor",
          "--format=agent"
        ],
        seed.env
      )
    );
    const inviteEnvelope = expectAgentEnvelope<MemberInviteData>(invited.stdout);
    expect(inviteEnvelope.context).toEqual(defaultContext());
    expect(inviteEnvelope.data.invitation.email).toBe("teammate@example.test");

    const created = await expectOk(
      runCli(
        [
          "api-key",
          "create",
          "--name",
          "ci pipeline",
          "--scopes",
          "read,write",
          "--format=agent"
        ],
        seed.env
      )
    );
    const createEnvelope = expectAgentEnvelope<ApiKeyData>(created.stdout);
    expect(createEnvelope.context).toEqual(defaultContext());
    expect(createEnvelope.data.api_key.id.length).toBeGreaterThan(0);
    expect(createEnvelope.data.plaintext_token).toMatch(/^vsp_[A-Za-z0-9]{32,}/u);
    const keyId = createEnvelope.data.api_key.id;

    const listed = await expectOk(
      runCli(["api-key", "list", "--format=agent"], seed.env)
    );
    const listEnvelope = expectAgentEnvelope<ApiKeyListData>(listed.stdout);
    expect(listEnvelope.context).toEqual(defaultContext());
    const listedKey = listEnvelope.data.api_keys.find((apiKey) => apiKey.id === keyId);
    expect(listedKey?.name).toBe("ci pipeline");
    expect(listedKey).not.toHaveProperty("plaintext_token");

    const revoked = await expectOk(
      runCli(["api-key", "revoke", keyId, "--format=agent"], seed.env)
    );
    const revokeEnvelope = expectAgentEnvelope<ApiKeyData>(revoked.stdout);
    expect(revokeEnvelope.context).toEqual(defaultContext());
    expect(revokeEnvelope.data.api_key.id).toBe(keyId);
    expect(revokeEnvelope.data.api_key.revoked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });
});

function expectAgentEnvelope<TData>(stdout: string): AgentEnvelope<TData> {
  const envelope = JSON.parse(stdout) as unknown as AgentEnvelope<TData>;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}

function defaultContext(): AgentEnvelope<unknown>["context"] {
  return {
    branch: null,
    project_key: null,
    revision: null,
    session_id: null
  };
}
