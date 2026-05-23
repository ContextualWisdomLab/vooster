import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createUseCaseWithMainStep } from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  completeWorkSession,
  startWorkSession,
  type SessionCompleteProblem,
  type SessionCompleteResponse,
  type SessionStartResponse
} from "../helpers/session-fixtures.js";
import { createStepLock } from "../helpers/step-fixtures.js";
import { createUseCase } from "../helpers/uc-fixtures.js";

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-018 - Complete a work session", () => {
  test("MAIN: complete session releases locks and opens merge request", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Complete Session",
      "complete-session",
      "stub-complete-session"
    );
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

    const response = await completeWorkSession(server, session.id, setup.cookie, {
      summary: "Finished implementation."
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
    expect(mergeRequest?.impact.severity_by_entity).toEqual({
      [usecase.id]: "NON_BREAKING"
    });
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
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Completed Twice",
      "completed-twice",
      "stub-completed-twice"
    );
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Complete once",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    await completeWorkSession(server, session.id, setup.cookie, {
      summary: "First completion."
    });

    const second = await completeWorkSession(server, session.id, setup.cookie, {
      summary: "Second completion."
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
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "No Merge Session",
      "no-merge-session",
      "stub-no-merge-session"
    );
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      auto_branch: true,
      branch_name: "agent/no-merge-session",
      intent: "Complete without merge",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;

    const response = await completeWorkSession(server, session.id, setup.cookie, {
      no_merge: true,
      summary: "No merge yet."
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
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Failed Complete",
      "failed-complete",
      "stub-failed-complete"
    );
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

    const failed = await completeWorkSession(server, session.id, setup.cookie, {
      simulate_completion_failure: true
    });

    expect(failed.status).toBe(500);
    const retry = await completeWorkSession(server, session.id, setup.cookie, {
      summary: "Retry completion."
    });
    const body = (await retry.json()) as SessionCompleteResponse;
    expect(body.session.status).toBe("COMPLETED");
    expect(body.released_lock_ids).toEqual([usecase.id]);
  });

  test("6a: conflicted branch opens merge request with resolve guidance", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Conflict Complete",
      "conflict-complete",
      "stub-conflict-complete"
    );
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      auto_branch: true,
      branch_name: "agent/conflict-complete",
      intent: "Complete with conflicts",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    const response = await completeWorkSession(server, session.id, setup.cookie, {
      simulate_conflicts: true,
      summary: "Conflicts discovered."
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as SessionCompleteResponse;
    expect(body.merge_request?.status).toBe("OPEN");
    expect(body.merge_request?.conflicts).toEqual([
      { entity_id: usecase.id, type: "SEMANTIC" }
    ]);
    if (body.merge_request === undefined) {
      throw new Error("expected merge request");
    }
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec merge resolve ${body.merge_request.id}`,
      reason: "Resolve conflicts before the merge request can be approved."
    });
  });

  test("4a: failed lock release warns while completing session", async () => {
    const { setup, usecase } = await createUseCaseWithMainStep(
      server,
      "Partial Lock Release",
      "partial-lock-release",
      "stub-partial-lock-release"
    );
    const secondUseCase = await createUseCase(
      server,
      setup,
      "Customer",
      "Reviews a refund"
    );
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Complete with partial release",
      pins: [usecase.key, secondUseCase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    for (const locked of [usecase, secondUseCase]) {
      await createStepLock(server, locked.id, setup.cookie, {
        expires_at: "2026-06-01T00:00:00.000Z",
        holder: session.id,
        mode: "SEMANTIC",
        reason: "Session owns semantic edits."
      });
    }
    const response = await completeWorkSession(server, session.id, setup.cookie, {
      simulate_failed_lock_release: secondUseCase.id,
      summary: "Complete despite one missing lock."
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as SessionCompleteResponse;
    expect(body.session.status).toBe("COMPLETED");
    expect(body.released_lock_ids).toEqual([usecase.id]);
    expect(body.warnings).toContainEqual({
      lock_id: secondUseCase.id,
      type: "LOCK_RELEASE_FAILED",
      message: "Lock was already released before completion."
    });
  });
});
