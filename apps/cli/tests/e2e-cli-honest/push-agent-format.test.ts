import { mkdtempSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

type PushData = {
  cache: {
    entries: Array<{
      path: string;
      revision: string;
      status: string;
    }>;
  };
  results: Array<{
    current_revision: string;
    path: string;
    status: string;
  }>;
  suggested_next_actions: Array<{ command: string }>;
};

type PullData = {
  cursor: string;
  files: Array<{
    path: string;
    revision: string;
  }>;
};

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

const tempRoots: string[] = [];
let server: TestServer;
let seed: CliSeed;
const usecaseTitle = "Places an order";

describe("honest CLI push --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-push-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "PAG",
      runCli,
      usecaseTitle
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
    }
  });

  test("agent push writes canonical file revisions", async () => {
    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const root = tempRoot();
    const pulled = await expectOk(runCli([
      "pull",
      "--project-id",
      seed.projectId,
      "--root",
      root,
      "--format=agent"
    ], seed.env));
    const pullEnvelope = expectAgentEnvelope<PullData>(pulled.stdout);
    const filePath = join(root, "specs", `${seed.usecaseKey}.md`);
    const original = await readFile(filePath, "utf8");
    await writeFile(filePath, original.replace(`# ${usecaseTitle}`, `# ${usecaseTitle} updated`));

    const pushed = await expectOk(runCli([
      "push",
      "--project-id",
      seed.projectId,
      "--root",
      root,
      "--format=agent"
    ], seed.env));

    const pushEnvelope = expectAgentEnvelope<PushData>(pushed.stdout);
    expect(pushEnvelope.context).toEqual(defaultContext());
    expect(pushEnvelope.data.results.at(0)?.path).toBe(`specs/${seed.usecaseKey}.md`);
    expect(pushEnvelope.data.results.at(0)?.status).toBe("OK");
    expect(pushEnvelope.data.cache.entries.at(0)?.status).toBe("SYNCED");
    expect(pushEnvelope.data.suggested_next_actions).toEqual(pushEnvelope.suggested_next_actions);
    expect(pushEnvelope.suggested_next_actions.at(0)?.command).toBe("vspec pull");
    const pushedRevision = pushEnvelope.data.results.at(0)?.current_revision ?? "";
    expect(pushedRevision).not.toBe(pullEnvelope.data.cursor);
    const synced = await readFile(filePath, "utf8");
    expect(synced).toContain(`revision: ${pushedRevision}`);
    expect(synced).toContain(`# ${usecaseTitle} updated`);
  });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-push-agent-honest-"));
  tempRoots.push(root);
  return root;
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
