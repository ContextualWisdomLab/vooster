import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const branchProjectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export const branchCreateRequestSchema = z.object({
  from: z.string().default("main"),
  name: z.string().min(1),
  simulate_snapshot_failure: z.boolean().default(false)
});

export const branchStoredResponseSchema = z.object({
  base_branch_id: z.string().nullable(),
  base_revision_ids: z.record(z.string(), z.string()),
  head_revision_ids: z.record(z.string(), z.string()),
  id: z.string(),
  name: z.string(),
  owner_id: z.string(),
  owner_type: z.enum(["AGENT", "HUMAN"]),
  project_id: z.string(),
  status: z.enum(["ABANDONED", "ACTIVE", "MERGED"])
});

const branchWarningSchema = z.object({
  merge_request_id: z.string(),
  type: z.literal("IN_FLIGHT_MERGE_REQUEST")
});

export const branchCreateResponseSchema = z.object({
  branch: branchStoredResponseSchema,
  suggested_next_actions: z.array(suggestedNextActionSchema),
  warnings: z.array(branchWarningSchema).optional()
});

export type BranchCreateRequest = z.infer<typeof branchCreateRequestSchema>;
export type BranchStoredResponse = z.infer<typeof branchStoredResponseSchema>;
export type BranchCreateResponse = z.infer<typeof branchCreateResponseSchema>;
