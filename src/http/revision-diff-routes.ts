import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";
import { useCaseWithProjectId } from "./usecase-support.js";

type DiffChange = {
  change_type: "ADD" | "CHANGE";
  entity_type: "STEP" | "USECASE";
  path: string;
  revision: string;
  severity: "BREAKING" | "COSMETIC" | "NON_BREAKING";
};

const diffQuerySchema = z.object({
  format: z.enum(["agent", "human", "json"]).default("human"),
  from: z.string().min(1),
  to: z.string().min(1)
});

export function registerRevisionDiffRoutes(app: FastifyInstance, state: SignupState) {
  app.get("/v1/usecases/:usecaseId/diff", (request, reply) =>
    compareRevisions(request, reply, state)
  );
}

function compareRevisions(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const params = z.object({ usecaseId: z.string().min(1) }).parse(request.params);
  const parsed = diffQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid diff request"));
  }
  const found = useCaseWithProjectId(state, params.usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to compare revisions"));
  }

  const revisions = state.revisionsByEntityId.get(found.usecase.id) ?? [];
  const from = revisionById(revisions, parsed.data.from);
  const to = revisionById(revisions, parsed.data.to);
  if (from === undefined || to === undefined) {
    return reply.code(404).send(problem(404, "Revision not found"));
  }

  const changes = revisionsBetween(revisions, from, to).map(diffChange);
  return reply.send({
    changes,
    format: parsed.data.format,
    from_revision: from.id,
    suggested_next_actions: nextActions(found.usecase, from.id),
    summary: summarize(changes),
    to_revision: to.id,
    usecase: { id: found.usecase.id, key: found.usecase.key }
  });
}

function revisionById(revisions: StoredRevision[], id: string): StoredRevision | undefined {
  return revisions.find((revision) => revision.id === id);
}

function revisionsBetween(
  revisions: StoredRevision[],
  from: StoredRevision,
  to: StoredRevision
) {
  return revisions.filter(
    (revision) =>
      revision.version_number > from.version_number &&
      revision.version_number <= to.version_number
  );
}

function diffChange(revision: StoredRevision): DiffChange {
  const addedStep = /^Added step (?<stepNumber>\d+) to main success scenario$/.exec(
    revision.change_summary ?? ""
  );
  if (addedStep?.groups?.stepNumber !== undefined) {
    return {
      change_type: "ADD",
      entity_type: "STEP",
      path: `main_success.steps[${addedStep.groups.stepNumber}]`,
      revision: revision.id,
      severity: revision.severity ?? "NON_BREAKING"
    };
  }

  return {
    change_type: "CHANGE",
    entity_type: "USECASE",
    path: "usecase",
    revision: revision.id,
    severity: revision.severity ?? "NON_BREAKING"
  };
}

function summarize(changes: DiffChange[]) {
  return {
    breaking: changes.filter((change) => change.severity === "BREAKING").length,
    cosmetic: changes.filter((change) => change.severity === "COSMETIC").length,
    non_breaking: changes.filter((change) => change.severity === "NON_BREAKING").length
  };
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
