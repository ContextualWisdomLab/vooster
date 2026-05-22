import type { StoredProject } from "../domain/entities/index.js";

export type ProjectStore = {
  deleteProject: (projectId: string) => Promise<DeleteProjectOutcome>;
  findProjectById: (projectId: string) => Promise<StoredProject | undefined>;
  findProjectByWorkspaceAndKey: (
    workspaceId: string,
    key: string
  ) => Promise<StoredProject | undefined>;
  listProjectsForWorkspace: (workspaceId: string) => Promise<StoredProject[]>;
  saveProject: (project: StoredProject) => Promise<void>;
  updateProjectName: (
    projectId: string,
    name: string
  ) => Promise<StoredProject | undefined>;
};

export type DeleteProjectOutcome = "DELETED" | "HAS_DEPENDENCIES" | "NOT_FOUND";
