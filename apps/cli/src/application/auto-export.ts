import { syncPullResponseSchema } from "@vooster/contracts";

import { syncFileContentWithRevision, writeSyncFile } from "../commands/sync-files.js";
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

export async function autoExport(config: AutoExportConfig): Promise<AffectedFile[]> {
  const response = await postJson(
    `${config.apiUrl}/v1/projects/${config.projectId}/sync/pull`,
    { branch: config.branch },
    { Cookie: config.cookie }
  );
  const body = syncPullResponseSchema.parse(response.body);
  const files = body.files;

  await Promise.all(
    files.map((file) =>
      writeSyncFile(
        config.root,
        file.path,
        syncFileContentWithRevision(file.content, file.revision)
      )
    )
  );
  await writeSyncState(config.root, { cursor: body.cursor });

  return files.map((file) => ({ path: file.path, revision: file.revision }));
}
