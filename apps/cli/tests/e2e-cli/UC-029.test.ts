import { mkdtempSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
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
  };
};
type HistoryResponse = { revisions: Array<{ revision: string }> };

const tempRoots: string[] = [];

afterEach(() => {
  cleanupCliE2e();
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("UC-029 CLI - Sync local files with the server", () => {
  test("MAIN: project member pulls canonical markdown and pushes an edited file", async () => {
    const server = await startNetworkServer("vspec-cli-uc029-");
    const root = mkdtempSync(join(tmpdir(), "vspec-cli-sync-root-"));
    tempRoots.push(root);
    try {
      const setup = await createSyncReadyUseCase(server.apiUrl);
      const filePath = join(root, "specs", `${setup.usecaseKey}.md`);
      const pulled = await runCli([
        "pull",
        "--project-id",
        setup.projectId,
        "--root",
        root,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(pulled.stderr).toBe("");
      expect(pulled.status).toBe(0);
      expect(pulled.stdout).toContain(`Cursor ${setup.baseRevision}`);
      expect(pulled.stdout).toContain(`File specs/${setup.usecaseKey}.md`);
      expect(await readFile(filePath, "utf8")).toContain(`# Reviews a refund`);

      const edited = (await readFile(filePath, "utf8")).replace(
        "# Reviews a refund",
        "# Reviews a refund quickly"
      );
      await writeFile(filePath, edited);
      const pushed = await runCli([
        "push",
        "--project-id",
        setup.projectId,
        "--root",
        root,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(pushed.stderr).toBe("");
      expect(pushed.status).toBe(0);
      expect(pushed.stdout).toContain(`Result specs/${setup.usecaseKey}.md OK`);
      expect(pushed.stdout).toContain(`Cache specs/${setup.usecaseKey}.md SYNCED`);
      expect(pushed.stdout).toContain("vspec pull");
      const synced = await readFile(filePath, "utf8");
      expect(synced).toContain("# Reviews a refund quickly");
      expect(synced).not.toContain(`revision: ${setup.baseRevision}`);
      const history = await historyRevisions(server.apiUrl, setup.cookie, setup.usecaseId);
      expect(history).toHaveLength(2);
      expect(synced).toContain(`revision: ${history[0] ?? ""}`);
    } finally {
      await server.stop();
    }
  });
});

async function createSyncReadyUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const headers = jsonHeaders(signedUp.cookie);
  const project = await postJson<ProjectResponse>(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    { key: "SYN", name: "Sync", visibility: "PRIVATE" },
    headers
  );
  await postJson(`${apiUrl}/v1/projects/${project.project.id}/actors`, {
    aliases: ["Reviewer"],
    description: "Person syncing specs.",
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
    projectId: project.project.id,
    usecaseId: usecase.usecase.id,
    usecaseKey: usecase.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await postJson<OAuthStartResponse>(`${apiUrl}/v1/auth/github/start`, {
    workspace: {
      name: "CLI Sync",
      slug: "cli-sync"
    }
  }, jsonHeaders());
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-sync-owner");
  callbackUrl.searchParams.set("state", start.state);

  const callback = await fetch(callbackUrl, { headers: { Cookie: start.cookie } });
  const callbackBody = await callback.json() as SignupResponse;

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    workspaceId: callbackBody.workspace.id
  };
}

async function historyRevisions(apiUrl: string, cookie: string, usecaseId: string) {
  const response = await fetch(`${apiUrl}/v1/usecases/${usecaseId}/revisions`, {
    headers: { Cookie: cookie }
  });
  const body = await response.json() as HistoryResponse;
  return body.revisions.map((revision) => revision.revision);
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
