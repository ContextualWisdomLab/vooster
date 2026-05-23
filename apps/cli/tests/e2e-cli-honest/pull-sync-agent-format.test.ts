import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
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

describe("honest CLI pull/sync --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-pull-sync-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "PSA",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
    }
  });

  test("agent pull and sync write canonical files", async () => {
    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const pullRoot = tempRoot();

    const pulled = await expectOk(
      runCli(
        ["pull", "--project-id", seed.projectId, "--root", pullRoot, "--format=agent"],
        seed.env
      )
    );
    const pullEnvelope = expectAgentEnvelope<PullData>(pulled.stdout);
    expect(pullEnvelope.context).toEqual(defaultContext());
    expect(pullEnvelope.data.cursor.length).toBeGreaterThan(0);
    expect(pullEnvelope.data.files.at(0)?.path).toBe(`specs/${seed.usecaseKey}.md`);
    await expect(
      readFile(join(pullRoot, "specs", `${seed.usecaseKey}.md`), "utf8")
    ).resolves.toContain(seed.usecaseKey);

    const syncRoot = tempRoot();
    const synced = await expectOk(
      runCli(
        ["sync", "--project-id", seed.projectId, "--root", syncRoot, "--format=agent"],
        seed.env
      )
    );
    const syncEnvelope = expectAgentEnvelope<PullData>(synced.stdout);
    expect(syncEnvelope.context).toEqual(defaultContext());
    expect(syncEnvelope.data.cursor).toBe(pullEnvelope.data.cursor);
    expect(syncEnvelope.data.files.at(0)?.path).toBe(`specs/${seed.usecaseKey}.md`);
    await expect(
      readFile(join(syncRoot, "specs", `${seed.usecaseKey}.md`), "utf8")
    ).resolves.toContain(seed.usecaseKey);
  });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-pull-sync-honest-"));
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
