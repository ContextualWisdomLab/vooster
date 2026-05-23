import { afterEach, describe, expect, test } from "vitest";
import { cleanupCliE2e, runCli, startNetworkServer } from "./helpers.js";

type SignupResponse = {
  workspace: {
    id: string;
  };
};

type OAuthStartResponse = {
  state: string;
};

type ProjectResponse = {
  project: {
    id: string;
  };
};

type UseCaseResponse = {
  usecase: {
    id: string;
  };
};

type BranchCreateResponse = {
  branch: {
    id: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-020 CLI - Merge a branch", () => {
  test("MAIN: project editor opens a clean merge that fast-forwards main", async () => {
    const server = await startNetworkServer("vspec-cli-uc020-");
    try {
      const setup = await createMergeReadyBranch(server.apiUrl);
      const result = await runCli([
        "merge",
        "open",
        setup.branchId,
        "--into",
        "main",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/Merge request [a-f0-9-]+/u);
      expect(result.stdout).toContain("Status MERGED");
      expect(result.stdout).toContain("Strategy FAST_FORWARD");
      expect(result.stdout).toContain("Conflicts 0");
      expect(result.stdout).toContain("Impacted entities 1");
      expect(result.stdout).toContain(`Source branch ${setup.branchId} MERGED`);
      expect(result.stdout).toContain("Main heads 1");
      expect(result.stdout).toContain("vspec merge show");
    } finally {
      await server.stop();
    }
  });
});

async function createMergeReadyBranch(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "MRG", name: "Merge", visibility: "PRIVATE" }),
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
      aliases: ["Buyer"],
      description: "Person buying a product.",
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
  const useCaseResponse = await fetch(
    `${apiUrl}/v1/projects/${projectBody.project.id}/usecases`,
    {
      body: JSON.stringify({
        primary_actor: "Customer",
        title: "Reviews mergeable refund"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const useCaseBody = (await useCaseResponse.json()) as UseCaseResponse;
  const branchResponse = await fetch(
    `${apiUrl}/v1/projects/${projectBody.project.id}/branches`,
    {
      body: JSON.stringify({ name: "feature/merge-refund" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const branchBody = (await branchResponse.json()) as BranchCreateResponse;
  await fetch(
    `${apiUrl}/__test/branches/${branchBody.branch.id}/usecases/${useCaseBody.usecase.id}/revisions`,
    {
      body: JSON.stringify({
        severity: "NON_BREAKING",
        title: "Reviews mergeable refund quickly"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );

  return {
    branchId: branchBody.branch.id,
    cookie: signedUp.cookie
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Merge",
        slug: "cli-merge"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = (await start.json()) as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-merge-owner");
  callbackUrl.searchParams.set("state", startBody.state);

  const callback = await fetch(callbackUrl, {
    headers: {
      Cookie: start.headers.get("set-cookie") ?? ""
    }
  });
  const callbackBody = (await callback.json()) as SignupResponse;

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    workspaceId: callbackBody.workspace.id
  };
}
