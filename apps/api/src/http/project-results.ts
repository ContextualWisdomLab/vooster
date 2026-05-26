import type { FastifyReply } from "fastify";
import type {
  DefaultWorkspaceProjectResult,
  ProjectCreationResult,
  ProjectDeletionResult,
  ProjectRenameResult
} from "../application/projects.js";
import { problem } from "./signup-support.js";

export function sendProjectCreationResult(
  reply: FastifyReply,
  result: ProjectCreationResult | DefaultWorkspaceProjectResult
) {
  switch (result.status) {
    case "CREATED":
      return reply.code(201).send({
        default_branch: result.defaultBranch,
        project: result.project,
        recommended_next_command: "vspec actor create"
      });
    case "FORBIDDEN":
      return reply.code(403).send(
        problem(403, "Request an invitation to this workspace", {}, [
          {
            command: "vspec workspace invitations request",
            reason: "Ask a workspace owner for access."
          }
        ])
      );
    case "WORKSPACE_ARCHIVED":
      return reply.code(409).send(problem(409, "Workspace has been archived"));
    case "DUPLICATE_KEY":
      return reply.code(422).send(
        problem(
          422,
          "Project key is already in use",
          {
            existing_project: {
              id: result.existingProject.id,
              key: result.existingProject.key,
              name: result.existingProject.name
            }
          },
          [
            {
              command: `vspec project show ${result.existingProject.key}`,
              reason: "Verify whether the existing project is the intended target."
            }
          ]
        )
      );
    case "CREATE_FAILED":
      return reply.code(500).send(
        problem(500, "Project creation failed", {
          request_id: result.requestId
        })
      );
    case "NO_WORKSPACE":
      return reply.code(409).send(
        problem(409, "No workspace available", {}, [
          {
            command: "vspec workspace create",
            reason: "Create a workspace before creating a project."
          }
        ])
      );
  }
}

export function sendProjectRenameResult(
  reply: FastifyReply,
  result: ProjectRenameResult
) {
  switch (result.status) {
    case "RENAMED":
      return reply.send({ project: result.project });
    case "FORBIDDEN":
      return reply.code(403).send(problem(403, "Not a member of this workspace"));
    case "NOT_FOUND":
      return reply.code(404).send(problem(404, "Project not found"));
    case "WORKSPACE_ARCHIVED":
      return reply.code(409).send(problem(409, "Workspace has been archived"));
  }
}

export function sendProjectDeletionResult(
  reply: FastifyReply,
  result: ProjectDeletionResult
) {
  switch (result.status) {
    case "DELETED":
      return reply.code(204).send();
    case "FORBIDDEN":
      return reply.code(403).send(problem(403, "Not a member of this workspace"));
    case "NOT_FOUND":
      return reply.code(404).send(problem(404, "Project not found"));
    case "WORKSPACE_ARCHIVED":
      return reply.code(409).send(problem(409, "Workspace has been archived"));
    case "HAS_DEPENDENCIES":
      return reply.code(409).send(
        problem(409, "Project still has use cases, actors, or other data", {}, [
          {
            command: "vspec project archive",
            reason: "Archive instead of deleting when the project has data."
          }
        ])
      );
  }
}
