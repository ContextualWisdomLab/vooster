import { z } from "zod";
import { actorStoredResponseSchema } from "./actor.js";
import { suggestedNextActionSchema } from "./common.js";

export const goalLevelSchema = z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]);
export const goalPrioritySchema = z.enum(["P0", "P1", "P2", "P3"]);
export const goalStatusSchema = z.enum([
  "IDENTIFIED",
  "IN_DESIGN",
  "PROMOTED",
  "REJECTED"
]);

export const goalProjectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export const goalParamsSchema = z.object({
  goalId: z.string().min(1)
});

export const goalCreateRequestSchema = z
  .object({
    actor: z.string().min(1).optional(),
    actor_id: z.string().min(1).optional(),
    description: z.string(),
    level: goalLevelSchema,
    priority: goalPrioritySchema
  })
  .refine((data) => data.actor !== undefined || data.actor_id !== undefined, {
    message: "Provide actor (name) or actor_id."
  });

export const goalPatchRequestSchema = z.object({
  status: goalStatusSchema.optional()
});

export const goalListQuerySchema = z.object({
  actor_id: z.string().optional()
});

export const goalPromoteRequestSchema = z.object({
  simulate_usecase_insert_failure: z.boolean().optional()
});

export const goalStoredResponseSchema = z.object({
  actor_id: z.string(),
  archived_at: z.string().nullable(),
  description: z.string(),
  id: z.string(),
  level: goalLevelSchema,
  linked_usecase_id: z.string().nullable(),
  priority: goalPrioritySchema,
  project_id: z.string(),
  status: goalStatusSchema
});

const revisionResponseSchema = z
  .object({
    version_number: z.number()
  })
  .loose();

const goalWarningSchema = z
  .object({
    command: z.string().optional(),
    message: z.string().optional()
  })
  .loose();

export const goalCreateResponseSchema = z.object({
  goal: goalStoredResponseSchema,
  recommended_next_command: z.string(),
  revision: revisionResponseSchema,
  warnings: z.array(goalWarningSchema).optional()
});

export const goalPatchResponseSchema = z.object({
  goal: goalStoredResponseSchema,
  revision: revisionResponseSchema
});

export const goalShowResponseSchema = z.object({
  goal: goalStoredResponseSchema,
  recommended_next_command: z.string()
});

export const goalResponseSchema = z.object({
  goal: goalStoredResponseSchema,
  recommended_next_command: z.string().optional(),
  revision: revisionResponseSchema.optional(),
  warnings: z.array(goalWarningSchema).optional()
});

export const goalListResponseSchema = z.object({
  actors: z.array(
    z.object({
      actor: actorStoredResponseSchema,
      goals: z.array(goalStoredResponseSchema)
    })
  )
});

export const goalPromotionResponseSchema = z.object({
  goal: goalStoredResponseSchema,
  revision: revisionResponseSchema,
  suggested_next_actions: z.array(suggestedNextActionSchema),
  usecase: z
    .object({
      format: z.string(),
      key: z.string(),
      title: z.string()
    })
    .loose(),
  warnings: z.array(goalWarningSchema).optional()
});

export type GoalCreateRequest = z.infer<typeof goalCreateRequestSchema>;
export type GoalPatchRequest = z.infer<typeof goalPatchRequestSchema>;
export type GoalStoredResponse = z.infer<typeof goalStoredResponseSchema>;
export type GoalCreateResponse = z.infer<typeof goalCreateResponseSchema>;
export type GoalPatchResponse = z.infer<typeof goalPatchResponseSchema>;
export type GoalShowResponse = z.infer<typeof goalShowResponseSchema>;
export type GoalResponse = z.infer<typeof goalResponseSchema>;
export type GoalListResponse = z.infer<typeof goalListResponseSchema>;
export type GoalPromotionResponse = z.infer<typeof goalPromotionResponseSchema>;
