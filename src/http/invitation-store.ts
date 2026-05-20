import type { SignupState } from "./signup-types.js";
import type { StoredInvitation } from "../domain/entities/index.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UserStore } from "../ports/user-store.js";

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

export async function activeMembershipForEmail(
  userStore: UserStore,
  membershipStore: MembershipStore,
  workspaceId: string,
  email: string
) {
  const user = await userStore.findUserByEmail(email);
  return user === undefined
    ? undefined
    : membershipStore.membershipForWorkspace(workspaceId, user.id);
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
