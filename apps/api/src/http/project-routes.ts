import type { FastifyInstance } from "fastify";
import {
  handleArchiveWorkspace,
  handleCreateProject,
  handleCreateProjectDefaultWorkspace,
  handleDeleteProject,
  handleListProjects,
  handleRenameProject,
  type ProjectRouteDeps
} from "./project-handlers.js";
import type { SignupState } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { SignupStore } from "../ports/signup-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

export function registerProjectRoutes(
  app: FastifyInstance,
  state: SignupState,
  signupStore: SignupStore | undefined,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  workspaceStore: WorkspaceStore
) {
  const deps: ProjectRouteDeps = {
    branchStore,
    membershipStore,
    projectStore,
    signupStore,
    state,
    workspaceStore
  };

  app.get("/v1/projects", (request, reply) => handleListProjects(request, reply, deps));
  app.post("/v1/projects", (request, reply) =>
    handleCreateProjectDefaultWorkspace(request, reply, deps)
  );
  app.post("/v1/workspaces/:workspaceId/projects", (request, reply) =>
    handleCreateProject(request, reply, deps)
  );
  app.patch("/v1/projects/:projectId", (request, reply) =>
    handleRenameProject(request, reply, deps)
  );
  app.delete("/v1/projects/:projectId", (request, reply) =>
    handleDeleteProject(request, reply, deps)
  );
  app.post("/__test/workspaces/:workspaceId/archive", (request, reply) =>
    handleArchiveWorkspace(request, reply, workspaceStore)
  );
}
