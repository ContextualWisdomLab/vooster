import { randomUUID } from "node:crypto";
import type { StoredInvitation } from "../http/invitation-store.js";
import type { StoredMembership } from "../http/signup-types.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UserStore } from "../ports/user-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

export type InvitationStore = {
  pendingInvitationForEmail: (
    workspaceId: string,
    email: string
  ) => StoredInvitation | undefined;
  saveInvitation: (invitation: StoredInvitation) => void;
};

export type InvitationDeps = {
  idFactory?: () => string;
  invitationStore: InvitationStore;
  membershipStore: MembershipStore;
  now?: () => Date;
  userStore: UserStore;
  workspaceStore: WorkspaceStore;
};

export type CreateInvitationInput = {
  email: string;
  role: "EDITOR" | "OWNER";
  simulateDeliveryFailure: boolean;
  simulateExpired: boolean;
  userId: string | undefined;
  workspaceId: string;
};

export type CreateInvitationResult =
  | { invitation: StoredInvitation; status: "CREATED" }
  | { invitation: StoredInvitation; status: "EXISTING" }
  | { status: "OWNER_REQUIRED" }
  | { status: "EDITOR_CANNOT_INVITE_OWNER" }
  | { status: "ALREADY_MEMBER" };

export async function createInvitation(
  deps: InvitationDeps,
  input: CreateInvitationInput
): Promise<CreateInvitationResult> {
  const membership = await authorizedMembership(deps, input.workspaceId, input.userId);
  if (membership === undefined) {
    return { status: "OWNER_REQUIRED" };
  }
  if (membership.role !== "OWNER" && input.role === "OWNER") {
    return { status: "EDITOR_CANNOT_INVITE_OWNER" };
  }
  if (
    (await activeMembershipForEmail(deps, input.workspaceId, input.email)) !== undefined
  ) {
    return { status: "ALREADY_MEMBER" };
  }

  const existing = deps.invitationStore.pendingInvitationForEmail(
    input.workspaceId,
    input.email
  );
  if (existing !== undefined) {
    return { invitation: existing, status: "EXISTING" };
  }

  const invitation = newInvitation(deps, input);
  deps.invitationStore.saveInvitation(invitation);
  return { invitation, status: "CREATED" };
}

async function authorizedMembership(
  deps: InvitationDeps,
  workspaceId: string,
  userId: string | undefined
): Promise<StoredMembership | undefined> {
  if (
    userId === undefined ||
    (await deps.workspaceStore.findWorkspaceById(workspaceId)) === undefined
  ) {
    return undefined;
  }
  return deps.membershipStore.membershipForWorkspace(workspaceId, userId);
}

async function activeMembershipForEmail(
  deps: InvitationDeps,
  workspaceId: string,
  email: string
): Promise<StoredMembership | undefined> {
  const user = await deps.userStore.findUserByEmail(email);
  return user === undefined
    ? undefined
    : deps.membershipStore.membershipForWorkspace(workspaceId, user.id);
}

function newInvitation(
  deps: InvitationDeps,
  input: CreateInvitationInput
): StoredInvitation {
  return {
    accepted_at: null,
    delivery_status: input.simulateDeliveryFailure ? "FAILED" : "SENT",
    email: input.email,
    expires_at: expiresAt(deps, input.simulateExpired),
    id: id(deps),
    role: input.role,
    token: id(deps),
    workspace_id: input.workspaceId
  };
}

function expiresAt(deps: InvitationDeps, expired: boolean): string {
  const offset = expired ? -60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return new Date(now(deps).getTime() + offset).toISOString();
}

function id(deps: InvitationDeps): string {
  return (deps.idFactory ?? randomUUID)();
}

function now(deps: InvitationDeps): Date {
  return (deps.now ?? (() => new Date()))();
}
