import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const invitationRoleSchema = z.enum(["EDITOR", "OWNER"]);

export const invitationCreateParamsSchema = z.object({
  workspaceId: z.string().min(1)
});

export const invitationCreateRequestSchema = z.object({
  email: z.email(),
  role: invitationRoleSchema,
  simulate_delivery_failure: z.boolean().optional(),
  simulate_expired: z.boolean().optional()
});

export const invitationAcceptParamsSchema = z.object({
  token: z.string().min(1)
});

export const invitationAcceptRequestSchema = z.object({
  code: z.string().min(1)
});

export const invitationResponseInvitationSchema = z.object({
  accepted_at: z.string().nullable(),
  delivery_status: z.enum(["FAILED", "SENT"]),
  email: z.email(),
  expires_at: z.string(),
  id: z.string(),
  role: invitationRoleSchema,
  token: z.string(),
  workspace_id: z.string()
});

const invitationMembershipResponseSchema = z.object({
  id: z.string(),
  role: invitationRoleSchema,
  user_id: z.string(),
  workspace_id: z.string()
});

const invitationUserResponseSchema = z.object({
  avatar_url: z.string(),
  email: z.email(),
  github_id: z.string(),
  id: z.string(),
  name: z.string()
});

export const invitationCreateResponseSchema = z.object({
  invitation: invitationResponseInvitationSchema,
  suggested_next_actions: z.array(suggestedNextActionSchema)
});

export const invitationAcceptResponseSchema = z.object({
  invitation: invitationResponseInvitationSchema,
  membership: invitationMembershipResponseSchema,
  user: invitationUserResponseSchema
});

export type InvitationRole = z.infer<typeof invitationRoleSchema>;
export type InvitationCreateRequest = z.infer<typeof invitationCreateRequestSchema>;
export type InvitationCreateResponse = z.infer<typeof invitationCreateResponseSchema>;
export type InvitationAcceptResponse = z.infer<typeof invitationAcceptResponseSchema>;
