import { Args, Command, Flags } from "@oclif/core";

import {
  printSessionComplete,
  printSessionList,
  printSessionStart,
  type SessionCompleteResponse,
  type SessionListResponse,
  type SessionStartResponse
} from "./session-output.js";
import {
  sessionCompleteFlagsFrom,
  sessionListFlagsFrom,
  sessionStartFlagsFrom,
  type SessionCliFlags
} from "./session-flags.js";
import { fetchJson, postJson } from "../http-client.js";

export class SessionCommand extends Command {
  static override description = "Manage work sessions.";

  static override args = {
    action: Args.string(),
    sessionId: Args.string()
  };

  static override flags = {
    "agent-type": Flags.string(),
    "api-url": Flags.string(),
    "auto-branch": Flags.boolean(),
    "branch-name": Flags.string(),
    intent: Flags.string(),
    "no-merge": Flags.boolean(),
    pin: Flags.string(),
    "project-id": Flags.string(),
    "session-cookie": Flags.string(),
    status: Flags.string(),
    summary: Flags.string(),
    "workspace-id": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(SessionCommand);

    await runSession(parsed.flags, parsed.args.action, parsed.args.sessionId, this.log.bind(this));
  }
}

export async function runSession(
  flags: SessionCliFlags,
  action: string | undefined,
  sessionId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "start") {
    await startSession(flags, writeLine);
    return;
  }
  if (action === "list") {
    await listSessions(flags, writeLine);
    return;
  }
  if (action === "complete") {
    await completeSession(flags, sessionId, writeLine);
    return;
  }

  throw new Error("Missing session action.");
}

async function startSession(
  flags: SessionCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const sessionFlags = sessionStartFlagsFrom(flags);
  const response = await postJson(
    `${sessionFlags.apiUrl}/v1/sessions`,
    {
      agent_type: sessionFlags.agentType,
      auto_branch: sessionFlags.autoBranch,
      ...(sessionFlags.branchName === undefined ? {} : { branch_name: sessionFlags.branchName }),
      intent: sessionFlags.intent,
      pins: sessionFlags.pins,
      project_id: sessionFlags.projectId
    },
    {
      Cookie: sessionFlags.sessionCookie,
      "X-Vspec-Agent": "codex-cli"
    }
  );

  printSessionStart(response.body as SessionStartResponse, writeLine);
}

async function listSessions(
  flags: SessionCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const sessionFlags = sessionListFlagsFrom(flags);
  const url = new URL("/v1/sessions", sessionFlags.apiUrl);
  url.searchParams.set("workspace_id", sessionFlags.workspaceId);
  setSearchParam(url, "project_id", sessionFlags.projectId);
  setSearchParam(url, "status", sessionFlags.status);

  const response = await fetchJson(url, {
    headers: {
      Cookie: sessionFlags.sessionCookie
    }
  });

  printSessionList(response.body as SessionListResponse, writeLine);
}

async function completeSession(
  flags: SessionCliFlags,
  sessionId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const sessionFlags = sessionCompleteFlagsFrom(flags, sessionId);
  const response = await postJson(
    `${sessionFlags.apiUrl}/v1/sessions/${sessionFlags.sessionId}/complete`,
    {
      no_merge: sessionFlags.noMerge,
      ...(sessionFlags.summary === undefined ? {} : { summary: sessionFlags.summary })
    },
    {
      Cookie: sessionFlags.sessionCookie
    }
  );

  printSessionComplete(response.body as SessionCompleteResponse, writeLine);
}

function setSearchParam(url: URL, name: string, value: string | undefined): void {
  if (value !== undefined) {
    url.searchParams.set(name, value);
  }
}
