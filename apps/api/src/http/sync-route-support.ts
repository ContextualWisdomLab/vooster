import { z } from "zod";

export const pullSchema = z.object({
  branch: z.string().default("main"),
  since: z.string().optional()
});

export const pushSchema = z.object({
  branch: z.string().default("main"),
  dry_run: z.boolean().default(false),
  files: z
    .array(
      z.object({
        base_revision: z.string().min(1),
        content: z.string().min(1),
        path: z.string().min(1)
      })
    )
    .min(1),
  simulate_network_failure: z.boolean().default(false)
});

type PushFile = z.infer<typeof pushSchema>["files"][number];

export function projectIdFrom(params: unknown) {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}

export function syncFileInput(file: PushFile) {
  return {
    baseRevision: file.base_revision,
    content: file.content,
    path: file.path
  };
}
