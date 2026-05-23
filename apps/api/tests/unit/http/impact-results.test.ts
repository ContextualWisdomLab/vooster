import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type { ImpactPayload } from "../../../src/application/impact-analysis.js";
import type { StoredUseCase } from "../../../src/domain/entities/index.js";
import { sendImpactResult } from "../../../src/http/impact-results.js";

describe("impact result responses", () => {
  test("serializes lookup, access, parse, and revision failures", () => {
    const cases = [
      {
        expectedStatus: 404,
        result: { status: "NOT_FOUND" as const },
        title: "Use case not found"
      },
      {
        expectedStatus: 403,
        result: { status: "ACCESS_DENIED" as const },
        title: "Not authorized to preview impact"
      },
      {
        expectedStatus: 400,
        result: {
          path: "changes/PAY-001.md",
          status: "PROPOSED_CHANGE_PARSE_FAILED" as const
        },
        title: "Proposed change parse failed"
      },
      {
        expectedStatus: 404,
        result: { status: "REVISION_NOT_FOUND" as const },
        title: "Revision not found"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendImpactResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes unreadable proposed-change guidance", () => {
    const captured = reply();

    sendImpactResult(captured.fastifyReply, {
      path: "changes/PAY-001.md",
      status: "PROPOSED_CHANGE_NOT_READABLE",
      usecase: usecase()
    });

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({
      path: "changes/PAY-001.md",
      suggested_next_actions: [
        { command: "vspec impact --proposed-change <path>" },
        { command: "vspec impact PAY-001" }
      ],
      title: "Proposed change file is not readable"
    });
  });

  test("serializes previewed impact payloads", () => {
    const captured = reply();

    sendImpactResult(captured.fastifyReply, {
      cached: true,
      impact: impactPayload(),
      nextActions: [{ command: "vspec lock PAY-001", reason: "Coordinate." }],
      previewId: "preview-1",
      status: "PREVIEWED"
    });

    expect(captured.statusCode).toBeUndefined();
    expect(captured.body).toEqual({
      cached: true,
      impact: impactPayload(),
      preview_id: "preview-1",
      suggested_next_actions: [{ command: "vspec lock PAY-001", reason: "Coordinate." }]
    });
  });
});

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    send: (body: unknown) => unknown;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply,
    send: (body) => {
      captured.body = body;
      return body;
    }
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: captured.send
  } as unknown as FastifyReply;
  return captured;
}

function impactPayload(): ImpactPayload {
  return {
    affected_branches: [],
    affected_sessions: [],
    affected_tests: [],
    confidence: 1,
    input_hash: "hash-1",
    severity: "NON_BREAKING"
  };
}

function usecase(): StoredUseCase {
  return { id: "usecase-1", key: "PAY-001" } as StoredUseCase;
}
