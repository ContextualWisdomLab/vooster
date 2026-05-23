import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  StoredInvitation,
  StoredMembership,
  StoredUser
} from "../../../src/domain/entities/index.js";
import {
  activeMembershipForEmail,
  expiryFor,
  invitations,
  pendingInvitationForEmail
} from "../../../src/http/invitation-store.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { UserStore } from "../../../src/ports/user-store.js";

describe("invitation store", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("keeps invitation maps scoped to signup state", () => {
    const first = signupState();
    const second = signupState();

    invitations(first).set("token-1", invitation());

    expect(invitations(first)).toBe(invitations(first));
    expect(invitations(first).get("token-1")).toMatchObject({ id: "invitation-1" });
    expect(invitations(second).size).toBe(0);
  });

  test("finds active memberships for known users by email", async () => {
    await expect(
      activeMembershipForEmail(
        userStore(user()),
        membershipStore(membership()),
        "workspace-1",
        "reader@example.com"
      )
    ).resolves.toEqual(membership());

    await expect(
      activeMembershipForEmail(
        userStore(undefined),
        membershipStore(membership()),
        "workspace-1",
        "missing@example.com"
      )
    ).resolves.toBeUndefined();
  });

  test("returns only pending unexpired invitations for the workspace and email", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T10:00:00Z"));
    const state = signupState();
    const pending = invitation({ token: "pending-token" });
    for (const item of [
      invitation({ accepted_at: "2026-05-23T09:00:00Z", token: "accepted-token" }),
      invitation({ expires_at: "2026-05-23T09:59:00Z", token: "expired-token" }),
      invitation({ email: "other@example.com", token: "other-token" }),
      invitation({ token: "workspace-token", workspace_id: "workspace-2" }),
      pending
    ]) {
      invitations(state).set(item.token, item);
    }

    expect(pendingInvitationForEmail(state, "workspace-1", "reader@example.com")).toBe(
      pending
    );
  });

  test("calculates future and past expiry timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T10:00:00Z"));

    expect(expiryFor(false)).toBe("2026-05-30T10:00:00.000Z");
    expect(expiryFor(true)).toBe("2026-05-23T09:59:00.000Z");
  });
});

function signupState(): SignupState {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map()
  };
}

function invitation(overrides: Partial<StoredInvitation> = {}): StoredInvitation {
  return {
    accepted_at: null,
    delivery_status: "SENT",
    email: "reader@example.com",
    expires_at: "2026-05-23T11:00:00Z",
    id: "invitation-1",
    role: "EDITOR",
    token: "token-1",
    workspace_id: "workspace-1",
    ...overrides
  };
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}

function user(): StoredUser {
  return {
    avatar_url: "https://example.com/avatar.png",
    email: "reader@example.com",
    github_id: "github-1",
    id: "user-1",
    name: "Reader"
  };
}

function membershipStore(found: StoredMembership | undefined): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined),
    membershipForWorkspace: () => Promise.resolve(found),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function userStore(found: StoredUser | undefined): UserStore {
  return {
    findUserByEmail: () => Promise.resolve(found),
    findUserByGithubId: () => Promise.resolve(undefined),
    saveUser: () => Promise.resolve(),
    updateLastLoginAt: () => Promise.resolve()
  };
}
