import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const mergeStrategySchema = z.enum(["FAST_FORWARD", "SQUASH"]);
export const mergeResolutionStrategySchema = z.enum(["MANUAL", "MINE", "THEIRS"]);

export const mergeOpenRequestSchema = z.object({
  simulate_write_failure: z.boolean().default(false),
  source_branch_id: z.string().min(1),
  strategy: mergeStrategySchema.optional(),
  target: z.literal("main").default("main")
});

const mergeResolutionSchema = z.object({
  entity_id: z.string().min(1),
  field: z.string().optional(),
  strategy: mergeResolutionStrategySchema,
  value: z.unknown().optional()
});

export const mergeResolveParamsSchema = z.object({
  mergeId: z.string().min(1)
});

export const mergeResolveRequestSchema = z.object({
  base_revision: z.string().min(1),
  resolutions: z.array(mergeResolutionSchema).min(1),
  simulate_write_failure: z.boolean().default(false)
});

const mergeBranchResponseSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  status: z.string()
});

const mergeImpactResponseSchema = z.looseObject({
  severity_by_entity: z.record(z.string(), z.string())
});

const mergeRequestResponseSchema = z.looseObject({
  conflicts: z.array(z.unknown()),
  id: z.string(),
  status: z.string(),
  impact: mergeImpactResponseSchema.optional(),
  strategy: z.string().optional()
});

const mergeOpenRequestResponseSchema = mergeRequestResponseSchema.extend({
  impact: mergeImpactResponseSchema,
  strategy: z.string()
});

const mergeRevisionResponseSchema = z.looseObject({
  id: z.string()
});

export const mergeOpenResponseSchema = z.object({
  main_head_revision_ids: z.record(z.string(), z.string()),
  merge_request: mergeOpenRequestResponseSchema,
  source_branch: mergeBranchResponseSchema,
  suggested_next_actions: z.array(suggestedNextActionSchema)
});

export const mergeResolveResponseSchema = z.object({
  main_head_revision_ids: z.record(z.string(), z.string()),
  merge_request: mergeRequestResponseSchema,
  new_revisions: z.array(mergeRevisionResponseSchema),
  source_branch: mergeBranchResponseSchema,
  suggested_next_actions: z.array(suggestedNextActionSchema)
});

export type MergeStrategy = z.infer<typeof mergeStrategySchema>;
export type MergeResolutionStrategy = z.infer<typeof mergeResolutionStrategySchema>;
export type MergeOpenRequest = z.infer<typeof mergeOpenRequestSchema>;
export type MergeResolveRequest = z.infer<typeof mergeResolveRequestSchema>;
export type MergeOpenResponse = z.infer<typeof mergeOpenResponseSchema>;
export type MergeResolveResponse = z.infer<typeof mergeResolveResponseSchema>;
