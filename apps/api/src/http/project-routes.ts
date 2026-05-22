import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { createProject as createProjectWorkflow } from "../application/projects.js";
import { sendProjectCreationResult } from "./project-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { SignupStore } from "../ports/signup-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

const keyPattern = /^[A-Z][A-Z0-9]{1,7}$/;

const projectRequestSchema = z.object({
  name: z.string().min(1),
  key: z.string(),
  simulate_branch_insert_failure: z.boolean().optional(),
  visibility: z.enum(["PRIVATE", "INTERNAL"]).default("PRIVATE")
});

export function registerProjectRoutes(
  app: FastifyInstance,
  state: SignupState,
  store: SignupStore | undefined,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  workspaceStore: WorkspaceStore
) {
  app.get("/v1/projects", (request, reply) =>
    listProjects(request, reply, state, membershipStore, projectStore)
  );
  app.post("/v1/workspaces/:workspaceId/projects", (request, reply) =>
    createProject(
      request,
      reply,
      state,
      store,
      branchStore,
      membershipStore,
      projectStore,
      workspaceStore
    )
  );
  app.post("/__test/workspaces/:workspaceId/archive", (request, reply) =>
    archiveWorkspace(request, reply, workspaceStore)
  );
}

async function listProjects(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined) {
    return reply.code(401).send(problem(401, "Sign in to list projects"));
  }

  const memberships = await membershipStore.membershipsForUser(userId);
  const projects = (
    await Promise.all(
      memberships.map((membership) =>
        projectStore.listProjectsForWorkspace(membership.workspace_id)
      )
    )
  ).flat();

  return reply.send({
    items: projects
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((project) => ({
        id: project.id,
        key: project.key,
        name: project.name,
        visibility: project.visibility,
        workspace_id: project.workspace_id
      }))
  });
}

async function createProject(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  store: SignupStore | undefined,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  workspaceStore: WorkspaceStore
) {
  const workspaceId = workspaceIdFrom(request.params);
  const parsed = projectRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid project request"));
  }

  if (!keyPattern.test(parsed.data.key)) {
    return reply.code(400).send(
      problem(400, "Invalid project key", {
        key_pattern: "^[A-Z][A-Z0-9]{1,7}$",
        example_keys: ["PAY", "PAY2", "OPS2026"]
      })
    );
  }

  return sendProjectCreationResult(
    reply,
    await createProjectWorkflow(
      {
        branchStore,
        membershipStore,
        projectStore,
        signupStore: store,
        workspaceStore
      },
      {
        dryRun: dryRunFromQuery(request.query),
        key: parsed.data.key,
        name: parsed.data.name,
        simulateBranchInsertFailure:
          parsed.data.simulate_branch_insert_failure === true,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken),
        visibility: parsed.data.visibility,
        workspaceId
      }
    )
  );
}

function dryRunFromQuery(query: unknown): boolean {
  if (typeof query !== "object" || query === null) {
    return false;
  }
  return (query as { dry_run?: unknown }).dry_run === "true";
}

async function archiveWorkspace(
  request: FastifyRequest,
  reply: FastifyReply,
  workspaceStore: WorkspaceStore
) {
  await workspaceStore.archiveWorkspace(
    workspaceIdFrom(request.params),
    new Date().toISOString()
  );
  return reply.send({ archived: true });
}

function workspaceIdFrom(params: unknown): string {
  const parsed = z.object({ workspaceId: z.string().min(1) }).parse(params);
  return parsed.workspaceId;
}
