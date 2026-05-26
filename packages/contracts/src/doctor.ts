import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const doctorQuerySchema = z.object({
  project_id: z.string().min(1).optional(),
  usecase: z.string().min(1).optional()
});

export const doctorCheckSchema = z.object({
  id: z.string(),
  message: z.string(),
  status: z.enum(["fail", "pass", "warning"])
});

export const doctorSuccessResponseSchema = z.object({
  checks: z.array(doctorCheckSchema),
  scope: z.object({
    project_id: z.string(),
    usecase: z
      .object({
        id: z.string(),
        key: z.string(),
        title: z.string()
      })
      .optional()
  }),
  status: z.enum(["issues_found", "ok"]),
  suggested_next_actions: z.array(suggestedNextActionSchema)
});

export type DoctorQuery = z.infer<typeof doctorQuerySchema>;
export type DoctorCheck = z.infer<typeof doctorCheckSchema>;
export type DoctorSuccessResponse = z.infer<typeof doctorSuccessResponseSchema>;
