import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { lockUseCase, type LockCreateResponse } from "../helpers/lock-fixtures.js";
import {
  advanceBranch,
  advanceMain,
  createBranch,
  openMerge,
  projectUseCase,
  type MergeOpenResponse
} from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { startWorkSession, type SessionStartResponse } from "../helpers/session-fixtures.js";

type WhoResponse = {
  locks: Array<{
    expires_at: string;
    held_by_session_id: null | string;
    held_by_user_id: string;
    id: string;
    lock_type: string;
  }>;
  merge_requests: Array<{
    conflict_count: number;
    id: string;
    source_branch_id: string;
    status: string;
  }>;
  sessions: Array<{
    agent_type: string;
    id: string;
    intent: string;
    started_at: string;
    user_id: string;
  }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  usecase: { id: string; key: string };
};

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-023 - See who is working on a use case", () => {
  test("MAIN: show active sessions locks and merge requests for a use case", async () => {
    const { setup, usecase } = await projectUseCase(server, "Who Works", "who-works", "stub-who-works");
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Coordinate on refund review",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    const locked = await lockUseCase(server, setup, usecase.id, {
      lock_type: "SEMANTIC",
      reason: "Session is editing semantics."
    }, session.id);
    const lock = ((await locked.json()) as LockCreateResponse).lock;
    const branch = await createBranch(server, setup, "feature/who-open-merge");
    await advanceBranch(server, setup, branch.id, usecase.id, "Reviews a refund quickly");
    await advanceMain(server, setup, usecase.id, "Reviews a refund manually");
    const opened = await openMerge(server, setup, branch.id);
    const merge = ((await opened.json()) as MergeOpenResponse).merge_request;

    const response = await server.fetch(`/v1/usecases/${usecase.id}/who`, {
      headers: { Cookie: setup.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as WhoResponse;
    expect(body.usecase).toEqual({ id: usecase.id, key: usecase.key });
    expect(body.sessions).toContainEqual(expect.objectContaining({
      agent_type: "CODEX",
      id: session.id,
      intent: "Coordinate on refund review",
      user_id: setup.userId
    }));
    expect(Date.parse(body.sessions[0]?.started_at ?? "")).not.toBeNaN();
    expect(body.locks).toContainEqual(expect.objectContaining({
      held_by_session_id: session.id,
      held_by_user_id: setup.userId,
      id: lock.id,
      lock_type: "SEMANTIC"
    }));
    expect(body.merge_requests).toContainEqual({
      conflict_count: merge.conflicts.length,
      id: merge.id,
      source_branch_id: branch.id,
      status: "OPEN"
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec lock list",
      reason: "Review active locks before editing."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec merge show ${merge.id}`,
      reason: "Review the open merge request touching this use case."
    });
  });
});
