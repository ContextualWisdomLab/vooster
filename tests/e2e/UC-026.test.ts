import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { lockUseCase, type LockCreateResponse } from "../helpers/lock-fixtures.js";
import { advanceMain, projectUseCase, type BranchRevisionResponse } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { startWorkSession, type SessionStartResponse } from "../helpers/session-fixtures.js";

type RevertResponse = {
  impact: { affected_branches: string[]; affected_sessions: string[]; severity: string };
  revision: {
    change_summary: string; entity_id: string; entity_type: string; id: string;
    parent_revision_id: string; snapshot: { title: string }; version_number: number;
  };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  usecase: { current_revision_id: string; id: string; title: string };
};
type RevertProblem = {
  affected_sessions?: string[]; expires_at?: string; expected_entity_id?: string;
  breaking_changes?: Array<{ path: string; revision: string; severity: string }>;
  held_by_user_id?: string; holding_session?: string; missing_revision?: string; reason?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};
type HistoryResponse = { revisions: Array<{ revision: string }> };

let server: TestServer;
beforeAll(async () => { server = await startServer(); });

afterAll(async () => { await server.stop(); });

describe("UC-026 - Revert a use case to a previous revision", () => {
  test("MAIN: append a forward revision restoring the target snapshot", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Revert Main", "revert-main", "stub-revert-main");
    const targetRevision = usecase.current_revision_id;
    const advanced = await server.fetch(`/__test/usecases/${usecase.id}/revisions`, {
      method: "POST",
      headers: jsonHeaders(setup.cookie),
      body: JSON.stringify({
        severity: "NON_BREAKING",
        title: "Reviews a refund quickly"
      })
    });
    const currentHead = ((await advanced.json()) as BranchRevisionResponse).revision_id;

    const response = await revert(usecase.id, setup.cookie, {
      revision_id: targetRevision,
      summary: "Restore refund wording"
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

    const response = await revert(usecase.id, setup.cookie, { revision_id: "rev-missing" });

    expect(response.status).toBe(404);
    const problem = (await response.json()) as RevertProblem;
    expect(problem.title).toMatch(/revision not found/i);
    expect(problem.missing_revision).toBe("rev-missing");
    expect(problem.expected_entity_id).toBe(usecase.id);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec history ${usecase.key}`,
      reason: "Find valid revision IDs for this use case."
    });

    expect(await historyRevisionIds(usecase.id, setup.cookie)).toEqual([usecase.current_revision_id]);
  });

  test("4a: breaking revert without force returns impact and writes nothing", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Revert Breaking", "revert-breaking", "stub-revert-breaking");
    const targetRevision = usecase.current_revision_id;
    const currentHead = await advanceMain(server, setup, usecase.id, "Reviews a refund manually");
    const sessionResponse = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Keep refund wording stable",
      pins: [usecase.key]
    });
    const session = ((await sessionResponse.json()) as SessionStartResponse).session;

    const response = await revert(usecase.id, setup.cookie, { revision_id: targetRevision });

    expect(response.status).toBe(409);
    const problem = (await response.json()) as RevertProblem;
    expect(problem.title).toMatch(/breaking/i);
    expect(problem.breaking_changes).toContainEqual({
      path: "usecase.title",
      revision: currentHead.revision_id,
      severity: "BREAKING"
    });
    expect(problem.affected_sessions).toEqual([session.id]);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec revert ${usecase.key} --to ${targetRevision} --force --summary "<reason>"`,
      reason: "Rerun with force only if the breaking impact is acceptable."
    });

    expect(await historyRevisionIds(usecase.id, setup.cookie)).toEqual([
      currentHead.revision_id, targetRevision
    ]);
  });

  test("3a: hard lock held by another session blocks revert", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Revert Locked", "revert-locked", "stub-revert-locked");
    const locked = await lockUseCase(
      server,
      setup,
      usecase.id,
      { lock_type: "HARD", reason: "Stabilize refund wording", ttl_minutes: 45 },
      "session-revert-holder"
    );
    const lock = ((await locked.json()) as LockCreateResponse).lock;

    const response = await revert(usecase.id, setup.cookie, {
      revision_id: usecase.current_revision_id
    });

    expect(response.status).toBe(409);
    const problem = (await response.json()) as RevertProblem;
    expect(problem.title).toMatch(/hard locked/i);
    expect(problem.holding_session).toBe("session-revert-holder");
    expect(problem.held_by_user_id).toBe(setup.userId);
    expect(problem.reason).toBe("Stabilize refund wording");
    expect(problem.expires_at).toBe(lock.expires_at);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec who ${usecase.key}`,
      reason: "Find the lock holder before retrying the revert."
    });

    expect(await historyRevisionIds(usecase.id, setup.cookie)).toEqual([usecase.current_revision_id]);
  });
});

function jsonHeaders(cookie: string) {
  return { "Content-Type": "application/json", Cookie: cookie };
}

function revert(usecaseId: string, cookie: string, body: Record<string, unknown>) {
  return server.fetch(`/v1/usecases/${usecaseId}/revert`, {
    method: "POST",
    headers: jsonHeaders(cookie),
    body: JSON.stringify(body)
  });
}

async function historyRevisionIds(usecaseId: string, cookie: string) {
  const history = await server.fetch(`/v1/usecases/${usecaseId}/revisions`, {
    headers: { Cookie: cookie }
  });
  const body = (await history.json()) as HistoryResponse;
  return body.revisions.map((revision) => revision.revision);
}
