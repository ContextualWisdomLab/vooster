export type WorkspaceStore = {
  archiveWorkspace: (workspaceId: string, archivedAt: string) => Promise<void>;
  isWorkspaceArchived: (workspaceId: string) => Promise<boolean>;
};
