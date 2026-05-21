import { Command, Flags } from "@oclif/core";

import { runSync } from "./sync.js";

type PullCliFlags = {
  "api-url"?: string;
  branch?: string;
  "dry-run"?: boolean;
  "project-id"?: string;
  root?: string;
  "session-cookie"?: string;
};

export class PullCommand extends Command {
  static override description = "Pull remote spec files into the workspace.";

  static override flags = {
    "api-url": Flags.string(),
    branch: Flags.string(),
    "dry-run": Flags.boolean(),
    "project-id": Flags.string(),
    root: Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(PullCommand);

    await runPull(parsed.flags, this.log.bind(this));
  }
}

export async function runPull(
  flags: PullCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  await runSync(flags, "pull", writeLine);
}
