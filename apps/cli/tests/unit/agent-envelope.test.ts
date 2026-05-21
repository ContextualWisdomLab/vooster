import { describe, expect, it } from "vitest";

import { buildAgentEnvelope } from "../../src/agent-envelope.js";

describe("buildAgentEnvelope", () => {
  it("returns the agent envelope contract with format_version 1", () => {
    const envelope = buildAgentEnvelope({
      data: {
        ok: true
      }
    });

    expect(Object.keys(envelope).sort()).toEqual(
      ["context", "data", "format_version", "suggested_next_actions", "warnings"].sort()
    );
    expect(envelope.format_version).toBe(1);
  });

  it("defaults context and advisory arrays", () => {
    const envelope = buildAgentEnvelope({
      data: {
        ok: true
      }
    });

    expect(envelope.context).toEqual({
      branch: null,
      project_key: null,
      revision: null,
      session_id: null
    });
    expect(envelope.suggested_next_actions).toEqual([]);
    expect(envelope.warnings).toEqual([]);
  });

  it("preserves provided context, warnings, and suggested actions", () => {
    const envelope = buildAgentEnvelope({
      context: {
        project_key: "ACME"
      },
      data: {
        key: "UC-001"
      },
      suggested_next_actions: [{ command: "vspec usecase show UC-001" }],
      warnings: [{ message: "Review required" }]
    });

    expect(envelope.context.project_key).toBe("ACME");
    expect(envelope.context.branch).toBeNull();
    expect(envelope.suggested_next_actions).toEqual([
      { command: "vspec usecase show UC-001" }
    ]);
    expect(envelope.warnings).toEqual([{ message: "Review required" }]);
  });
});
