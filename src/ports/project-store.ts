import type { StoredProject } from "../http/signup-types.js";

export type ProjectStore = {
  findProjectById: (projectId: string) => Promise<StoredProject | undefined>;
  findProjectByWorkspaceAndKey: (
    workspaceId: string,
    key: string
  ) => Promise<StoredProject | undefined>;
  saveProject: (project: StoredProject) => Promise<void>;
};
