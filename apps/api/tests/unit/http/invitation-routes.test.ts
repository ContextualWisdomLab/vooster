import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredInvitation,
  StoredMembership,
  StoredUser
} from "../../../src/domain/entities/index.js";
import { invitations } from "../../../src/http/invitation-store.js";
import { registerInvitationRoutes } from "../../../src/http/invitation-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { UserStore } from "../../../src/ports/user-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("invitation routes", () => {
  test("rejects malformed invitation create requests", async () => {
    const context = routeContext();
    const captured = reply();

    await context.handlers.create(
      request({ workspaceId: "workspace-1" }, { email: "not-email", role: "EDITOR" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid invitation request" });
  });

  test("rejects expired invitation acceptance", async () => {
    const context = routeContext();
    const missing = reply();
    await context.handlers.accept(
      request({ token: "token-1" }, { code: "" }),
      missing.fastifyReply
    );
    expect(missing.statusCode).toBe(404);

    const captured = reply();
    invitations(context.state).set(
      "token-1",
      invitation({ expires_at: "2000-01-01T00:00:00.000Z" })
    );

    await context.handlers.accept(
      request({ token: "token-1" }, { code: "reader" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(410);
    expect(captured.body).toMatchObject({ code: "invitation_expired" });
  });

  test("accepts invitations with an existing GitHub user", async () => {
    const savedMemberships: StoredMembership[] = [];
    const existing = user();
    const context = routeContext({
      membershipStore: membershipStore(savedMemberships),
      userStore: userStore(existing)
    });
    const captured = reply();
    invitations(context.state).set(
      "token-1",
      invitation({ email: "existing-user@users.noreply.github.com" })
    );

    await context.handlers.accept(
      request({ token: "token-1" }, { code: "existing-user" }),
      captured.fastifyReply
    );

    expect(savedMemberships).toHaveLength(1);
    expect(savedMemberships[0]).toMatchObject({
      role: "EDITOR",
      user_id: existing.id,
      workspace_id: "workspace-1"
    });
    expect(context.state.sessionsByToken.size).toBe(1);
    const body = captured.body as { invitation: StoredInvitation };
    expect(body.invitation.accepted_at).toEqual(expect.any(String));
    expect(captured.body).toMatchObject({
      membership: { user_id: existing.id },
      user: existing
    });
  });
});

function routeContext(
  overrides: {
    membershipStore?: MembershipStore;
    userStore?: UserStore;
  } = {}
) {
  const state: SignupState = {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map()
  };
  const handlers: Partial<Record<"accept" | "create", Handler>> = {};
  const app = {
    post: (path: string, routeHandler: Handler) => {
      handlers[path.includes("/accept") ? "accept" : "create"] = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerInvitationRoutes(
    app,
    { authStub: true },
    state,
    overrides.membershipStore ?? membershipStore([]),
    overrides.userStore ?? userStore(),
    {} as WorkspaceStore
  );

  if (handlers.accept === undefined || handlers.create === undefined) {
    throw new Error("expected invitation routes");
  }
  return { handlers: handlers as Record<"accept" | "create", Handler>, state };
}

function request(params: Record<string, string>, body?: unknown): FastifyRequest {
  return { body, headers: {}, params } as unknown as FastifyRequest;
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
    header: () => {
      return captured.fastifyReply;
    },
    send: (body: unknown) => {
      captured.body = body;
      return body;
    }
  } as unknown as FastifyReply;
  return captured;
}

function invitation(overrides: Partial<StoredInvitation> = {}): StoredInvitation {
  return {
    accepted_at: null,
    delivery_status: "SENT",
    email: "reader@users.noreply.github.com",
    expires_at: "2999-01-01T00:00:00.000Z",
    id: "invitation-1",
    role: "EDITOR",
    token: "token-1",
    workspace_id: "workspace-1",
    ...overrides
  };
}

function user(): StoredUser {
  return {
    avatar_url: "https://github.com/identicons/stub.png",
    email: "existing-user@users.noreply.github.com",
    github_id: "existing-user",
    id: "user-1",
    name: "Existing User"
  };
}

function membershipStore(saved: StoredMembership[]): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: (membership: StoredMembership) => {
      saved.push(membership);
      return Promise.resolve();
    }
  };
}

function userStore(existing?: StoredUser): UserStore {
  return {
    findUserByEmail: () => Promise.resolve(undefined),
    findUserByGithubId: () => Promise.resolve(existing),
    saveUser: () => {
      throw new Error("expected existing user");
    },
    updateLastLoginAt: () => Promise.resolve()
  };
}
