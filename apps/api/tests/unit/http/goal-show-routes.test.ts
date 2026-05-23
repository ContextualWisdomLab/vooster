import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredGoal,
  StoredMembership
} from "../../../src/domain/entities/index.js";
import { showGoal } from "../../../src/http/goal-show-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";
import type { GoalStore } from "../../../src/ports/goal-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";

describe("goal show route helper", () => {
  test("returns not found when the goal does not exist", async () => {
    const captured = reply();

    await showGoal(request(), captured.fastifyReply, signupState(), {
      goalStore: goalStore(undefined),
      membershipStore: membershipStore(storedMembership())
    });

    expect(captured.statusCode).toBe(404);
    expect(captured.body).toMatchObject({ title: "Goal not found" });
  });

  test("requires an authenticated project member", async () => {
    const cases = [
      { membership: storedMembership(), state: signupState({ authenticated: false }) },
      { membership: undefined, state: signupState({ authenticated: true }) }
    ];

    for (const item of cases) {
      const captured = reply();

      await showGoal(request(), captured.fastifyReply, item.state, {
        goalStore: goalStore(storedGoal()),
        membershipStore: membershipStore(item.membership)
      });

      expect(captured.statusCode).toBe(403);
      expect(captured.body).toMatchObject({
        title: "Contact the workspace owner for access"
      });
    }
  });

  test("returns the goal for authenticated project members", async () => {
    const captured = reply();

    await showGoal(request(), captured.fastifyReply, signupState(), {
      goalStore: goalStore(storedGoal()),
      membershipStore: membershipStore(storedMembership())
    });

    expect(captured.statusCode).toBeUndefined();
    expect(captured.body).toEqual({
      goal: storedGoal(),
      recommended_next_command: "vspec goal list"
    });
  });
});

function request(): FastifyRequest {
  return {
    headers: { cookie: "vspec_session=token-1" },
    params: { goalId: "goal-1" }
  } as FastifyRequest;
}

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    send: (body: unknown) => unknown;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply,
    send: (body) => {
      captured.body = body;
      return body;
    }
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: captured.send
  } as unknown as FastifyReply;
  return captured;
}

function signupState(options: { authenticated?: boolean } = {}): SignupState {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken:
      options.authenticated === false
        ? new Map<string, string>()
        : new Map([["token-1", "user-1"]])
  };
}

function goalStore(goal: StoredGoal | undefined): GoalStore {
  return {
    findGoalById: () => Promise.resolve(goal),
    listGoals: () => Promise.resolve([]),
    saveGoal: () => Promise.resolve(),
    updateGoal: () => Promise.resolve()
  };
}

function membershipStore(membership: StoredMembership | undefined): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(membership),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function storedGoal(): StoredGoal {
  return {
    actor_id: "actor-1",
    archived_at: null,
    description: "Buyer can place an order",
    id: "goal-1",
    level: "USER_GOAL",
    linked_usecase_id: null,
    priority: "P1",
    project_id: "project-1",
    status: "IDENTIFIED"
  };
}

function storedMembership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}
