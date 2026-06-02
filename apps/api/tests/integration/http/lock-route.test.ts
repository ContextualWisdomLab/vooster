import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { lockUseCase, renewLock } from "../../helpers/lock-fixtures.js";
import {
  createActor,
  createProject,
  createUseCase,
  type ProjectSetup,
  type UseCase
} from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;

describe("POST /v1/locks integration", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed lock payloads through real routing", async () => {
    const response = await server.fetch("/v1/locks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: "Invalid lock request" });
  });

  test("rejects malformed lock renewal payloads through real routing", async () => {
    const response = await server.fetch("/v1/locks/lock-1/renew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_minutes: 0 })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Invalid lock renewal request"
    });
  });
});

describe("lock lifecycle integration", () => {
  let setup: ProjectSetup;
  let usecase: UseCase;

  beforeEach(async () => {
    server = await startServer();
    setup = await createProject(
      server,
      "Lock Lifecycle",
      "lock-lifecycle",
      "stub-lock"
    );
    await createActor(server, setup, "Customer");
    usecase = await createUseCase(server, setup, "Customer", "Places an order");
  });

  afterEach(async () => {
    await server.stop();
  });

  test("derives lock ownership from the session header on create", async () => {
    const response = await lockUseCase(
      server,
      setup,
      usecase.id,
      { lock_type: "SEMANTIC", reason: "Owns semantic edits." },
      "session-array"
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as LockBody;
    expect(body.lock.held_by_session_id).toBe("session-array");

    const who = await fetchWho(usecase.id, setup.cookie);
    expect(who.locks).toContainEqual(
      expect.objectContaining({ held_by_session_id: "session-array" })
    );
  });

  test("falls back to a null session when no session header is provided", async () => {
    const response = await server.fetch("/v1/locks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        lock_type: "SEMANTIC",
        reason: "Owns semantic edits.",
        target_id: usecase.id,
        target_type: "USECASE"
      })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as LockBody;
    expect(body.lock.held_by_session_id).toBeNull();
  });

  test("renews a lock held by the session and releases it", async () => {
    const created = await lockUseCase(
      server,
      setup,
      usecase.id,
      { lock_type: "SEMANTIC", reason: "Owns semantic edits.", ttl_minutes: 10 },
      "session-1"
    );
    const createdBody = (await created.json()) as LockBody;
    const lockId = createdBody.lock.id;

    const renewed = await renewLock(
      server,
      setup,
      lockId,
      { ttl_minutes: 60 },
      "session-1"
    );
    expect(renewed.status).toBe(200);
    const renewedBody = (await renewed.json()) as LockBody;
    expect(renewedBody.lock.id).toBe(lockId);
    expect(Date.parse(renewedBody.lock.expires_at)).toBeGreaterThan(
      Date.parse(createdBody.lock.expires_at)
    );

    const released = await server.fetch(`/v1/locks/${lockId}`, {
      method: "DELETE",
      headers: { Cookie: setup.cookie, "X-Vspec-Session": "session-1" }
    });
    expect(released.status).toBe(200);

    const who = await fetchWho(usecase.id, setup.cookie);
    expect(who.locks).toEqual([]);
  });

  async function fetchWho(usecaseId: string, cookie: string): Promise<WhoBody> {
    const response = await server.fetch(`/v1/usecases/${usecaseId}/who`, {
      headers: { Cookie: cookie }
    });
    return (await response.json()) as WhoBody;
  }
});

type LockBody = {
  lock: { expires_at: string; held_by_session_id: null | string; id: string };
};
type WhoBody = { locks: Array<{ held_by_session_id: null | string }> };
