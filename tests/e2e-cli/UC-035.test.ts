import { mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

type SignupResponse = { workspace: { id: string } };
type OAuthStartResponse = { state: string };
type ProjectResponse = { project: { id: string } };
type UseCaseResponse = {
  usecase: {
    current_revision_id: string;
    id: string;
    key: string;
    title: string;
  };
};

const tempRoots: string[] = [];

afterEach(() => {
  cleanupCliE2e();
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("UC-035 CLI - Propose a spec change", () => {
  test("MAIN: agent previews a title change, then commits the preview", async () => {
    const server = await startNetworkServer("vspec-cli-uc035-");
    const root = mkdtempSync(join(tmpdir(), "vspec-cli-change-"));
    tempRoots.push(root);
    try {
      const setup = await createChangeReadyUseCase(server.apiUrl);
      const patchPath = join(root, "title-patch.json");
      await writeFile(patchPath, JSON.stringify({
        entity_id: setup.usecaseId,
        entity_type: "USECASE",
        fields: { title: "Reviews a refund with audit trail" }
      }), "utf8");

      const preview = await runCli([
        "change",
        "propose",
        "--usecase",
        setup.usecaseKey,
        "--base-revision",
        setup.baseRevision,
        "--patch",
        patchPath,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(preview.stderr).toBe("");
      expect(preview.status).toBe(0);
      expect(preview.stdout).toContain("Preview ");
      expect(preview.stdout).toContain("Severity NON_BREAKING");
      expect(preview.stdout).toContain("Affected sessions none");
      expect(preview.stdout).toContain(`Before ${setup.originalTitle}`);
      expect(preview.stdout).toContain("After Reviews a refund with audit trail");
      expect(preview.stdout).toContain("vspec change commit --preview-id");
      const previewId = preview.stdout.match(/Preview ([^\s]+)/)?.[1] ?? "";

      const committed = await runCli([
        "change",
        "commit",
        "--preview-id",
        previewId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(committed.stderr).toBe("");
      expect(committed.status).toBe(0);
      expect(committed.stdout).toContain(`Entity ${setup.usecaseId}`);
      expect(committed.stdout).toMatch(/Revision [0-9a-f-]{36}/);
      expect(committed.stdout).toContain(`vspec history ${setup.usecaseKey}`);
    } finally {
      await server.stop();
    }
  });
});

async function createChangeReadyUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const headers = jsonHeaders(signedUp.cookie);
  const project = await postJson<ProjectResponse>(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    { key: "CHG", name: "Change Preview", visibility: "PRIVATE" },
    headers
  );
  await postJson(`${apiUrl}/v1/projects/${project.project.id}/actors`, {
    aliases: ["Reviewer"],
    description: "Person reviewing refund wording.",
    is_human: true,
    name: "Customer",
    type: "PRIMARY"
  }, headers);
  const usecase = await postJson<UseCaseResponse>(
    `${apiUrl}/v1/projects/${project.project.id}/usecases`,
    { primary_actor: "Customer", title: "Reviews a refund" },
    headers
  );

  return {
    baseRevision: usecase.usecase.current_revision_id,
    cookie: signedUp.cookie,
    originalTitle: usecase.usecase.title,
    usecaseId: usecase.usecase.id,
    usecaseKey: usecase.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await postJson<OAuthStartResponse>(`${apiUrl}/v1/auth/github/start`, {
    workspace: {
      name: "CLI Change Preview",
      slug: "cli-change-preview"
    }
  }, jsonHeaders());
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-change-preview-owner");
  callbackUrl.searchParams.set("state", start.state);

  const callback = await fetch(callbackUrl, { headers: { Cookie: start.cookie } });
  const callbackBody = await callback.json() as SignupResponse;

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    workspaceId: callbackBody.workspace.id
  };
}

async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>
): Promise<T & { cookie: string }> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers,
    method: "POST"
  });
  const responseBody = await response.json() as T;
  if (!response.ok) {
    throw new Error(`Setup request failed with ${String(response.status)}`);
  }
  return { ...responseBody, cookie: response.headers.get("set-cookie") ?? "" };
}

function jsonHeaders(cookie?: string): Record<string, string> {
  return cookie === undefined
    ? { "Content-Type": "application/json" }
    : { "Content-Type": "application/json", Cookie: cookie };
}
