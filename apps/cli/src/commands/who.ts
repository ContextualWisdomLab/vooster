import { Args, Command, Flags } from "@oclif/core";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { requiredArgument, resolveContextFlag } from "../flag-values.js";
import { fetchJson } from "../http-client.js";

type WhoCliFlags = {
  "api-url"?: string;
  format?: string;
  "session-cookie"?: string;
};

type WhoFlags = {
  apiUrl: string;
  sessionCookie: string;
  usecaseId: string;
};

type WhoResponse = {
  locks: Array<{
    expires_at: string;
    held_by_session_id: null | string;
    held_by_user_id: string;
    id: string;
    lock_type: string;
  }>;
  merge_requests: Array<{
    conflict_count: number;
    id: string;
    source_branch_id: string;
    status: string;
  }>;
  sessions: Array<{
    agent_type: string;
    id: string;
    intent: string;
    markers?: string[];
  }>;
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    key: string;
  };
};

export class WhoCommand extends Command {
  static override description = "Show active sessions, locks, and merge requests for a use case.";

  static override args = {
    usecase: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    format: Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(WhoCommand);

    await runWho(parsed.flags, parsed.args.usecase, this.log.bind(this));
  }
}

export async function runWho(
  flags: WhoCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const whoFlags = whoFlagsFrom(flags, usecaseId);
  const response = await fetchJson(`${whoFlags.apiUrl}/v1/usecases/${whoFlags.usecaseId}/who`, {
    headers: {
      Cookie: whoFlags.sessionCookie
    }
  });
  const body = response.body as WhoResponse;

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({
      data: body,
      suggested_next_actions: body.suggested_next_actions
    }), null, 2));
    return;
  }

  writeLine(`UseCase ${body.usecase.key}`);
  writeLine(`Sessions ${String(body.sessions.length)}`);
  for (const session of body.sessions) {
    writeLine(`Session ${session.id}`);
    writeLine(`Agent ${session.agent_type}`);
    writeLine(`Intent ${session.intent}`);
    if ((session.markers ?? []).length > 0) {
      writeLine(`Markers ${(session.markers ?? []).join(", ")}`);
    }
  }
  writeLine(`Locks ${String(body.locks.length)}`);
  for (const lock of body.locks) {
    writeLine(`Lock ${lock.id}`);
    writeLine(`Type ${lock.lock_type}`);
    writeLine(`Holder ${lock.held_by_session_id ?? lock.held_by_user_id}`);
    writeLine(`Expires at ${lock.expires_at}`);
  }
  writeLine(`Merge requests ${String(body.merge_requests.length)}`);
  for (const merge of body.merge_requests) {
    writeLine(`Merge request ${merge.id}`);
    writeLine(`Source branch ${merge.source_branch_id}`);
    writeLine(`Status ${merge.status}`);
    writeLine(`Conflicts ${String(merge.conflict_count)}`);
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function whoFlagsFrom(flags: WhoCliFlags, usecaseId: string | undefined): WhoFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}
