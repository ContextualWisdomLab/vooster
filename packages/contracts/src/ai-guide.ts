import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const aiGuideQuerySchema = z.object({
  cli_version: z.string().default("1.0.0"),
  format: z.enum(["json", "markdown"]).default("markdown")
});

export const cachedAiGuideSchema = z.object({
  cli_version: z.string(),
  content: z.string()
});

export const aiGuideRequestBodySchema = z.object({
  cached_guides: z.array(cachedAiGuideSchema).default([]),
  simulate_network_failure: z.boolean().default(false)
});

export const aiGuideMarkdownResponseSchema = z.object({
  cache: z.object({
    cli_version: z.string(),
    previous_cli_version: z.string().optional(),
    status: z.enum(["REFRESHED", "REFRESHED_VERSION_MISMATCH", "STALE_FALLBACK"])
  }),
  content: z.string(),
  suggested_next_actions: z.array(suggestedNextActionSchema),
  warnings: z
    .array(
      z.object({
        message: z.string(),
        type: z.string()
      })
    )
    .optional()
});

export const aiGuideJsonResponseSchema = z.object({
  examples: z.array(
    z.object({
      commands: z.array(z.string()),
      title: z.string()
    })
  ),
  sections: z.array(
    z.object({
      body: z.string(),
      heading: z.string()
    })
  ),
  suggested_next_actions: z.array(suggestedNextActionSchema),
  version: z.string()
});

export const aiGuideResponseSchema = z.union([
  aiGuideMarkdownResponseSchema,
  aiGuideJsonResponseSchema
]);

export type AiGuideQuery = z.infer<typeof aiGuideQuerySchema>;
export type AiGuideRequestBody = z.infer<typeof aiGuideRequestBodySchema>;
export type AiGuideMarkdownResponse = z.infer<typeof aiGuideMarkdownResponseSchema>;
export type AiGuideJsonResponse = z.infer<typeof aiGuideJsonResponseSchema>;
export type AiGuideResponse = z.infer<typeof aiGuideResponseSchema>;
