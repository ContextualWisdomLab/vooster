import type { StoredProject } from "../domain/entities/index.js";

export type ProjectStore = {
  findProjectById: (projectId: string) => Promise<StoredProject | undefined>;
  findProjectByWorkspaceAndKey: (
    workspaceId: string,
    key: string
  ) => Promise<StoredProject | undefined>;
  listProjectsForWorkspace: (workspaceId: string) => Promise<StoredProject[]>;
  saveProject: (project: StoredProject) => Promise<void>;
};
