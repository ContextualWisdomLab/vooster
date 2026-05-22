import { Command, Flags } from "@oclif/core";

import { runSync } from "./sync.js";

type PushCliFlags = {
  "api-url"?: string;
  branch?: string;
  "dry-run"?: boolean;
  format?: string;
  "project-id"?: string;
  root?: string;
  "session-cookie"?: string;
};

export class PushCommand extends Command {
  static override description = "Push local spec files to the server.";

  static override flags = {
    "api-url": Flags.string(),
    branch: Flags.string(),
    "dry-run": Flags.boolean(),
    format: Flags.string(),
    "project-id": Flags.string(),
    root: Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(PushCommand);

    await runPush(parsed.flags, this.log.bind(this));
  }
}

export async function runPush(
  flags: PushCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  await runSync(flags, "push", writeLine);
}
