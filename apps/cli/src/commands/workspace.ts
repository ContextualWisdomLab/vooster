import { Args, Command, Flags } from "@oclif/core";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { writeConfig } from "../config-store.js";
import { requiredArgument } from "../flag-values.js";

type WorkspaceFlags = {
  format?: string;
};

export class WorkspaceCommand extends Command {
  static override description = "Manage workspaces.";

  static override args = {
    action: Args.string(),
    slug: Args.string()
  };

  static override flags = {
    format: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(WorkspaceCommand);
    runWorkspace(
      parsed.flags,
      parsed.args.action,
      parsed.args.slug,
      this.log.bind(this)
    );
  }
}

export function runWorkspace(
  flags: WorkspaceFlags,
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

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: {
            config: {
              current_workspace_id: workspaceSlug,
              current_workspace_slug: workspaceSlug
            },
            workspace: {
              id: workspaceSlug,
              slug: workspaceSlug
            }
          }
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`Workspace ${workspaceSlug}`);
}
