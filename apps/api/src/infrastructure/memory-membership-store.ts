import type { StoredMembership } from "../domain/entities/index.js";
import type { MembershipStore } from "../ports/membership-store.js";

export function createMemoryMembershipStore(
  workspaceIdForProject: (projectId: string) => Promise<string | undefined>
): MembershipStore {
  const membershipsByUserId = new Map<string, StoredMembership[]>();

  return {
    async membershipForProject(projectId, userId) {
      const workspaceId = await workspaceIdForProject(projectId);
      return workspaceId === undefined
        ? undefined
        : (membershipsByUserId.get(userId) ?? []).find(
            (membership) => membership.workspace_id === workspaceId
          );
    },

    membershipForWorkspace(workspaceId, userId) {
      return Promise.resolve(
        (membershipsByUserId.get(userId) ?? []).find(
          (membership) => membership.workspace_id === workspaceId
        )
      );
    },

    membershipsForUser(userId) {
      return Promise.resolve(membershipsByUserId.get(userId) ?? []);
    },

    saveMembership(membership) {
      const existing = membershipsByUserId.get(membership.user_id) ?? [];
      membershipsByUserId.set(membership.user_id, [...existing, membership]);
      return Promise.resolve();
    }
  };
}
