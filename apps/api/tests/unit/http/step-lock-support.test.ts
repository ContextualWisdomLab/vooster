import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import { createTestLock } from "../../../src/http/step-lock-support.js";
import type { LockStore } from "../../../src/ports/lock-store.js";

describe("step lock support", () => {
  test("rejects malformed lock requests", async () => {
    const captured = reply();

    await createTestLock(
      request({ body: { holder: "agent", mode: "HARD", reason: "" } }),
      captured.fastifyReply,
      {} as LockStore
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid lock request" });
  });
});

function request(options: { body?: unknown }): FastifyRequest {
  return {
    body: options.body,
    params: { usecaseId: "usecase-1" }
  } as unknown as FastifyRequest;
}

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
