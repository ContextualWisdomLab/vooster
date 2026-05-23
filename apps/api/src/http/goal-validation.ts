import { z } from "zod";

export const goalRequestSchema = z.object({
  actor_id: z.string().min(1),
  description: z.string(),
  level: z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]),
  priority: z.enum(["P0", "P1", "P2", "P3"])
});

export const goalPatchSchema = z.object({
  status: z.enum(["IDENTIFIED", "IN_DESIGN", "PROMOTED", "REJECTED"]).optional()
});
