import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI --format=agent write paths", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-agent-format-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "AGT",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent actor create", async () => {
    const result = await expectOk(
      runCli(
        [
          "actor",
          "create",
          "--project-id",
          seed.projectId,
          "--name",
          "Support Agent",
          "--type",
          "SUPPORTING",
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    expectAgentEnvelope(result.stdout, "actor");
  });

  test("agent stakeholder create", async () => {
    const result = await expectOk(
      runCli(
        [
          "stakeholder",
          "create",
          "--project-id",
          seed.projectId,
          "--name",
          "Operations",
          "--type",
          "INTERNAL",
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    expectAgentEnvelope(result.stdout, "stakeholder");
  });

  test("agent goal create", async () => {
    const result = await expectOk(
      runCli(
        [
          "goal",
          "create",
          "--project-id",
          seed.projectId,
          "--actor-id",
          seed.actorId,
          "--description",
          "Reviews checkout status",
          "--level",
          "USER_GOAL",
          "--priority",
          "P1",
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    expectAgentEnvelope(result.stdout, "goal");
  });

  test("agent goal list", async () => {
    await createGoal("Reviews order history");
    const result = await expectOk(
      runCli(
        ["goal", "list", "--project-id", seed.projectId, "--format=agent"],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    expectAgentEnvelope(result.stdout, "actors");
  });

  test("agent goal promote", async () => {
    const goalId = await createGoal("Tracks shipment status");
    const result = await expectOk(
      runCli(["goal", "promote", goalId, "--format=agent"], seed.env)
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    expectAgentEnvelope(result.stdout, "usecase");
  });

  test("agent usecase create", async () => {
    const result = await expectOk(
      runCli(
        [
          "usecase",
          "create",
          "--project-id",
          seed.projectId,
          "--title",
          "Reviews delivery address",
          "--primary-actor",
          "Customer",
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    expectAgentEnvelope(result.stdout, "usecase");
  });
});

async function createGoal(description: string): Promise<string> {
  const result = await expectOk(
    runCli(
      [
        "goal",
        "create",
        "--project-id",
        seed.projectId,
        "--actor-id",
        seed.actorId,
        "--description",
        description,
        "--level",
        "USER_GOAL",
        "--priority",
        "P1"
      ],
      seed.env
    )
  );
  const goalId = result.stdout.match(/Goal id ([^\s]+)/u)?.[1];
  expect(goalId).toBeDefined();
  return goalId as string;
}

function expectAgentEnvelope(stdout: string, dataKey: string): void {
  const envelope = JSON.parse(stdout) as Record<string, unknown>;

  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(envelope.data).toHaveProperty(dataKey);
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
}
