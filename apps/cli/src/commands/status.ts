import { Command, Flags } from "@oclif/core";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { readConfig } from "../config-store.js";

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
    runStatus(parsed.flags, this.log.bind(this));
  }
}

export function runStatus(
  flags: StatusFlags,
  writeLine: (message: string) => void
): void {
  const config = readConfig();

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({
      data: { config }
    }), null, 2));
    return;
  }

  writeLine(`api_url ${config.api_url ?? ""}`);
  writeLine(`current_workspace_id ${config.current_workspace_id ?? ""}`);
  writeLine(`current_project_key ${config.current_project_key ?? ""}`);
  writeLine(`profile ${config.profile ?? ""}`);
}
