import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const commentBodySchema = z.object({
  body: z.string().min(1),
  simulate_write_failure: z.boolean().optional()
});

export const commentPatchSchema = z
  .object({
    body: z.string().min(1).optional(),
    resolved: z.literal(true).optional()
  })
  .refine((value) => value.body !== undefined || value.resolved !== undefined);

export const usecaseCommentParamsSchema = z.object({
  usecaseId: z.string().min(1)
});

export const commentIdParamsSchema = z.object({
  commentId: z.string().min(1)
});

export const commentAddQuerySchema = z
  .looseObject({
    dry_run: z.literal("true").optional()
  })
  .nullish()
  .transform((value) => value?.dry_run === "true");

export const commentPayloadSchema = z.object({
  author_id: z.string(),
  body: z.string(),
  created_at: z.string(),
  id: z.string(),
  resolved: z.boolean(),
  resolved_at: z.string().nullable(),
  target_id: z.string(),
  target_type: z.literal("USECASE"),
  updated_at: z.string().nullable()
});

export const commentResponseSchema = z.object({
  comment: commentPayloadSchema,
  suggested_next_actions: z.array(suggestedNextActionSchema)
});

export const commentListResponseSchema = z.object({
  comments: z.array(commentPayloadSchema)
});

export type CommentBodyRequest = z.infer<typeof commentBodySchema>;
export type CommentPatchRequest = z.infer<typeof commentPatchSchema>;
export type CommentPayload = z.infer<typeof commentPayloadSchema>;
export type CommentResponse = z.infer<typeof commentResponseSchema>;
export type CommentListResponse = z.infer<typeof commentListResponseSchema>;
