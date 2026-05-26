import type { FastifyReply } from "fastify";
import type { SyncPushResult } from "../application/sync-files.js";
import { problem } from "./signup-support.js";
import { networkFailureProblem } from "./sync-result-support.js";

export function sendSyncPushResult(reply: FastifyReply, result: SyncPushResult) {
  switch (result.status) {
    case "FORBIDDEN":
      return reply.code(403).send(syncAccessProblem());
    case "NETWORK_FAILURE":
      return reply.code(503).send(networkFailureProblem(result.files));
    case "PUSHED":
      return reply.send({
        cache: { entries: result.cacheEntries },
        results: result.results,
        suggested_next_actions: result.suggestedNextActions
      });
  }
}

export function syncAccessProblem() {
  return problem(403, "Not authorized to sync files", { exit_code: 3 }, [
    {
      command: "vspec login",
      reason: "Authenticate before syncing files."
    },
    {
      command: "vspec api-key create",
      reason: "Issue a new agent API key if non-interactive auth failed."
    }
  ]);
}
