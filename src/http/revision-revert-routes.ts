import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredLock, StoredRevision, StoredUseCase } from "./signup-types.js";
import { useCaseWithProjectId } from "./usecase-support.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";

const revertBodySchema = z.object({
  force: z.boolean().default(false),
  revision_id: z.string().min(1),
  simulate_gherkin_drift: z.boolean().default(false),
  simulate_write_failure: z.boolean().default(false),
  summary: z.string().optional()
});

export function registerRevisionRevertRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  app.post("/v1/usecases/:usecaseId/revert", (request, reply) =>
    revertUseCase(request, reply, state, branchStore, membershipStore, projectStore)
  );
}

async function revertUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = revertBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid revert request"));
  }
  const found = useCaseWithProjectId(state, params.usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to revert use case"));
  }
  const lock = state.stepLocksByUseCaseId.get(found.usecase.id);
  if (lock?.mode === "HARD") {
    return reply.code(409).send(hardLockProblem(found.usecase, lock));
  }

  const revisions = state.revisionsByEntityId.get(found.usecase.id) ?? [];
  const target = revisions.find((revision) => revision.id === parsed.data.revision_id);
  if (target === undefined) {
    return reply
      .code(404)
      .send(missingRevisionProblem(found.usecase, parsed.data.revision_id));
  }
  const current = revisions.at(-1);
  if (current === undefined) {
    return reply.code(404).send(problem(404, "Revision not found"));
  }
  if (!parsed.data.force && current.severity === "BREAKING") {
    return reply
      .code(409)
      .send(breakingRevertProblem(found.usecase, target.id, current, state));
  }
  if (parsed.data.simulate_write_failure) {
    return reply.code(500).send(writeFailureProblem(found.usecase, target.id));
  }

  const revision = revertRevision(found.usecase, target, current, revisions.length + 1);
  Object.assign(found.usecase, target.snapshot, { current_revision_id: revision.id });
  state.revisionsByEntityId.set(found.usecase.id, [...revisions, revision]);
  await advanceMainHead(projectStore, branchStore, found.projectId, found.usecase.id, revision.id);

  return reply.code(201).send({
    impact: {
      affected_branches: [],
      affected_sessions: [],
      severity: revision.severity
    },
    revision,
    suggested_next_actions: nextActions(found.usecase.key),
    usecase: found.usecase,
    ...(parsed.data.simulate_gherkin_drift ? { warnings: [gherkinDriftWarning()] } : {})
  });
}

function revertRevision(
  usecase: StoredUseCase,
  target: StoredRevision,
  current: StoredRevision,
  versionNumber: number
): StoredRevision {
  return {
    id: randomUUID(),
    entity_type: "USECASE",
    entity_id: usecase.id,
    version_number: versionNumber,
    snapshot: target.snapshot,
    change_summary: `Revert to ${target.id}`,
    parent_revision_id: current.id,
    severity: current.severity ?? "NON_BREAKING"
  };
}

async function advanceMainHead(
  projectStore: ProjectStore,
  branchStore: BranchStore,
  projectId: string,
  usecaseId: string,
  revisionId: string
) {
  const project = await projectStore.findProjectById(projectId);
  const branch = project === undefined
    ? undefined
    : await branchStore.findBranchById(project.default_branch_id);
  if (branch !== undefined) {
    branch.head_revision_ids = { ...(branch.head_revision_ids ?? {}), [usecaseId]: revisionId };
    await branchStore.updateBranch(branch);
  }
}

function missingRevisionProblem(usecase: StoredUseCase, revisionId: string) {
  return problem(
    404,
    "Revision not found",
    { expected_entity_id: usecase.id, missing_revision: revisionId },
    [
      { command: `vspec history ${usecase.key}`, reason: "Find valid revision IDs for this use case." }
    ]
  );
}

function hardLockProblem(usecase: StoredUseCase, lock: StoredLock) {
  return problem(
    409,
    "Use case is HARD locked",
    { expires_at: lock.expires_at, held_by_user_id: lock.held_by_user_id,
      holding_session: lock.held_by_session_id, reason: lock.reason },
    [
      { command: `vspec who ${usecase.key}`, reason: "Find the lock holder before retrying the revert." }
    ]
  );
}

function breakingRevertProblem(
  usecase: StoredUseCase,
  targetRevision: string,
  current: StoredRevision,
  state: SignupState
) {
  return problem(
    409,
    "Revert would reintroduce breaking changes",
    {
      affected_sessions: activeSessionIds(state, usecase.id),
      breaking_changes: [
        { path: "usecase.title", revision: current.id, severity: "BREAKING" }
      ]
    },
    [
      {
        command: `vspec revert ${usecase.key} --to ${targetRevision} --force --summary "<reason>"`,
        reason: "Rerun with force only if the breaking impact is acceptable."
      }
    ]
  );
}

function activeSessionIds(state: SignupState, usecaseId: string) {
  return (state.workSessionsByUseCaseId.get(usecaseId) ?? [])
    .filter((session) => session.status === "ACTIVE")
    .map((session) => session.id);
}

function gherkinDriftWarning() {
  return { message: "Pinned CI feature files will drift on next sync.", type: "GHERKIN_DRIFT" };
}

function writeFailureProblem(usecase: StoredUseCase, targetRevision: string) {
  return problem(
    500,
    "Revert write failed",
    { exit_code: 5 },
    [
      { command: `vspec revert ${usecase.key} --to ${targetRevision} --retry`,
        reason: "Retry after the revert write failure." }
    ]
  );
}

function nextActions(key: string) {
  return [
    { command: `vspec history ${key}`, reason: "Review the append-only revision history." },
    { command: "vspec session list --status=active", reason: "Check sessions affected by the revert." }
  ];
}
