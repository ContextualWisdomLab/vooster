import { describe, expect, test } from "vitest";
import { whoParamsSchema, whoResponseSchema } from "../src/index.js";

describe("who contracts", () => {
  test("parses who request params", () => {
    expect(whoParamsSchema.parse({ usecaseId: "PAY-001" })).toEqual({
      usecaseId: "PAY-001"
    });
  });

  test("rejects malformed who request params", () => {
    expect(() => whoParamsSchema.parse({ usecaseId: "" })).toThrow();
  });

  test("parses who success responses without dropping coordination fields", () => {
    const response = whoResponseSchema.parse({
      archived: true,
      locks: [
        {
          expires_at: "2026-05-22T00:30:00.000Z",
          held_by_session_id: null,
          held_by_user_id: "user-1",
          id: "lock-1",
          lock_type: "SEMANTIC"
        }
      ],
      merge_requests: [
        {
          conflict_count: 2,
          id: "merge-1",
          source_branch_id: null,
          status: "OPEN"
        }
      ],
      sessions: [
        {
          agent_type: "CODEX",
          id: "session-1",
          intent: "Coordinate on checkout",
          markers: ["ZOMBIE"],
          started_at: "2026-05-22T00:00:00.000Z",
          user_id: "user-1"
        }
      ],
      suggested_next_actions: [
        { command: "vspec merge show merge-1", reason: "Review it." }
      ],
      usecase: {
        id: "usecase-1",
        key: "PAY-001"
      }
    });

    expect(response.locks[0]?.lock_type).toBe("SEMANTIC");
    expect(response.merge_requests[0]?.source_branch_id).toBeNull();
    expect(response.sessions[0]?.markers).toEqual(["ZOMBIE"]);
    expect(response.usecase.id).toBe("usecase-1");
  });
});
