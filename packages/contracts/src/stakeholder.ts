import { z } from "zod";

export const stakeholderTypeSchema = z.enum(["INTERNAL", "EXTERNAL", "REGULATORY"]);

export const stakeholderProjectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export const stakeholderParamsSchema = stakeholderProjectParamsSchema.extend({
  stakeholderId: z.string().min(1)
});

export const stakeholderCreateRequestSchema = z.object({
  attach_to_step: z.boolean().optional(),
  description: z.string().default(""),
  name: z.string().min(1),
  type: z.string()
});

export const stakeholderPatchRequestSchema = z.object({
  description: z.string().optional(),
  name: z.string().min(1).optional(),
  type: z.string().optional()
});

export const stakeholderSummarySchema = z.object({
  description: z.string(),
  id: z.string(),
  name: z.string(),
  type: stakeholderTypeSchema
});

export const stakeholderStoredResponseSchema = stakeholderSummarySchema.extend({
  archived_at: z.string().nullable(),
  project_id: z.string()
});

export const stakeholderResponseSchema = z.object({
  stakeholder: stakeholderSummarySchema
});

export const stakeholderListResponseSchema = z.object({
  items: z.array(stakeholderSummarySchema)
});

export const stakeholderCreateResponseSchema = z.object({
  recommended_next_command: z.string(),
  revision: z
    .object({
      version_number: z.number()
    })
    .loose(),
  stakeholder: stakeholderStoredResponseSchema
});

export const stakeholderArchiveResponseSchema = z.object({
  archived: z.literal(true),
  stakeholder: z.object({ id: z.string() })
});

export type StakeholderType = z.infer<typeof stakeholderTypeSchema>;
export type StakeholderCreateRequest = z.infer<typeof stakeholderCreateRequestSchema>;
export type StakeholderPatchRequest = z.infer<typeof stakeholderPatchRequestSchema>;
export type StakeholderSummary = z.infer<typeof stakeholderSummarySchema>;
export type StakeholderResponse = z.infer<typeof stakeholderResponseSchema>;
export type StakeholderListResponse = z.infer<typeof stakeholderListResponseSchema>;
export type StakeholderCreateResponse = z.infer<typeof stakeholderCreateResponseSchema>;
export type StakeholderArchiveResponse = z.infer<
  typeof stakeholderArchiveResponseSchema
>;
