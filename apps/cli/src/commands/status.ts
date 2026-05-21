import { Command } from "@oclif/core";

import { readConfig } from "../config-store.js";

export class StatusCommand extends Command {
  static override description = "Print local vspec context.";

  override async run(): Promise<void> {
    await Promise.resolve();
    runStatus({}, this.log.bind(this));
  }
}

export function runStatus(
  _flags: Record<string, unknown>,
  writeLine: (message: string) => void
): void {
  const config = readConfig();
  writeLine(`api_url ${config.api_url ?? ""}`);
  writeLine(`current_workspace_id ${config.current_workspace_id ?? ""}`);
  writeLine(`current_project_key ${config.current_project_key ?? ""}`);
  writeLine(`profile ${config.profile ?? ""}`);
}
