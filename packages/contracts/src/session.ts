import { z } from "zod";

import { suggestedNextActionSchema } from "./common.js";

export const sessionStartRequestSchema = z.object({
  agent_type: z.string().default("OTHER"),
  auto_branch: z.boolean().default(false),
  branch_name: z.string().min(1).optional(),
  intent: z.string().min(1),
  pins: z.array(z.string().min(1)).min(1),
  project_id: z.string().min(1),
  simulate_write_failure: z.boolean().default(false)
});

export const sessionListStatusSchema = z.enum(["ABANDONED", "ACTIVE", "COMPLETED"]);

export const sessionListQuerySchema = z.object({
  project_id: z.string().optional(),
  status: sessionListStatusSchema.default("ACTIVE"),
  user_id: z.string().optional(),
  workspace_id: z.string().min(1)
});

export const sessionCompleteParamsSchema = z.object({
  sessionId: z.string().min(1)
});

export const sessionCompleteRequestSchema = z.object({
  no_merge: z.boolean().default(false),
  simulate_conflicts: z.boolean().default(false),
  simulate_completion_failure: z.boolean().default(false),
  simulate_failed_lock_release: z.string().optional(),
  summary: z.string().optional()
});

export const sessionStartResponseSchema = z.object({
  branch: z.looseObject({ id: z.string(), name: z.string() }).optional(),
  session: z.looseObject({
    agent_identifier: z.string(),
    agent_type: z.string(),
    id: z.string(),
    intent: z.string(),
    pinned_revisions: z.record(z.string(), z.string()),
    status: z.string()
  }),
  session_file: z.looseObject({
    path: z.string(),
    session_id: z.string()
  }),
  suggested_next_actions: z.array(suggestedNextActionSchema),
  warnings: z
    .array(
      z.looseObject({
        message: z.string(),
        type: z.string()
      })
    )
    .optional()
});

export const sessionListResponseSchema = z.object({
  sessions: z.array(
    z.looseObject({
      agent_identifier: z.string(),
      agent_type: z.string(),
      branch_name: z.string().nullable(),
      conflict_markers: z.array(z.string()),
      id: z.string(),
      idle_seconds: z.number(),
      intent: z.string(),
      lock_count: z.number(),
      markers: z.array(z.string()),
      pinned_keys: z.array(z.string()),
      status: z.string()
    })
  ),
  suggested_next_actions: z.array(suggestedNextActionSchema).optional(),
  summary: z.looseObject({
    total_conflicts: z.number()
  }),
  total: z.number()
});

export const sessionCompleteResponseSchema = z.object({
  merge_request: z
    .looseObject({
      conflicts: z.array(z.unknown()),
      id: z.string(),
      status: z.string(),
      strategy: z.string()
    })
    .optional(),
  released_lock_ids: z.array(z.string()),
  session: z.looseObject({
    ended_at: z.string(),
    id: z.string(),
    status: z.string()
  }),
  session_file: z.looseObject({
    cleared: z.boolean(),
    path: z.string()
  }),
  suggested_next_actions: z.array(suggestedNextActionSchema),
  warnings: z
    .array(
      z.looseObject({
        lock_id: z.string(),
        message: z.string().optional(),
        type: z.string()
      })
    )
    .optional()
});

export type SessionStartRequest = z.infer<typeof sessionStartRequestSchema>;
export type SessionListStatus = z.infer<typeof sessionListStatusSchema>;
export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;
export type SessionCompleteParams = z.infer<typeof sessionCompleteParamsSchema>;
export type SessionCompleteRequest = z.infer<typeof sessionCompleteRequestSchema>;
export type SessionStartResponse = z.infer<typeof sessionStartResponseSchema>;
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;
export type SessionCompleteResponse = z.infer<typeof sessionCompleteResponseSchema>;
