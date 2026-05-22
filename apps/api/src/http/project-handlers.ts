import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createProject as createProjectWorkflow,
  createProjectInDefaultWorkspace,
  deleteProject as deleteProjectWorkflow,
  renameProject as renameProjectWorkflow
} from "../application/projects.js";
import {
  sendProjectCreationResult,
  sendProjectDeletionResult,
  sendProjectRenameResult
} from "./project-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { SignupStore } from "../ports/signup-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,7}$/;

const projectRequestSchema = z.object({
  name: z.string().min(1),
  key: z.string(),
  simulate_branch_insert_failure: z.boolean().optional(),
  visibility: z.enum(["PRIVATE", "INTERNAL"]).default("PRIVATE")
});

const projectRenameSchema = z.object({ name: z.string().min(1).max(120) });

export type ProjectRouteDeps = {
  branchStore: BranchStore;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  signupStore: SignupStore | undefined;
  state: SignupState;
  workspaceStore: WorkspaceStore;
};

export async function handleListProjects(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: Pick<ProjectRouteDeps, "membershipStore" | "projectStore" | "state">
) {
  const userId = authenticatedUserId(request.headers.cookie, deps.state.sessionsByToken);
  if (userId === undefined) {
    return reply.code(401).send(problem(401, "Sign in to list projects"));
  }

  const memberships = await deps.membershipStore.membershipsForUser(userId);
  const projects = (
    await Promise.all(
      memberships.map((membership) =>
        deps.projectStore.listProjectsForWorkspace(membership.workspace_id)
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

export async function handleCreateProject(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: ProjectRouteDeps
) {
  const workspaceId = workspaceIdFrom(request.params);
  const parsed = projectRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid project request"));
  }
  if (!KEY_PATTERN.test(parsed.data.key)) {
    return reply.code(400).send(invalidKeyProblem());
  }

  return sendProjectCreationResult(
    reply,
    await createProjectWorkflow(
      {
        branchStore: deps.branchStore,
        membershipStore: deps.membershipStore,
        projectStore: deps.projectStore,
        signupStore: deps.signupStore,
        workspaceStore: deps.workspaceStore
      },
      {
        dryRun: dryRunFromQuery(request.query),
        key: parsed.data.key,
        name: parsed.data.name,
        simulateBranchInsertFailure: parsed.data.simulate_branch_insert_failure === true,
        userId: authenticatedUserId(request.headers.cookie, deps.state.sessionsByToken),
        visibility: parsed.data.visibility,
        workspaceId
      }
    )
  );
}

export async function handleCreateProjectDefaultWorkspace(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: ProjectRouteDeps
) {
  const userId = authenticatedUserId(request.headers.cookie, deps.state.sessionsByToken);
  if (userId === undefined) {
    return reply.code(401).send(problem(401, "Sign in to create a project"));
  }

  const parsed = projectRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid project request"));
  }
  if (!KEY_PATTERN.test(parsed.data.key)) {
    return reply.code(400).send(invalidKeyProblem());
  }

  return sendProjectCreationResult(
    reply,
    await createProjectInDefaultWorkspace(
      {
        branchStore: deps.branchStore,
        membershipStore: deps.membershipStore,
        projectStore: deps.projectStore,
        signupStore: deps.signupStore,
        workspaceStore: deps.workspaceStore
      },
      {
        dryRun: dryRunFromQuery(request.query),
        key: parsed.data.key,
        name: parsed.data.name,
        simulateBranchInsertFailure: parsed.data.simulate_branch_insert_failure === true,
        userId,
        visibility: parsed.data.visibility
      }
    )
  );
}

export async function handleRenameProject(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: Pick<ProjectRouteDeps, "membershipStore" | "projectStore" | "state" | "workspaceStore">
) {
  const userId = authenticatedUserId(request.headers.cookie, deps.state.sessionsByToken);
  if (userId === undefined) {
    return reply.code(401).send(problem(401, "Sign in to rename a project"));
  }

  const projectId = projectIdFrom(request.params);
  const parsed = projectRenameSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid rename request"));
  }

  return sendProjectRenameResult(
    reply,
    await renameProjectWorkflow(
      {
        membershipStore: deps.membershipStore,
        projectStore: deps.projectStore,
        workspaceStore: deps.workspaceStore
      },
      { name: parsed.data.name, projectId, userId }
    )
  );
}

export async function handleDeleteProject(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: Pick<ProjectRouteDeps, "membershipStore" | "projectStore" | "state" | "workspaceStore">
) {
  const userId = authenticatedUserId(request.headers.cookie, deps.state.sessionsByToken);
  if (userId === undefined) {
    return reply.code(401).send(problem(401, "Sign in to delete a project"));
  }

  const projectId = projectIdFrom(request.params);

  return sendProjectDeletionResult(
    reply,
    await deleteProjectWorkflow(
      {
        membershipStore: deps.membershipStore,
        projectStore: deps.projectStore,
        workspaceStore: deps.workspaceStore
      },
      { projectId, userId }
    )
  );
}

export async function handleArchiveWorkspace(
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

function dryRunFromQuery(query: unknown): boolean {
  if (typeof query !== "object" || query === null) {
    return false;
  }
  return (query as { dry_run?: unknown }).dry_run === "true";
}

function invalidKeyProblem() {
  return problem(400, "Invalid project key", {
    key_pattern: "^[A-Z][A-Z0-9]{1,7}$",
    example_keys: ["PAY", "PAY2", "OPS2026"]
  });
}

function workspaceIdFrom(params: unknown): string {
  return z.object({ workspaceId: z.string().min(1) }).parse(params).workspaceId;
}

function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}
