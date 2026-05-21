import { Command, Flags } from "@oclif/core";

import { readConfig, writeConfig } from "../config-store.js";
import { resolveContextFlag } from "../flag-values.js";

type LogoutFlags = {
  "api-url"?: string;
  "session-cookie"?: string;
};

export class LogoutCommand extends Command {
  static override description = "Log out and clear local credentials.";

  static override flags = {
    "api-url": Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(LogoutCommand);
    await runLogout(parsed.flags, this.log.bind(this));
  }
}

export async function runLogout(
  flags: LogoutFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const apiUrl = resolveContextFlag(flags, "api-url");
  const sessionCookie = resolveContextFlag(flags, "session-cookie");
  const response = await fetch(`${apiUrl}/v1/auth/logout`, {
    headers: {
      Cookie: sessionCookie
    },
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`API request failed with ${String(response.status)}.`);
  }

  writeConfig({
    ...readConfig(),
    session_token: undefined
  });
  writeLine("Logged out");
}
