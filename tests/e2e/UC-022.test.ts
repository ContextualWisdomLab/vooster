import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  lockUseCase,
  type LockCreateResponse,
  type LockProblemResponse
} from "../helpers/lock-fixtures.js";
import { projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-022 - Lock a use case", () => {
  test("MAIN: acquire a semantic lock with finite TTL and session holder", async () => {
    const { setup, usecase } = await projectUseCase(server, "Lock Use Case", "lock-usecase", "stub-lock-usecase");

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
    expect(Date.parse(body.lock.expires_at)).toBeGreaterThan(Date.parse(body.lock.acquired_at));
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec lock renew ${usecase.key}`,
      reason: "Renew the lock before it expires."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec unlock ${usecase.key}`,
      reason: "Release the lock when the edit is complete."
    });
  });

  test("3a: competing semantic lock is rejected with holder guidance", async () => {
    const { setup, usecase } = await projectUseCase(server, "Competing Lock", "competing-lock", "stub-competing-lock");
    const first = await lockUseCase(server, setup, usecase.id, {
      lock_type: "SEMANTIC",
      reason: "First session edits the flow."
    }, "session-lock-a");
    const firstBody = (await first.json()) as LockCreateResponse;

    const response = await lockUseCase(server, setup, usecase.id, {
      lock_type: "SEMANTIC",
      reason: "Second session edits the flow."
    }, "session-lock-b");

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
});
