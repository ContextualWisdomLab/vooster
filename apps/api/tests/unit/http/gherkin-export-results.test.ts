import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredUseCase } from "../../../src/domain/entities/index.js";
import { sendGherkinExportProblem } from "../../../src/http/gherkin-export-results.js";

describe("Gherkin export result responses", () => {
  test("serializes simple export failures", () => {
    const cases = [
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Not authorized to export Gherkin"
      },
      {
        expectedStatus: 404,
        result: { status: "USECASE_NOT_FOUND" as const },
        title: "Use case not found"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendGherkinExportProblem(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes archived use case guidance", () => {
    const captured = reply();

    sendGherkinExportProblem(captured.fastifyReply, {
      status: "ARCHIVED_USECASE",
      usecase: usecase({ archived_at: "2026-05-23T00:00:00Z" })
    });

    expect(captured.statusCode).toBe(409);
    expect(captured.body).toMatchObject({
      suggested_next_actions: [{ command: "vspec usecase restore PAY-001" }],
      title: "Use case is archived"
    });
  });

  test("serializes incomplete use case guidance", () => {
    const captured = reply();

    sendGherkinExportProblem(captured.fastifyReply, {
      missingRequiredField: "main_success.steps",
      status: "INCOMPLETE_USECASE",
      usecase: usecase()
    });

    expect(captured.statusCode).toBe(422);
    expect(captured.body).toMatchObject({
      missing_required_field: "main_success.steps",
      suggested_next_actions: [
        { command: "vspec doctor PAY-001" },
        { command: "vspec scenario add PAY-001 --type main-success" }
      ],
      title: "Cannot export incomplete use case"
    });
  });

  test("serializes missing revision guidance", () => {
    const captured = reply();

    sendGherkinExportProblem(captured.fastifyReply, {
      revisionId: "revision-missing",
      status: "REVISION_NOT_FOUND",
      usecase: usecase()
    });

    expect(captured.statusCode).toBe(404);
    expect(captured.body).toMatchObject({
      revision_id: "revision-missing",
      suggested_next_actions: [{ command: "vspec history PAY-001" }],
      title: "Revision not found"
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

function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    id: "usecase-1",
    key: "PAY-001",
    title: "Place an order",
    ...overrides
  } as StoredUseCase;
}
