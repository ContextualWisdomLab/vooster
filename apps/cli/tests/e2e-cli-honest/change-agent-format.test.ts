import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type AgentEnvelope<TData> = {
  context: {
    revision: null | string;
  };
  data: TData;
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

type UsecaseAgentData = {
  title: string;
  usecase: {
    id: string;
    key: string;
  };
};

type ChangePreviewData = {
  preview_id: string;
};

type ChangeCommitData = {
  revisions: Array<{
    entity_id: string;
    revision_id: string;
  }>;
};

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

const tempRoots: string[] = [];
let server: TestServer;

describe("honest CLI change --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-change-agent-");
  }, 30_000);

  afterAll(async () => {
    await server.stop();
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
    }
  });

  test("agent change propose and commit", async () => {
    const seed = await testSeed();
    const shown = await expectOk(
      runCli(["usecase", "show", seed.usecaseKey, "--format=agent"], seed.env)
    );
    const usecase = expectAgentEnvelope<UsecaseAgentData>(shown.stdout);
    const baseRevision = usecase.context.revision;
    expect(baseRevision).toBeTypeOf("string");
    expect(usecase.data.title).toBeTypeOf("string");

    const patchPath = patchFile(
      usecase.data.usecase.id,
      `${usecase.data.title} with audit trail`
    );
    const previewResult = await expectOk(
      runCli(
        [
          "change",
          "propose",
          "--usecase",
          seed.usecaseKey,
          "--base-revision",
          baseRevision ?? "",
          "--patch",
          patchPath,
          "--format=agent"
        ],
        seed.env
      )
    );

    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const preview = expectAgentEnvelope<ChangePreviewData>(previewResult.stdout);
    expect(preview.data.preview_id).toBeTypeOf("string");
    expect(preview.context.revision).toBeNull();
    expect(preview.suggested_next_actions.at(0)?.command).toContain(
      "vspec change commit"
    );

    const commitResult = await expectOk(
      runCli(
        ["change", "commit", "--preview-id", preview.data.preview_id, "--format=agent"],
        seed.env
      )
    );
    const committed = expectAgentEnvelope<ChangeCommitData>(commitResult.stdout);
    const firstRevision = firstCommittedRevision(committed);
    expect(firstRevision.entity_id).toBe(usecase.data.usecase.id);
    expect(firstRevision.revision_id).toBeTypeOf("string");
    expect(committed.context.revision).toBe(firstRevision.revision_id);
  });
});

function testSeed(): Promise<CliSeed> {
  return seedViaCli({
    apiUrl: server.apiUrl,
    projectKey: "CAG",
    runCli
  });
}

function patchFile(usecaseId: string, title: string): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-change-agent-"));
  tempRoots.push(root);
  const path = join(root, "patch.json");
  writeFileSync(
    path,
    JSON.stringify({
      entity_id: usecaseId,
      entity_type: "USECASE",
      fields: { title }
    }),
    "utf8"
  );
  return path;
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

function firstCommittedRevision(envelope: AgentEnvelope<ChangeCommitData>): {
  entity_id: string;
  revision_id: string;
} {
  const firstRevision = envelope.data.revisions[0];
  expect(firstRevision).toBeDefined();
  return firstRevision as { entity_id: string; revision_id: string };
}
