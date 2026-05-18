import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { projectUseCase, type BranchRevisionResponse } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type RevertResponse = {
  impact: {
    affected_branches: string[];
    affected_sessions: string[];
    severity: string;
  };
  revision: {
    change_summary: string;
    entity_id: string;
    entity_type: string;
    id: string;
    parent_revision_id: string;
    snapshot: { title: string };
    version_number: number;
  };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  usecase: { current_revision_id: string; id: string; title: string };
};
type RevertProblem = {
  expected_entity_id?: string;
  missing_revision?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};
type HistoryResponse = {
  revisions: Array<{ revision: string }>;
};

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-026 - Revert a use case to a previous revision", () => {
  test("MAIN: append a forward revision restoring the target snapshot", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Revert Main", "revert-main", "stub-revert-main");
    const targetRevision = usecase.current_revision_id;
    const advanced = await server.fetch(`/__test/usecases/${usecase.id}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        severity: "NON_BREAKING",
        title: "Reviews a refund quickly"
      })
    });
    const currentHead = ((await advanced.json()) as BranchRevisionResponse).revision_id;

    const response = await server.fetch(`/v1/usecases/${usecase.id}/revert`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ revision_id: targetRevision, summary: "Restore refund wording" })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as RevertResponse;
    expect(body.revision).toMatchObject({
      change_summary: `Revert to ${targetRevision}`,
      entity_id: usecase.id,
      entity_type: "USECASE",
      parent_revision_id: currentHead,
      snapshot: { title: "Reviews a refund" },
      version_number: 3
    });
    expect(body.revision.id).not.toBe(targetRevision);
    expect(body.revision.id).not.toBe(currentHead);
    expect(body.usecase).toMatchObject({
      current_revision_id: body.revision.id,
      id: usecase.id,
      title: "Reviews a refund"
    });
    expect(body.impact).toEqual({
      affected_branches: [],
      affected_sessions: [],
      severity: "NON_BREAKING"
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec history ${usecase.key}`,
      reason: "Review the append-only revision history."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec session list --status=active",
      reason: "Check sessions affected by the revert."
    });
  });

  test("2a: missing target revision returns history guidance without appending", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Revert Missing", "revert-missing", "stub-revert-missing");

    const response = await server.fetch(`/v1/usecases/${usecase.id}/revert`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ revision_id: "rev-missing" })
    });

    expect(response.status).toBe(404);
    const problem = (await response.json()) as RevertProblem;
    expect(problem.title).toMatch(/revision not found/i);
    expect(problem.missing_revision).toBe("rev-missing");
    expect(problem.expected_entity_id).toBe(usecase.id);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec history ${usecase.key}`,
      reason: "Find valid revision IDs for this use case."
    });

    const history = await server.fetch(`/v1/usecases/${usecase.id}/revisions`, {
      headers: { Cookie: setup.cookie }
    });
    const body = (await history.json()) as HistoryResponse;
    expect(body.revisions.map((revision) => revision.revision)).toEqual([
      usecase.current_revision_id
    ]);
  });
});
