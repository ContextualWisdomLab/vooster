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
type BranchRevisionResponse = { revision_id: string };

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-026 CLI - Revert a use case revision", () => {
  test("MAIN: project member appends a forward revision restoring an earlier snapshot", async () => {
    const server = await startNetworkServer("vspec-cli-uc026-");
    try {
      const setup = await createAdvancedUseCase(server.apiUrl);
      const result = await runCli([
        "revert",
        setup.usecaseId,
        "--to",
        setup.targetRevision,
        "--summary",
        "Restore refund wording",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`UseCase ${setup.usecaseId}`);
      expect(result.stdout).toContain("Title Reviews a refund");
      expect(result.stdout).toContain(`Change Revert to ${setup.targetRevision}`);
      expect(result.stdout).toContain(`Parent ${setup.previousHead}`);
      expect(result.stdout).toContain("Version 3");
      expect(result.stdout).toContain("Impact NON_BREAKING");
      expect(result.stdout).toContain("Affected sessions none");
      expect(result.stdout).toContain("Affected branches none");
      expect(result.stdout).toContain(`vspec history ${setup.usecaseKey}`);
      expect(result.stdout).toContain("vspec session list --status=active");
    } finally {
      await server.stop();
    }
  });
});

async function createAdvancedUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const headers = jsonHeaders(signedUp.cookie);
  const project = await postJson<ProjectResponse>(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    { key: "REV", name: "Revert", visibility: "PRIVATE" },
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
  const advanced = await postJson<BranchRevisionResponse>(
    `${apiUrl}/__test/usecases/${usecase.usecase.id}/revisions`,
    { severity: "NON_BREAKING", title: "Reviews a refund quickly" },
    headers
  );

  return {
    cookie: signedUp.cookie,
    previousHead: advanced.revision_id,
    targetRevision: usecase.usecase.current_revision_id,
    usecaseId: usecase.usecase.id,
    usecaseKey: usecase.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await postJson<OAuthStartResponse>(`${apiUrl}/v1/auth/github/start`, {
    workspace: {
      name: "CLI Revert",
      slug: "cli-revert"
    }
  }, jsonHeaders());
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-revert-owner");
  callbackUrl.searchParams.set("state", start.state);

  const callback = await fetch(callbackUrl, {
    headers: {
      Cookie: start.cookie
    }
  });
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
