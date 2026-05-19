import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredRevision, StoredSpecBranch, StoredUseCase } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

type DiffChange = {
  change_type: "ADD" | "CHANGE";
  entity_type: "STEP" | "USECASE";
  path: string;
  revision: string;
  severity: "BREAKING" | "COSMETIC" | "NON_BREAKING";
  source_branch?: string;
};

const diffQuerySchema = z.object({
  format: z.enum(["agent", "human", "json"]).default("human"),
  from: z.string().min(1),
  to: z.string().min(1)
});

export function registerRevisionDiffRoutes(
  app: FastifyInstance,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  app.get("/v1/usecases/:usecaseId/diff", (request, reply) =>
    compareRevisions(
      request,
      reply,
      state,
      branchStore,
      membershipStore,
      revisionStore,
      useCaseStore
    )
  );
}

async function compareRevisions(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = diffQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid diff request"));
  }
  const found = await useCaseStore.findUseCaseWithProject(params.usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(diffAccessProblem());
  }

  const revisions = await revisionStore.listRevisions(found.usecase.id);
  const from = revisionById(revisions, parsed.data.from);
  const to = revisionById(revisions, parsed.data.to);
  if (from === undefined || to === undefined) {
    const missingRevision = from === undefined ? parsed.data.from : parsed.data.to;
    return reply.code(404).send(missingRevisionProblem(found.usecase, missingRevision));
  }

  const fromBranch = await branchForRevision(branchStore, found.projectId, from.id);
  const toBranch = await branchForRevision(branchStore, found.projectId, to.id);
  const crossBranch = fromBranch !== undefined &&
    toBranch !== undefined &&
    fromBranch.id !== toBranch.id;
  const changes = await Promise.all(
    revisionsBetween(revisions, from, to).map(async (revision) =>
      diffChange(
        revision,
        (await branchForRevision(branchStore, found.projectId, revision.id))?.name
      )
    )
  );
  return reply.send({
    changes,
    ...(crossBranch ? crossBranchWarning(fromBranch, toBranch) : {}),
    format: parsed.data.format,
    from_revision: from.id,
    ...(from.id === to.id ? { note: "Revisions match byte-for-byte." } : {}),
    suggested_next_actions: nextActions(found.usecase, from.id),
    summary: summarize(changes),
    to_revision: to.id,
    usecase: { id: found.usecase.id, key: found.usecase.key }
  });
}

function revisionById(revisions: StoredRevision[], id: string): StoredRevision | undefined {
  return revisions.find((revision) => revision.id === id);
}

function revisionsBetween(revisions: StoredRevision[], from: StoredRevision, to: StoredRevision) {
  return revisions.filter(
    (revision) =>
      revision.version_number > from.version_number &&
      revision.version_number <= to.version_number
  );
}

function diffChange(revision: StoredRevision, sourceBranch?: string): DiffChange {
  const addedStep = /^Added step (?<stepNumber>\d+) to main success scenario$/.exec(
    revision.change_summary ?? ""
  );
  if (addedStep?.groups?.stepNumber !== undefined) {
    return {
      change_type: "ADD",
      entity_type: "STEP",
      path: `main_success.steps[${addedStep.groups.stepNumber}]`,
      revision: revision.id,
      severity: revision.severity ?? "NON_BREAKING",
      ...(sourceBranch === undefined ? {} : { source_branch: sourceBranch })
    };
  }

  return {
    change_type: "CHANGE",
    entity_type: "USECASE",
    path: "usecase.title",
    revision: revision.id,
    severity: revision.severity ?? "NON_BREAKING",
    ...(sourceBranch === undefined ? {} : { source_branch: sourceBranch })
  };
}

async function branchForRevision(
  branchStore: BranchStore,
  projectId: string,
  revisionId: string
) {
  return (await branchStore.listBranches(projectId)).find(
    (branch) =>
      branch.project_id === projectId &&
      Object.values(branch.head_revision_ids ?? {}).includes(revisionId)
  );
}

function crossBranchWarning(fromBranch: StoredSpecBranch, toBranch: StoredSpecBranch) {
  return {
    cross_branch: true,
    warnings: [
      {
        from_branch: fromBranch.name,
        to_branch: toBranch.name,
        type: "CROSS_BRANCH_DIFF"
      }
    ]
  };
}

function summarize(changes: DiffChange[]) {
  return {
    breaking: changes.filter((change) => change.severity === "BREAKING").length,
    cosmetic: changes.filter((change) => change.severity === "COSMETIC").length,
    non_breaking: changes.filter((change) => change.severity === "NON_BREAKING").length
  };
}

function missingRevisionProblem(usecase: StoredUseCase, revisionId: string) {
  return problem(
    404,
    "Revision not found",
    {
      missing_revision: revisionId,
      usecase: { id: usecase.id, key: usecase.key }
    },
    [
      {
        command: `vspec history ${usecase.key}`,
        reason: "Find valid revision IDs for this use case."
      }
    ]
  );
}

function diffAccessProblem() {
  return problem(
    403,
    "Not authorized to compare revisions",
    {},
    [
      {
        command: "vspec login",
        reason: "Authenticate with an account that has project access."
      },
      {
        command: "vspec member set-role",
        reason: "Ask a workspace owner for read access."
      }
    ]
  );
}

function nextActions(usecase: StoredUseCase, fromRevision: string) {
  return [
    {
      command: `vspec revert ${usecase.key} --to ${fromRevision}`,
      reason: "Restore the earlier revision if this change is not wanted."
    },
    {
      command: `vspec impact ${usecase.key}`,
      reason: "Check dependent work before approving the change."
    },
    {
      command: "vspec merge open",
      reason: "Open a merge request when the diff is acceptable."
    }
  ];
}
