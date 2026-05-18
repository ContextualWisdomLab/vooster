import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

type LockCreateResponse = {
  lock: {
    acquired_at: string;
    auto_release: boolean;
    expires_at: string;
    held_by_session_id: null | string;
    held_by_user_id: string;
    id: string;
    lock_type: string;
    reason: string;
    target_id: string;
    target_type: string;
  };
  suggested_next_actions: Array<{ command: string; reason: string }>;
};

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

    const response = await server.fetch("/v1/locks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setup.cookie,
        "X-Vspec-Session": "session-main-lock"
      },
      body: JSON.stringify({
        lock_type: "SEMANTIC",
        reason: "Agent is rewriting the success scenario.",
        target_id: usecase.id,
        target_type: "USECASE",
        ttl_minutes: 15
      })
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
});
