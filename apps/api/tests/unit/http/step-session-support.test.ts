import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredWorkSession } from "../../../src/domain/entities/index.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";
import {
  affectedSessionIds,
  createTestWorkSession
} from "../../../src/http/step-session-support.js";

describe("step session support", () => {
  test("rejects invalid work session requests", async () => {
    const captured = reply();
    const store = workSessionStore([]);

    await createTestWorkSession(
      request({ body: { id: "", pinned_revision_id: "revision-1" } }),
      captured.fastifyReply,
      store
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid work session request" });
    expect(store.saved).toEqual([]);
  });

  test("creates active work sessions for the requested use case", async () => {
    const captured = reply();
    const store = workSessionStore([]);

    await createTestWorkSession(
      request({ body: { id: "session-1", pinned_revision_id: "revision-1" } }),
      captured.fastifyReply,
      store
    );

    expect(captured.statusCode).toBe(201);
    expect(captured.body).toEqual({
      session: {
        id: "session-1",
        pinned_revision_id: "revision-1",
        status: "ACTIVE",
        usecase_id: "usecase-1"
      }
    });
    expect(store.saved).toEqual([captured.body?.session]);
  });

  test("lists affected session ids", async () => {
    await expect(
      affectedSessionIds(
        workSessionStore([
          { id: "session-1" } as StoredWorkSession,
          { id: "session-2" } as StoredWorkSession
        ]),
        "usecase-1"
      )
    ).resolves.toEqual(["session-1", "session-2"]);
  });
});

function request(input: { body: unknown }): FastifyRequest {
  return {
    body: input.body,
    params: { usecaseId: "usecase-1" }
  } as FastifyRequest;
}

function reply() {
  const captured: {
    body?: { session?: StoredWorkSession; title?: string };
    fastifyReply: FastifyReply;
    send: (body: { session?: StoredWorkSession; title?: string }) => unknown;
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

function workSessionStore(existing: StoredWorkSession[]) {
  const saved: StoredWorkSession[] = [];
  return {
    findWorkSessionById: (sessionId: string) =>
      Promise.resolve(existing.find((session) => session.id === sessionId)),
    listWorkSessions: () => Promise.resolve(existing),
    listWorkSessionsForUseCase: () => Promise.resolve(existing),
    saveWorkSession: (session: StoredWorkSession) => {
      saved.push(session);
      return Promise.resolve();
    },
    updateWorkSession: (session: StoredWorkSession) => {
      saved.push(session);
      return Promise.resolve();
    },
    saved
  } as WorkSessionStore & { saved: StoredWorkSession[] };
}
