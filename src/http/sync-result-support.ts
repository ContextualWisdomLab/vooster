import type { StoredUseCase } from "./signup-types.js";
import { usecaseMarkdown } from "./sync-markdown.js";

export type SyncResult = {
  conflict_content?: string;
  current_revision: string;
  impact?: { entity_id: string; severity: "BREAKING" };
  path: string;
  status: "CONFLICT" | "OK" | "SKIPPED";
};

type ConflictFile = {
  content: string;
  path: string;
};

export function cacheEntries(results: SyncResult[]) {
  return results.map((result) => ({
    path: result.path,
    revision: result.current_revision,
    status: result.status === "CONFLICT" ? "UNRESOLVED" : "SYNCED"
  }));
}

export function staleFileConflict(usecase: StoredUseCase, file: ConflictFile): SyncResult {
  return {
    conflict_content: conflictContent(file.content, usecaseMarkdown(usecase), usecase),
    current_revision: usecase.current_revision_id,
    impact: { entity_id: usecase.id, severity: "BREAKING" },
    path: file.path,
    status: "CONFLICT"
  };
}

export function suggestedSyncActions(results: SyncResult[]) {
  return results.some((result) => result.status === "CONFLICT")
    ? conflictActions()
    : syncedActions();
}

function conflictContent(local: string, remote: string, usecase: StoredUseCase) {
  return `<<<<<<< local\n${local}\n=======\n${remote}\n>>>>>>> remote (${usecase.current_revision_id})\n`;
}

function syncedActions() {
  return [
    {
      command: "vspec pull",
      reason: "Refresh local files after successful push."
    }
  ];
}

function conflictActions() {
  return [
    {
      command: "vspec diff",
      reason: "Inspect the server and local changes before resolving the conflict."
    },
    {
      command: "vspec push",
      reason: "Push again after removing conflict markers."
    }
  ];
}
