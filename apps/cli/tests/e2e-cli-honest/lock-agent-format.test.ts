import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type LockAgentEnvelope = {
  context: {
    session_id: null | string;
  };
  data: {
    lock: {
      held_by_session_id: null | string;
      id: string;
      lock_type: string;
      target_id: string;
    };
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};
type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI lock acquire --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-lock-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "LAG",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent lock acquire", async () => {
    const result = await expectOk(
      runCli(
        [
          "lock",
          seed.usecaseKey,
          "--type",
          "semantic",
          "--reason",
          "Agent is editing the lock envelope.",
          "--ttl",
          "15",
          "--session",
          "session-agent-lock",
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    expect(envelope.data.lock.id).toBeTypeOf("string");
    expect(envelope.data.lock.lock_type).toBe("SEMANTIC");
    expect(envelope.data.lock.target_id).toBeTypeOf("string");
    expect(envelope.data.lock.held_by_session_id).toBe("session-agent-lock");
    expect(envelope.context.session_id).toBe("session-agent-lock");
    expect(envelope.suggested_next_actions.at(0)?.command).toContain(
      "vspec lock renew"
    );
  });

  test("agent lock release", async () => {
    const acquire = await expectOk(
      runCli(
        [
          "lock",
          seed.usecaseKey,
          "--type",
          "semantic",
          "--reason",
          "Agent is checking release envelopes.",
          "--ttl",
          "15",
          "--session",
          "session-agent-lock",
          "--format=agent"
        ],
        seed.env
      )
    );
    const lockId = expectAgentEnvelope(acquire.stdout).data.lock.id;

    const release = await expectOk(
      runCli(
        [
          "lock",
          "release",
          lockId,
          "--session",
          "session-agent-lock",
          "--format=agent"
        ],
        seed.env
      )
    );

    const envelope = expectAgentEnvelope(release.stdout);
    expect(envelope.data.lock.id).toBe(lockId);
    expect(envelope.context.session_id).toBe("session-agent-lock");
    expect(envelope.suggested_next_actions).toEqual([]);
  });
});

function expectAgentEnvelope(stdout: string): LockAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as LockAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
