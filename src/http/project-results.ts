import type { FastifyReply } from "fastify";
import type { ProjectCreationResult } from "../application/projects.js";
import { problem } from "./signup-support.js";

export function sendProjectCreationResult(
  reply: FastifyReply,
  result: ProjectCreationResult
) {
  switch (result.status) {
    case "CREATED":
      return reply.code(201).send({
        default_branch: result.defaultBranch,
        project: result.project,
        recommended_next_command: "vspec actor define"
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
  }
}
