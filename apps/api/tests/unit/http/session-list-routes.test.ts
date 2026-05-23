import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import type { StoredWorkSession } from "../../../src/domain/entities/index.js";
import { registerSessionListRoutes } from "../../../src/http/session-list-routes.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";

let currentApp: FastifyInstance | undefined;

afterEach(() => currentApp?.close());

describe("session list routes", () => {
  test.each(["/v1/sessions", "/v1/sessions/watch"])(
    "rejects invalid session list queries on %s",
    async (url) => {
      const response = await sessionListApp().inject({
        headers: authHeaders(),
        method: "GET",
        url
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<ProblemBody>().title).toBe("Invalid session list request");
    }
  );

  test("returns a problem event response when watching without workspace membership", async () => {
    const response = await sessionListApp({ member: false }).inject({
      headers: authHeaders(),
      method: "GET",
      url: "/v1/sessions/watch?workspace_id=workspace-1"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<ProblemBody>().title).toBe("Workspace membership required");
  });

  test("returns a snapshot event stream for watch requests", async () => {
    const response = await sessionListApp().inject({
      headers: authHeaders(),
      method: "GET",
      url: "/v1/sessions/watch?workspace_id=workspace-1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body).toContain("event: snapshot");
  });

  test("returns session list snapshots", async () => {
    const response = await sessionListApp().inject({
      headers: authHeaders(),
      method: "GET",
      url: "/v1/sessions?workspace_id=workspace-1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ total: number }>().total).toBe(0);
  });

  test("rejects heartbeat updates for missing sessions and invalid timestamps", async () => {
    const app = sessionListApp({ session: session() });

    const missing = await app.inject({
      method: "POST",
      payload: { last_activity_at: "2026-05-20T00:00:00.000Z" },
      url: "/__test/sessions/missing/heartbeat"
    });
    const invalid = await app.inject({
      method: "POST",
      payload: { last_activity_at: "not-a-date" },
      url: "/__test/sessions/session-1/heartbeat"
    });

    expect(missing.statusCode).toBe(404);
    expect(missing.json<ProblemBody>().title).toBe("Session not found");
    expect(invalid.statusCode).toBe(404);
    expect(invalid.json<ProblemBody>().title).toBe("Session not found");
  });

  test("updates session heartbeat timestamps", async () => {
    const storedSession = session();
    const updates: StoredWorkSession[] = [];
    const response = await sessionListApp({ session: storedSession, updates }).inject({
      method: "POST",
      payload: { last_activity_at: "2026-05-20T00:30:00.000Z" },
      url: "/__test/sessions/session-1/heartbeat"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ updated: boolean }>().updated).toBe(true);
    expect(updates).toEqual([
      { ...storedSession, last_activity_at: "2026-05-20T00:30:00.000Z" }
    ]);
  });
});

type ProblemBody = { title: string };
type SessionListOptions = {
  member?: boolean;
  session?: StoredWorkSession;
  updates?: StoredWorkSession[];
};

function sessionListApp(options: SessionListOptions = {}) {
  const app = Fastify();
  currentApp = app;
  registerSessionListRoutes(
    app,
    state(),
    stub<BranchStore>({
      findBranchById: () => Promise.resolve(undefined)
    }),
    stub<LockStore>({
      listLocksHeldBySession: () => Promise.resolve([])
    }),
    stub<MembershipStore>({
      membershipForWorkspace: () =>
        Promise.resolve(options.member === false ? undefined : membership())
    }),
    stub<ProjectStore>({
      listProjectsForWorkspace: () => Promise.resolve([project()])
    }),
    stub<WorkSessionStore>({
      findWorkSessionById: (sessionId) =>
        Promise.resolve(
          sessionId === options.session?.id ? options.session : undefined
        ),
      listWorkSessions: () => Promise.resolve([]),
      updateWorkSession: (session) => {
        options.updates?.push({ ...session });
        return Promise.resolve();
      }
    }),
    stub<UseCaseStore>({
      listUseCases: () => Promise.resolve([])
    })
  );
  return app;
}

function state() {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set<string>(),
    sessionsByToken: new Map([["session-1", "user-1"]])
  };
}

function stub<T>(value: Partial<T>): T {
  return value as T;
}

const authHeaders = () => ({ cookie: "vspec_session=session-1" });

function membership() {
  return {
    id: "membership-1",
    role: "OWNER" as const,
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

function project() {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "PAY",
    name: "Payments",
    visibility: "PRIVATE" as const,
    workspace_id: "workspace-1"
  };
}

function session(): StoredWorkSession {
  return {
    agent_identifier: "codex-cli",
    agent_type: "CODEX",
    branch_id: null,
    id: "session-1",
    intent: "Monitor active work",
    last_activity_at: "2026-05-20T00:00:00.000Z",
    pinned_revisions: {},
    project_id: "project-1",
    started_at: "2026-05-20T00:00:00.000Z",
    status: "ACTIVE",
    user_id: "user-1"
  };
}
