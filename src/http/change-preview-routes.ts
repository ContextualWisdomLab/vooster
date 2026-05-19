import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { isReadOnlyMembership, membershipForProject } from "./membership-support.js";
import { hardLockProblem, previews, type ChangePreview } from "./change-preview-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredUseCase } from "./signup-types.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

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
export async function previewSpecChange(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  useCaseStore: UseCaseStore
): Promise<boolean> {
  if (!proposalMarkerSchema.safeParse(request.body).success) {
    return false;
  }
  const parsed = proposalSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send(problem(400, "Invalid change proposal"));
    return true;
  }
  const access = await accessibleUseCaseByKey(
    request,
    state,
    membershipStore,
    useCaseStore,
    parsed.data.usecase_key
  );
  if (access === undefined) {
    reply.code(404).send(problem(404, "Use case not found"));
    return true;
  }
  const { membership, usecase } = access;
  if (isReadOnlyMembership(state, membership)) {
    reply.code(403).send(problem(403, "Write access required"));
    return true;
  }
  const patch = parsed.data.patch;
  if (patch.entity_id !== usecase.id) {
    reply.code(400).send(problem(400, "Patch targets a different use case"));
    return true;
  }
  const hardLock = await blockingHardLock(lockStore, usecase);
  if (hardLock !== undefined) {
    reply.code(409).send(hardLockProblem(usecase, hardLock));
    return true;
  }
  if (parsed.data.base_revision !== usecase.current_revision_id) {
    reply.code(409).send(await staleBaseProblem(revisionStore, usecase));
    return true;
  }

  const preview = changePreview(usecase, parsed.data.base_revision, patch.fields.title);
  const affectedSessions = affectedActiveSessions(state, usecase);
  previews(state).set(preview.id, preview);
  reply.code(201).send({
    diff: preview.diff,
    expires_at: preview.expires_at,
    impact: { affected_sessions: affectedSessions, severity: preview.severity },
    preview_id: preview.id,
    severity: preview.severity,
    suggested_next_actions: [
      {
        command: `vspec change commit --preview-id ${preview.id}`,
        reason: "Commit the preview after human review."
      },
      ...(affectedSessions.length === 0 ? [] : [{
        command: `vspec who ${usecase.key}`,
        reason: "Coordinate with active sessions before committing."
      }])
    ],
    warnings: parsed.data.auto_commit === true ? [
      {
        message: "NON_BREAKING changes require explicit human commit.",
        type: "AUTO_COMMIT_REFUSED"
      }
    ] : []
  });
  return true;
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

async function accessibleUseCaseByKey(
  request: FastifyRequest,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore,
  key: string
) {
  const candidates = await useCaseStore.findUseCasesByKey(key);
  let usecase: StoredUseCase | undefined;
  for (const candidate of candidates) {
    if (
      await membershipForProject(request, state, membershipStore, candidate.project_id) !==
      undefined
    ) {
      usecase = candidate;
      break;
    }
  }
  if (usecase === undefined || usecase.archived_at !== null) {
    return undefined;
  }
  const membership = await membershipForProject(
    request,
    state,
    membershipStore,
    usecase.project_id
  );
  return membership === undefined ? undefined : { membership, usecase };
}

async function staleBaseProblem(revisionStore: RevisionStore, usecase: StoredUseCase) {
  const current = await revisionStore.findRevisionById(usecase.current_revision_id);
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

function affectedActiveSessions(state: SignupState, usecase: StoredUseCase) {
  return (state.workSessionsByUseCaseId.get(usecase.id) ?? [])
    .filter((session) => session.status === "ACTIVE")
    .map((session) => ({
      agent_type: session.agent_type,
      id: session.id,
      owner: session.user_id,
      pinned_usecase_keys: [usecase.key]
    }));
}

async function blockingHardLock(lockStore: LockStore, usecase: StoredUseCase) {
  const lock = await lockStore.findLockForUseCase(usecase.id);
  return lock?.mode === "HARD" && Date.parse(lock.expires_at) > Date.now() ? lock : undefined;
}
