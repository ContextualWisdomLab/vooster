import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredRevision,
  StoredStakeholder
} from "../../../src/domain/entities/index.js";
import { registerStakeholderRoutes } from "../../../src/http/stakeholder-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;
const noop = () => undefined;

describe("stakeholder routes", () => {
  test("rejects stakeholder creation without membership", async () => {
    const routes = registeredRoutes();
    const captured = reply();

    await routes.post(request({ body: validBody() }), captured.fastifyReply);

    expect(captured.statusCode).toBe(403);
    expect(captured.body).toMatchObject({
      title: "Contact the workspace owner for access"
    });
  });

  test("rejects malformed stakeholder creation requests", async () => {
    const routes = registeredRoutes();
    const captured = reply();

    await routes.post(
      request({
        body: { name: "", type: "INTERNAL" },
        cookie: "vspec_session=token-1"
      }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid stakeholder request" });
  });

  test("creates stakeholders with default description and dry run off", async () => {
    const savedStakeholders: StoredStakeholder[] = [];
    const savedRevisions: StoredRevision[] = [];
    const routes = registeredRoutes({ savedRevisions, savedStakeholders });
    const captured = reply();

    await routes.post(
      request({ body: validBody(), cookie: "vspec_session=token-1" }),
      captured.fastifyReply
    );

    expect(captured.statusCode).toBe(201);
    expect(captured.body).toMatchObject({
      recommended_next_command: "vspec usecase add-stakeholder",
      stakeholder: { description: "", name: "Product Manager", type: "INTERNAL" }
    });
    expect(savedStakeholders).toHaveLength(1);
    expect(savedRevisions).toHaveLength(1);

    const dryRun = reply();
    await routes.post(
      request({
        body: validBody(),
        cookie: "vspec_session=token-1",
        query: { dry_run: "true" }
      }),
      dryRun.fastifyReply
    );

    expect(dryRun.statusCode).toBe(201);
    expect(savedStakeholders).toHaveLength(1);
    expect(savedRevisions).toHaveLength(1);
  });
});

function registeredRoutes(
  options: {
    savedRevisions?: StoredRevision[];
    savedStakeholders?: StoredStakeholder[];
  } = {}
) {
  const handlers: { post?: Handler } = {};
  const app = {
    delete: noop,
    get: noop,
    patch: noop,
    post: (_path: string, handler: Handler) => {
      handlers.post = handler;
    }
  } as unknown as FastifyInstance;

  registerStakeholderRoutes(
    app,
    signupState(),
    membershipStore(),
    { findProjectById: () => Promise.resolve(undefined) } as unknown as ProjectStore,
    revisionStore(options.savedRevisions ?? []),
    stakeholderStore(options.savedStakeholders ?? []),
    { isWorkspaceArchived: () => Promise.resolve(false) } as unknown as WorkspaceStore
  );

  if (handlers.post === undefined) {
    throw new Error("expected stakeholder POST route");
  }
  return { post: handlers.post };
}

function request(options: {
  body: unknown;
  cookie?: string;
  query?: Record<string, unknown>;
}): FastifyRequest {
  return {
    body: options.body,
    headers: { cookie: options.cookie },
    params: { projectId: "project-1" },
    query: options.query
  } as FastifyRequest;
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

function validBody() {
  return { name: "Product Manager", type: "INTERNAL" };
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

function revisionStore(saved: StoredRevision[]): RevisionStore {
  return {
    saveRevision: (revision: StoredRevision) => {
      saved.push(revision);
      return Promise.resolve();
    }
  } as unknown as RevisionStore;
}

function stakeholderStore(saved: StoredStakeholder[]): StakeholderStore {
  return {
    findStakeholderByName: () => Promise.resolve(undefined),
    saveStakeholder: (stakeholder: StoredStakeholder) => {
      saved.push(stakeholder);
      return Promise.resolve();
    }
  } as unknown as StakeholderStore;
}
