import { z } from "zod";

export const goalRequestSchema = z
  .object({
    actor: z.string().min(1).optional(),
    actor_id: z.string().min(1).optional(),
    description: z.string(),
    level: z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]),
    priority: z.enum(["P0", "P1", "P2", "P3"])
  })
  .refine((data) => data.actor !== undefined || data.actor_id !== undefined, {
    message: "Provide actor (name) or actor_id."
  });

export const goalPatchSchema = z.object({
  status: z.enum(["IDENTIFIED", "IN_DESIGN", "PROMOTED", "REJECTED"]).optional()
});
