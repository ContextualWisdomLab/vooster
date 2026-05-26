import { z } from "zod";

export const projectVisibilitySchema = z.enum(["PRIVATE", "INTERNAL"]);

export const projectCreateRequestSchema = z.object({
  key: z.string(),
  name: z.string().min(1),
  simulate_branch_insert_failure: z.boolean().optional(),
  visibility: projectVisibilitySchema.default("PRIVATE")
});

export const projectRenameRequestSchema = z.object({
  name: z.string().min(1).max(120)
});

export const projectWorkspaceParamsSchema = z.object({
  workspaceId: z.string().min(1)
});

export const projectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export const projectCreateQuerySchema = z
  .looseObject({
    dry_run: z.literal("true").optional()
  })
  .nullish()
  .transform((value) => value?.dry_run === "true");

export const projectResponseSchema = z.object({
  default_branch_id: z.string(),
  id: z.string(),
  key: z.string(),
  name: z.string(),
  visibility: projectVisibilitySchema,
  workspace_id: z.string()
});

export const projectListItemSchema = projectResponseSchema.omit({
  default_branch_id: true
});

export const projectDefaultBranchSchema = z.object({
  base_branch_id: z.string().nullable(),
  base_revision_ids: z.record(z.string(), z.string()).optional(),
  head_revision_ids: z.record(z.string(), z.string()).optional(),
  id: z.string(),
  merged_at: z.string().optional(),
  name: z.string(),
  owner_id: z.string(),
  owner_type: z.enum(["AGENT", "HUMAN"]),
  project_id: z.string(),
  status: z.enum(["ABANDONED", "ACTIVE", "MERGED"]).optional()
});

export const projectCreateResponseSchema = z.object({
  default_branch: projectDefaultBranchSchema,
  project: projectResponseSchema,
  recommended_next_command: z.string()
});

export const projectRenameResponseSchema = z.object({
  project: projectResponseSchema
});

export const projectListResponseSchema = z.object({
  items: z.array(projectListItemSchema)
});

export type ProjectCreateRequest = z.infer<typeof projectCreateRequestSchema>;
export type ProjectRenameRequest = z.infer<typeof projectRenameRequestSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type ProjectListItem = z.infer<typeof projectListItemSchema>;
export type ProjectCreateResponse = z.infer<typeof projectCreateResponseSchema>;
export type ProjectRenameResponse = z.infer<typeof projectRenameResponseSchema>;
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
