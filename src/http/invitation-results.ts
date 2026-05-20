import type { FastifyReply } from "fastify";
import type { CreateInvitationResult } from "../application/invitations.js";
import type { StoredInvitation } from "./invitation-store.js";
import {
  alreadyMemberProblem,
  editorOwnerInviteProblem
} from "./invitation-problems.js";
import { problem } from "./signup-support.js";

export function sendCreateInvitationResult(
  reply: FastifyReply,
  result: CreateInvitationResult
) {
  switch (result.status) {
    case "CREATED":
      return reply.code(201).send(invitationResponse(result.invitation));
    case "EXISTING":
      return reply.code(200).send(invitationResponse(result.invitation, true));
    case "OWNER_REQUIRED":
      return reply.code(403).send(problem(403, "Workspace owner role required"));
    case "EDITOR_CANNOT_INVITE_OWNER":
      return reply.code(403).send(editorOwnerInviteProblem());
    case "ALREADY_MEMBER":
      return reply.code(422).send(alreadyMemberProblem());
  }
}

function invitationResponse(invitation: StoredInvitation, includeResend = false) {
  return {
    invitation,
    suggested_next_actions: [
      {
        command: "vspec member list",
        reason: "Review pending and active workspace members."
      },
      ...(includeResend
        ? [
            {
              command: "vspec member invite --resend",
              reason: "Resend the existing invitation email."
            }
          ]
        : []),
      ...(invitation.delivery_status === "FAILED"
        ? [
            {
              command: "vspec member invite --email <corrected>",
              reason: "Correct the address and send a new invitation."
            }
          ]
        : [])
    ]
  };
}
