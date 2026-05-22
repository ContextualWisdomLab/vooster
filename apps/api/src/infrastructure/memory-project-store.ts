import type { StoredProject } from "../domain/entities/index.js";
import type { ProjectStore } from "../ports/project-store.js";

export function createMemoryProjectStore(): ProjectStore {
  const projects = new Map<string, StoredProject>();

  return {
    deleteProject(projectId) {
      if (!projects.has(projectId)) {
        return Promise.resolve("NOT_FOUND" as const);
      }
      projects.delete(projectId);
      return Promise.resolve("DELETED" as const);
    },

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
    },

    updateProjectName(projectId, name) {
      const project = projects.get(projectId);
      if (project === undefined) {
        return Promise.resolve(undefined);
      }
      const updated: StoredProject = { ...project, name };
      projects.set(projectId, updated);
      return Promise.resolve(updated);
    }
  };
}
