import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredActor,
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { registerUseCaseRoutes } from "../../../src/http/usecase-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { GoalStore } from "../../../src/ports/goal-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

describe("use case routes", () => {
  test("creates use cases when the query string is absent", async () => {
    const savedRevisions: StoredRevision[] = [];
    const savedUseCases: StoredUseCase[] = [];
    const captured = reply();

    await registeredRoute({
      revisionStore: revisionStore(savedRevisions),
      useCaseStore: useCaseStore(savedUseCases)
    })(request(), captured.fastifyReply);

    expect(captured.statusCode).toBe(201);
    expect(savedUseCases).toHaveLength(1);
    expect(savedRevisions).toHaveLength(1);
    expect(captured.body).toMatchObject({
      usecase: {
        key: "CHK-001",
        title: "Places an order"
      }
    });
  });
});

function registeredRoute(overrides: {
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
}): Handler {
  let handler: Handler | undefined;
  const app = {
    post: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    }
  } as unknown as FastifyInstance;

  registerUseCaseRoutes(
    app,
    signupState(),
    actorStore(),
    {} as GoalStore,
    membershipStore(),
    projectStore(),
    overrides.revisionStore,
    overrides.useCaseStore
  );

  if (handler === undefined) {
    throw new Error("expected use case route");
  }
  return handler;
}

function request(): FastifyRequest {
  return {
    body: {
      primary_actor: "Customer",
      title: "Places an order"
    },
    headers: { cookie: "vspec_session=token-1" },
    params: { projectId: "project-1" }
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

function actorStore(): ActorStore {
  return {
    archiveActor: () => Promise.resolve(false),
    findActorById: () => Promise.resolve(undefined),
    findActorByName: () => Promise.resolve(actor()),
    listActors: () => Promise.resolve([]),
    saveActor: () => Promise.resolve()
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

function projectStore(): ProjectStore {
  return {
    deleteProject: () => Promise.resolve("NOT_FOUND"),
    findProjectById: () => Promise.resolve(project()),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    saveProject: () => Promise.resolve(),
    updateProjectName: () => Promise.resolve(undefined)
  };
}

function revisionStore(savedRevisions: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: (revision) => {
      savedRevisions.push(revision);
      return Promise.resolve();
    }
  };
}

function useCaseStore(savedUseCases: StoredUseCase[]): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: () => Promise.resolve(undefined),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve([]),
    saveUseCase: (usecase) => {
      savedUseCases.push(usecase);
      return Promise.resolve();
    },
    updateUseCase: () => Promise.resolve()
  };
}

function actor(): StoredActor {
  return {
    aliases: [],
    archived_at: null,
    description: "",
    id: "actor-1",
    is_human: true,
    name: "Customer",
    project_id: "project-1",
    type: "PRIMARY"
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

function project(): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "CHK",
    name: "Checkout",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}
