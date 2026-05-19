import type { StoredMembership } from "../http/signup-types.js";

export type MembershipStore = {
  membershipForProject: (
    projectId: string,
    userId: string
  ) => Promise<StoredMembership | undefined>;
  membershipForWorkspace: (
    workspaceId: string,
    userId: string
  ) => Promise<StoredMembership | undefined>;
  membershipsForUser: (userId: string) => Promise<StoredMembership[]>;
  saveMembership: (membership: StoredMembership) => Promise<void>;
};
