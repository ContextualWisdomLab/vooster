import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import type { StoredWorkSession } from "../../../src/domain/entities/index.js";
import {
  archivedUsecase,
  authHeaders,
  sessionApp,
  type SessionOptions,
  validPayload
} from "./session-routes-fixtures.js";

let currentApp: FastifyInstance | undefined;

afterEach(() => currentApp?.close());

describe("session routes", () => {
  test.each(failureCases)(
    "maps failed session starts to problem responses",
    async (options, payload, statusCode, title) => {
      const response = await app(options).inject({
        headers: authHeaders(),
        method: "POST",
        payload,
        url: "/v1/sessions"
      });

      expect(response.statusCode).toBe(statusCode);
      expect(response.json<{ title: string }>().title).toBe(title);
    }
  );

  test("starts sessions with the agent header as identifier", async () => {
    const savedSessions: StoredWorkSession[] = [];
    const response = await app({ savedSessions }).inject({
      headers: { ...authHeaders(), "x-vspec-agent": "codex-cli" },
      method: "POST",
      payload: validPayload({ agent_type: "CODEX" }),
      url: "/v1/sessions"
    });

    const body = response.json<SessionStartBody>();
    expect(response.statusCode).toBe(201);
    expect(body.session).toMatchObject({
      agent_identifier: "codex-cli",
      agent_type: "CODEX",
      pinned_revisions: { "usecase-1": "revision-latest" }
    });
    expect(body.session_file.session_id).toBe(body.session.id);
    expect(savedSessions).toEqual([body.session]);
  });
});

type SessionStartBody = {
  session: StoredWorkSession;
  session_file: { session_id: string };
};
type FailureCase = [SessionOptions, Record<string, unknown>, number, string];

const failureCases: FailureCase[] = [
  [
    {},
    { intent: "Missing pins", project_id: "project-1" },
    400,
    "Invalid session request"
  ],
  [{ member: false }, validPayload(), 403, "Contact the workspace owner for access"],
  [{ usecases: [] }, validPayload(), 422, "Pinned use case not found"],
  [
    { usecases: [archivedUsecase()] },
    validPayload(),
    422,
    "Pinned use case is archived"
  ],
  [{ lockMode: "HARD" }, validPayload(), 409, "Pinned use case is hard-locked"],
  [
    { lockMode: "SEMANTIC" },
    validPayload({ auto_branch: true }),
    409,
    "Pinned use case has a semantic lock"
  ],
  [
    { project: null },
    validPayload({ auto_branch: true, branch_name: "agent/session-work" }),
    409,
    "Auto branch name is already in use"
  ],
  [{}, validPayload({ simulate_write_failure: true }), 500, "Session creation failed"]
];

function app(options: SessionOptions = {}) {
  currentApp = sessionApp(options);
  return currentApp;
}
