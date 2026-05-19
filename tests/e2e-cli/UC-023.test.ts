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

type SessionStartResponse = {
  session: {
    id: string;
  };
};

type LockResponse = {
  lock: {
    id: string;
  };
};

type BranchCreateResponse = {
  branch: {
    id: string;
  };
};

type MergeOpenResponse = {
  merge_request: {
    conflicts: unknown[];
    id: string;
  };
};

afterEach(() => {
  cleanupCliE2e();
});

describe("UC-023 CLI - See who is working on a use case", () => {
  test("MAIN: project member sees active sessions, locks, and merge requests", async () => {
    const server = await startNetworkServer("vspec-cli-uc023-");
    try {
      const setup = await createBusyUseCase(server.apiUrl);
      const result = await runCli([
        "who",
        setup.usecaseId,
        "--session-cookie",
        setup.cookie,
        "--api-url",
        server.apiUrl
      ]);

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`UseCase ${setup.usecaseKey}`);
      expect(result.stdout).toContain("Sessions 1");
      expect(result.stdout).toContain(`Session ${setup.sessionId}`);
      expect(result.stdout).toContain("Agent CODEX");
      expect(result.stdout).toContain("Intent Coordinate on refund review");
      expect(result.stdout).toContain("Locks 1");
      expect(result.stdout).toContain(`Lock ${setup.lockId}`);
      expect(result.stdout).toContain("Type SEMANTIC");
      expect(result.stdout).toContain("Merge requests 1");
      expect(result.stdout).toContain(`Merge request ${setup.mergeId}`);
      expect(result.stdout).toContain(`Source branch ${setup.branchId}`);
      expect(result.stdout).toContain(`Conflicts ${String(setup.conflictCount)}`);
      expect(result.stdout).toContain("vspec lock list");
      expect(result.stdout).toContain(`vspec merge show ${setup.mergeId}`);
    } finally {
      await server.stop();
    }
  });
});

async function createBusyUseCase(apiUrl: string) {
  const signedUp = await signup(apiUrl);
  const projectResponse = await fetch(
    `${apiUrl}/v1/workspaces/${signedUp.workspaceId}/projects`,
    {
      body: JSON.stringify({ key: "WHO", name: "Who", visibility: "PRIVATE" }),
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
        title: "Reviews coordinated refund"
      }),
      headers: {
        "Content-Type": "application/json",
        Cookie: signedUp.cookie
      },
      method: "POST"
    }
  );
  const useCaseBody = await useCaseResponse.json() as UseCaseResponse;
  const sessionResponse = await fetch(`${apiUrl}/v1/sessions`, {
    body: JSON.stringify({
      agent_type: "CODEX",
      intent: "Coordinate on refund review",
      pins: [useCaseBody.usecase.key],
      project_id: projectBody.project.id
    }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie,
      "X-Vspec-Agent": "codex-cli"
    },
    method: "POST"
  });
  const sessionBody = await sessionResponse.json() as SessionStartResponse;
  const lockResponse = await fetch(`${apiUrl}/v1/locks`, {
    body: JSON.stringify({
      lock_type: "SEMANTIC",
      reason: "Session is editing semantics.",
      target_id: useCaseBody.usecase.id,
      target_type: "USECASE"
    }),
    headers: {
      "Content-Type": "application/json",
      Cookie: signedUp.cookie,
      "X-Vspec-Session": sessionBody.session.id
    },
    method: "POST"
  });
  const lockBody = await lockResponse.json() as LockResponse;
  const branchResponse = await fetch(`${apiUrl}/v1/projects/${projectBody.project.id}/branches`, {
    body: JSON.stringify({ name: "feature/who-open-merge" }),
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
        title: "Reviews coordinated refund quickly"
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
      title: "Reviews coordinated refund manually"
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
    branchId: branchBody.branch.id,
    conflictCount: mergeBody.merge_request.conflicts.length,
    cookie: signedUp.cookie,
    lockId: lockBody.lock.id,
    mergeId: mergeBody.merge_request.id,
    sessionId: sessionBody.session.id,
    usecaseId: useCaseBody.usecase.id,
    usecaseKey: useCaseBody.usecase.key
  };
}

async function signup(apiUrl: string) {
  const start = await fetch(`${apiUrl}/v1/auth/github/start`, {
    body: JSON.stringify({
      workspace: {
        name: "CLI Who",
        slug: "cli-who"
      }
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const startBody = await start.json() as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", apiUrl);
  callbackUrl.searchParams.set("code", "stub-cli-who-owner");
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
