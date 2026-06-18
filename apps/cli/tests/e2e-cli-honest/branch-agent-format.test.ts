import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type BranchAgentEnvelope = {
  context: {
    branch: null | string;
  };
  data: {
    branch: {
      id: string;
      name: string;
      status: string;
    };
  };
  format_version: 1;
  suggested_next_actions: unknown[];
  warnings: unknown[];
};
type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI branch create --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-branch-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "BAG",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    if (server) await server.stop();
  });

  test("agent branch create", async () => {
    const result = await expectOk(
      runCli(
        [
          "branch",
          "create",
          "feature/agent-envelope",
          "--from",
          "main",
          "--project-id",
          seed.projectId,
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    expect(envelope.data.branch.id).toBeTypeOf("string");
    expect(envelope.data.branch.name).toBe("feature/agent-envelope");
    expect(envelope.data.branch.status).toBe("ACTIVE");
    expect(envelope.context.branch).toBe("feature/agent-envelope");
  });
});

function expectAgentEnvelope(stdout: string): BranchAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as BranchAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
