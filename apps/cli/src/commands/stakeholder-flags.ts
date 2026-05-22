import { requiredFlag, resolveContextFlag } from "../flag-values.js";

export type StakeholderCliFlags = {
  "api-url"?: string;
  description?: string;
  format?: string;
  name?: string;
  "project-id"?: string;
  "session-cookie"?: string;
  type?: string;
};

export type StakeholderType = "EXTERNAL" | "INTERNAL" | "REGULATORY";

export type StakeholderCreateFlags = {
  apiUrl: string;
  description: string;
  name: string;
  projectId: string;
  sessionCookie: string;
  type: StakeholderType;
};

export function stakeholderCreateFlagsFrom(
  flags: StakeholderCliFlags
): StakeholderCreateFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    description: flags.description ?? "",
    name: requiredFlag(flags, "name"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    type: stakeholderType(requiredFlag(flags, "type"))
  };
}

export function stakeholderPatchFrom(
  flags: StakeholderCliFlags
): Record<string, string> {
  const patch: Record<string, string> = {};
  if (flags.description !== undefined) {
    patch.description = flags.description;
  }
  if (flags.name !== undefined) {
    patch.name = flags.name;
  }
  if (flags.type !== undefined) {
    patch.type = stakeholderType(flags.type);
  }
  return patch;
}

function stakeholderType(rawType: string): StakeholderType {
  const type = rawType.toUpperCase();
  if (type === "EXTERNAL" || type === "INTERNAL" || type === "REGULATORY") {
    return type;
  }

  throw new Error("Stakeholder type must be INTERNAL, EXTERNAL, or REGULATORY.");
}
