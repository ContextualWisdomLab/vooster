import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const scenarioTypeSchema = z.enum(["EXTENSION", "MAIN_SUCCESS"]);
export const scenarioOutcomeSchema = z.enum(["FAILURE", "PARTIAL", "SUCCESS"]);

export const stepImplementationRefSchema = z
  .string()
  .min(1)
  .refine(
    (value) => /^[^\s:]+(?::[A-Za-z_$][A-Za-z0-9_$.-]*)?$/.test(value),
    "Use path or path:symbol with no whitespace."
  );

export const scenarioCreateRequestSchema = z.object({
  condition: z.string().optional(),
  extension_point: z.string().optional(),
  outcome: scenarioOutcomeSchema.optional(),
  type: scenarioTypeSchema
});

export const scenarioStepCreateRequestSchema = z.object({
  action: z.string(),
  actor: z.string().min(1),
  force: z.boolean().default(false),
  position: z.number().int().min(1).optional()
});

export const stepMoveRequestSchema = z.object({
  to: z.number().int().min(1)
});

export const stepPatchRequestSchema = z.object({
  action: z.string().optional(),
  actor: z.string().optional(),
  base_revision: z.string().min(1),
  force: z.boolean().default(false),
  implements: z.array(stepImplementationRefSchema).optional(),
  notes: z.string().optional()
});

export const scenarioParamsSchema = z.object({
  usecaseId: z.string().min(1)
});

export const scenarioStepParamsSchema = z.object({
  scenarioId: z.string().min(1)
});

export const stepParamsSchema = z.object({
  stepId: z.string().min(1)
});

export const scenarioDryRunQuerySchema = z
  .looseObject({
    dry_run: z.literal("true").optional()
  })
  .nullish()
  .transform((value) => value?.dry_run === "true");

export const scenarioStoredResponseSchema = z.looseObject({
  condition: z.string().nullable().optional(),
  extension_point: z.string().nullable().optional(),
  id: z.string(),
  outcome: scenarioOutcomeSchema.optional(),
  parent_step_number: z.number().nullable().optional(),
  type: scenarioTypeSchema.optional(),
  usecase_id: z.string().optional()
});

export const stepStoredResponseSchema = z.looseObject({
  action: z.string().optional(),
  actor_id: z.string().optional(),
  id: z.string().optional(),
  implements: z.array(z.string()).default([]),
  invokes: z.array(z.string()).default([]),
  scenario_id: z.string().optional(),
  step_number: z.number().optional()
});

export const scenarioRevisionResponseSchema = z.looseObject({
  change_summary: z.string().optional(),
  id: z.string().optional(),
  severity: z.string().optional(),
  version_number: z.number().optional()
});

export const scenarioWarningResponseSchema = z.looseObject({
  message: z.string(),
  type: z.string()
});

export const scenarioCreateResponseSchema = z.object({
  revision: scenarioRevisionResponseSchema,
  scenario: scenarioStoredResponseSchema,
  suggested_next_actions: z.array(suggestedNextActionSchema).default([]),
  steps: z.array(stepStoredResponseSchema).default([]),
  warnings: z.array(scenarioWarningResponseSchema).optional()
});

export const scenarioStepCreateResponseSchema = z.object({
  revision: scenarioRevisionResponseSchema,
  scenario_steps: z.array(stepStoredResponseSchema),
  step: stepStoredResponseSchema,
  warnings: z.array(scenarioWarningResponseSchema).optional()
});

export const stepMoveResponseSchema = scenarioStepCreateResponseSchema;

export const stepUpdateResponseSchema = z.object({
  affected_sessions: z.array(z.string()),
  revision: scenarioRevisionResponseSchema,
  step: stepStoredResponseSchema
});

export type ScenarioCreateRequest = z.infer<typeof scenarioCreateRequestSchema>;
export type ScenarioStepCreateRequest = z.infer<typeof scenarioStepCreateRequestSchema>;
export type StepMoveRequest = z.infer<typeof stepMoveRequestSchema>;
export type StepPatchRequest = z.infer<typeof stepPatchRequestSchema>;
export type ScenarioCreateResponse = z.infer<typeof scenarioCreateResponseSchema>;
export type ScenarioStepCreateResponse = z.infer<
  typeof scenarioStepCreateResponseSchema
>;
export type StepMoveResponse = z.infer<typeof stepMoveResponseSchema>;
export type StepUpdateResponse = z.infer<typeof stepUpdateResponseSchema>;
