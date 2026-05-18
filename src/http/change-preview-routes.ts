import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { isReadOnlyMembership, membershipForProject } from "./membership-support.js";
import { previewProblem, previews, type ChangePreview } from "./change-preview-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredUseCase } from "./signup-types.js";

const proposalMarkerSchema = z.object({ patch: z.unknown(), usecase_key: z.string().min(1) });
const proposalSchema = z.object({
  auto_commit: z.boolean().optional(),
  base_revision: z.string().min(1),
  patch: z.object({
    entity_id: z.string().min(1),
    entity_type: z.literal("USECASE"),
    fields: z.object({ title: z.string().min(1) })
  }),
  usecase_key: z.string().min(1)
});
const commitSchema = z.object({
  confirmed: z.boolean().optional(),
  preview_id: z.string().min(1)
});

export function registerChangeCommitRoutes(app: FastifyInstance, state: SignupState) {
  app.post("/v1/changes/commit", (request, reply) => commitSpecChange(request, reply, state));
  app.post("/__test/changes/previews/:previewId/expire", (request, reply) => {
    const params = z.object({ previewId: z.string().min(1) }).parse(request.params);
    const preview = previews(state).get(params.previewId);
    if (preview === undefined) {
      return reply.code(404).send(problem(404, "Change preview not found"));
    }
    preview.expires_at = new Date(Date.now() - 1_000).toISOString();
    return reply.send({ expired: true });
  });
}

export function previewSpecChange(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  if (!proposalMarkerSchema.safeParse(request.body).success) {
    return undefined;
  }
  const parsed = proposalSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid change proposal"));
  }
  const access = accessibleUseCaseByKey(request, state, parsed.data.usecase_key);
  if (access === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  const { membership, usecase } = access;
  if (isReadOnlyMembership(state, membership)) {
    return reply.code(403).send(problem(403, "Write access required"));
  }
  const patch = parsed.data.patch;
  if (patch.entity_id !== usecase.id) {
    return reply.code(400).send(problem(400, "Patch targets a different use case"));
  }
  if (parsed.data.base_revision !== usecase.current_revision_id) {
    return reply.code(409).send(staleBaseProblem(state, usecase));
  }

  const preview = changePreview(usecase, parsed.data.base_revision, patch.fields.title);
  previews(state).set(preview.id, preview);
  return reply.code(201).send({
    diff: preview.diff,
    expires_at: preview.expires_at,
    impact: { affected_sessions: [], severity: preview.severity },
    preview_id: preview.id,
    severity: preview.severity,
    suggested_next_actions: [
      {
        command: `vspec change commit --preview-id ${preview.id}`,
        reason: "Commit the preview after human review."
      }
    ],
    warnings: parsed.data.auto_commit === true ? [
      {
        message: "NON_BREAKING changes require explicit human commit.",
        type: "AUTO_COMMIT_REFUSED"
      }
    ] : []
  });
}

function commitSpecChange(request: FastifyRequest, reply: FastifyReply, state: SignupState) {
  const parsed = commitSchema.safeParse(request.body);
  const preview = parsed.success ? previews(state).get(parsed.data.preview_id) : undefined;
  if (preview === undefined) {
    return reply.code(400).send(previewProblem(
      400,
      "Every commit must reference a still-valid preview",
      "Generate a preview before committing a spec change."
    ));
  }
  if (Date.parse(preview.expires_at) <= Date.now()) {
    return reply.code(410).send(previewProblem(
      410,
      "Change preview expired",
      "Regenerate the preview before committing."
    ));
  }
  return reply.code(501).send(problem(501, "Change commit is not implemented"));
}

function changePreview(usecase: StoredUseCase, baseRevision: string, title: string): ChangePreview {
  const preview = {
    base_revision: baseRevision,
    diff: [
      {
        after: title,
        before: usecase.title,
        entity_id: usecase.id,
        entity_type: "USECASE" as const,
        path: "title" as const,
        severity: "NON_BREAKING" as const
      }
    ],
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    id: randomUUID(),
    severity: "NON_BREAKING" as const,
    usecase_id: usecase.id
  };
  return preview;
}

function accessibleUseCaseByKey(
  request: FastifyRequest,
  state: SignupState,
  key: string
) {
  const usecase = useCasesByKey(state, key).find((candidate) =>
    membershipForProject(request, state, candidate.project_id) !== undefined);
  if (usecase === undefined || usecase.archived_at !== null) {
    return undefined;
  }
  const membership = membershipForProject(request, state, usecase.project_id);
  return membership === undefined ? undefined : { membership, usecase };
}

function useCasesByKey(state: SignupState, key: string): StoredUseCase[] {
  const matches = [];
  for (const usecases of state.usecasesByProjectId.values()) {
    matches.push(...usecases.filter((candidate) => candidate.key === key));
  }
  return matches;
}

function staleBaseProblem(state: SignupState, usecase: StoredUseCase) {
  const current = (state.revisionsByEntityId.get(usecase.id) ?? [])
    .find((revision) => revision.id === usecase.current_revision_id);
  return problem(
    409,
    "Stale base revision",
    {
      current_revision: usecase.current_revision_id,
      impact: { affected_sessions: [], severity: current?.severity ?? "NON_BREAKING" }
    },
    [
      {
        command: `vspec usecase show ${usecase.key} --format=agent`,
        reason: "Re-read the current use case before proposing again."
      },
      {
        command: `vspec change propose ${usecase.key}`,
        reason: "Propose the change again against the fresh base revision."
      }
    ]
  );
}
