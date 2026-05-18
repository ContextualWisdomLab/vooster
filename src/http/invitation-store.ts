import type { SignupState } from "./signup-types.js";

export type StoredInvitation = {
  accepted_at: null | string;
  delivery_status: "FAILED" | "SENT";
  email: string;
  expires_at: string;
  id: string;
  role: "EDITOR" | "OWNER";
  token: string;
  workspace_id: string;
};

const invitationsByState = new WeakMap<SignupState, Map<string, StoredInvitation>>();

export function invitations(state: SignupState) {
  const existing = invitationsByState.get(state);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, StoredInvitation>();
  invitationsByState.set(state, created);
  return created;
}

export function activeMembershipForEmail(state: SignupState, workspaceId: string, email: string) {
  const user = [...state.usersByGithubId.values()].find((candidate) => candidate.email === email);
  return (state.membershipsByUserId.get(user?.id ?? "") ?? []).find(
    (membership) => membership.workspace_id === workspaceId
  );
}

export function pendingInvitationForEmail(state: SignupState, workspaceId: string, email: string) {
  const now = Date.now();
  return [...invitations(state).values()].find(
    (invitation) =>
      invitation.workspace_id === workspaceId &&
      invitation.email === email &&
      invitation.accepted_at === null &&
      Date.parse(invitation.expires_at) > now
  );
}

export function expiryFor(expired: boolean) {
  const offset = expired ? -60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + offset).toISOString();
}
