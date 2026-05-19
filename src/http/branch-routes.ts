import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  isReadOnlyMembership,
  membershipForProject
} from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredProject, StoredSpecBranch } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { MergeRequestStore } from "../ports/merge-request-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const branchCreateSchema = z.object({
  from: z.string().default("main"),
  name: z.string().min(1),
  simulate_snapshot_failure: z.boolean().default(false)
});

export function registerBranchRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/projects/:projectId/branches", (request, reply) =>
    createBranch(
      request,
      reply,
      state,
      branchStore,
      projectStore,
      membershipStore,
      mergeRequestStore,
      useCaseStore
    )
  );
}

async function createBranch(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  projectStore: ProjectStore,
  membershipStore: MembershipStore,
  mergeRequestStore: MergeRequestStore,
  useCaseStore: UseCaseStore
) {
  const projectId = projectIdFrom(request.params);
  const membership = await membershipForProject(request, state, membershipStore, projectId);
  if (membership === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  if (isReadOnlyMembership(state, membership)) {
    return readOnly(reply);
  }
  const parsed = branchCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid branch request"));
  }
  if (parsed.data.from !== "main") {
    return reply.code(422).send(
      problem(422, "MVP supports single-level branches from main only", {}, [
        {
          command: `vspec branch create ${parsed.data.name} --from main`,
          reason: "Create MVP branches from main only."
        }
      ])
    );
  }
  if (await branchNameExists(branchStore, projectId, parsed.data.name)) {
    const suggestedName = await nextBranchName(branchStore, projectId, parsed.data.name);
    return reply.code(422).send(
      problem(
        422,
        "Branch name is already in use",
        { suggested_name: suggestedName },
        [
          {
            command: `vspec branch create ${suggestedName}`,
            reason: "Create the branch with an available name."
          }
        ]
      )
    );
  }

  const project = await projectStore.findProjectById(projectId);
  const baseBranch =
    project === undefined ? undefined : await branchStore.findBranchById(project.default_branch_id);
  if (project === undefined || baseBranch === undefined) {
    return reply.code(404).send(problem(404, "Project branch not found"));
  }
  if (parsed.data.simulate_snapshot_failure) {
    return reply.code(500).send(
      problem(500, "Branch snapshot failed", { exit_code: 5 }, [
        {
          command: `vspec branch create ${parsed.data.name} --retry`,
          reason: "Retry after the failed branch snapshot."
        }
      ])
    );
  }
  const snapshot = await mainHeadSnapshot(state, project, useCaseStore);
  const branch: StoredSpecBranch = {
    id: randomUUID(),
    project_id: projectId,
    name: parsed.data.name,
    owner_type: "HUMAN",
    owner_id: membership.user_id,
    base_branch_id: baseBranch.id,
    base_revision_ids: snapshot,
    head_revision_ids: snapshot,
    status: "ACTIVE"
  };
  await branchStore.saveBranch(branch);
  const warnings = await inFlightMergeRequestWarnings(mergeRequestStore, baseBranch.id);

  return reply.code(201).send({
    branch,
    ...(warnings.length === 0 ? {} : { warnings }),
    suggested_next_actions: [
      { command: `vspec branch checkout ${branch.name}`, reason: "Switch to the isolated branch." },
      {
        command: `vspec usecase edit ${await firstUseCaseKey(projectId, useCaseStore)}`,
        reason: "Start editing a use case on the branch."
      }
    ]
  });
}

async function inFlightMergeRequestWarnings(
  mergeRequestStore: MergeRequestStore,
  targetBranchId: string
) {
  return (await mergeRequestStore.listOpenMergeRequestsByTargetBranchId(targetBranchId))
    .map((mergeRequest) => ({
      merge_request_id: mergeRequest.id,
      type: "IN_FLIGHT_MERGE_REQUEST"
    }));
}

function readOnly(reply: FastifyReply) {
  return reply.code(403).send(
    problem(403, "Editor role required to create branches", {}, [
      {
        command: "vspec member list",
        reason: "Find a workspace editor or owner who can create branches."
      }
    ])
  );
}

async function mainHeadSnapshot(
  state: SignupState,
  project: StoredProject,
  useCaseStore: UseCaseStore
): Promise<Record<string, string>> {
  return Object.fromEntries(
    (await useCaseStore.listUseCases(project.id)).map((usecase) => [
      usecase.id,
      latestRevisionId(state, usecase.id) ?? usecase.current_revision_id
    ])
  );
}

function latestRevisionId(state: SignupState, entityId: string): string | undefined {
  const revisions = state.revisionsByEntityId.get(entityId) ?? [];
  return revisions[revisions.length - 1]?.id;
}

async function firstUseCaseKey(
  projectId: string,
  useCaseStore: UseCaseStore
): Promise<string> {
  return (await useCaseStore.listUseCases(projectId))[0]?.key ?? "<KEY>";
}

async function branchNameExists(
  branchStore: BranchStore,
  projectId: string,
  name: string
): Promise<boolean> {
  return (await branchStore.findBranchByProjectAndName(projectId, name)) !== undefined;
}

async function nextBranchName(
  branchStore: BranchStore,
  projectId: string,
  name: string
): Promise<string> {
  let suffix = 2;
  let candidate = `${name}-${String(suffix)}`;
  while (await branchNameExists(branchStore, projectId, candidate)) {
    suffix += 1;
    candidate = `${name}-${String(suffix)}`;
  }
  return candidate;
}

function projectIdFrom(params: unknown): string {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}
