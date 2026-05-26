import type { FastifyReply, FastifyRequest } from "fastify";
import {
  changePreviewMarkerSchema,
  changePreviewRequestSchema
} from "@vooster/contracts";
import { previewChange } from "../application/change-preview.js";
import { sendChangePreviewResult } from "./change-preview-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export async function previewSpecChange(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
): Promise<boolean> {
  if (!changePreviewMarkerSchema.safeParse(request.body).success) {
    return false;
  }
  const parsed = changePreviewRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send(problem(400, "Invalid change proposal"));
    return true;
  }
  const patch = parsed.data.patch;
  sendChangePreviewResult(
    reply,
    state,
    await previewChange(
      {
        lockStore,
        membershipStore,
        readOnlyMemberships: state.readOnlyMemberships,
        revisionStore,
        useCaseStore,
        workSessionStore
      },
      {
        autoCommit: parsed.data.auto_commit === true,
        baseRevision: parsed.data.base_revision,
        patch: { entityId: patch.entity_id, title: patch.fields.title },
        usecaseKey: parsed.data.usecase_key,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
  return true;
}
