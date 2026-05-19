import type { StoredWorkspace } from "../http/signup-types.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

export function createMemoryWorkspaceStore(): WorkspaceStore {
  const workspacesById = new Map<string, StoredWorkspace>();
  const archivedWorkspaces = new Map<string, string>();

  return {
    archiveWorkspace(workspaceId, archivedAt) {
      archivedWorkspaces.set(workspaceId, archivedAt);
      return Promise.resolve();
    },

    findWorkspaceById(workspaceId) {
      return Promise.resolve(workspacesById.get(workspaceId));
    },

    isWorkspaceArchived(workspaceId) {
      return Promise.resolve(archivedWorkspaces.has(workspaceId));
    },

    saveWorkspace(workspace) {
      workspacesById.set(workspace.id, workspace);
      return Promise.resolve();
    }
  };
}
