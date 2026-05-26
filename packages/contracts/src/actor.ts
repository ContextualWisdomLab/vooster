import { z } from "zod";

export const actorTypeSchema = z.enum(["PRIMARY", "SUPPORTING", "OFFSTAGE"]);

export const actorProjectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export const actorParamsSchema = actorProjectParamsSchema.extend({
  actorId: z.string().min(1)
});

export const actorCreateRequestSchema = z.object({
  aliases: z.array(z.string()).default([]),
  description: z.string().default(""),
  is_human: z.boolean(),
  name: z.string().min(1),
  type: z.string()
});

export const actorPatchRequestSchema = z.object({
  aliases: z.array(z.string()).optional(),
  description: z.string().optional(),
  is_human: z.boolean().optional(),
  name: z.string().min(1).optional(),
  type: z.string().optional()
});

export const actorSummarySchema = z.object({
  aliases: z.array(z.string()),
  description: z.string(),
  id: z.string(),
  is_human: z.boolean(),
  name: z.string(),
  type: actorTypeSchema
});

export const actorStoredResponseSchema = actorSummarySchema.extend({
  archived_at: z.string().nullable(),
  project_id: z.string()
});

export const actorResponseSchema = z.object({
  actor: actorSummarySchema
});

export const actorListResponseSchema = z.object({
  items: z.array(actorSummarySchema)
});

export const actorCreateResponseSchema = z.object({
  actor: actorStoredResponseSchema,
  recommended_next_command: z.string(),
  revision: z
    .object({
      version_number: z.number()
    })
    .loose()
});

export const actorArchiveResponseSchema = z.object({
  actor: z.object({ id: z.string() }),
  archived: z.literal(true)
});

export type ActorType = z.infer<typeof actorTypeSchema>;
export type ActorCreateRequest = z.infer<typeof actorCreateRequestSchema>;
export type ActorPatchRequest = z.infer<typeof actorPatchRequestSchema>;
export type ActorSummary = z.infer<typeof actorSummarySchema>;
export type ActorResponse = z.infer<typeof actorResponseSchema>;
export type ActorListResponse = z.infer<typeof actorListResponseSchema>;
export type ActorCreateResponse = z.infer<typeof actorCreateResponseSchema>;
export type ActorArchiveResponse = z.infer<typeof actorArchiveResponseSchema>;
