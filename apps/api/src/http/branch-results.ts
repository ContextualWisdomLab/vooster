import type { FastifyReply } from "fastify";
import type { CreateBranchResult } from "../application/branches.js";
import { problem } from "./signup-support.js";

export function sendCreateBranchResult(
  reply: FastifyReply,
  result: CreateBranchResult
) {
  switch (result.status) {
    case "ACCESS_DENIED":
      return reply
        .code(403)
        .send(problem(403, "Contact the workspace owner for access"));
    case "READ_ONLY":
      return reply.code(403).send(
        problem(403, "Editor role required to create branches", {}, [
          {
            command: "vspec member list",
            reason: "Find a workspace editor or owner who can create branches."
          }
        ])
      );
    case "NON_MAIN_BASE":
      return reply.code(422).send(
        problem(422, "MVP supports single-level branches from main only", {}, [
          {
            command: `vspec branch create ${result.branchName} --from main`,
            reason: "Create MVP branches from main only."
          }
        ])
      );
    case "NAME_COLLISION":
      return reply.code(422).send(
        problem(
          422,
          "Branch name is already in use",
          { suggested_name: result.suggestedName },
          [
            {
              command: `vspec branch create ${result.suggestedName}`,
              reason: "Create the branch with an available name."
            }
          ]
        )
      );
    case "PROJECT_BRANCH_NOT_FOUND":
      return reply.code(404).send(problem(404, "Project branch not found"));
    case "SNAPSHOT_FAILED":
      return reply.code(500).send(
        problem(500, "Branch snapshot failed", { exit_code: result.exitCode }, [
          {
            command: `vspec branch create ${result.branchName} --retry`,
            reason: "Retry after the failed branch snapshot."
          }
        ])
      );
    case "CREATED":
      return reply.code(201).send({
        branch: result.branch,
        ...(result.warnings.length === 0 ? {} : { warnings: result.warnings }),
        suggested_next_actions: result.suggestedNextActions
      });
  }
}
