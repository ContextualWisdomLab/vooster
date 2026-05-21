import { Args, Command } from "@oclif/core";

import { writeConfig } from "../config-store.js";
import { requiredArgument } from "../flag-values.js";

export class WorkspaceCommand extends Command {
  static override description = "Manage workspaces.";

  static override args = {
    action: Args.string(),
    slug: Args.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(WorkspaceCommand);
    runWorkspace(parsed.flags, parsed.args.action, parsed.args.slug, this.log.bind(this));
  }
}

export function runWorkspace(
  _flags: Record<string, unknown>,
  action: string | undefined,
  slug: string | undefined,
  writeLine: (message: string) => void
): void {
  if (action !== "switch") {
    throw new Error("Missing workspace action.");
  }

  const workspaceSlug = requiredArgument(slug, "workspace slug");
  writeConfig({
    current_workspace_id: workspaceSlug,
    current_workspace_slug: workspaceSlug
  });
  writeLine(`Workspace ${workspaceSlug}`);
}
