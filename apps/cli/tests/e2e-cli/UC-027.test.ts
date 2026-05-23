import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

type SignupResponse = { workspace: { id: string } };
type OAuthStartResponse = { state: string };
type ProjectResponse = { project: { id: string } };
type UseCaseResponse = {
  usecase: {
    id: string;
    key: string;
  };
};
type BranchRevisionResponse = { revision_id: string };

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-027 CLI - Analyze proposed change impact", () => {
  test("MAIN: project member previews current head impact without writing revisions", async () => {
    const server = await startNetworkServer("vspec-cli-uc027-");
    try {
      const setup = await createAdvancedUseCase(server.apiUrl);
      const result = await runCli([
        "impact",
        setup.usecaseId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Preview ");
      expect(result.stdout).toContain("Cached false");
      expect(result.stdout).toContain("Severity BREAKING");
      expect(result.stdout).toContain("Confidence 1");
      expect(result.stdout).toContain("Affected sessions none");
      expect(result.stdout).toContain("Affected branches none");
      expect(result.stdout).toContain("Affected tests none");
      expect(result.stdout).toContain("Input hash ");
      expect(result.stdout).toContain(`vspec lock ${setup.usecaseKey}`);
      expect(result.stdout).toContain("vspec session list --status=active");
      expect(result.stdout).toContain("vspec changes commit");
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
    { key: "IMP", name: "Impact", visibility: "PRIVATE" },
    headers
  );
  await postJson(
    `${apiUrl}/v1/projects/${project.project.id}/actors`,
    {
      aliases: ["Reviewer"],
      description: "Person reviewing refund wording.",
      is_human: true,
      name: "Customer",
      type: "PRIMARY"
    },
    headers
  );
  const usecase = await postJson<UseCaseResponse>(
    `${apiUrl}/v1/projects/${project.project.id}/usecases`,
    { primary_actor: "Customer", title: "Reviews a refund" },
    headers
  );
  await postJson<BranchRevisionResponse>(
    `${apiUrl}/__test/usecases/${usecase.usecase.id}/revisions`,
    { severity: "BREAKING", title: "Reviews a refund manually" },
    headers
  );

  return {
    cookie: signedUp.cookie,
    usecaseId: usecase.usecase.id,
    usecaseKey: usecase.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await postJson<OAuthStartResponse>(
    `${apiUrl}/v1/auth/github/start`,
    {
      workspace: {
        name: "CLI Impact",
        slug: "cli-impact"
      }
    },
    jsonHeaders()
  );
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-impact-owner");
  callbackUrl.searchParams.set("state", start.state);

  const callback = await fetch(callbackUrl, {
    headers: {
      Cookie: start.cookie
    }
  });
  const callbackBody = (await callback.json()) as SignupResponse;

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
  const responseBody = (await response.json()) as T;
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
