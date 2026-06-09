import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { runMutationCommand } from "../../src/application/mutation-command.js";
import { collectLocalSyncFiles } from "../../src/commands/sync-files.js";

type SyncPullBody = {
  cursor: string;
  files: Array<{
    content: string;
    path: string;
    revision: string;
  }>;
};

type AgentEnvelope = {
  affected_files: Array<{ path: string; revision: string }>;
  status: "error" | "ok";
};

const roots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
  while (roots.length > 0) {
    rmSync(roots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("push after CLI authoring", () => {
  test("uses the last server head as push base after scenario and step mutations", async () => {
    const root = fixtureRoot();
    stubFetch([
      syncPull("cursor-2", "revision-2", specMarkdown("revision-1", "Scenario")),
      syncPull("cursor-3", "revision-3", specMarkdown("revision-2", "Step"))
    ]);

    await runAuthoringMutation(root, "/v1/usecases/UC-001/scenarios");
    await runAuthoringMutation(root, "/v1/scenarios/scenario-1/steps");

    const local = await collectLocalSyncFiles(root);

    expect(local.warnings).toEqual([]);
    expect(local.files).toHaveLength(1);
    expect(local.files.at(0)?.path).toBe("specs/UC-001.md");
    expect(local.files.at(0)?.base_revision).toBe("revision-3");
    expect(local.files.at(0)?.content).toContain("revision: revision-3");
    expect(readFileSync(specPath(root), "utf8")).toContain("revision: revision-3");
  });
});

async function runAuthoringMutation(root: string, path: string): Promise<void> {
  const lines: string[] = [];
  await runMutationCommand(mutation(path), context(root), {
    format: "agent",
    human: () => undefined,
    writeLine: (line) => lines.push(line)
  });

  const envelope = JSON.parse(lines.join("\n")) as AgentEnvelope;
  expect(envelope.status).toBe("ok");
  expect(envelope.affected_files.at(0)?.path).toBe("specs/UC-001.md");
}

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-push-after-authoring-"));
  roots.push(root);
  return root;
}

function mutation(path: string) {
  return {
    body: { ok: true },
    method: "POST" as const,
    path,
    selectData: (body: unknown) => body
  };
}

function context(root: string) {
  return {
    apiUrl: "https://api.example.test",
    branch: "main",
    cookie: "vspec_session=session-token",
    dryRun: false,
    projectId: "project-1",
    root
  };
}

function stubFetch(syncPulls: SyncPullBody[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL) => {
      const url = input.toString();
      const body = url.endsWith("/sync/pull")
        ? (syncPulls.shift() ?? syncPull("cursor-empty", "revision-empty", ""))
        : { ok: true };
      return Promise.resolve(jsonResponse(body));
    })
  );
}

function syncPull(cursor: string, revision: string, content: string): SyncPullBody {
  return {
    cursor,
    files: [
      {
        content,
        path: "specs/UC-001.md",
        revision
      }
    ]
  };
}

function specMarkdown(revision: string, marker: string): string {
  return `---\nrevision: ${revision}\n---\n# ${marker}\n`;
}

function specPath(root: string): string {
  return join(root, "specs", "UC-001.md");
}

function jsonResponse(body: unknown): Response {
  return {
    headers: new Headers(),
    json: () => Promise.resolve(body),
    ok: true,
    status: 200
  } as Response;
}
