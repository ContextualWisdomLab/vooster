import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type LockAgentEnvelope = {
  context: {
    session_id: null | string;
  };
  data: {
    lock: {
      expires_at: string;
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

describe("honest CLI lock renew --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-lock-renew-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "LRA",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    if (server) await server.stop();
  });

  test("agent lock renew", async () => {
    const acquired = await expectOk(
      runCli(
        [
          "lock",
          seed.usecaseKey,
          "--type",
          "semantic",
          "--reason",
          "Agent is editing the lock renew envelope.",
          "--ttl",
          "5",
          "--session",
          "session-agent-lock-renew",
          "--format=agent"
        ],
        seed.env
      )
    );
    const acquiredEnvelope = expectAgentEnvelope(acquired.stdout);

    const renewed = await expectOk(
      runCli(
        [
          "lock",
          "renew",
          acquiredEnvelope.data.lock.id,
          "--ttl",
          "15",
          "--session",
          "session-agent-lock-renew",
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const renewedEnvelope = expectAgentEnvelope(renewed.stdout);
    expect(renewedEnvelope.data.lock.id).toBe(acquiredEnvelope.data.lock.id);
    expect(renewedEnvelope.data.lock.expires_at).not.toBe(
      acquiredEnvelope.data.lock.expires_at
    );
    expect(renewedEnvelope.context.session_id).toBe("session-agent-lock-renew");
    expect(renewedEnvelope.suggested_next_actions).toEqual([]);
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
