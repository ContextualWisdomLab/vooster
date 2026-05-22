import type { FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredMembership } from "../../../src/domain/entities/index.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import {
  isReadOnlyMembership,
  membershipForProject,
  membershipForWorkspace
} from "../../../src/http/membership-support.js";
import type { SignupState } from "../../../src/http/signup-types.js";

describe("membership support", () => {
  test("returns project membership for the authenticated session user", async () => {
    const state = signupState();
    const membership = storedMembership();

    await expect(
      membershipForProject(
        request("token-1"),
        state,
        membershipStore({ projectMembership: membership }),
        "project-1"
      )
    ).resolves.toBe(membership);
  });

  test("returns workspace membership for the authenticated session user", async () => {
    const state = signupState();
    const membership = storedMembership();

    await expect(
      membershipForWorkspace(
        request("token-1"),
        state,
        membershipStore({ workspaceMembership: membership }),
        "workspace-1"
      )
    ).resolves.toBe(membership);
  });

  test("does not query membership stores without an authenticated session", async () => {
    const state = signupState();
    const calls: string[] = [];

    await expect(
      membershipForProject(
        request("missing-token"),
        state,
        membershipStore({ calls }),
        "project-1"
      )
    ).resolves.toBeUndefined();
    await expect(
      membershipForWorkspace(
        request(undefined),
        state,
        membershipStore({ calls }),
        "ws-1"
      )
    ).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });

  test("checks read-only membership markers by user and workspace", () => {
    const state = signupState();
    const membership = storedMembership();

    state.readOnlyMemberships.add("user-1:workspace-1");

    expect(isReadOnlyMembership(state, membership)).toBe(true);
    expect(
      isReadOnlyMembership(state, storedMembership({ workspace_id: "workspace-2" }))
    ).toBe(false);
  });
});

function request(token: string | undefined): FastifyRequest {
  return {
    headers: {
      cookie: token === undefined ? undefined : `vspec_session=${token}`
    }
  } as FastifyRequest;
}

function signupState(): SignupState {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map([["token-1", "user-1"]])
  };
}

function membershipStore(options: {
  calls?: string[];
  projectMembership?: StoredMembership;
  workspaceMembership?: StoredMembership;
}): MembershipStore {
  const calls = options.calls ?? [];
  return {
    membershipForProject: (projectId: string, userId: string) => {
      calls.push(`project:${projectId}:${userId}`);
      return Promise.resolve(options.projectMembership);
    },
    membershipForWorkspace: (workspaceId: string, userId: string) => {
      calls.push(`workspace:${workspaceId}:${userId}`);
      return Promise.resolve(options.workspaceMembership);
    }
  } as unknown as MembershipStore;
}

function storedMembership(overrides: Partial<StoredMembership> = {}): StoredMembership {
  return {
    id: "membership-1",
    role: "OWNER",
    user_id: "user-1",
    workspace_id: "workspace-1",
    ...overrides
  };
}
