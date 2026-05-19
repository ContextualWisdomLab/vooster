import type { FastifyRequest } from "fastify";
import { authenticatedUserId } from "./session-support.js";
import type { SignupState, StoredMembership } from "./signup-types.js";
import type { MembershipStore } from "../ports/membership-store.js";

export async function membershipForProject(
  request: FastifyRequest,
  state: SignupState,
  membershipStore: MembershipStore,
  projectId: string
): Promise<StoredMembership | undefined> {
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined) {
    return undefined;
  }

  return membershipStore.membershipForProject(projectId, userId);
}

export async function membershipForWorkspace(
  request: FastifyRequest,
  state: SignupState,
  membershipStore: MembershipStore,
  workspaceId: string
): Promise<StoredMembership | undefined> {
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined) {
    return undefined;
  }

  return membershipStore.membershipForWorkspace(workspaceId, userId);
}

export function isReadOnlyMembership(
  state: SignupState,
  membership: StoredMembership
): boolean {
  return state.readOnlyMemberships.has(`${membership.user_id}:${membership.workspace_id}`);
}
