import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { isReadOnlyMembership, membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredUseCase } from "./signup-types.js";

type ChangePreview = {
  base_revision: string;
  diff: ChangeDiff[];
  expires_at: string;
  id: string;
  severity: "NON_BREAKING";
  usecase_id: string;
};
type ChangeDiff = {
  after: string;
  before: string;
  entity_id: string;
  entity_type: "USECASE";
  path: "title";
  severity: "NON_BREAKING";
};

const previewsByState = new WeakMap<SignupState, Map<string, ChangePreview>>();
const proposalMarkerSchema = z.object({ patch: z.unknown(), usecase_key: z.string().min(1) });
const proposalSchema = z.object({
  base_revision: z.string().min(1),
  patch: z.object({
    entity_id: z.string().min(1),
    entity_type: z.literal("USECASE"),
    fields: z.object({ title: z.string().min(1) })
  }),
  usecase_key: z.string().min(1)
});

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
  const usecase = useCaseByKey(state, parsed.data.usecase_key);
  if (usecase === undefined || usecase.archived_at !== null) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  const membership = membershipForProject(request, state, usecase.project_id);
  if (membership === undefined || isReadOnlyMembership(state, membership)) {
    return reply.code(403).send(problem(403, "Write access required"));
  }
  const patch = parsed.data.patch;
  if (patch.entity_id !== usecase.id) {
    return reply.code(400).send(problem(400, "Patch targets a different use case"));
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
    warnings: []
  });
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

function previews(state: SignupState) {
  const existing = previewsByState.get(state);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, ChangePreview>();
  previewsByState.set(state, created);
  return created;
}

function useCaseByKey(state: SignupState, key: string): StoredUseCase | undefined {
  for (const usecases of state.usecasesByProjectId.values()) {
    const usecase = usecases.find((candidate) => candidate.key === key);
    if (usecase !== undefined) {
      return usecase;
    }
  }
  return undefined;
}
