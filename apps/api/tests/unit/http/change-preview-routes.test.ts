import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredMembership,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";
import { previewSpecChange } from "../../../src/http/change-preview-routes.js";
import { previews } from "../../../src/http/change-preview-support.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";

describe("change preview routes", () => {
  test("passes through bodies that are not change proposals", async () => {
    const captured = reply();

    await expect(callPreview({ body: { other: true }, reply: captured })).resolves.toBe(
      false
    );

    expect(captured.body).toBeUndefined();
  });

  test("rejects malformed change proposals after marker detection", async () => {
    const captured = reply();

    await expect(
      callPreview({
        body: { patch: {}, usecase_key: "PAY-001" },
        reply: captured
      })
    ).resolves.toBe(true);

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid change proposal" });
  });

  test("previews valid change proposals for the authenticated user", async () => {
    const state = signupState();
    const captured = reply();

    await expect(
      callPreview({
        body: proposalBody(),
        cookie: "vspec_session=token-1",
        reply: captured,
        sessions: [session()],
        state
      })
    ).resolves.toBe(true);

    expect(captured.statusCode).toBe(201);
    expect(captured.body).toMatchObject({
      impact: {
        affected_sessions: [{ id: "session-1", pinned_usecase_keys: ["PAY-001"] }],
        severity: "NON_BREAKING"
      },
      warnings: [{ type: "AUTO_COMMIT_REFUSED" }]
    });

    const previewId = (captured.body as { preview_id?: unknown }).preview_id;
    expect(typeof previewId).toBe("string");
    expect(previews(state).get(String(previewId))).toMatchObject({
      base_revision: "revision-1",
      usecase_id: "usecase-1"
    });
  });
});

function callPreview(options: {
  body: unknown;
  cookie?: string;
  reply: ReturnType<typeof reply>;
  sessions?: StoredWorkSession[];
  state?: SignupState;
}) {
  return previewSpecChange(
    request(options.body, options.cookie),
    options.reply.fastifyReply,
    options.state ?? signupState(),
    lockStore(),
    membershipStore(),
    {} as unknown as RevisionStore,
    workSessionStore(options.sessions ?? []),
    useCaseStore()
  );
}

function proposalBody() {
  return {
    auto_commit: true,
    base_revision: "revision-1",
    patch: {
      entity_id: "usecase-1",
      entity_type: "USECASE",
      fields: { title: "Place an order quickly" }
    },
    usecase_key: "PAY-001"
  };
}

function request(body: unknown, cookie?: string) {
  return { body, headers: { cookie } } as FastifyRequest;
}

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

function signupState(): SignupState {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map([["token-1", "user-1"]])
  };
}

function lockStore(): LockStore {
  return {
    findLockForUseCase: () => Promise.resolve(undefined)
  } as unknown as LockStore;
}

function membershipStore(): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(membership())
  } as unknown as MembershipStore;
}

function useCaseStore(): UseCaseStore {
  return {
    findUseCasesByKey: () => Promise.resolve([usecase()])
  } as unknown as UseCaseStore;
}

function workSessionStore(sessions: StoredWorkSession[]): WorkSessionStore {
  return {
    listWorkSessionsForUseCase: () => Promise.resolve(sessions)
  } as unknown as WorkSessionStore;
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

function session(): StoredWorkSession {
  return {
    agent_type: "CODEX",
    id: "session-1",
    pinned_revisions: { "usecase-1": "revision-1" },
    status: "ACTIVE",
    user_id: "user-2"
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    id: "usecase-1",
    key: "PAY-001",
    project_id: "project-1",
    title: "Place an order"
  } as StoredUseCase;
}
