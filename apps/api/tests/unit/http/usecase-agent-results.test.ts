import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type { ShowUseCaseResult } from "../../../src/application/usecase-agent-types.js";
import type { StoredUseCase } from "../../../src/domain/entities/index.js";
import { sendUseCaseAgentResult } from "../../../src/http/usecase-agent-results.js";

describe("use case agent result responses", () => {
  test("serializes lookup and revision failures", () => {
    const cases: Array<{
      expectedStatus: number;
      result: ShowUseCaseResult;
      title: string;
    }> = [
      {
        expectedStatus: 404,
        result: { status: "NOT_FOUND" },
        title: "Use case not found"
      },
      {
        expectedStatus: 404,
        result: {
          revision: "revision-missing",
          status: "REVISION_NOT_FOUND",
          usecaseKey: "CHK-001"
        },
        title: "Revision not found"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendUseCaseAgentResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });

  test("serializes authentication guidance and successful payloads", () => {
    const auth = reply();
    sendUseCaseAgentResult(auth.fastifyReply, { status: "AUTHENTICATION_REQUIRED" });

    expect(auth.statusCode).toBe(401);
    expect(auth.body).toMatchObject({
      suggested_next_actions: [
        { command: "vspec login" },
        { command: "vspec api-key create --scopes read" }
      ],
      title: "Authentication required"
    });

    const simple = reply();
    sendUseCaseAgentResult(simple.fastifyReply, {
      data: data(),
      status: "SIMPLE",
      usecase: usecase()
    });
    expect(simple.body).toMatchObject({
      primary_actor: { name: "Customer" },
      usecase: { key: "CHK-001" }
    });

    const agent = reply();
    sendUseCaseAgentResult(agent.fastifyReply, {
      envelope: {
        context: {
          branch: "main",
          project_key: "CHK",
          request_id: "request-1",
          revision: "revision-1",
          session_id: null
        },
        data: data(),
        format_version: 1,
        suggested_next_actions: [],
        warnings: []
      },
      status: "AGENT_ENVELOPE"
    });
    expect(agent.body).toMatchObject({ format_version: 1 });
  });
});

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: (body: unknown) => {
      captured.body = body;
      return body;
    }
  } as unknown as FastifyReply;
  return captured;
}

function data() {
  return {
    invoked_by: [],
    primary_actor: { name: "Customer" },
    scenarios: [],
    stakeholder_interests: [],
    title: "Places an order",
    usecase: usecase()
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "CHK-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P2",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Places an order"
  };
}
