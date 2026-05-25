import { describe, expect, test } from "vitest";
import type { StoredLock } from "../../../src/domain/entities/index.js";
import {
  lock,
  lockBody,
  registeredRoutes,
  reply,
  request
} from "./lock-routes-fixtures.js";

describe("lock routes", () => {
  test("rejects malformed lock payloads", async () => {
    const routes = registeredRoutes();
    const cases = [
      {
        call: (captured: ReturnType<typeof reply>) =>
          routes.create(request({ body: { reason: "" } }), captured.fastifyReply),
        title: "Invalid lock request"
      },
      {
        call: (captured: ReturnType<typeof reply>) =>
          routes.renew(
            request({ body: { ttl_minutes: 0 }, params: { lockId: "lock-1" } }),
            captured.fastifyReply
          ),
        title: "Invalid lock renewal request"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      await item.call(captured);

      expect(captured.statusCode).toBe(400);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("derives lock ownership from session headers", async () => {
    const deletedLockIds: string[] = [];
    const savedLocks: StoredLock[] = [];
    const updatedLocks: StoredLock[] = [];
    const routes = registeredRoutes({
      deletedLockIds,
      existingLock: lock({ held_by_session_id: null, holder: "user-1" }),
      savedLocks,
      updatedLocks
    });

    await routes.create(
      request({
        body: lockBody(),
        cookie: "vspec_session=token-1",
        sessionHeader: ["session-array"]
      }),
      reply().fastifyReply
    );
    await routes.create(
      request({
        body: lockBody(),
        cookie: "vspec_session=token-1",
        sessionHeader: []
      }),
      reply().fastifyReply
    );
    await routes.renew(
      request({
        body: {},
        cookie: "vspec_session=token-1",
        params: { lockId: "lock-1" }
      }),
      reply().fastifyReply
    );
    await routes.release(
      request({
        body: {},
        cookie: "vspec_session=token-1",
        params: { lockId: "lock-1" }
      }),
      reply().fastifyReply
    );

    expect(savedLocks.map((item) => item.held_by_session_id)).toEqual([
      "session-array",
      null
    ]);
    expect(updatedLocks).toHaveLength(1);
    expect(deletedLockIds).toEqual(["lock-1"]);
  });
});
