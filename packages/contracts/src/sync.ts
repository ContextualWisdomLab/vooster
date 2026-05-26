import { z } from "zod";

import { suggestedNextActionSchema } from "./common.js";

export const syncProjectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export const syncPullRequestSchema = z.object({
  branch: z.string().default("main"),
  since: z.string().optional()
});

export const syncPushFileSchema = z.object({
  base_revision: z.string().min(1),
  content: z.string().min(1),
  path: z.string().min(1)
});

export const syncPushRequestSchema = z.object({
  branch: z.string().default("main"),
  dry_run: z.boolean().default(false),
  files: z.array(syncPushFileSchema).min(1),
  simulate_network_failure: z.boolean().default(false)
});

export const syncPullResponseSchema = z.object({
  cursor: z.string(),
  files: z.array(
    z.object({
      content: z.string(),
      path: z.string(),
      revision: z.string()
    })
  )
});

export const syncPushResultSchema = z.looseObject({
  conflict_content: z.string().optional(),
  current_revision: z.string(),
  dry_run: z.boolean().optional(),
  impact: z
    .looseObject({
      entity_id: z.string(),
      severity: z.string()
    })
    .optional(),
  path: z.string(),
  status: z.string()
});

export const syncPushResponseSchema = z.object({
  cache: z.object({
    entries: z.array(
      z.object({
        path: z.string(),
        revision: z.string(),
        status: z.string()
      })
    )
  }),
  results: z.array(syncPushResultSchema),
  suggested_next_actions: z.array(suggestedNextActionSchema)
});

export type SyncProjectParams = z.infer<typeof syncProjectParamsSchema>;
export type SyncPullRequest = z.infer<typeof syncPullRequestSchema>;
export type SyncPushFile = z.infer<typeof syncPushFileSchema>;
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
export type SyncPushResult = z.infer<typeof syncPushResultSchema>;
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;
