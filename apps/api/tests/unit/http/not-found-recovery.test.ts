import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";

import {
  sendAddScenarioStepResult,
  sendCreateScenarioResult
} from "../../../src/http/scenario-results.js";
import {
  sendStepEditingResult,
  sendStepMoveResult
} from "../../../src/http/step-results.js";
import { githubUnavailable } from "../../../src/http/signup-support.js";

type ProblemBody = {
  suggested_next_actions: Array<{
    command: string;
    reason: string;
  }>;
  title: string;
};

describe("not-found recovery responses", () => {
  test.each([
    [
      "step-add-scenario-not-found",
      (fastifyReply: FastifyReply) =>
        sendAddScenarioStepResult(fastifyReply, { status: "SCENARIO_NOT_FOUND" })
    ],
    [
      "step-edit-step-not-found",
      (fastifyReply: FastifyReply) =>
        sendStepEditingResult(fastifyReply, { status: "STEP_NOT_FOUND" })
    ],
    [
      "step-move-step-not-found",
      (fastifyReply: FastifyReply) =>
        sendStepMoveResult(fastifyReply, { status: "STEP_NOT_FOUND" })
    ],
    [
      "scenario-create-usecase-not-found",
      (fastifyReply: FastifyReply) =>
        sendCreateScenarioResult(fastifyReply, { status: "USECASE_NOT_FOUND" })
    ]
  ] as const)("teaches usecase show recovery for %s", (_token, sendResult) => {
    const captured = reply();

    sendResult(captured.fastifyReply);

    const body = captured.body as ProblemBody;
    expect(captured.statusCode).toBe(404);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec usecase show <KEY>",
      reason: "Re-read the use case to get the current scenario and step ids."
    });
    expect(JSON.stringify(body)).not.toContain("vspec login");
    expect(JSON.stringify(body)).not.toContain("Restart signup");
  });

  test("preserves auth-specific login recovery", () => {
    const captured = reply();

    githubUnavailable(captured.fastifyReply, "login");

    const body = captured.body as ProblemBody;
    expect(captured.statusCode).toBe(502);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec login",
      reason: "Retry login after GitHub is reachable."
    });
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
    header: () => captured.fastifyReply,
    send: (body: unknown) => {
      captured.body = body;
      return body;
    }
  } as unknown as FastifyReply;
  return captured;
}
