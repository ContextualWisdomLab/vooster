import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredInvitation } from "../../../src/domain/entities/index.js";
import { sendCreateInvitationResult } from "../../../src/http/invitation-results.js";

describe("invitation result responses", () => {
  test("serializes created and existing invitations", () => {
    const created = reply();
    sendCreateInvitationResult(created.fastifyReply, {
      invitation: invitation(),
      status: "CREATED"
    });

    expect(created.statusCode).toBe(201);
    expect(created.body).toMatchObject({
      invitation: { id: "invitation-1" },
      suggested_next_actions: [{ command: "vspec member list" }]
    });

    const existing = reply();
    sendCreateInvitationResult(existing.fastifyReply, {
      invitation: invitation({ delivery_status: "FAILED" }),
      status: "EXISTING"
    });

    expect(existing.statusCode).toBe(200);
    expect(existing.body).toMatchObject({
      suggested_next_actions: [
        { command: "vspec member list" },
        { command: "vspec member invite --resend" },
        { command: "vspec member invite --email <corrected>" }
      ]
    });
  });

  test("serializes invitation failures", () => {
    const cases = [
      {
        expectedStatus: 403,
        result: { status: "OWNER_REQUIRED" as const },
        title: "Workspace owner role required"
      },
      {
        expectedStatus: 403,
        result: { status: "EDITOR_CANNOT_INVITE_OWNER" as const },
        title: "Only workspace owners can invite owners"
      },
      {
        expectedStatus: 422,
        result: { status: "ALREADY_MEMBER" as const },
        title: "Email already belongs to a workspace member"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendCreateInvitationResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });
});

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: (body: unknown) => {
      captured.body = body;
      return body;
    }
  } as unknown as FastifyReply;
  return captured;
}

function invitation(overrides: Partial<StoredInvitation> = {}): StoredInvitation {
  return {
    accepted_at: null,
    delivery_status: "SENT",
    email: "teammate@example.com",
    expires_at: "2026-05-27T00:00:00.000Z",
    id: "invitation-1",
    role: "EDITOR",
    token: "token-1",
    workspace_id: "workspace-1",
    ...overrides
  };
}
