import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredMembership,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { registerUseCaseUpdateRoutes } from "../../../src/http/usecase-update-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("use case update routes", () => {
  test("accepts documented metadata fields", async () => {
    const updates: StoredUseCase[] = [];
    const captured = reply();

    await registeredRoute({ updates })(
      request({
        body: {
          format: "BRIEF",
          level: "SUMMARY",
          priority: "P1",
          scope: "checkout-admin",
          status: "DRAFT",
          title: "Reviews checkout status"
        },
        cookie: "vspec_session=token-1"
      }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBeUndefined();
    expect(updates).toEqual([
      usecase({
        level: "SUMMARY",
        priority: "P1",
        scope: "checkout-admin",
        status: "DRAFT",
        title: "Reviews checkout status"
      })
    ]);
    expect(captured.body).toMatchObject({
      usecase: {
        level: "SUMMARY",
        priority: "P1",
        scope: "checkout-admin",
        status: "DRAFT",
        title: "Reviews checkout status"
      }
    });
  });

  test("rejects malformed use case updates", async () => {
    const captured = reply();

    await registeredRoute()(
      request({ body: { status: "UNKNOWN" } }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid use case update" });
  });
});

function registeredRoute(options: { updates?: StoredUseCase[] } = {}): Handler {
  let handler: Handler | undefined;
  const app = {
    patch: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerUseCaseUpdateRoutes(
    app,
    signupState(),
    {} as BranchStore,
    membershipStore(),
    {} as ProjectStore,
    {} as RevisionStore,
    stakeholderInterestStore(),
    useCaseStore(options.updates ?? [])
  );

  if (handler === undefined) {
    throw new Error("expected use case update route");
  }
  return handler;
}

function request(options: { body?: unknown; cookie?: string }): FastifyRequest {
  return {
    body: options.body,
    headers: { cookie: options.cookie },
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

function signupState(): SignupState {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map([["token-1", "user-1"]])
  };
}

function membershipStore(): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(member()),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function stakeholderInterestStore(): StakeholderInterestStore {
  return {
    deleteStakeholderInterest: () => Promise.resolve(),
    findStakeholderInterestById: () => Promise.resolve(undefined),
    findStakeholderInterestForStakeholder: () => Promise.resolve(undefined),
    listStakeholderInterests: () => Promise.resolve([]),
    saveStakeholderInterest: () => Promise.resolve()
  };
}

function useCaseStore(updates: StoredUseCase[]): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () =>
      Promise.resolve({ projectId: "project-1", usecase: usecase() }),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: (updated) => {
      updates.push(updated);
      return Promise.resolve();
    }
  };
}

function member(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
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
    scope: "chk",
    status: "DRAFT",
    title: "Places an order",
    ...overrides
  };
}
