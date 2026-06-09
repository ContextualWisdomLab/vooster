import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const usecaseLevelSchema = z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]);
export const usecasePrioritySchema = z.enum(["P0", "P1", "P2", "P3"]);
export const usecaseStatusSchema = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "DEPRECATED"
]);

export const usecaseCreateRequestSchema = z.object({
  force: z.boolean().default(false),
  level: usecaseLevelSchema.default("USER_GOAL"),
  primary_actor: z.string().min(1),
  priority: usecasePrioritySchema.default("P2"),
  scope: z.string().optional(),
  simulate_key_collision_once: z.boolean().default(false),
  title: z.string().min(1)
});

export const usecasePatchRequestSchema = z.object({
  archived_at: z.null().optional(),
  format: z.literal("BRIEF").optional(),
  level: usecaseLevelSchema.optional(),
  priority: usecasePrioritySchema.optional(),
  scope: z.string().min(1).optional(),
  status: usecaseStatusSchema.optional(),
  title: z.string().min(1).optional()
});

export const usecaseParamsSchema = z.object({
  usecaseId: z.string().min(1)
});

export const usecaseProjectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export const usecaseCreateQuerySchema = z
  .looseObject({
    dry_run: z.literal("true").optional()
  })
  .nullish()
  .transform((value) => value?.dry_run === "true");

export const usecaseArchiveQuerySchema = z
  .looseObject({
    hard: z.literal("true").optional(),
    purge: z.literal("true").optional()
  })
  .nullish()
  .transform((value) => value?.hard === "true" || value?.purge === "true");

export const usecaseListQuerySchema = z.object({
  actor_id: z.string().optional(),
  archived: z.enum(["active", "all", "only"]).default("active"),
  cursor: z.string().optional(),
  level: usecaseLevelSchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  q: z.string().optional(),
  status: usecaseStatusSchema.optional()
});

export const usecaseShowQuerySchema = z.object({
  format: z.enum(["agent", "human", "json"]).default("human"),
  revision: z.string().optional(),
  session: z.string().optional()
});

export const usecaseStoredResponseSchema = z.looseObject({
  archived_at: z.string().nullable().optional(),
  current_revision_id: z.string().optional(),
  format: z.string().optional(),
  id: z.string().optional(),
  key: z.string(),
  level: usecaseLevelSchema.optional(),
  priority: usecasePrioritySchema.optional(),
  scope: z.string().optional(),
  status: usecaseStatusSchema.optional(),
  title: z.string().optional()
});

export const usecaseRevisionResponseSchema = z.looseObject({
  change_summary: z.string().optional(),
  id: z.string().optional(),
  version_number: z.number().optional()
});

export const usecaseCreateResponseSchema = z.object({
  revision: usecaseRevisionResponseSchema,
  suggested_next_actions: z.array(suggestedNextActionSchema),
  usecase: usecaseStoredResponseSchema
});

export const usecaseUpdateResponseSchema = z.object({
  usecase: usecaseStoredResponseSchema
});

export const usecaseRestoreResponseSchema = z.object({
  revision: usecaseRevisionResponseSchema.optional(),
  usecase: usecaseStoredResponseSchema
});

export const usecaseArchiveResponseSchema = z.object({
  active_locks_count: z.number(),
  affected_sessions: z.array(z.unknown()).optional(),
  affected_sessions_count: z.number(),
  revision: usecaseRevisionResponseSchema,
  suggested_next_actions: z.array(suggestedNextActionSchema),
  usecase: usecaseStoredResponseSchema
});

export const usecaseListItemSchema = z.looseObject({
  archived_at: z.string().nullable().optional(),
  extension_count: z.number().default(0),
  key: z.string(),
  level: usecaseLevelSchema,
  primary_actor: z.string(),
  scenario_count: z.number().default(0),
  status: usecaseStatusSchema,
  title: z.string(),
  trigger_excerpt: z.string().default("")
});

export const usecaseListResponseSchema = z.object({
  items: z.array(usecaseListItemSchema),
  next_cursor: z.string().nullable(),
  suggested_next_actions: z.array(suggestedNextActionSchema).optional()
});

const usecaseStepResponseSchema = z.looseObject({
  action: z.string(),
  actor: z.string(),
  implements: z.array(z.string()).default([]),
  invokes: z.array(z.string()).default([]),
  step_number: z.number()
});

const usecaseScenarioResponseSchema = z.looseObject({
  condition: z.string().nullable().optional(),
  extension_point: z.string().nullable().optional(),
  steps: z.array(usecaseStepResponseSchema).default([]),
  type: z.string()
});

export const usecaseShowDataSchema = z.looseObject({
  invoked_by: z.array(z.unknown()).optional(),
  primary_actor: z.object({ name: z.string() }).optional(),
  scenarios: z.array(usecaseScenarioResponseSchema).optional(),
  stakeholder_interests: z
    .array(
      z.looseObject({
        interest: z.string(),
        stakeholder: z.string()
      })
    )
    .optional(),
  usecase: usecaseStoredResponseSchema
});

export const usecaseShowResponseSchema = usecaseShowDataSchema;

export const usecaseAgentEnvelopeSchema = z.looseObject({
  data: usecaseShowDataSchema,
  format_version: z.number()
});

export type UsecaseCreateRequest = z.infer<typeof usecaseCreateRequestSchema>;
export type UsecasePatchRequest = z.infer<typeof usecasePatchRequestSchema>;
export type UsecaseListQuery = z.infer<typeof usecaseListQuerySchema>;
export type UsecaseListResponse = z.infer<typeof usecaseListResponseSchema>;
export type UsecaseShowResponse = z.infer<typeof usecaseShowResponseSchema>;
export type UsecaseCreateResponse = z.infer<typeof usecaseCreateResponseSchema>;
export type UsecaseUpdateResponse = z.infer<typeof usecaseUpdateResponseSchema>;
export type UsecaseArchiveResponse = z.infer<typeof usecaseArchiveResponseSchema>;
export type UsecaseRestoreResponse = z.infer<typeof usecaseRestoreResponseSchema>;
