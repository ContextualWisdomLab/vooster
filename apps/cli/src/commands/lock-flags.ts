import {
  optionalFlag,
  requiredArgument,
  requiredFlag,
  resolveContextFlag
} from "../flag-values.js";

export type LockCliFlags = {
  "api-url"?: string;
  format?: string;
  reason?: string;
  session?: string;
  "session-cookie"?: string;
  ttl?: string;
  type?: string;
};

export type LockCreateFlags = {
  apiUrl: string;
  reason: string;
  sessionCookie: string;
  sessionId: string | undefined;
  targetId: string;
  ttlMinutes: number;
  type: "HARD" | "SEMANTIC" | "SOFT";
};

export type LockReleaseFlags = {
  apiUrl: string;
  lockId: string;
  sessionCookie: string;
  sessionId: string | undefined;
};

export type LockRenewFlags = LockReleaseFlags & {
  ttlMinutes: number;
};

export function lockCreateFlagsFrom(
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

export function lockRenewFlagsFrom(
  flags: LockCliFlags,
  lockId: string | undefined
): LockRenewFlags {
  return {
    ...lockReleaseFlagsFrom(flags, lockId),
    ttlMinutes: ttlMinutes(flags.ttl)
  };
}

export function lockReleaseFlagsFrom(
  flags: LockCliFlags,
  lockId: string | undefined
): LockReleaseFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    lockId: requiredArgument(lockId, "lock-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    sessionId: optionalFlag(flags, "session")
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
