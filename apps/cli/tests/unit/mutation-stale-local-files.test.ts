import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { runMutationCommand } from "../../src/application/mutation-command.js";

type AgentEnvelope = {
  affected_files: Array<{ path: string; revision: string }>;
  data: unknown;
  status: "error" | "ok";
  suggested_next_actions: Array<{ command: string; reason?: string }>;
};

const roots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  process.exitCode = undefined;
  while (roots.length > 0) {
    rmSync(roots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("mutation stale local file handling", () => {
  test("materializes affected files when project context is available", async () => {
    const root = fixtureRoot();
    stubFetch();
    const lines: string[] = [];

    await runMutationCommand(mutation(), context({ projectId: "project-1", root }), {
      format: "agent",
      human: () => undefined,
      writeLine: (line) => lines.push(line)
    });

    const envelope = JSON.parse(lines.join("\n")) as AgentEnvelope;
    expect(envelope.status).toBe("ok");
    expect(envelope.affected_files).toEqual([
      { path: "specs/UC-001.md", revision: "revision-2" }
    ]);
    expect(envelope.suggested_next_actions).toEqual([]);
    expect(readFileSync(join(root, "specs/UC-001.md"), "utf8")).toBe(
      "# Updated spec\n"
    );
  });

  test("suggests pull when project context is unavailable", async () => {
    const root = fixtureRoot();
    const fetchSpy = stubFetch();
    const lines: string[] = [];

    await runMutationCommand(mutation(), context({ projectId: null, root }), {
      format: "agent",
      human: () => undefined,
      writeLine: (line) => lines.push(line)
    });

    const envelope = JSON.parse(lines.join("\n")) as AgentEnvelope;
    expect(envelope.status).toBe("ok");
    expect(envelope.affected_files).toEqual([]);
    expect(envelope.suggested_next_actions).toContainEqual({
      command: "vspec pull",
      reason:
        "Local spec files may be stale after this mutation; run vspec pull to refresh them."
    });
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "https://api.example.test/v1/projects/project-1/sync/pull",
      expect.anything()
    );
  });
});

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-mutation-stale-"));
  roots.push(root);
  return root;
}

function mutation() {
  return {
    body: { action: "Adds a step." },
    method: "POST" as const,
    path: "/v1/scenarios/scenario-1/steps",
    selectData: (body: unknown) => body
  };
}

function context(input: { projectId: string | null; root: string }) {
  return {
    apiUrl: "https://api.example.test",
    branch: "main",
    cookie: "vspec_session=session-token",
    dryRun: false,
    projectId: input.projectId,
    root: input.root
  };
}

function stubFetch() {
  const fetchSpy = vi.fn((input: string | URL) => {
    const url = input.toString();
    return Promise.resolve(
      jsonResponse(
        url.endsWith("/sync/pull")
          ? {
              cursor: "cursor-2",
              files: [
                {
                  content: "# Updated spec\n",
                  path: "specs/UC-001.md",
                  revision: "revision-2"
                }
              ]
            }
          : { step: { id: "step-1" } }
      )
    );
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function jsonResponse(body: unknown): Response {
  return {
    headers: new Headers(),
    json: () => Promise.resolve(body),
    ok: true,
    status: 200
  } as Response;
}
