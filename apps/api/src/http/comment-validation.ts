import { z } from "zod";

export const commentBodySchema = z.object({
  body: z.string().min(1),
  simulate_write_failure: z.boolean().optional()
});

export const commentPatchSchema = z.object({
  body: z.string().min(1).optional(),
  resolved: z.literal(true).optional()
});
