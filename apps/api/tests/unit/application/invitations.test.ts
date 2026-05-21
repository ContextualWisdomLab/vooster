import { describe, expect, test } from "vitest";
import { createInvitation } from "../../../src/application/invitations.js";
import type { StoredInvitation } from "../../../src/domain/entities/index.js";
import type {
  StoredMembership,
  StoredUser,
  StoredWorkspace
} from "../../../src/domain/entities/index.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { UserStore } from "../../../src/ports/user-store.js";
import type { WorkspaceStore } from "../../../src/ports/workspace-store.js";

describe("invitations application", () => {
  test("creates an expiring invitation for a workspace member", async () => {
    const savedInvitations: StoredInvitation[] = [];

    const result = await createInvitation(depsFor({ savedInvitations }), {
      email: "teammate@example.com",
      role: "EDITOR",
      simulateDeliveryFailure: false,
      simulateExpired: false,
      userId: "user-1",
      workspaceId: "workspace-1"
    });

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected invitation to be created");
    }
    expect(result.invitation).toEqual({
      accepted_at: null,
      delivery_status: "SENT",
      email: "teammate@example.com",
      expires_at: "2026-05-27T00:00:00.000Z",
      id: "id-1",
      role: "EDITOR",
      token: "id-2",
      workspace_id: "workspace-1"
    });
    expect(savedInvitations).toEqual([result.invitation]);
  });

  test("returns existing pending invitations without saving duplicates", async () => {
    const existing = invitation();
    const savedInvitations: StoredInvitation[] = [];

    const result = await createInvitation(
      depsFor({ pendingInvitation: existing, savedInvitations }),
      createInput()
    );

    expect(result).toEqual({
      invitation: existing,
      status: "EXISTING"
    });
    expect(savedInvitations).toEqual([]);
  });

  test("rejects forbidden, owner-escalation, and active-member invitations without saving", async () => {
    const savedInvitations: StoredInvitation[] = [];

    await expect(
      createInvitation(depsFor({ membership: null, savedInvitations }), createInput())
    ).resolves.toEqual({ status: "OWNER_REQUIRED" });
    await expect(
      createInvitation(depsFor({ workspace: null, savedInvitations }), createInput())
    ).resolves.toEqual({ status: "OWNER_REQUIRED" });
    await expect(
      createInvitation(
        depsFor({ membership: membership({ role: "EDITOR" }), savedInvitations }),
        createInput({ role: "OWNER" })
      )
    ).resolves.toEqual({ status: "EDITOR_CANNOT_INVITE_OWNER" });
    await expect(
      createInvitation(
        depsFor({
          existingUser: user({ email: "teammate@example.com" }),
          existingUserMembership: membership({ user_id: "user-existing" }),
          savedInvitations
        }),
        createInput()
      )
    ).resolves.toEqual({ status: "ALREADY_MEMBER" });

    expect(savedInvitations).toEqual([]);
  });

  test("records delivery failure and expired invitation state", async () => {
    const result = await createInvitation(
      depsFor(),
      createInput({
        simulateDeliveryFailure: true,
        simulateExpired: true
      })
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected invitation to be created");
    }
    expect(result.invitation).toMatchObject({
      delivery_status: "FAILED",
      expires_at: "2026-05-19T23:59:00.000Z"
    });
  });
});

function depsFor(
  options: {
    existingUser?: StoredUser;
    existingUserMembership?: StoredMembership;
    membership?: StoredMembership | null;
    pendingInvitation?: StoredInvitation;
    savedInvitations?: StoredInvitation[];
    workspace?: StoredWorkspace | null;
  } = {}
) {
  const savedInvitations = options.savedInvitations ?? [];
  return {
    idFactory: idFactory(),
    invitationStore: {
      pendingInvitationForEmail: () => options.pendingInvitation,
      saveInvitation: (invitation: StoredInvitation) => {
        savedInvitations.push(invitation);
      }
    },
    membershipStore: membershipStore(
      "membership" in options ? (options.membership ?? null) : membership(),
      options.existingUserMembership
    ),
    now: () => new Date("2026-05-20T00:00:00.000Z"),
    userStore: userStore(options.existingUser),
    workspaceStore: workspaceStore(
      "workspace" in options ? (options.workspace ?? null) : workspace()
    )
  };
}

function membershipStore(
  workspaceMembership: StoredMembership | null,
  existingUserMembership: StoredMembership | undefined
): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined),
    membershipForWorkspace: (workspaceId, userId) => {
      const memberships = [workspaceMembership, existingUserMembership].filter(
        (item): item is StoredMembership => item !== null && item !== undefined
      );
      return Promise.resolve(
        memberships.find(
          (item) => item.workspace_id === workspaceId && item.user_id === userId
        )
      );
    },
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function userStore(existingUser: StoredUser | undefined): UserStore {
  return {
    findUserByEmail: (email) =>
      Promise.resolve(existingUser?.email === email ? existingUser : undefined),
    findUserByGithubId: () => Promise.resolve(undefined),
    saveUser: () => Promise.resolve(),
    updateLastLoginAt: () => Promise.resolve()
  };
}

function workspaceStore(value: StoredWorkspace | null): WorkspaceStore {
  return {
    archiveWorkspace: () => Promise.resolve(),
    findWorkspaceById: () => Promise.resolve(value ?? undefined),
    isWorkspaceArchived: () => Promise.resolve(false),
    nextAvailableWorkspaceSlug: (slug) => Promise.resolve(slug),
    saveWorkspace: () => Promise.resolve(),
    workspaceSlugExists: () => Promise.resolve(false)
  };
}

function createInput(overrides: Partial<Parameters<typeof createInvitation>[1]> = {}) {
  return {
    email: "teammate@example.com",
    role: "EDITOR" as const,
    simulateDeliveryFailure: false,
    simulateExpired: false,
    userId: "user-1",
    workspaceId: "workspace-1",
    ...overrides
  };
}

function idFactory() {
  let nextId = 1;
  return () => `id-${String(nextId++)}`;
}

function invitation(): StoredInvitation {
  return {
    accepted_at: null,
    delivery_status: "SENT",
    email: "teammate@example.com",
    expires_at: "2026-05-27T00:00:00.000Z",
    id: "invitation-1",
    role: "EDITOR",
    token: "token-1",
    workspace_id: "workspace-1"
  };
}

function membership(overrides: Partial<StoredMembership> = {}): StoredMembership {
  return {
    id: "membership-1",
    role: "OWNER",
    user_id: "user-1",
    workspace_id: "workspace-1",
    ...overrides
  };
}

function user(overrides: Partial<StoredUser> = {}): StoredUser {
  return {
    avatar_url: "https://example.com/avatar.png",
    email: "member@example.com",
    github_id: "github-1",
    id: "user-existing",
    name: "Member",
    ...overrides
  };
}

function workspace(): StoredWorkspace {
  return {
    archived_at: null,
    id: "workspace-1",
    name: "Workspace",
    owner_id: "user-1",
    plan: "FREE",
    slug: "workspace"
  };
}
