import Fastify from "fastify";
import type {
  StoredProject,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";
import { registerSessionRoutes } from "../../../src/http/session-routes.js";
import type { BranchStore } from "../../../src/ports/branch-store.js";
import type { LockStore } from "../../../src/ports/lock-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";

export type SessionOptions = {
  lockMode?: "HARD" | "SEMANTIC";
  member?: boolean;
  project?: StoredProject | null;
  savedSessions?: StoredWorkSession[];
  usecases?: StoredUseCase[];
};

export function sessionApp(options: SessionOptions = {}) {
  const app = Fastify();
  const savedSessions = options.savedSessions ?? [];

  registerSessionRoutes(
    app,
    state(),
    stub<BranchStore>({
      listBranches: () => Promise.resolve([]),
      saveBranch: () => Promise.resolve()
    }),
    stub<LockStore>({
      findLockForUseCase: () =>
        Promise.resolve(
          options.lockMode === undefined
            ? undefined
            : {
                expires_at: "2026-06-01T00:00:00.000Z",
                holder: "session-lock-holder",
                mode: options.lockMode,
                reason: "Locked for testing",
                usecase_id: "usecase-1"
              }
        )
    }),
    stub<MembershipStore>({
      membershipForProject: () =>
        Promise.resolve(options.member === false ? undefined : membership())
    }),
    stub<ProjectStore>({
      findProjectById: () =>
        Promise.resolve(
          options.project === null ? undefined : (options.project ?? project())
        )
    }),
    stub<RevisionStore>({
      latestRevision: () =>
        Promise.resolve({
          entity_id: "usecase-1",
          entity_type: "USECASE",
          id: "revision-latest",
          snapshot: usecase(),
          version_number: 2
        })
    }),
    stub<WorkSessionStore>({
      saveWorkSession: (session) => {
        savedSessions.push(session);
        return Promise.resolve();
      }
    }),
    stub<UseCaseStore>({
      listUseCases: () => Promise.resolve(options.usecases ?? [usecase()])
    })
  );

  return app;
}

export function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    agent_type: "OTHER",
    intent: "Implement session start",
    pins: ["UC-001"],
    project_id: "project-1",
    ...overrides
  };
}

export const authHeaders = () => ({ cookie: "vspec_session=session-1" });

export function archivedUsecase(): StoredUseCase {
  return { ...usecase(), archived_at: "2026-05-23T00:00:00.000Z" };
}

function stub<T>(value: Partial<T>): T {
  return value as T;
}

function state() {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set<string>(),
    sessionsByToken: new Map([["session-1", "user-1"]])
  };
}

function membership() {
  return {
    id: "membership-1",
    role: "EDITOR" as const,
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

function project(): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "SES",
    name: "Sessions",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "UC-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "Sessions",
    status: "DRAFT",
    title: "Start a work session"
  };
}
