import { Command, Flags } from "@oclif/core";
import {
  sessionListResponseSchema,
  type SessionListResponse
} from "@vooster/contracts";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { readConfig, type VspecConfig } from "../config-store.js";
import { fetchJson } from "../http-client.js";

type StatusFlags = {
  format?: string;
};

export class StatusCommand extends Command {
  static override description = "Print local vspec context.";

  static override flags = {
    format: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(StatusCommand);
    await runStatus(parsed.flags, this.log.bind(this));
  }
}

export async function runStatus(
  flags: StatusFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const config = readConfig();

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: { config }
        }),
        null,
        2
      )
    );
    return Promise.resolve();
  }

  writeLine(`Project ${config.current_project_key ?? "none"}`);
  writeLine(
    `Workspace ${config.current_workspace_slug ?? config.current_workspace_id ?? "none"}`
  );
  writeLine("Branch main");
  writeLine("Session none");
  printSessionContext(await sessionContext(config), writeLine);
  writeLine('Next action vspec session start --intent "..." --pin <KEY-NNN>');
}

async function sessionContext(
  config: VspecConfig
): Promise<SessionListResponse | undefined> {
  if (
    config.api_url === undefined ||
    config.current_workspace_id === undefined ||
    config.session_token === undefined
  ) {
    return undefined;
  }
  const url = new URL("/v1/sessions", config.api_url);
  url.searchParams.set("workspace_id", config.current_workspace_id);
  if (config.current_project_id !== undefined) {
    url.searchParams.set("project_id", config.current_project_id);
  }

  try {
    const response = await fetchJson(url, {
      headers: { Cookie: sessionCookie(config.session_token) }
    });
    return sessionListResponseSchema.parse(response.body);
  } catch {
    return undefined;
  }
}

function printSessionContext(
  sessions: SessionListResponse | undefined,
  writeLine: (message: string) => void
): void {
  if (sessions === undefined) {
    writeLine("Active sessions run: vspec session list");
    writeLine("Locks run: vspec who <KEY-NNN>");
    return;
  }

  writeLine(`Active sessions ${String(sessions.total)}`);
  writeLine(`Total conflicts ${String(sessions.summary.total_conflicts)}`);
  for (const session of sessions.sessions) {
    writeLine(`Session ${session.id}`);
    writeLine(`Agent ${session.agent_type} ${session.agent_identifier}`);
    writeLine(`Intent ${session.intent}`);
    writeLine(`Pins ${session.pinned_keys.join(", ") || "none"}`);
    writeLine(`Branch ${session.branch_name ?? "none"}`);
    writeLine(`Locks ${String(session.lock_count)}`);
  }
}

function sessionCookie(token: string): string {
  return token.includes("vspec_session=") ? token : `vspec_session=${token}`;
}
