import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredMembership, StoredProject } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { SignupStore } from "../ports/signup-store.js";

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
  projectStore: ProjectStore
) {
  app.post("/v1/workspaces/:workspaceId/projects", (request, reply) =>
    createProject(request, reply, state, store, branchStore, membershipStore, projectStore)
  );
  app.post("/__test/workspaces/:workspaceId/archive", (request, reply) =>
    archiveWorkspace(request, reply, state)
  );
}

async function createProject(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  store: SignupStore | undefined,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  const workspaceId = workspaceIdFrom(request.params);
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  const membership = await membershipFor(membershipStore, userId, workspaceId);
  if (membership === undefined) {
    return reply.code(403).send(
      problem(403, "Request an invitation to this workspace", {}, [
        {
          command: "vspec workspace invitations request",
          reason: "Ask a workspace owner for access."
        }
      ])
    );
  }

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

  if (state.workspaceArchivedAt.has(workspaceId)) {
    return reply.code(409).send(problem(409, "Workspace has been archived"));
  }

  const existing = await projectStore.findProjectByWorkspaceAndKey(
    workspaceId,
    parsed.data.key
  );
  if (existing !== undefined) {
    return reply.code(422).send(
      problem(
        422,
        "Project key is already in use",
        {
          existing_project: {
            id: existing.id,
            key: existing.key,
            name: existing.name
          }
        },
        [
          {
            command: `vspec project show ${existing.key}`,
            reason: "Verify whether the existing project is the intended target."
          }
        ]
      )
    );
  }

  const project = newProject(workspaceId, parsed.data);
  if (parsed.data.simulate_branch_insert_failure === true) {
    return reply.code(500).send(
      problem(500, "Project creation failed", {
        request_id: randomUUID()
      })
    );
  }

  const branch = {
    id: randomUUID(),
    project_id: project.id,
    name: "main" as const,
    owner_type: "HUMAN" as const,
    owner_id: membership.user_id,
    base_branch_id: null
  };
  project.default_branch_id = branch.id;

  if (store === undefined) {
    await projectStore.saveProject(project);
    await branchStore.saveBranch(branch);
  } else {
    await store.saveProjectWithDefaultBranch(project, branch);
  }

  return reply.code(201).send({
    project,
    default_branch: branch,
    recommended_next_command: "vspec actor define"
  });
}

function archiveWorkspace(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  state.workspaceArchivedAt.set(workspaceIdFrom(request.params), new Date().toISOString());
  return reply.send({ archived: true });
}

function workspaceIdFrom(params: unknown): string {
  const parsed = z.object({ workspaceId: z.string().min(1) }).parse(params);
  return parsed.workspaceId;
}

function membershipFor(
  membershipStore: MembershipStore,
  userId: string | undefined,
  workspaceId: string
): Promise<StoredMembership | undefined> {
  if (userId === undefined) {
    return Promise.resolve(undefined);
  }

  return membershipStore.membershipForWorkspace(workspaceId, userId);
}

function newProject(
  workspaceId: string,
  data: z.infer<typeof projectRequestSchema>
): StoredProject {
  return {
    id: randomUUID(),
    workspace_id: workspaceId,
    name: data.name,
    key: data.key,
    visibility: data.visibility,
    default_branch_id: ""
  };
}
