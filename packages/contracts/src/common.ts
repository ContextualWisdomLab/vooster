import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok")
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const suggestedNextActionSchema = z.object({
  command: z.string(),
  reason: z.string()
});

export type SuggestedNextAction = z.infer<typeof suggestedNextActionSchema>;
