import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { StoredLock, StoredUseCase } from "../../../src/domain/entities/index.js";
import { registerLockRoutes } from "../../../src/http/lock-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

export function registeredRoutes(
  options: {
    deletedLockIds?: string[];
    existingLock?: StoredLock;
    savedLocks?: StoredLock[];
    updatedLocks?: StoredLock[];
  } = {}
) {
  const handlers: { create?: Handler; release?: Handler; renew?: Handler } = {};
  const app = {
    delete: (path: string, handler: Handler) => {
      if (path === "/v1/locks/:lockId") handlers.release = handler;
    },
    post: (path: string, handler: Handler) => {
      if (path === "/v1/locks") handlers.create = handler;
      else handlers.renew = handler;
    }
  } as unknown as FastifyInstance;

  registerLockRoutes(
    app,
    signupState(),
    lockStore(options),
    membershipStore(),
    useCaseStore()
  );

  if (
    handlers.create === undefined ||
    handlers.release === undefined ||
    handlers.renew === undefined
  ) {
    throw new Error("expected lock routes");
  }
  return {
    create: handlers.create,
    release: handlers.release,
    renew: handlers.renew
  };
}

export function request(options: {
  body: unknown;
  cookie?: string;
  params?: Record<string, string>;
  sessionHeader?: string | string[];
}): FastifyRequest {
  return {
    body: options.body,
    headers: {
      cookie: options.cookie,
      "x-vspec-session": options.sessionHeader
    },
    params: options.params ?? {}
  } as unknown as FastifyRequest;
}

export function reply() {
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

export function lockBody() {
  return {
    lock_type: "SEMANTIC",
    reason: "Edit use case",
    target_id: "usecase-1",
    target_type: "USECASE",
    ttl_minutes: 30
  };
}

export function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2099-01-01T00:00:00.000Z",
    held_by_session_id: "session-1",
    held_by_user_id: "user-1",
    holder: "session-1",
    id: "lock-1",
    mode: "SEMANTIC",
    reason: "Edit use case",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function lockStore(options: {
  deletedLockIds?: string[];
  existingLock?: StoredLock;
  savedLocks?: StoredLock[];
  updatedLocks?: StoredLock[];
}): LockStore {
  return {
    deleteLock: (lockId: string) => {
      options.deletedLockIds?.push(lockId);
      return Promise.resolve();
    },
    findLockById: () => Promise.resolve(options.existingLock),
    findLockForUseCase: () => Promise.resolve(undefined),
    saveLock: (newLock: StoredLock) => {
      options.savedLocks?.push(newLock);
      return Promise.resolve();
    },
    updateLock: (updatedLock: StoredLock) => {
      options.updatedLocks?.push(updatedLock);
      return Promise.resolve();
    }
  } as unknown as LockStore;
}

function membershipStore(): MembershipStore {
  return {
    membershipForProject: () =>
      Promise.resolve({
        id: "membership-1",
        role: "EDITOR",
        user_id: "user-1",
        workspace_id: "workspace-1"
      })
  } as unknown as MembershipStore;
}

function useCaseStore(): UseCaseStore {
  return {
    findUseCaseWithProject: () =>
      Promise.resolve({
        projectId: "project-1",
        usecase: {
          archived_at: null,
          id: "usecase-1",
          key: "LCK-001",
          project_id: "project-1",
          title: "Review locked refund"
        } as StoredUseCase
      })
  } as unknown as UseCaseStore;
}

function signupState(): SignupState {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map([["token-1", "user-1"]])
  };
}
