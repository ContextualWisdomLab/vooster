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

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-028 CLI - Comment on a use case", () => {
  test("MAIN: project member adds, lists, edits, resolves, and deletes own comment", async () => {
    const server = await startNetworkServer("vspec-cli-uc028-");
    try {
      const setup = await createCommentReadyUseCase(server.apiUrl);
      const added = await runCli([
        "comment",
        "add",
        setup.usecaseId,
        "--body",
        "**Review** this flow",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(added.stderr).toBe("");
      expect(added.status).toBe(0);
      expect(added.stdout).toContain("Comment ");
      expect(added.stdout).toContain(`Target ${setup.usecaseId}`);
      expect(added.stdout).toContain("Resolved false");
      expect(added.stdout).toContain("Body **Review** this flow");
      expect(added.stdout).toContain(`vspec comment list ${setup.usecaseKey}`);
      expect(added.stdout).toContain(`vspec usecase show ${setup.usecaseKey}`);
      const commentId = added.stdout.match(/Comment ([a-f0-9-]+)/)?.[1];
      expect(commentId).toBeDefined();

      const listed = await runCli([
        "comment",
        "list",
        setup.usecaseId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(listed.stderr).toBe("");
      expect(listed.status).toBe(0);
      expect(listed.stdout).toContain("Comments 1");
      expect(listed.stdout).toContain(`Comment ${commentId ?? ""}`);
      expect(listed.stdout).toContain("Body **Review** this flow");

      const edited = await runCli([
        "comment",
        "edit",
        commentId ?? "",
        "--body",
        "_Resolved in spec._",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(edited.stderr).toBe("");
      expect(edited.status).toBe(0);
      expect(edited.stdout).toContain(`Comment ${commentId ?? ""}`);
      expect(edited.stdout).toContain("Body _Resolved in spec._");
      expect(edited.stdout).toContain("Updated at ");

      const resolved = await runCli([
        "comment",
        "resolve",
        commentId ?? "",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(resolved.stderr).toBe("");
      expect(resolved.status).toBe(0);
      expect(resolved.stdout).toContain(`Comment ${commentId ?? ""}`);
      expect(resolved.stdout).toContain("Resolved true");
      expect(resolved.stdout).toContain("Resolved at ");

      const deleted = await runCli([
        "comment",
        "delete",
        commentId ?? "",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(deleted.stderr).toBe("");
      expect(deleted.status).toBe(0);
      expect(deleted.stdout).toContain(`Comment ${commentId ?? ""}`);
      expect(deleted.stdout).toContain("Deleted true");
    } finally {
      await server.stop();
    }
  });
});

async function createCommentReadyUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const headers = jsonHeaders(signedUp.cookie);
  const project = await postJson<ProjectResponse>(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    { key: "CMT", name: "Comments", visibility: "PRIVATE" },
    headers
  );
  await postJson(`${apiUrl}/v1/projects/${project.project.id}/actors`, {
    aliases: ["Reviewer"],
    description: "Person reviewing comments.",
    is_human: true,
    name: "Customer",
    type: "PRIMARY"
  }, headers);
  const usecase = await postJson<UseCaseResponse>(
    `${apiUrl}/v1/projects/${project.project.id}/usecases`,
    { primary_actor: "Customer", title: "Reviews comments" },
    headers
  );

  return {
    cookie: signedUp.cookie,
    usecaseId: usecase.usecase.id,
    usecaseKey: usecase.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await postJson<OAuthStartResponse>(`${apiUrl}/v1/auth/github/start`, {
    workspace: {
      name: "CLI Comment",
      slug: "cli-comment"
    }
  }, jsonHeaders());
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-comment-owner");
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
