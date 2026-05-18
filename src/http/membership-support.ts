import type { FastifyRequest } from "fastify";
import { authenticatedUserId } from "./session-support.js";
import type { SignupState, StoredMembership } from "./signup-types.js";

export function membershipForProject(
  request: FastifyRequest,
  state: SignupState,
  projectId: string
): StoredMembership | undefined {
  const project = state.projectsById.get(projectId);
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (project === undefined || userId === undefined) {
    return undefined;
  }
  return (state.membershipsByUserId.get(userId) ?? []).find(
    (membership) => membership.workspace_id === project.workspace_id
  );
}

export function isReadOnlyMembership(
  state: SignupState,
  membership: StoredMembership
): boolean {
  return state.readOnlyMemberships.has(`${membership.user_id}:${membership.workspace_id}`);
}
