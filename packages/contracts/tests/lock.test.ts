import { describe, expect, test } from "vitest";
import {
  lockCreateRequestSchema,
  lockParamsSchema,
  lockResponseSchema,
  lockRenewRequestSchema
} from "../src/index.js";

describe("lock contracts", () => {
  test("parses create, renew, and params request boundaries", () => {
    expect(
      lockCreateRequestSchema.parse({
        lock_type: "SEMANTIC",
        reason: "Editing the success scenario.",
        target_id: "usecase-1",
        target_type: "USECASE"
      })
    ).toEqual({
      lock_type: "SEMANTIC",
      reason: "Editing the success scenario.",
      target_id: "usecase-1",
      target_type: "USECASE",
      ttl_minutes: 30
    });
    expect(lockRenewRequestSchema.parse({})).toEqual({ ttl_minutes: 30 });
    expect(lockParamsSchema.parse({ lockId: "lock-1" })).toEqual({
      lockId: "lock-1"
    });
  });

  test("rejects malformed lock request boundaries", () => {
    expect(() =>
      lockCreateRequestSchema.parse({
        lock_type: "SEMANTIC",
        reason: "",
        target_id: "usecase-1",
        target_type: "USECASE"
      })
    ).toThrow();
    expect(() => lockRenewRequestSchema.parse({ ttl_minutes: 0 })).toThrow();
    expect(() => lockParamsSchema.parse({ lockId: "" })).toThrow();
  });

  test("parses lock success responses without dropping stored lock fields", () => {
    const body = lockResponseSchema.parse({
      lock: lock(),
      suggested_next_actions: [
        {
          command: "vspec lock renew lock-1",
          reason: "Renew the lock before it expires."
        }
      ],
      warnings: [
        {
          holders: ["session-2"],
          message: "SOFT lock coexists with session-2",
          type: "SOFT_LOCK_COEXISTS"
        }
      ]
    });

    expect(body.lock.acquired_at).toBe("2026-05-22T00:00:00.000Z");
    expect(body.lock.mode).toBe("SEMANTIC");
    expect(body.warnings?.[0]?.holders).toEqual(["session-2"]);
  });

  test("parses stored lock responses that do not include a lock id", () => {
    const lockWithoutId: Record<string, unknown> = { ...lock() };
    delete lockWithoutId.id;

    expect(lockResponseSchema.parse({ lock: lockWithoutId }).lock.id).toBeUndefined();
  });
});

function lock() {
  return {
    acquired_at: "2026-05-22T00:00:00.000Z",
    auto_release: true,
    expires_at: "2026-05-22T00:15:00.000Z",
    held_by_session_id: "session-1",
    held_by_user_id: "user-1",
    holder: "session-1",
    id: "lock-1",
    lock_type: "SEMANTIC",
    mode: "SEMANTIC",
    reason: "Editing the success scenario.",
    target_id: "usecase-1",
    target_type: "USECASE",
    usecase_id: "usecase-1"
  };
}
