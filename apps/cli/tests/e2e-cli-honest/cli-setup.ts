import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "vitest";

type CliResult = {
  status: number | null;
  stderr: string;
  stdout: string;
};

type RunCli = (args: string[], env?: Record<string, string>) => Promise<CliResult>;

type SeedOverrides = {
  actorName?: string;
  projectKey?: string;
  projectName?: string;
  usecaseTitle?: string;
  workspaceName?: string;
  workspaceSlug?: string;
};

export type CliSeed = {
  actorId: string;
  env: Record<string, string>;
  projectId: string;
  projectKey: string;
  usecaseKey: string;
};

export async function seedViaCli(
  input: {
    apiUrl: string;
    runCli: RunCli;
  } & SeedOverrides
): Promise<CliSeed> {
  const projectKey = input.projectKey ?? "HON";
  const actorName = input.actorName ?? "Customer";
  const configPath = join(mkdtempSync(join(tmpdir(), "vspec-honest-")), "config.json");
  const env = {
    VSPEC_AUTH_STUB: "1",
    VSPEC_AUTH_STUB_ID: `${projectKey.toLowerCase()}-honest-user`,
    VSPEC_API_URL: input.apiUrl,
    VSPEC_CONFIG_PATH: configPath
  };

  await expectOk(
    input.runCli(
      [
        "login",
        "--workspace-name",
        input.workspaceName ?? `${projectKey} Workspace`,
        "--workspace-slug",
        input.workspaceSlug ?? `${projectKey.toLowerCase()}-workspace`
      ],
      env
    )
  );

  const project = await expectOk(
    input.runCli(
      [
        "project",
        "create",
        "--name",
        input.projectName ?? `${projectKey} Project`,
        "--key",
        projectKey
      ],
      env
    )
  );
  const projectId = requiredMatch(
    project.stdout,
    /Project .+ [A-Z0-9]+ ([^\s]+)/u,
    "project id"
  );

  const actor = await expectOk(
    input.runCli(
      [
        "actor",
        "create",
        "--name",
        actorName,
        "--type",
        "PRIMARY",
        "--description",
        "Person buying a product.",
        "--aliases",
        "Buyer",
        "--project-id",
        projectId
      ],
      env
    )
  );
  const actorId = requiredMatch(actor.stdout, /Actor id ([^\s]+)/u, "actor id");

  const usecase = await expectOk(
    input.runCli(
      [
        "usecase",
        "create",
        "--title",
        input.usecaseTitle ?? "Places an order",
        "--primary-actor",
        actorName,
        "--project-id",
        projectId
      ],
      env
    )
  );
  const usecaseKey = requiredMatch(
    usecase.stdout,
    /UseCase ([A-Z0-9]+-\d+)/u,
    "usecase key"
  );

  return {
    actorId,
    env,
    projectId,
    projectKey,
    usecaseKey
  };
}

export async function addStakeholderViaCli(
  seed: CliSeed,
  runCli: RunCli,
  name = "Product Manager"
): Promise<void> {
  await expectOk(
    runCli(
      [
        "stakeholder",
        "create",
        "--project-id",
        seed.projectId,
        "--name",
        name,
        "--type",
        "INTERNAL",
        "--description",
        "Owns the checkout business outcome."
      ],
      seed.env
    )
  );

  await expectOk(
    runCli(
      [
        "usecase",
        "add-stakeholder",
        seed.usecaseKey,
        "--stakeholder",
        name,
        "--interest",
        "Checkout revenue is protected.",
        "--protection-mechanism",
        "Success guarantee"
      ],
      seed.env
    )
  );
}

export async function addMainScenarioViaCli(
  seed: CliSeed,
  runCli: RunCli
): Promise<string> {
  await addStakeholderViaCli(seed, runCli);
  const scenario = await expectOk(
    runCli(["scenario", "add", seed.usecaseKey, "--type", "main-success"], seed.env)
  );

  return requiredMatch(scenario.stdout, /Scenario ([a-f0-9-]+)/u, "scenario id");
}

export async function addMainStepViaCli(
  seed: CliSeed,
  runCli: RunCli
): Promise<{ baseRevision: string; stepId: string }> {
  const scenarioId = await addMainScenarioViaCli(seed, runCli);
  const step = await expectOk(
    runCli(
      [
        "step",
        "add",
        scenarioId,
        "--actor",
        "Customer",
        "--action",
        "Places an order."
      ],
      seed.env
    )
  );

  return {
    baseRevision: requiredMatch(step.stdout, /Revision id ([^\s]+)/u, "revision id"),
    stepId: requiredMatch(step.stdout, /Step ([a-f0-9-]+)/u, "step id")
  };
}

export async function expectOk(result: Promise<CliResult>): Promise<CliResult> {
  const resolved = await result;
  expect(resolved.stderr).toBe("");
  expect(resolved.status).toBe(0);
  return resolved;
}

function requiredMatch(stdout: string, pattern: RegExp, label: string): string {
  const value = stdout.match(pattern)?.[1];
  expect(value, `missing ${label} in ${stdout}`).toBeDefined();
  return value as string;
}
