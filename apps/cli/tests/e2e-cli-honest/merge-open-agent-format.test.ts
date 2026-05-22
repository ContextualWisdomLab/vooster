import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type BranchAgentEnvelope = {
  data: {
    branch: {
      id: string;
      name: string;
    };
  };
  format_version: 1;
};

type MergeOpenAgentEnvelope = {
  context: {
    branch: null | string;
  };
  data: {
    merge_request: {
      id: string;
      status: string;
    };
    source_branch: {
      id: string;
      name: string;
      status: string;
    };
  };
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI merge open --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-merge-open-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "MAG",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent merge open", async () => {
    const branch = await createBranch();
    const result = await expectOk(
      runCli(["merge", "open", branch.data.branch.id, "--format=agent"], seed.env)
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectMergeEnvelope(result.stdout);
    expect(envelope.data.merge_request.id).toBeTypeOf("string");
    expect(envelope.data.source_branch.id).toBe(branch.data.branch.id);
    expect(envelope.data.source_branch.name).toBe(branch.data.branch.name);
    expect(envelope.context.branch).toBe(branch.data.branch.name);
    expect(envelope.suggested_next_actions.at(0)?.command).toContain(
      "vspec merge show"
    );
  });
});

async function createBranch(): Promise<BranchAgentEnvelope> {
  const result = await expectOk(
    runCli(
      [
        "branch",
        "create",
        "agent/merge-open",
        "--project-id",
        seed.projectId,
        "--format=agent"
      ],
      seed.env
    )
  );

  return JSON.parse(result.stdout) as BranchAgentEnvelope;
}

function expectMergeEnvelope(stdout: string): MergeOpenAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as MergeOpenAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
