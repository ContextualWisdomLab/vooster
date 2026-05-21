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
    key: string;
  };
};

type BranchCreateResponse = {
  branch: {
    id: string;
  };
};

type MergeOpenResponse = {
  merge_request: {
    current_revision_id: string;
    id: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-021 CLI - Resolve a merge conflict", () => {
  test("MAIN: project editor resolves a structural conflict with the source value", async () => {
    const server = await startNetworkServer("vspec-cli-uc021-");
    try {
      const setup = await createResolvableConflict(server.apiUrl);
      const result = await runCli([
        "merge",
        "resolve",
        setup.mergeId,
        "--base-revision",
        setup.baseRevision,
        "--entity-id",
        setup.usecaseId,
        "--field",
        "title",
        "--strategy",
        "theirs",
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`Merge request ${setup.mergeId}`);
      expect(result.stdout).toContain("Status MERGED");
      expect(result.stdout).toContain("Conflicts 0");
      expect(result.stdout).toContain("New revisions 1");
      expect(result.stdout).toContain(`Source branch ${setup.branchId} MERGED`);
      expect(result.stdout).toContain("Main heads 1");
      expect(result.stdout).toContain(`vspec usecase show ${setup.usecaseKey}`);
    } finally {
      await server.stop();
    }
  });
});

async function createResolvableConflict(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "RSV", name: "Resolve", visibility: "PRIVATE" }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const projectBody = await projectResponse.json() as ProjectResponse;
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
        title: "Reviews resolvable refund"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const useCaseBody = await useCaseResponse.json() as UseCaseResponse;
  const branchResponse = await fetch(`${apiUrl}/v1/projects/${projectBody.project.id}/branches`, {
    body: JSON.stringify({ name: "feature/resolve-refund" }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie
    },
    method: "POST"
  });
  const branchBody = await branchResponse.json() as BranchCreateResponse;
  await fetch(
    `${apiUrl}/__test/branches/${branchBody.branch.id}/usecases/${useCaseBody.usecase.id}/revisions`,
    {
      body: JSON.stringify({
        severity: "BREAKING",
        title: "Reviews resolvable refund quickly"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  await fetch(`${apiUrl}/__test/usecases/${useCaseBody.usecase.id}/revisions`, {
    body: JSON.stringify({
      severity: "BREAKING",
      title: "Reviews resolvable refund manually"
    }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie
    },
    method: "POST"
  });
  const mergeResponse = await fetch(`${apiUrl}/v1/merges`, {
    body: JSON.stringify({
      source_branch_id: branchBody.branch.id,
      target: "main"
    }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie
    },
    method: "POST"
  });
  const mergeBody = await mergeResponse.json() as MergeOpenResponse;

  return {
    baseRevision: mergeBody.merge_request.current_revision_id,
    branchId: branchBody.branch.id,
    cookie: signedUp.cookie,
    mergeId: mergeBody.merge_request.id,
    usecaseId: useCaseBody.usecase.id,
    usecaseKey: useCaseBody.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Resolve",
        slug: "cli-resolve"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-resolve-owner");
  callbackUrl.searchParams.set("state", startBody.state);

  const callback = await fetch(callbackUrl, {
    headers: {
      Cookie: start.headers.get("set-cookie") ?? ""
    }
  });
  const callbackBody = await callback.json() as SignupResponse;

  return {
    cookie: callback.headers.get("set-cookie") ?? "",
    workspaceId: callbackBody.workspace.id
  };
}
