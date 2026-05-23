import { Args, Command, Flags } from "@oclif/core";

import { buildAgentEnvelope } from "../agent-envelope.js";
import {
  optionalFlag,
  requiredArgument,
  requiredFlag,
  resolveContextFlag
} from "../flag-values.js";
import { postJson } from "../http-client.js";

type LockCliFlags = {
  "api-url"?: string;
  format?: string;
  reason?: string;
  session?: string;
  "session-cookie"?: string;
  ttl?: string;
  type?: string;
};

type LockCreateFlags = {
  apiUrl: string;
  reason: string;
  sessionCookie: string;
  sessionId: string | undefined;
  targetId: string;
  ttlMinutes: number;
  type: "HARD" | "SEMANTIC" | "SOFT";
};

type LockRenewFlags = {
  apiUrl: string;
  lockId: string;
  sessionCookie: string;
  sessionId: string | undefined;
  ttlMinutes: number;
};

type LockResponse = {
  lock: {
    auto_release: boolean;
    expires_at: string;
    held_by_session_id: null | string;
    held_by_user_id: string;
    id: string;
    lock_type: string;
    target_id: string;
  };
  suggested_next_actions?: Array<{
    command: string;
  }>;
};

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
  action: "acquire" | "renew",
  targetId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
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

function writeLockOutput(
  flags: LockCliFlags,
  body: LockResponse,
  sessionId: string | undefined,
  writeLine: (message: string) => void
): void {
  const suggestedNextActions = body.suggested_next_actions ?? [];
  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: body,
          context: { session_id: sessionId ?? null },
          suggested_next_actions: suggestedNextActions
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`Lock ${body.lock.id}`);
  writeLine(`Type ${body.lock.lock_type}`);
  writeLine(`Target ${body.lock.target_id}`);
  writeLine(`Holder ${body.lock.held_by_session_id ?? body.lock.held_by_user_id}`);
  writeLine(`Auto release ${String(body.lock.auto_release)}`);
  writeLine(`Expires at ${body.lock.expires_at}`);
  for (const action of suggestedNextActions) {
    writeLine(action.command);
  }
}

function lockCreateFlagsFrom(
  flags: LockCliFlags,
  targetId: string | undefined
): LockCreateFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    reason: requiredFlag(flags, "reason"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    sessionId: optionalFlag(flags, "session"),
    targetId: requiredArgument(targetId, "usecase-id"),
    ttlMinutes: ttlMinutes(flags.ttl),
    type: lockType(requiredFlag(flags, "type"))
  };
}

function lockRenewFlagsFrom(
  flags: LockCliFlags,
  lockId: string | undefined
): LockRenewFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    lockId: requiredArgument(lockId, "lock-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    sessionId: optionalFlag(flags, "session"),
    ttlMinutes: ttlMinutes(flags.ttl)
  };
}

function lockType(rawType: string): "HARD" | "SEMANTIC" | "SOFT" {
  const type = rawType.toUpperCase();
  if (type === "HARD" || type === "SEMANTIC" || type === "SOFT") {
    return type;
  }

  throw new Error("Lock type must be HARD, SEMANTIC, or SOFT.");
}

function ttlMinutes(rawTtl: string | undefined): number {
  if (rawTtl === undefined) {
    return 30;
  }
  const parsed = Number(rawTtl);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  throw new Error("Lock TTL must be a positive number.");
}
