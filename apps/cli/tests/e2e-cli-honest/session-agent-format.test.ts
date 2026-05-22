import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;
type SessionAgentEnvelope = {
  context: {
    session_id: null | string;
  };
  data: {
    released_lock_ids?: string[];
    session: {
      ended_at?: string;
      id: string;
      project_id?: string;
      started_at?: string;
      status: string;
    };
    session_file?: {
      path: string;
    };
    sessions?: unknown[];
    summary?: {
      total_conflicts: number;
    };
    total?: number;
  };
  format_version: 1;
  suggested_next_actions: unknown[];
  warnings: unknown[];
};

let server: TestServer;
let seed: CliSeed;

describe("honest CLI session --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-session-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "SAG",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent session start", async () => {
    const result = await expectOk(runCli([
      "session",
      "start",
      "--intent",
      "Implement session envelope",
      "--pin",
      seed.usecaseKey,
      "--agent-type",
      "CODEX",
      "--project-id",
      seed.projectId,
      "--format=agent"
    ], seed.env));

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    const session = envelope.data.session;
    const sessionFile = requiredValue(envelope.data.session_file);
    expect(session.id).toBeTypeOf("string");
    expect(session.project_id).toBe(seed.projectId);
    expect(session.started_at).toBeTypeOf("string");
    expect(session.status).toBe("ACTIVE");
    expect(sessionFile.path).toBe(".vspec/session.json");
    expect(envelope.context.session_id).toBe(session.id);
  });

  test("agent session list", async () => {
    const result = await expectOk(runCli([
      "session",
      "list",
      "--project-id",
      seed.projectId,
      "--format=agent"
    ], seed.env));

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    expect(Array.isArray(envelope.data.sessions)).toBe(true);
    expect(envelope.data.total).toBeGreaterThanOrEqual(1);
    expect(requiredValue(envelope.data.summary).total_conflicts).toBeTypeOf("number");
    expect(envelope.context.session_id).toBeNull();
  });

  test("agent session complete", async () => {
    const id = await startSession();
    const result = await expectOk(runCli([
      "session",
      "complete",
      id,
      "--summary",
      "Session envelope verified",
      "--no-merge",
      "--format=agent"
    ], seed.env));

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    const session = envelope.data.session;
    const sessionFile = requiredValue(envelope.data.session_file);
    expect(session.id).toBe(id);
    expect(session.ended_at).toBeTypeOf("string");
    expect(session.status).toBe("COMPLETED");
    expect(Array.isArray(envelope.data.released_lock_ids)).toBe(true);
    expect(sessionFile.path).toBe(".vspec/session.json");
    expect(envelope.context.session_id).toBe(id);
  });
});

async function startSession(): Promise<string> {
  const result = await expectOk(runCli([
    "session",
    "start",
    "--intent",
    "Implement session envelope",
    "--pin",
    seed.usecaseKey,
    "--agent-type",
    "CODEX",
    "--project-id",
    seed.projectId,
    "--format=agent"
  ], seed.env));
  return expectAgentEnvelope(result.stdout).data.session.id;
}

function expectAgentEnvelope(stdout: string): {
  context: { session_id: null | string };
  data: SessionAgentEnvelope["data"];
} {
  const envelope = JSON.parse(stdout) as unknown as SessionAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}

function requiredValue<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  return value as T;
}
