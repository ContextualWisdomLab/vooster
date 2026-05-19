import type { StoredProject } from "../http/signup-types.js";
import type { ProjectStore } from "../ports/project-store.js";

export function createMemoryProjectStore(
  projectsById: Map<string, StoredProject>
): ProjectStore {
  return {
    findProjectById(projectId) {
      return Promise.resolve(projectsById.get(projectId));
    },

    findProjectByWorkspaceAndKey(workspaceId, key) {
      return Promise.resolve(
        [...projectsById.values()].find(
          (project) => project.workspace_id === workspaceId && project.key === key
        )
      );
    },

    saveProject(project) {
      projectsById.set(project.id, project);
      return Promise.resolve();
    }
  };
}
