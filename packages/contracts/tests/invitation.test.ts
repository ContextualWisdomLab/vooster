import { describe, expect, test } from "vitest";
import {
  invitationAcceptParamsSchema,
  invitationAcceptRequestSchema,
  invitationAcceptResponseSchema,
  invitationCreateParamsSchema,
  invitationCreateRequestSchema,
  invitationCreateResponseSchema
} from "../src/index.js";

describe("invitation contracts", () => {
  test("parses create and accept request boundaries", () => {
    expect(invitationCreateParamsSchema.parse({ workspaceId: "workspace-1" })).toEqual({
      workspaceId: "workspace-1"
    });
    expect(
      invitationCreateRequestSchema.parse({
        email: "teammate@example.test",
        role: "EDITOR",
        simulate_delivery_failure: true,
        simulate_expired: true
      })
    ).toEqual({
      email: "teammate@example.test",
      role: "EDITOR",
      simulate_delivery_failure: true,
      simulate_expired: true
    });
    expect(invitationAcceptParamsSchema.parse({ token: "token-1" })).toEqual({
      token: "token-1"
    });
    expect(invitationAcceptRequestSchema.parse({ code: "github-code" })).toEqual({
      code: "github-code"
    });
  });

  test("rejects malformed invitation request boundaries", () => {
    expect(() =>
      invitationCreateRequestSchema.parse({
        email: "not-email",
        role: "EDITOR"
      })
    ).toThrow();
    expect(() =>
      invitationCreateRequestSchema.parse({
        email: "teammate@example.test",
        role: "ADMIN"
      })
    ).toThrow();
    expect(() => invitationCreateParamsSchema.parse({ workspaceId: "" })).toThrow();
    expect(() => invitationAcceptParamsSchema.parse({ token: "" })).toThrow();
    expect(() => invitationAcceptRequestSchema.parse({ code: "" })).toThrow();
  });

  test("parses create and accept success responses", () => {
    const created = invitationCreateResponseSchema.parse({
      invitation: invitation(),
      suggested_next_actions: [
        {
          command: "vspec member list",
          reason: "Review pending and active workspace members."
        }
      ]
    });
    expect(created.invitation.delivery_status).toBe("SENT");

    const accepted = invitationAcceptResponseSchema.parse({
      invitation: invitation({ accepted_at: "2026-05-22T00:00:00.000Z" }),
      membership: {
        id: "membership-1",
        role: "EDITOR",
        user_id: "user-1",
        workspace_id: "workspace-1"
      },
      user: {
        avatar_url: "https://example.test/avatar.png",
        email: "teammate@example.test",
        github_id: "123",
        id: "user-1",
        name: "Teammate"
      }
    });
    expect(accepted.membership.role).toBe("EDITOR");
    expect(accepted.user.email).toBe("teammate@example.test");
  });
});

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    accepted_at: null,
    delivery_status: "SENT",
    email: "teammate@example.test",
    expires_at: "2026-05-29T00:00:00.000Z",
    id: "invitation-1",
    role: "EDITOR",
    token: "token-1",
    workspace_id: "workspace-1",
    ...overrides
  };
}
