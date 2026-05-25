import {
  optionalFlag,
  requiredArgument,
  requiredFlag,
  resolveContextFlag
} from "../flag-values.js";

export type UsecaseCliFlags = {
  "actor-id"?: string;
  "api-url"?: string;
  branch?: string;
  cursor?: string;
  "dry-run"?: boolean;
  field?: string;
  format?: string;
  force?: boolean;
  interest?: string;
  level?: string;
  limit?: string;
  "primary-actor"?: string;
  "project-id"?: string;
  "protection-mechanism"?: string;
  q?: string;
  revision?: string;
  root?: string;
  session?: string;
  "session-cookie"?: string;
  stakeholder?: string;
  status?: string;
  title?: string;
  value?: string;
};

export type UsecaseCreateFlags = {
  apiUrl: string;
  branch: string;
  dryRun: boolean;
  force: boolean;
  primaryActor: string;
  projectId: string;
  root: string;
  sessionCookie: string;
  title: string;
};

export type UsecaseListFlags = {
  actorId: string | undefined;
  apiUrl: string;
  cursor: string | undefined;
  level: string | undefined;
  limit: string | undefined;
  projectId: string;
  q: string | undefined;
  sessionCookie: string;
  status: string | undefined;
};

export type UsecaseShowFlags = {
  apiUrl: string;
  format: "agent" | "human" | "json";
  revision: string | undefined;
  session: string | undefined;
  sessionCookie: string;
  usecaseId: string;
};

export type UsecaseArchiveFlags = {
  apiUrl: string;
  sessionCookie: string;
  usecaseId: string;
};

export type UsecaseSetFlags = {
  apiUrl: string;
  field: "status";
  sessionCookie: string;
  usecaseId: string;
  value: string;
};

export type StakeholderInterestFlags = {
  apiUrl: string;
  interest: string;
  protectionMechanism: string;
  sessionCookie: string;
  stakeholder: string;
  usecaseId: string;
};

export function usecaseCreateFlagsFrom(flags: UsecaseCliFlags): UsecaseCreateFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    branch: flags.branch ?? "main",
    dryRun: flags["dry-run"] === true,
    force: flags.force === true,
    primaryActor: requiredFlag(flags, "primary-actor"),
    projectId: resolveContextFlag(flags, "project-id"),
    root: flags.root ?? process.cwd(),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    title: requiredFlag(flags, "title")
  };
}

export function usecaseListFlagsFrom(flags: UsecaseCliFlags): UsecaseListFlags {
  return {
    actorId: optionalFlag(flags, "actor-id"),
    apiUrl: resolveContextFlag(flags, "api-url"),
    cursor: optionalFlag(flags, "cursor"),
    level: optionalFlag(flags, "level"),
    limit: optionalFlag(flags, "limit"),
    projectId: resolveContextFlag(flags, "project-id"),
    q: optionalFlag(flags, "q"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    status: optionalFlag(flags, "status")
  };
}

export function usecaseShowFlagsFrom(
  flags: UsecaseCliFlags,
  usecaseId: string | undefined
): UsecaseShowFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    format: usecaseFormat(flags.format ?? "human"),
    revision: optionalFlag(flags, "revision"),
    session: optionalFlag(flags, "session"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

export function usecaseArchiveFlagsFrom(
  flags: UsecaseCliFlags,
  usecaseId: string | undefined
): UsecaseArchiveFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

export function usecaseSetFlagsFrom(
  flags: UsecaseCliFlags,
  usecaseId: string | undefined
): UsecaseSetFlags {
  const field = requiredFlag(flags, "field");
  if (field !== "status") {
    throw new Error("Only --field status is supported.");
  }
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    field,
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id"),
    value: requiredFlag(flags, "value")
  };
}

export function stakeholderInterestFlagsFrom(
  flags: UsecaseCliFlags,
  usecaseId: string | undefined
): StakeholderInterestFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    interest: requiredFlag(flags, "interest"),
    protectionMechanism: flags["protection-mechanism"] ?? "",
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    stakeholder: requiredFlag(flags, "stakeholder"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function usecaseFormat(rawFormat: string): "agent" | "human" | "json" {
  const format = rawFormat.toLowerCase();
  if (isUsecaseFormat(format)) {
    return format;
  }

  throw new Error("Diff format must be human, json, or agent.");
}

function isUsecaseFormat(format: string): format is "agent" | "human" | "json" {
  return ["agent", "human", "json"].includes(format);
}
