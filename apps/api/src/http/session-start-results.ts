import type { StoredSpecBranch, StoredWorkSession } from "../domain/entities/index.js";
import { problem } from "./signup-support.js";

export function sessionStartResponse(
  session: StoredWorkSession,
  keys: string[],
  warning?: { message: string; type: "UNKNOWN_AGENT_TYPE" },
  branch?: StoredSpecBranch
) {
  return {
    session,
    ...(branch === undefined ? {} : { branch }),
    ...(warning === undefined ? {} : { warnings: [warning] }),
    session_file: {
      path: ".vspec/session.json",
      session_id: session.id
    },
    suggested_next_actions: [
      ...keys.map((key) => ({
        command: `vspec usecase show ${key} --session ${session.id}`,
        reason: "Open the pinned use case revision."
      })),
      {
        command: "vspec session complete",
        reason: "Close the session when the work is done."
      }
    ]
  };
}

export function writeFailureProblem() {
  return problem(
    500,
    "Session creation failed",
    { created_branch: false, created_session: false },
    [
      {
        command: "vspec session start --retry",
        reason: "Retry after the failed transaction."
      }
    ]
  );
}
