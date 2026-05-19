import type { StoredWorkspace } from "../http/signup-types.js";

export type WorkspaceStore = {
  archiveWorkspace: (workspaceId: string, archivedAt: string) => Promise<void>;
  findWorkspaceById: (workspaceId: string) => Promise<StoredWorkspace | undefined>;
  isWorkspaceArchived: (workspaceId: string) => Promise<boolean>;
  nextAvailableWorkspaceSlug: (slug: string) => Promise<string>;
  saveWorkspace: (workspace: StoredWorkspace) => Promise<void>;
  workspaceSlugExists: (slug: string) => Promise<boolean>;
};
