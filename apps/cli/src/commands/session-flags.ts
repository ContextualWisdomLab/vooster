import { optionalFlag, requiredArgument, requiredFlag, resolveContextFlag } from "../flag-values.js";

export type SessionCliFlags = {
  "agent-type"?: string;
  "api-url"?: string;
  "auto-branch"?: boolean;
  "branch-name"?: string;
  format?: string;
  intent?: string;
  "no-merge"?: boolean;
  pin?: string;
  "project-id"?: string;
  "session-cookie"?: string;
  status?: string;
  summary?: string;
  "workspace-id"?: string;
};

type SessionStartFlags = {
  agentType: string;
  apiUrl: string;
  autoBranch: boolean;
  branchName: string | undefined;
  intent: string;
  pins: string[];
  projectId: string;
  sessionCookie: string;
};

type SessionListFlags = {
  apiUrl: string;
  projectId: string | undefined;
  sessionCookie: string;
  status: string | undefined;
  workspaceId: string;
};

type SessionCompleteFlags = {
  apiUrl: string;
  noMerge: boolean;
  sessionCookie: string;
  sessionId: string;
  summary: string | undefined;
};

export function sessionStartFlagsFrom(flags: SessionCliFlags): SessionStartFlags {
  return {
    agentType: agentType(flags["agent-type"] ?? "OTHER"),
    apiUrl: resolveContextFlag(flags, "api-url"),
    autoBranch: flags["auto-branch"] ?? false,
    branchName: optionalFlag(flags, "branch-name"),
    intent: requiredFlag(flags, "intent"),
    pins: pinsFrom(requiredFlag(flags, "pin")),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie")
  };
}

export function sessionListFlagsFrom(flags: SessionCliFlags): SessionListFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    projectId: optionalFlag(flags, "project-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    status: optionalFlag(flags, "status"),
    workspaceId: resolveContextFlag(flags, "workspace-id")
  };
}

export function sessionCompleteFlagsFrom(
  flags: SessionCliFlags,
  sessionId: string | undefined
): SessionCompleteFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    noMerge: flags["no-merge"] ?? false,
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    sessionId: requiredArgument(sessionId, "session-id"),
    summary: optionalFlag(flags, "summary")
  };
}

function pinsFrom(rawPins: string): string[] {
  return rawPins.split(",").map((pin) => pin.trim()).filter(Boolean);
}

function agentType(rawAgentType: string): string {
  return rawAgentType.toUpperCase().replaceAll("-", "_");
}
