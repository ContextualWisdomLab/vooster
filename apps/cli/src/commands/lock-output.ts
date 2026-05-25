import { buildAgentEnvelope } from "../agent-envelope.js";

export type LockResponse = {
  lock: {
    auto_release: boolean;
    expires_at: string;
    held_by_session_id: null | string;
    held_by_user_id: string;
    id: string;
    lock_type: string;
    target_id: string;
  };
  suggested_next_actions?: Array<{
    command: string;
  }>;
};

type LockOutputFlags = {
  format?: string;
};

export function writeLockOutput(
  flags: LockOutputFlags,
  body: LockResponse,
  sessionId: string | undefined,
  writeLine: (message: string) => void
): void {
  const suggestedNextActions = body.suggested_next_actions ?? [];
  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: body,
          context: { session_id: sessionId ?? null },
          suggested_next_actions: suggestedNextActions
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`Lock ${body.lock.id}`);
  writeLine(`Type ${body.lock.lock_type}`);
  writeLine(`Target ${body.lock.target_id}`);
  writeLine(`Holder ${body.lock.held_by_session_id ?? body.lock.held_by_user_id}`);
  writeLine(`Auto release ${String(body.lock.auto_release)}`);
  writeLine(`Expires at ${body.lock.expires_at}`);
  for (const action of suggestedNextActions) {
    writeLine(action.command);
  }
}
