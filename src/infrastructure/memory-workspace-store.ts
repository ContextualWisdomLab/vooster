import type { WorkspaceStore } from "../ports/workspace-store.js";

export function createMemoryWorkspaceStore(): WorkspaceStore {
  const archivedWorkspaces = new Map<string, string>();

  return {
    archiveWorkspace(workspaceId, archivedAt) {
      archivedWorkspaces.set(workspaceId, archivedAt);
      return Promise.resolve();
    },

    isWorkspaceArchived(workspaceId) {
      return Promise.resolve(archivedWorkspaces.has(workspaceId));
    }
  };
}
