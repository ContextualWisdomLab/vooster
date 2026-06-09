import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredRevision,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { titleLooksLikeVerbPhrase } from "../../../src/application/verb-phrases.js";
import {
  sendUseCaseAuthoringResult,
  sendUseCaseUpdateResult
} from "../../../src/http/usecase-results.js";

describe("use case result responses", () => {
  test("serializes authoring failure statuses", () => {
    const cases = [
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Not authorized to create use cases in this project"
      },
      {
        expectedStatus: 422,
        result: {
          offendingWord: "checkout",
          status: "TITLE_NOT_VERB_PHRASE" as const,
          suggestedTitles: ["Review checkout"]
        },
        title: "Use case title should be a verb phrase"
      },
      {
        expectedStatus: 404,
        result: { status: "PROJECT_NOT_FOUND" as const },
        title: "Project not found"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendUseCaseAuthoringResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes authoring validation guidance", () => {
    const title = reply();
    sendUseCaseAuthoringResult(title.fastifyReply, {
      offendingWord: "checkout",
      status: "TITLE_NOT_VERB_PHRASE",
      suggestedTitles: ["Review checkout"]
    });

    expect(title.body).toMatchObject({
      code: "TITLE_NOT_VERB_PHRASE",
      offending_word: "checkout",
      suggested_next_actions: [
        {
          command: "vspec usecase create --force",
          reason: "Create anyway after reviewing the title."
        }
      ],
      suggested_titles: ["Review checkout"]
    });
    expect(
      suggestedTitles(title.body).every((suggested) =>
        titleLooksLikeVerbPhrase(suggested)
      )
    ).toBe(true);

    const actor = reply();
    sendUseCaseAuthoringResult(actor.fastifyReply, {
      actorName: "Buyer",
      status: "PRIMARY_ACTOR_NOT_AVAILABLE"
    });

    expect(actor.statusCode).toBe(422);
    expect(actor.body).toMatchObject({
      actor_name: "Buyer",
      code: "PRIMARY_ACTOR_NOT_AVAILABLE",
      suggested_next_actions: [
        { command: "vspec actor list" },
        { command: "vspec actor create --name Buyer" }
      ],
      title: "Primary actor is not available"
    });
  });

  test("serializes successful authoring payloads", () => {
    const captured = reply();
    const usecase = storedUseCase();
    const revision = storedRevision();

    sendUseCaseAuthoringResult(captured.fastifyReply, {
      revision,
      status: "CREATED",
      suggestedNextActions: [
        { command: "vspec usecase show PAY-001", reason: "Open it." }
      ],
      usecase
    });

    expect(captured.statusCode).toBe(201);
    expect(captured.body).toEqual({
      revision,
      suggested_next_actions: [
        { command: "vspec usecase show PAY-001", reason: "Open it." }
      ],
      usecase
    });
  });

  test("serializes update failures and success", () => {
    const cases = [
      {
        expectedStatus: 404,
        result: { status: "USECASE_NOT_FOUND" as const },
        title: "Use case not found"
      },
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 422,
        result: { status: "NEEDS_STAKEHOLDER_INTEREST" as const },
        title: "Use case needs at least one stakeholder interest"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendUseCaseUpdateResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }

    const updated = reply();
    const usecase = storedUseCase();

    sendUseCaseUpdateResult(updated.fastifyReply, {
      status: "UPDATED",
      usecase
    });

    expect(updated.statusCode).toBeUndefined();
    expect(updated.body).toEqual({ usecase });
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

function suggestedTitles(body: unknown): string[] {
  if (typeof body !== "object" || body === null) {
    return [];
  }
  const value = (body as { suggested_titles?: unknown }).suggested_titles;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function storedUseCase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    current_revision_id: "revision-1",
    id: "usecase-1",
    key: "PAY-001",
    status: "DRAFT",
    title: "Place an order",
    ...overrides
  } as StoredUseCase;
}

function storedRevision(): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-1",
    snapshot: storedUseCase(),
    version_number: 1
  };
}
