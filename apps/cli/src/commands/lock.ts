import { Args, Command, Flags } from "@oclif/core";

import { deleteJson, postJson } from "../http-client.js";
import {
  lockCreateFlagsFrom,
  lockReleaseFlagsFrom,
  lockRenewFlagsFrom,
  type LockCliFlags
} from "./lock-flags.js";
import { writeLockOutput, type LockResponse } from "./lock-output.js";

export class LockCommand extends Command {
  static override description = "Create a use case lock.";

  static override args = {
    usecase: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    format: Flags.string(),
    reason: Flags.string(),
    session: Flags.string(),
    "session-cookie": Flags.string(),
    ttl: Flags.string(),
    type: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(LockCommand);

    await runLock(parsed.flags, "acquire", parsed.args.usecase, this.log.bind(this));
  }
}

export async function runLock(
  flags: LockCliFlags,
  action: "acquire" | "release" | "renew",
  targetId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "release") {
    await releaseLock(flags, targetId, writeLine);
    return;
  }
  if (action === "renew") {
    await renewLock(flags, targetId, writeLine);
    return;
  }

  const lockFlags = lockCreateFlagsFrom(flags, targetId);
  const response = await postJson(
    `${lockFlags.apiUrl}/v1/locks`,
    {
      lock_type: lockFlags.type,
      reason: lockFlags.reason,
      target_id: lockFlags.targetId,
      target_type: "USECASE",
      ttl_minutes: lockFlags.ttlMinutes
    },
    {
      Cookie: lockFlags.sessionCookie,
      ...(lockFlags.sessionId === undefined
        ? {}
        : { "X-Vspec-Session": lockFlags.sessionId })
    }
  );
  const body = response.body as LockResponse;

  writeLockOutput(flags, body, lockFlags.sessionId, writeLine);
}

async function renewLock(
  flags: LockCliFlags,
  lockId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const renewFlags = lockRenewFlagsFrom(flags, lockId);
  const response = await postJson(
    `${renewFlags.apiUrl}/v1/locks/${renewFlags.lockId}/renew`,
    { ttl_minutes: renewFlags.ttlMinutes },
    {
      Cookie: renewFlags.sessionCookie,
      ...(renewFlags.sessionId === undefined
        ? {}
        : { "X-Vspec-Session": renewFlags.sessionId })
    }
  );
  const body = response.body as LockResponse;

  writeLockOutput(flags, body, renewFlags.sessionId, writeLine);
}

async function releaseLock(
  flags: LockCliFlags,
  lockId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const releaseFlags = lockReleaseFlagsFrom(flags, lockId);
  const response = await deleteJson(
    `${releaseFlags.apiUrl}/v1/locks/${releaseFlags.lockId}`,
    {
      Cookie: releaseFlags.sessionCookie,
      ...(releaseFlags.sessionId === undefined
        ? {}
        : { "X-Vspec-Session": releaseFlags.sessionId })
    }
  );
  const body = response.body as LockResponse;

  writeLockOutput(flags, body, releaseFlags.sessionId, writeLine);
}
