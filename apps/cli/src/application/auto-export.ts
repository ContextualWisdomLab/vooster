import { writeSyncFile } from "../commands/sync-files.js";
import type { AffectedFile } from "../domain/envelope.js";
import { postJson } from "../infrastructure/http/client.js";
import { writeSyncState } from "../infrastructure/local-state/sync-state.js";

export type AutoExportConfig = {
  apiUrl: string;
  branch: string;
  cookie: string;
  projectId: string;
  root: string;
};

type SyncPullFile = {
  content: string;
  path: string;
  revision: string;
};

type SyncPullResponse = {
  cursor?: string;
  files?: SyncPullFile[];
};

export async function autoExport(config: AutoExportConfig): Promise<AffectedFile[]> {
  const response = await postJson(
    `${config.apiUrl}/v1/projects/${config.projectId}/sync/pull`,
    { branch: config.branch },
    { Cookie: config.cookie }
  );
  const body = (response.body ?? {}) as SyncPullResponse;
  const files = Array.isArray(body.files) ? body.files.filter(isPullFile) : [];

  await Promise.all(
    files.map((file) => writeSyncFile(config.root, file.path, file.content))
  );
  if (typeof body.cursor === "string") {
    await writeSyncState(config.root, { cursor: body.cursor });
  }

  return files.map((file) => ({ path: file.path, revision: file.revision }));
}

function isPullFile(value: unknown): value is SyncPullFile {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { content?: unknown; path?: unknown; revision?: unknown };
  return (
    typeof candidate.content === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.revision === "string"
  );
}
