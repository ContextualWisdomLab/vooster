import type { StoredWorkspace } from "../http/signup-types.js";

export type WorkspaceStore = {
  archiveWorkspace: (workspaceId: string, archivedAt: string) => Promise<void>;
  findWorkspaceById: (workspaceId: string) => Promise<StoredWorkspace | undefined>;
  isWorkspaceArchived: (workspaceId: string) => Promise<boolean>;
  saveWorkspace: (workspace: StoredWorkspace) => Promise<void>;
};
