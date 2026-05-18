import { expect } from "vitest";
import type { TestServer } from "./server.js";
import {
  createActor,
  createProject,
  createUseCase,
  type ProjectSetup,
  type UseCase
} from "./uc-fixtures.js";

type BranchCreateResponse = {
  branch: { base_branch_id: string; id: string; name: string };
};
export type BranchRevisionResponse = { revision_id: string };
export type MergeOpenResponse = {
  main_head_revision_ids: Record<string, string>;
  merge_request: {
    conflicts: unknown[];
    id: string;
    impact: {
      affected_branches: string[];
      affected_sessions: string[];
      severity_by_entity: Record<string, string>;
    };
    source_branch_id: string;
    status: string;
    strategy: string;
    target_branch_id: string;
  };
  source_branch: { id: string; status: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
export type MergeProblemResponse = {
  exit_code?: number;
  holding_session?: string;
  main_head_revision_ids?: Record<string, string>;
  merge_request?: { status: string };
  source_branch?: { status: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};
type Severity = "BREAKING" | "COSMETIC" | "NON_BREAKING";

export async function projectUseCase(server: TestServer, name: string, slug: string, code: string) {
  const setup = await createProject(server, name, slug, code);
  await createActor(server, setup, "Customer");
  const usecase = await createUseCase(server, setup, "Customer", "Reviews a refund");
  return { setup, usecase };
}

export async function createBranch(server: TestServer, setup: ProjectSetup, name: string) {
  const response = await server.fetch(`/v1/projects/${setup.projectId}/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({ name })
  });
  return ((await response.json()) as BranchCreateResponse).branch;
}

export async function advanceBranch(
  server: TestServer,
  setup: ProjectSetup,
  branchId: string,
  usecaseId: string,
  title: string,
  severity: Severity = "BREAKING"
) {
  const response = await server.fetch(`/__test/branches/${branchId}/usecases/${usecaseId}/revisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({ severity, title })
  });
  expect(response.status).toBe(200);
  return (await response.json()) as BranchRevisionResponse;
}

export async function advanceMain(
  server: TestServer,
  setup: ProjectSetup,
  usecaseId: UseCase["id"],
  title: string
) {
  const response = await server.fetch(`/__test/usecases/${usecaseId}/revisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({ severity: "BREAKING", title })
  });
  expect(response.status).toBe(200);
  return (await response.json()) as BranchRevisionResponse;
}

export async function advanceBranchExtension(
  server: TestServer,
  setup: ProjectSetup,
  branchId: string,
  usecaseId: string,
  extensionPoint: string,
  condition: string
) {
  const response = await server.fetch(`/__test/branches/${branchId}/usecases/${usecaseId}/extensions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({ condition, extension_point: extensionPoint })
  });
  expect(response.status).toBe(200);
  return (await response.json()) as BranchRevisionResponse;
}

export async function advanceMainExtension(
  server: TestServer,
  setup: ProjectSetup,
  usecaseId: UseCase["id"],
  extensionPoint: string,
  condition: string
) {
  const response = await server.fetch(`/__test/usecases/${usecaseId}/extensions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({ condition, extension_point: extensionPoint })
  });
  expect(response.status).toBe(200);
  return (await response.json()) as BranchRevisionResponse;
}

export function openMerge(
  server: TestServer,
  setup: ProjectSetup,
  branchId: string,
  strategy?: "FAST_FORWARD" | "SQUASH",
  simulateWriteFailure = false
) {
  return server.fetch("/v1/merges", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({
      simulate_write_failure: simulateWriteFailure,
      source_branch_id: branchId,
      strategy,
      target: "main"
    })
  });
}
