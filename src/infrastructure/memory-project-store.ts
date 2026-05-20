import type { StoredProject } from "../domain/entities/index.js";
import type { ProjectStore } from "../ports/project-store.js";

export function createMemoryProjectStore(): ProjectStore {
  const projects = new Map<string, StoredProject>();

  return {
    findProjectById(projectId) {
      return Promise.resolve(projects.get(projectId));
    },

    findProjectByWorkspaceAndKey(workspaceId, key) {
      return Promise.resolve(
        [...projects.values()].find(
          (project) => project.workspace_id === workspaceId && project.key === key
        )
      );
    },

    listProjectsForWorkspace(workspaceId) {
      return Promise.resolve(
        [...projects.values()].filter((project) => project.workspace_id === workspaceId)
      );
    },

    saveProject(project) {
      projects.set(project.id, project);
      return Promise.resolve();
    }
  };
}
