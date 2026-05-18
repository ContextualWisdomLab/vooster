import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";
import { useCaseWithProjectId } from "./usecase-support.js";

const previewSchema = z.object({
  base_revision: z.string().min(1),
  entity_id: z.string().min(1),
  entity_type: z.literal("USECASE"),
  proposed_change_content: z.string().optional(),
  proposed_change_path: z.string().optional()
});

export function registerImpactRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/changes/preview", (request, reply) => previewImpact(request, reply, state));
}

function previewImpact(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const parsed = previewSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid impact preview request"));
  }
  const found = useCaseWithProjectId(state, parsed.data.entity_id);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to preview impact"));
  }
  if (parsed.data.proposed_change_content !== undefined) {
    return reply
      .code(400)
      .send(parseProposedChangeProblem(parsed.data.proposed_change_path ?? "<inline>"));
  }
  if (parsed.data.proposed_change_path !== undefined) {
    return reply
      .code(400)
      .send(missingProposedChangeProblem(found.usecase, parsed.data.proposed_change_path));
  }
  const revision = revisionById(state, found.usecase.id, parsed.data.base_revision);
  if (revision === undefined) {
    return reply.code(404).send(problem(404, "Revision not found"));
  }

  const inputHash = impactHash(revision.id, revision.snapshot);
  const previewId = randomUUID();
  return reply.send({
    cached: false,
    impact: {
      affected_branches: [],
      affected_sessions: [],
      affected_tests: [],
      confidence: 1,
      input_hash: inputHash,
      severity: revision.severity ?? "NON_BREAKING"
    },
    preview_id: previewId,
    suggested_next_actions: nextActions(found.usecase, previewId)
  });
}

function revisionById(
  state: SignupState,
  usecaseId: string,
  revisionId: string
): StoredRevision | undefined {
  return (state.revisionsByEntityId.get(usecaseId) ?? [])
    .find((revision) => revision.id === revisionId);
}

function impactHash(revisionId: string, snapshot: StoredRevision["snapshot"]) {
  return createHash("sha256")
    .update(JSON.stringify({ revisionId, snapshot }))
    .digest("hex");
}

function missingProposedChangeProblem(usecase: StoredUseCase, path: string) {
  return problem(
    400,
    "Proposed change file is not readable",
    { path },
    [
      {
        command: "vspec impact --proposed-change <path>",
        reason: "Verify the proposed-change path and retry."
      },
      {
        command: `vspec impact ${usecase.key}`,
        reason: "Rerun without a proposed-change file to analyze the current head."
      }
    ]
  );
}

function parseProposedChangeProblem(path: string) {
  return problem(
    400,
    "Proposed change parse failed",
    { parser_error: "Missing frontmatter" },
    [
      {
        command: `vspec doctor ${path}`,
        reason: "Validate the proposed-change file format."
      }
    ]
  );
}

function nextActions(usecase: StoredUseCase, previewId: string) {
  return [
    {
      command: `vspec lock ${usecase.key}`,
      reason: "Lock the use case before applying a risky change."
    },
    {
      command: "vspec session list --status=active",
      reason: "Coordinate with affected active sessions."
    },
    {
      command: `vspec changes commit ${previewId}`,
      reason: "Commit the previewed change after review."
    }
  ];
}
