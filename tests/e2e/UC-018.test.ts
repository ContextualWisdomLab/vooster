import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createUseCaseWithMainStep } from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { startWorkSession, type SessionStartResponse } from "../helpers/session-fixtures.js";
import { createStepLock } from "../helpers/step-fixtures.js";

type SessionCompleteResponse = {
  merge_request?: {
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
  released_lock_ids: string[];
  session: { branch_id: string; ended_at: string; id: string; status: string };
  session_file: { cleared: boolean; path: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type SessionCompleteProblem = {
  current_status?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-018 - Complete a work session", () => {
  test("MAIN: complete session releases locks and opens merge request", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Complete Session", "complete-session", "stub-complete-session");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      auto_branch: true,
      branch_name: "agent/complete-session",
      intent: "Complete the branch",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    await createStepLock(server, usecase.id, setup.cookie, {
      expires_at: "2026-06-01T00:00:00.000Z",
      holder: session.id,
      mode: "SEMANTIC",
      reason: "Session owns semantic edits."
    });

    const response = await server.fetch(`/v1/sessions/${session.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ summary: "Finished implementation." })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as SessionCompleteResponse;
    expect(body.session).toMatchObject({
      branch_id: session.branch_id,
      id: session.id,
      status: "COMPLETED"
    });
    expect(Date.parse(body.session.ended_at)).not.toBeNaN();
    expect(body.released_lock_ids).toEqual([usecase.id]);
    const mergeRequest = body.merge_request;
    expect(mergeRequest).toMatchObject({
      conflicts: [],
      source_branch_id: session.branch_id,
      status: "OPEN",
      strategy: "FAST_FORWARD"
    });
    expect(mergeRequest?.impact.severity_by_entity).toEqual({ [usecase.id]: "NON_BREAKING" });
    expect(body.session_file).toEqual({ path: ".vspec/session.json", cleared: true });
    if (mergeRequest === undefined) {
      throw new Error("expected merge request");
    }
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec merge show ${mergeRequest.id}`,
      reason: "Review the merge request opened for this completed session."
    });
  });

  test("2a: completing an already completed session returns current status", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Completed Twice", "completed-twice", "stub-completed-twice");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Complete once",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    await server.fetch(`/v1/sessions/${session.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ summary: "First completion." })
    });

    const second = await server.fetch(`/v1/sessions/${session.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ summary: "Second completion." })
    });

    expect(second.status).toBe(409);
    const problem = (await second.json()) as SessionCompleteProblem;
    expect(problem.title).toMatch(/session is not active/i);
    expect(problem.current_status).toBe("COMPLETED");
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec session show ${session.id}`,
      reason: "Inspect the current session state before retrying."
    });
  });

  test("6b: no_merge completes session without opening merge request", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "No Merge Session", "no-merge-session", "stub-no-merge-session");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      auto_branch: true,
      branch_name: "agent/no-merge-session",
      intent: "Complete without merge",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;

    const response = await server.fetch(`/v1/sessions/${session.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ no_merge: true, summary: "No merge yet." })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as SessionCompleteResponse;
    expect(body.session.status).toBe("COMPLETED");
    expect(body.merge_request).toBeUndefined();
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec merge open agent/no-merge-session",
      reason: "Open a merge request for the completed branch later."
    });
  });

  test("*a: transactional failure leaves session active and locks held", async () => {
    const { setup, usecase } =
      await createUseCaseWithMainStep(server, "Failed Complete", "failed-complete", "stub-failed-complete");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Fail completion",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    await createStepLock(server, usecase.id, setup.cookie, {
      expires_at: "2026-06-01T00:00:00.000Z",
      holder: session.id,
      mode: "SEMANTIC",
      reason: "Lock should survive failed completion."
    });

    const failed = await server.fetch(`/v1/sessions/${session.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ simulate_completion_failure: true })
    });

    expect(failed.status).toBe(500);
    const retry = await server.fetch(`/v1/sessions/${session.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ summary: "Retry completion." })
    });
    const body = (await retry.json()) as SessionCompleteResponse;
    expect(body.session.status).toBe("COMPLETED");
    expect(body.released_lock_ids).toEqual([usecase.id]);
  });
});
