import type { StoredWorkspace } from "../domain/entities/index.js";
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

    nextAvailableWorkspaceSlug(slug) {
      return Promise.resolve(nextAvailableSlug(slug, existingSlugs(workspacesById)));
    },

    saveWorkspace(workspace) {
      workspacesById.set(workspace.id, workspace);
      return Promise.resolve();
    },

    workspaceSlugExists(slug) {
      return Promise.resolve(existingSlugs(workspacesById).has(slug));
    }
  };
}

function existingSlugs(workspacesById: Map<string, StoredWorkspace>) {
  return new Set([...workspacesById.values()].map((workspace) => workspace.slug));
}

function nextAvailableSlug(slug: string, existingSlugs: Set<string>): string {
  let suffix = 2;
  let candidate = `${slug}-${String(suffix)}`;

  while (existingSlugs.has(candidate)) {
    suffix += 1;
    candidate = `${slug}-${String(suffix)}`;
  }

  return candidate;
}
