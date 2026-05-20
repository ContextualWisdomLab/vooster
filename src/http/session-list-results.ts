import type { FastifyReply } from "fastify";
import type { SessionListResult } from "../application/session-list.js";
import { problem } from "./signup-support.js";

export function sendSessionListResult(reply: FastifyReply, result: SessionListResult) {
  switch (result.status) {
    case "LISTED":
      return reply.send(result.snapshot);
    case "FORBIDDEN":
      return reply.code(403).send(workspaceMembershipProblem());
  }
}

export function sessionListEvent(result: SessionListResult): string | undefined {
  return result.status === "LISTED"
    ? `event: snapshot\ndata: ${JSON.stringify(result.snapshot)}\n\n`
    : undefined;
}

export function workspaceMembershipProblem() {
  return problem(403, "Workspace membership required", {}, [
    { command: "vspec workspace list", reason: "Choose a workspace you can access." }
  ]);
}
