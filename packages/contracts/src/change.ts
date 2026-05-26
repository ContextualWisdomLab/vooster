import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

const changeSeveritySchema = z.enum(["BREAKING", "COSMETIC", "NON_BREAKING"]);

const changePatchSchema = z.object({
  entity_id: z.string().min(1),
  entity_type: z.literal("USECASE"),
  fields: z.object({ title: z.string().min(1) })
});

export const changePreviewMarkerSchema = z.object({
  patch: z.unknown(),
  usecase_key: z.string().min(1)
});

export const changePreviewRequestSchema = z.object({
  auto_commit: z.boolean().optional(),
  base_revision: z.string().min(1),
  patch: changePatchSchema,
  usecase_key: z.string().min(1)
});

export const changeCommitRequestSchema = z.object({
  confirmed: z.boolean().optional(),
  preview_id: z.string().min(1)
});

export const changeTestPreviewExpireParamsSchema = z.object({
  previewId: z.string().min(1)
});

const changeDiffSchema = z.object({
  after: z.string(),
  before: z.string(),
  entity_id: z.string(),
  entity_type: z.literal("USECASE"),
  path: z.literal("title"),
  severity: changeSeveritySchema
});

const changeAffectedSessionSchema = z.object({
  agent_type: z.string().optional(),
  id: z.string(),
  owner: z.string().optional(),
  pinned_usecase_keys: z.array(z.string())
});

const changeWarningSchema = z.object({
  message: z.string(),
  type: z.string()
});

export const changePreviewResponseSchema = z.object({
  diff: z.array(changeDiffSchema),
  expires_at: z.string(),
  impact: z.object({
    affected_sessions: z.array(changeAffectedSessionSchema),
    severity: changeSeveritySchema
  }),
  preview_id: z.string(),
  severity: changeSeveritySchema,
  suggested_next_actions: z.array(suggestedNextActionSchema),
  warnings: z.array(changeWarningSchema)
});

export const changeCommitResponseSchema = z.object({
  revisions: z.array(
    z.object({
      entity_id: z.string(),
      revision_id: z.string()
    })
  ),
  suggested_next_actions: z.array(suggestedNextActionSchema)
});

export type ChangePreviewRequest = z.infer<typeof changePreviewRequestSchema>;
export type ChangeCommitRequest = z.infer<typeof changeCommitRequestSchema>;
export type ChangePreviewResponse = z.infer<typeof changePreviewResponseSchema>;
export type ChangeCommitResponse = z.infer<typeof changeCommitResponseSchema>;
