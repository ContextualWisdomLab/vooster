import { requiredFlag, resolveContextFlag } from "../flag-values.js";

export type ActorCliFlags = {
  aliases?: string;
  "api-url"?: string;
  branch?: string;
  description?: string;
  "dry-run"?: boolean;
  format?: string;
  name?: string;
  "project-id"?: string;
  root?: string;
  "session-cookie"?: string;
  type?: string;
};

export type ActorType = "OFFSTAGE" | "PRIMARY" | "SUPPORTING";

export type ActorCreateFlags = {
  aliases: string[];
  apiUrl: string;
  branch: string;
  description: string;
  dryRun: boolean;
  name: string;
  projectId: string;
  root: string;
  sessionCookie: string;
  type: ActorType;
};

export function actorCreateFlagsFrom(flags: ActorCliFlags): ActorCreateFlags {
  return {
    aliases: aliasesFrom(flags.aliases),
    apiUrl: resolveContextFlag(flags, "api-url"),
    branch: flags.branch ?? "main",
    description: flags.description ?? "",
    dryRun: flags["dry-run"] === true,
    name: requiredFlag(flags, "name"),
    projectId: resolveContextFlag(flags, "project-id"),
    root: flags.root ?? process.cwd(),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    type: actorType(requiredFlag(flags, "type"))
  };
}

export function actorPatchFrom(
  flags: ActorCliFlags
): Record<string, string | string[]> {
  const patch: Record<string, string | string[]> = {};
  if (flags.aliases !== undefined) {
    patch.aliases = aliasesFrom(flags.aliases);
  }
  if (flags.description !== undefined) {
    patch.description = flags.description;
  }
  if (flags.name !== undefined) {
    patch.name = flags.name;
  }
  if (flags.type !== undefined) {
    patch.type = actorType(flags.type);
  }
  return patch;
}

function actorType(rawType: string): ActorType {
  const type = rawType.toUpperCase();
  if (type === "OFFSTAGE" || type === "PRIMARY" || type === "SUPPORTING") {
    return type;
  }

  throw new Error("Actor type must be PRIMARY, SUPPORTING, or OFFSTAGE.");
}

function aliasesFrom(rawAliases: string | undefined): string[] {
  if (rawAliases === undefined || rawAliases.trim() === "") {
    return [];
  }

  return rawAliases
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean);
}
