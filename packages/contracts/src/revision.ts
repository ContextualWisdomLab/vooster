import { z } from "zod";

import { suggestedNextActionSchema } from "./common.js";

export const revisionUsecaseParamsSchema = z.object({
  usecaseId: z.string().min(1)
});

export const revisionHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  project_id: z.string().optional(),
  simulate_server_error: z.literal("true").optional()
});

export const revisionDiffFormatSchema = z.enum(["agent", "human", "json"]);

export const revisionDiffQuerySchema = z.object({
  format: revisionDiffFormatSchema.default("human"),
  from: z.string().min(1),
  to: z.string().min(1)
});

export const revisionRevertRequestSchema = z.object({
  force: z.boolean().default(false),
  revision_id: z.string().min(1),
  simulate_gherkin_drift: z.boolean().default(false),
  simulate_write_failure: z.boolean().default(false),
  summary: z.string().optional()
});

export const revisionHistoryResponseSchema = z.object({
  limit: z.number(),
  revisions: z.array(
    z.looseObject({
      author: z.string(),
      change_summary: z.string().optional(),
      entity_id: z.string(),
      entity_type: z.string(),
      revision: z.string(),
      timestamp: z.string(),
      version_number: z.number()
    })
  ),
  suggested_next_actions: z.array(suggestedNextActionSchema),
  suppressed_count: z.number(),
  truncated: z.boolean(),
  usecase: z.looseObject({
    key: z.string()
  })
});

export const revisionDiffResponseSchema = z.looseObject({
  changes: z.array(
    z.looseObject({
      change_type: z.string(),
      entity_type: z.string(),
      path: z.string(),
      revision: z.string(),
      severity: z.string(),
      source_branch: z.string().optional()
    })
  ),
  cross_branch: z.boolean().optional(),
  format: revisionDiffFormatSchema,
  from_revision: z.string(),
  note: z.string().optional(),
  suggested_next_actions: z.array(suggestedNextActionSchema),
  summary: z.looseObject({
    breaking: z.number(),
    cosmetic: z.number(),
    non_breaking: z.number()
  }),
  to_revision: z.string(),
  usecase: z.looseObject({
    key: z.string()
  }),
  warnings: z
    .array(
      z.looseObject({
        from_branch: z.string(),
        to_branch: z.string(),
        type: z.string()
      })
    )
    .optional()
});

export const revisionRevertResponseSchema = z.object({
  impact: z.looseObject({
    affected_branches: z.array(z.string()),
    affected_sessions: z.array(z.string()),
    severity: z.string()
  }),
  revision: z.looseObject({
    change_summary: z.string(),
    id: z.string(),
    parent_revision_id: z.string(),
    severity: z.string(),
    version_number: z.number()
  }),
  suggested_next_actions: z.array(suggestedNextActionSchema),
  usecase: z.looseObject({
    current_revision_id: z.string(),
    id: z.string(),
    title: z.string()
  }),
  warnings: z
    .array(
      z.looseObject({
        message: z.string(),
        type: z.string()
      })
    )
    .optional()
});

export type RevisionUsecaseParams = z.infer<typeof revisionUsecaseParamsSchema>;
export type RevisionHistoryQuery = z.infer<typeof revisionHistoryQuerySchema>;
export type RevisionDiffFormat = z.infer<typeof revisionDiffFormatSchema>;
export type RevisionDiffQuery = z.infer<typeof revisionDiffQuerySchema>;
export type RevisionRevertRequest = z.infer<typeof revisionRevertRequestSchema>;
export type RevisionHistoryResponse = z.infer<typeof revisionHistoryResponseSchema>;
export type RevisionDiffResponse = z.infer<typeof revisionDiffResponseSchema>;
export type RevisionRevertResponse = z.infer<typeof revisionRevertResponseSchema>;
