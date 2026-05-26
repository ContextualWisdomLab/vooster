import {
  syncProjectParamsSchema,
  syncPullRequestSchema,
  syncPushRequestSchema,
  type SyncPushFile
} from "@vooster/contracts";

export const pullSchema = syncPullRequestSchema;
export const pushSchema = syncPushRequestSchema;

export function projectIdFrom(params: unknown) {
  return syncProjectParamsSchema.parse(params).projectId;
}

export function syncFileInput(file: SyncPushFile) {
  return {
    baseRevision: file.base_revision,
    content: file.content,
    path: file.path
  };
}
