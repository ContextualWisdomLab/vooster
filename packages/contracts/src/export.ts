import { z } from "zod";

export const usecaseExportParamsSchema = z.object({
  id: z.string().min(1)
});

export const usecaseExportRequestSchema = z.object({
  existing_file_content: z.string().optional(),
  force: z.boolean().default(false),
  output_path: z.string().optional(),
  revision_id: z.string().optional()
});

export const gherkinExportResponseSchema = z.string();
export const markdownExportResponseSchema = z.string();

export type UsecaseExportRequest = z.infer<typeof usecaseExportRequestSchema>;
export type GherkinExportResponse = z.infer<typeof gherkinExportResponseSchema>;
export type MarkdownExportResponse = z.infer<typeof markdownExportResponseSchema>;
