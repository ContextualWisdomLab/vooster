import { afterEach, describe, expect, test, vi } from "vitest";

import { runApiKey } from "../../src/commands/api-key.js";
import { runMember } from "../../src/commands/member.js";

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
    scopes: string[];
  };
  plaintext_token?: string;
};

type ApiKeyListData = {
  api_keys: Array<{
    id: string;
    name: string;
    revoked_at: null | string;
    scopes: string[];
  }>;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("member/api-key --format=agent", () => {
  test("agent member invite", async () => {
    stubFetch(memberInviteResponse());
    const lines: string[] = [];

    await runMember(memberFlags({ format: "agent" }), "invite", (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<MemberInviteData>(stdout);
    expectNoHumanMemberLines(stdout);
    expect(envelope.data.invitation.email).toBe("teammate@example.test");
    expect(envelope.data.invitation.role).toBe("EDITOR");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions.at(0)?.command).toBe("vspec member list");
    expect(envelope.warnings).toEqual([]);
  });

  test("agent api-key create", async () => {
    stubFetch(apiKeyCreateResponse());
    const lines: string[] = [];

    await runApiKey(apiKeyFlags({ format: "agent" }), "create", undefined, (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<ApiKeyData>(stdout);
    expectNoHumanApiKeyLines(stdout);
    expect(envelope.data.api_key.id).toBe("key-1");
    expect(envelope.data.plaintext_token).toBe("vsp_test_token");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions.at(0)?.command).toBe("vspec api-key list");
    expect(envelope.warnings).toEqual([]);
  });

  test("agent api-key list", async () => {
    stubFetch({ api_keys: [apiKeyPayload()] });
    const lines: string[] = [];

    await runApiKey(apiKeyFlags({ format: "agent" }), "list", undefined, (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<ApiKeyListData>(stdout);
    expectNoHumanApiKeyLines(stdout);
    expect(envelope.data.api_keys.at(0)?.id).toBe("key-1");
    expect(envelope.data.api_keys.at(0)).not.toHaveProperty("plaintext_token");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions).toEqual([]);
    expect(envelope.warnings).toEqual([]);
  });

  test("agent api-key revoke", async () => {
    stubFetch(apiKeyRevokeResponse());
    const lines: string[] = [];

    await runApiKey(apiKeyFlags({ format: "agent" }), "revoke", "key-1", (line) => lines.push(line));

    const stdout = lines.join("\n");
    const envelope = expectAgentEnvelope<ApiKeyData>(stdout);
    expectNoHumanApiKeyLines(stdout);
    expect(envelope.data.api_key.id).toBe("key-1");
    expect(envelope.data.api_key.revoked_at).toBe("2026-05-22T00:00:00.000Z");
    expect(envelope.context).toEqual(defaultContext());
    expect(envelope.suggested_next_actions.at(0)?.command).toBe("vspec api-key list");
    expect(envelope.warnings).toEqual([]);
  });

  test("human member and api-key output", async () => {
    stubFetch(memberInviteResponse());
    const inviteLines: string[] = [];
    await runMember(memberFlags(), "invite", (line) => inviteLines.push(line));
    expect(inviteLines).toContain("Invited teammate@example.test");
    expect(inviteLines).toContain("Role EDITOR");
    expect(inviteLines).toContain("vspec member list");

    stubFetch(apiKeyCreateResponse());
    const createLines: string[] = [];
    await runApiKey(apiKeyFlags(), "create", undefined, (line) => createLines.push(line));
    expect(createLines).toContain("ApiKey key-1");
    expect(createLines).toContain("Token vsp_test_token");
    expect(createLines).toContain("Only shown once");

    stubFetch({ api_keys: [apiKeyPayload()] });
    const listLines: string[] = [];
    await runApiKey(apiKeyFlags(), "list", undefined, (line) => listLines.push(line));
    expect(listLines).toContain("ApiKeys 1");
    expect(listLines).toContain("ApiKey key-1");

    stubFetch(apiKeyRevokeResponse());
    const revokeLines: string[] = [];
    await runApiKey(apiKeyFlags(), "revoke", "key-1", (line) => revokeLines.push(line));
    expect(revokeLines).toContain("Revoked 2026-05-22T00:00:00.000Z");
  });
});

function stubFetch(body: unknown): void {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
    headers: new Headers(),
    json: () => Promise.resolve(body),
    ok: true
  } as Response)));
}

function memberFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    email: "teammate@example.test",
    role: "editor",
    "session-cookie": "session-token",
    "workspace-id": "workspace-1",
    ...overrides
  };
}

function apiKeyFlags(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "api-url": "https://api.example.test",
    name: "ci pipeline",
    scopes: "read,write",
    "session-cookie": "session-token",
    "workspace-id": "workspace-1",
    ...overrides
  };
}

function memberInviteResponse() {
  return {
    invitation: {
      email: "teammate@example.test",
      role: "EDITOR"
    },
    suggested_next_actions: [
      { command: "vspec member list" }
    ]
  };
}

function apiKeyCreateResponse() {
  return {
    api_key: apiKeyPayload(),
    plaintext_token: "vsp_test_token",
    suggested_next_actions: [
      { command: "vspec api-key list" }
    ]
  };
}

function apiKeyRevokeResponse() {
  return {
    api_key: apiKeyPayload({ revoked_at: "2026-05-22T00:00:00.000Z" }),
    suggested_next_actions: [
      { command: "vspec api-key list" }
    ]
  };
}

function apiKeyPayload(overrides: Partial<{ revoked_at: null | string }> = {}) {
  return {
    id: "key-1",
    name: "ci pipeline",
    revoked_at: overrides.revoked_at ?? null,
    scopes: ["read", "write"]
  };
}

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

function expectNoHumanMemberLines(stdout: string): void {
  expect(stdout).not.toContain("Invited ");
  expect(stdout).not.toContain("Role ");
}

function expectNoHumanApiKeyLines(stdout: string): void {
  expect(stdout).not.toContain("ApiKey ");
  expect(stdout).not.toContain("ApiKeys ");
  expect(stdout).not.toContain("Name ");
  expect(stdout).not.toContain("Scopes ");
  expect(stdout).not.toContain("Revoked ");
  expect(stdout).not.toContain("Token ");
  expect(stdout).not.toContain("Only shown once");
}
