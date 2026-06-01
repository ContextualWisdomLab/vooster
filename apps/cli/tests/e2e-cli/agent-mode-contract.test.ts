import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

type SignupResponse = { workspace: { id: string } };
type OAuthStartResponse = { state: string };
type ProjectResponse = { project: { id: string } };
type UsecaseListResponse = { items: Array<{ title: string }> };

type SuccessEnvelope = {
  status: "ok" | "error";
  error?: { code: string; message: string };
  data: { usecase: { id: string; key: string } } | null;
  affected_files: Array<{ path: string; revision: string }>;
  dry_run: boolean;
  suggested_next_actions: Array<{ command: string; reason?: string }>;
  format_version: number;
};

type ErrorEnvelope = {
  status: "error";
  error: { code: string; message: string };
  data: null;
  affected_files: Array<unknown>;
  dry_run: boolean;
  suggested_next_actions: Array<{ command: string; reason?: string }>;
  format_version: number;
};

afterEach(() => {
  cleanupCliE2e();
});

describe("vspec usecase create --format=agent — auto-export & error envelope & dry-run", () => {
  test("OK: envelope reports affected_files and the file exists on disk under --root", async () => {
    const server = await startNetworkServer("vspec-cli-agent-contract-ok-");
    const workdir = await mkdtemp(join(tmpdir(), "vspec-agent-ok-"));
    try {
      const setup = await prepareProject(server.apiUrl, "ACO", "Agent Contract Ok");

      const result = await runCli([
        "usecase",
        "create",
        "--project-id",
        setup.projectId,
        "--primary-actor",
        "Customer",
        "--title",
        "Reviews auto-exported flow",
        "--format=agent",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl,
        "--root",
        workdir
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);

      const envelope = JSON.parse(result.stdout) as SuccessEnvelope;
      expect(envelope.status).toBe("ok");
      expect(envelope.error).toBeUndefined();
      expect(envelope.dry_run).toBe(false);
      expect(envelope.format_version).toBe(1);
      expect(envelope.data?.usecase.id).toBeTruthy();

      expect(envelope.affected_files.length).toBeGreaterThan(0);
      const usecaseFile = envelope.affected_files.find((file) =>
        /^specs\/[A-Z]+-\d+\.md$/.test(file.path)
      );
      expect(usecaseFile).toBeDefined();
      if (!usecaseFile) {
        throw new Error("usecaseFile missing despite toBeDefined() above");
      }

      const content = await readFile(join(workdir, usecaseFile.path), "utf8");
      expect(content).toContain("Reviews auto-exported flow");
    } finally {
      await server.stop();
      await rm(workdir, { recursive: true, force: true });
    }
  });

  test("ERROR: unknown primary-actor returns envelope with error.code + recovery hints", async () => {
    const server = await startNetworkServer("vspec-cli-agent-contract-err-");
    const workdir = await mkdtemp(join(tmpdir(), "vspec-agent-err-"));
    try {
      const setup = await prepareProject(server.apiUrl, "ACE", "Agent Contract Error");

      const result = await runCli([
        "usecase",
        "create",
        "--project-id",
        setup.projectId,
        "--primary-actor",
        "Nonexistent Actor",
        "--title",
        "Reviews failure path",
        "--format=agent",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl,
        "--root",
        workdir
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).not.toBe(0);

      const envelope = JSON.parse(result.stdout) as ErrorEnvelope;
      expect(envelope.status).toBe("error");
      expect(envelope.data).toBeNull();
      expect(envelope.error.code).toBeTruthy();
      expect(envelope.error.message).toBeTruthy();
      expect(envelope.suggested_next_actions.length).toBeGreaterThan(0);
      expect(envelope.affected_files.length).toBe(0);
    } finally {
      await server.stop();
      await rm(workdir, { recursive: true, force: true });
    }
  });

  test("DRY-RUN: no server mutation, no file written, envelope flagged", async () => {
    const server = await startNetworkServer("vspec-cli-agent-contract-dry-");
    const workdir = await mkdtemp(join(tmpdir(), "vspec-agent-dry-"));
    try {
      const setup = await prepareProject(server.apiUrl, "ACD", "Agent Contract DryRun");

      const result = await runCli([
        "usecase",
        "create",
        "--project-id",
        setup.projectId,
        "--primary-actor",
        "Customer",
        "--title",
        "Reviews would-be flow",
        "--format=agent",
        "--dry-run",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl,
        "--root",
        workdir
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);

      const envelope = JSON.parse(result.stdout) as SuccessEnvelope;
      expect(envelope.status).toBe("ok");
      expect(envelope.dry_run).toBe(true);
      expect(envelope.affected_files.length).toBe(0);

      const listResponse = await fetch(
        `${server.apiUrl}/v1/projects/${setup.projectId}/usecases`,
        { headers: { Cookie: setup.cookie } }
      );
      const listBody = (await listResponse.json()) as UsecaseListResponse;
      expect(
        listBody.items.find((u) => u.title === "Reviews would-be flow")
      ).toBeUndefined();
    } finally {
      await server.stop();
      await rm(workdir, { recursive: true, force: true });
    }
  });
});

async function prepareProject(apiUrl: string, key: string, name: string) {
  const signedUp = await signup(apiUrl, key);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key, name, visibility: "PRIVATE" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const projectBody = (await projectResponse.json()) as ProjectResponse;
  await fetch(`${apiUrl}/v1/projects/${projectBody.project.id}/actors`, {
    body: JSON.stringify({
      aliases: [],
      description: "",
      is_human: true,
      name: "Customer",
      type: "PRIMARY"
    }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie
    },
    method: "POST"
  });
  return {
    cookie: signedUp.cookie,
    projectId: projectBody.project.id
  };
}

async function signup(apiUrl: string, suffix: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: `Agent Contract ${suffix}`,
        slug: `agent-contract-${suffix.toLowerCase()}`
      }
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", `stub-agent-${suffix.toLowerCase()}`);
  callbackUrl.searchParams.set("state", startBody.state);
  const callback = await fetch(callbackUrl, {
    headers: { Cookie: start.headers.get("set-cookie") ?? "" }
  });
  const callbackBody = (await callback.json()) as SignupResponse;
  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    workspaceId: callbackBody.workspace.id
  };
}
