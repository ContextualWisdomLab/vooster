import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import { sendListApiKeysResult } from "../../../src/http/api-key-results.js";

describe("api key result responses", () => {
  test("serializes list access failures", () => {
    const captured = reply();

    sendListApiKeysResult(captured.fastifyReply, { status: "OWNER_REQUIRED" });

    expect(captured.statusCode).toBe(403);
    expect(captured.body).toMatchObject({ title: "Workspace owner role required" });
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
