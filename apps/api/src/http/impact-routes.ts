import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  previewImpact as previewImpactWorkflow,
  type ImpactPayload
} from "../application/impact-analysis.js";
import { previewSpecChange } from "./change-preview-routes.js";
import { sendImpactResult } from "./impact-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

const impactCaches = new WeakMap<SignupState, Map<string, ImpactPayload>>();
const previewSchema = z.object({
  base_revision: z.string().min(1),
  entity_id: z.string().min(1),
  entity_type: z.literal("USECASE"),
  proposed_change_content: z.string().optional(),
  proposed_change_path: z.string().optional()
});

export function registerImpactRoutes(
  app: FastifyInstance,
  state: SignupState,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/changes/preview", async (request, reply) => {
    if (
      await previewSpecChange(
        request,
        reply,
        state,
        lockStore,
        membershipStore,
        revisionStore,
        workSessionStore,
        useCaseStore
      )
    ) {
      return undefined;
    }
    return previewImpact(
      request,
      reply,
      state,
      membershipStore,
      revisionStore,
      workSessionStore,
      useCaseStore
    );
  });
}

async function previewImpact(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  const parsed = previewSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid impact preview request"));
  }
  return sendImpactResult(
    reply,
    await previewImpactWorkflow(
      {
        cache: cacheFor(state),
        membershipStore,
        revisionStore,
        useCaseStore,
        workSessionStore
      },
      {
        baseRevision: parsed.data.base_revision,
        entityId: parsed.data.entity_id,
        proposedChangeContent: parsed.data.proposed_change_content,
        proposedChangePath: parsed.data.proposed_change_path,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

function cacheFor(state: SignupState) {
  const existing = impactCaches.get(state);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, ImpactPayload>();
  impactCaches.set(state, created);
  return created;
}
