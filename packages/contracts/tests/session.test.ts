import { describe, expect, test } from "vitest";
import {
  sessionCompleteParamsSchema,
  sessionCompleteRequestSchema,
  sessionCompleteResponseSchema,
  sessionListQuerySchema,
  sessionListResponseSchema,
  sessionStartRequestSchema,
  sessionStartResponseSchema
} from "../src/index.js";

describe("session contracts", () => {
  test("parses session request boundaries", () => {
    expect(
      sessionStartRequestSchema.parse({
        auto_branch: true,
        branch_name: "agent/refund",
        intent: "Implement refund flow",
        pins: ["PAY-001"],
        project_id: "project-1"
      })
    ).toMatchObject({ agent_type: "OTHER", auto_branch: true });
    expect(
      sessionListQuerySchema.parse({
        status: "COMPLETED",
        workspace_id: "workspace-1"
      })
    ).toEqual({ status: "COMPLETED", workspace_id: "workspace-1" });
    expect(sessionCompleteParamsSchema.parse({ sessionId: "session-1" })).toEqual({
      sessionId: "session-1"
    });
    expect(sessionCompleteRequestSchema.parse({ no_merge: true })).toMatchObject({
      no_merge: true
    });
  });

  test("rejects malformed session request boundaries", () => {
    expect(() =>
      sessionStartRequestSchema.parse({
        intent: "",
        pins: ["PAY-001"],
        project_id: "project-1"
      })
    ).toThrow();
    expect(() =>
      sessionListQuerySchema.parse({ status: "OPEN", workspace_id: "workspace-1" })
    ).toThrow();
    expect(() => sessionCompleteParamsSchema.parse({ sessionId: "" })).toThrow();
  });

  test("parses session success responses", () => {
    const started = sessionStartResponseSchema.parse({
      branch: {
        id: "branch-1",
        name: "agent/refund"
      },
      session: {
        agent_identifier: "codex-cli",
        agent_type: "CODEX",
        id: "session-1",
        intent: "Implement refund flow",
        pinned_revisions: { "usecase-1": "revision-1" },
        status: "ACTIVE"
      },
      session_file: {
        path: ".vspec/session.json",
        session_id: "session-1"
      },
      suggested_next_actions: [
        {
          command: "vspec session complete",
          reason: "Close the session when the work is done."
        }
      ],
      warnings: [{ message: "Unknown agent type.", type: "UNKNOWN_AGENT_TYPE" }]
    });
    expect(started.session.id).toBe("session-1");

    const listed = sessionListResponseSchema.parse({
      sessions: [
        {
          agent_identifier: "codex-cli",
          agent_type: "CODEX",
          branch_name: null,
          conflict_markers: [],
          id: "session-1",
          idle_seconds: 0,
          intent: "Implement refund flow",
          lock_count: 0,
          markers: [],
          pinned_keys: ["PAY-001"],
          status: "ACTIVE"
        }
      ],
      suggested_next_actions: [
        {
          command: 'vspec session start --intent "..."',
          reason: "Start a session when work begins."
        }
      ],
      summary: { total_conflicts: 0 },
      total: 1
    });
    expect(listed.total).toBe(1);

    const completed = sessionCompleteResponseSchema.parse({
      merge_request: {
        conflicts: [],
        id: "merge-1",
        status: "OPEN",
        strategy: "FAST_FORWARD"
      },
      released_lock_ids: ["lock-1"],
      session: {
        ended_at: "2026-05-22T01:00:00.000Z",
        id: "session-1",
        status: "COMPLETED"
      },
      session_file: { cleared: true, path: ".vspec/session.json" },
      suggested_next_actions: [
        {
          command: "vspec merge show merge-1",
          reason: "Review the merge request opened for this completed session."
        }
      ],
      warnings: [
        { lock_id: "lock-1", message: "Lock release failed.", type: "LOCK_RELEASE" }
      ]
    });
    expect(completed.session.status).toBe("COMPLETED");
  });
});
