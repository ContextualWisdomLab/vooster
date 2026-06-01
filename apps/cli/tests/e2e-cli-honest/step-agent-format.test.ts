import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import {
  addMainScenarioViaCli,
  addMainStepViaCli,
  expectOk,
  seedViaCli,
  type CliSeed
} from "./cli-setup.js";

type StepAgentEnvelope = {
  affected_files?: unknown[];
  context: {
    revision: null | string;
  };
  data: {
    affected_sessions?: string[];
    revision: {
      id?: string;
      severity: string;
      version_number: number;
    };
    scenario_steps?: Array<{
      action: string;
      step_number: number;
    }>;
    step: {
      action: string;
      id: string;
      step_number?: number;
    };
  };
  dry_run?: boolean;
  format_version: 1;
  status?: "ok" | "error";
  suggested_next_actions: unknown[];
  warnings: unknown[];
};
type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;

describe("honest CLI step --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-step-agent-");
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent step add", async () => {
    const seed = await testSeed("SAA");
    const scenarioId = await addMainScenarioViaCli(seed, runCli);
    const result = await expectOk(
      runCli(
        [
          "step",
          "add",
          scenarioId,
          "--actor",
          "Customer",
          "--action",
          "Places an order.",
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    expect(envelope.data.step.id).toBeTypeOf("string");
    expect(envelope.data.step.action).toBe("Places an order.");
    expect(envelope.data.scenario_steps?.at(0)?.step_number).toBe(1);
    expect(envelope.context.revision).toBe(envelope.data.revision.id);
  });

  test("agent step edit", async () => {
    const seed = await testSeed("SAE");
    const step = await addMainStepViaCli(seed, runCli);
    const result = await expectOk(
      runCli(
        [
          "step",
          "edit",
          step.stepId,
          "--action",
          "Reviews the order.",
          "--base-revision",
          step.baseRevision,
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const envelope = expectAgentEnvelope(result.stdout);
    expect(envelope.data.step.id).toBe(step.stepId);
    expect(envelope.data.step.action).toBe("Reviews the order.");
    expect(envelope.context.revision).toBeNull();
  });
});

function testSeed(projectKey: string): Promise<CliSeed> {
  return seedViaCli({
    apiUrl: server.apiUrl,
    projectKey,
    runCli
  });
}

function expectAgentEnvelope(stdout: string): StepAgentEnvelope {
  const envelope = JSON.parse(stdout) as unknown as StepAgentEnvelope;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}
