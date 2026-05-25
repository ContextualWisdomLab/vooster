import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  lockUseCase,
  renewLock,
  type LockCreateResponse,
  type LockProblemResponse
} from "../helpers/lock-fixtures.js";
import { projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  completeWorkSession,
  startWorkSession,
  type SessionCompleteResponse,
  type SessionStartResponse
} from "../helpers/session-fixtures.js";

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-022 - Lock a use case", () => {
  test("MAIN: acquire a semantic lock with finite TTL and session holder", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Lock Use Case",
      "lock-usecase",
      "stub-lock-usecase"
    );

    const response = await lockUseCase(server, setup, usecase.id, {
      lock_type: "SEMANTIC",
      reason: "Agent is rewriting the success scenario.",
      ttl_minutes: 15
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as LockCreateResponse;
    expect(body.lock).toMatchObject({
      auto_release: true,
      held_by_session_id: "session-main-lock",
      held_by_user_id: setup.userId,
      lock_type: "SEMANTIC",
      reason: "Agent is rewriting the success scenario.",
      target_id: usecase.id,
      target_type: "USECASE"
    });
    expect(body.lock.id).toEqual(expect.any(String));
    expect(Date.parse(body.lock.acquired_at)).not.toBeNaN();
    expect(Date.parse(body.lock.expires_at)).toBeGreaterThan(
      Date.parse(body.lock.acquired_at)
    );
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec lock renew ${body.lock.id}`,
      reason: "Renew the lock before it expires."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec lock release ${body.lock.id}`,
      reason: "Release the lock when the edit is complete."
    });
  });

  test("3a: competing semantic lock is rejected with holder guidance", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Competing Lock",
      "competing-lock",
      "stub-competing-lock"
    );
    const first = await lockUseCase(
      server,
      setup,
      usecase.id,
      {
        lock_type: "SEMANTIC",
        reason: "First session edits the flow."
      },
      "session-lock-a"
    );
    const firstBody = (await first.json()) as LockCreateResponse;

    const response = await lockUseCase(
      server,
      setup,
      usecase.id,
      {
        lock_type: "SEMANTIC",
        reason: "Second session edits the flow."
      },
      "session-lock-b"
    );

    expect(response.status).toBe(409);
    const problem = (await response.json()) as LockProblemResponse;
    expect(problem.title).toMatch(/competing lock/i);
    expect(problem.holding_session).toBe("session-lock-a");
    expect(problem.held_by_user_id).toBe(setup.userId);
    expect(problem.expires_at).toBe(firstBody.lock.expires_at);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec who ${usecase.key}`,
      reason: "Inspect the session holding the lock."
    });
  });

  test("1a: expired lock renewal is rejected with reacquire guidance", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Expired Lock",
      "expired-lock",
      "stub-expired-lock"
    );
    const created = await lockUseCase(server, setup, usecase.id, {
      lock_type: "SEMANTIC",
      reason: "Short edit.",
      ttl_minutes: 0.000001
    });
    const lock = ((await created.json()) as LockCreateResponse).lock;

    const response = await renewLock(server, setup, lock.id, { ttl_minutes: 30 });

    expect(response.status).toBe(409);
    const problem = (await response.json()) as LockProblemResponse;
    expect(problem.title).toMatch(/expired lock/i);
    expect(problem.lock_id).toBe(lock.id);
    expect(problem.expires_at).toBe(lock.expires_at);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec lock ${usecase.key} --type semantic`,
      reason: "Reacquire the lock from scratch."
    });
  });

  test("1b: lock renewal by another session is forbidden", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Foreign Renew",
      "foreign-renew",
      "stub-foreign-renew"
    );
    const created = await lockUseCase(
      server,
      setup,
      usecase.id,
      {
        lock_type: "SEMANTIC",
        reason: "Owner is editing."
      },
      "session-owner"
    );
    const lock = ((await created.json()) as LockCreateResponse).lock;

    const response = await renewLock(
      server,
      setup,
      lock.id,
      { ttl_minutes: 30 },
      "session-other"
    );

    expect(response.status).toBe(403);
    const problem = (await response.json()) as LockProblemResponse;
    expect(problem.title).toMatch(/does not own/i);
    expect(problem.lock_id).toBe(lock.id);
    expect(problem.holding_session).toBe("session-owner");
    expect(problem.expires_at).toBe(lock.expires_at);
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec who ${usecase.key}`,
      reason: "Identify the lock owner."
    });
  });

  test("5a: completing a session releases its auto-release locks", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Release Lock",
      "release-lock",
      "stub-release-lock"
    );
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Edit locked use case",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    const created = await lockUseCase(
      server,
      setup,
      usecase.id,
      {
        lock_type: "SEMANTIC",
        reason: "Session owns this edit."
      },
      session.id
    );
    const lock = ((await created.json()) as LockCreateResponse).lock;

    const completed = await completeWorkSession(server, session.id, setup.cookie, {
      no_merge: true,
      summary: "Done with locked edit."
    });

    expect(completed.status).toBe(200);
    const body = (await completed.json()) as SessionCompleteResponse;
    expect(body.released_lock_ids).toEqual([lock.id]);
    const reacquired = await lockUseCase(
      server,
      setup,
      usecase.id,
      {
        lock_type: "HARD",
        reason: "Next session can lock now."
      },
      "session-after-complete"
    );
    expect(reacquired.status).toBe(201);
  });

  test("*a: expired locks do not block fresh acquisition", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Expired Fresh",
      "expired-fresh",
      "stub-expired-fresh"
    );
    const expired = await lockUseCase(
      server,
      setup,
      usecase.id,
      {
        lock_type: "SEMANTIC",
        reason: "This lock expires immediately.",
        ttl_minutes: 0.000001
      },
      "session-expired-lock"
    );
    const expiredLock = ((await expired.json()) as LockCreateResponse).lock;

    const response = await lockUseCase(
      server,
      setup,
      usecase.id,
      {
        lock_type: "HARD",
        reason: "Fresh session can proceed."
      },
      "session-fresh-lock"
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as LockCreateResponse;
    expect(body.lock.id).not.toBe(expiredLock.id);
    expect(body.lock.held_by_session_id).toBe("session-fresh-lock");
    expect(body.lock.lock_type).toBe("HARD");
  });
});
