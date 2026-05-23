import { Args, Command, Flags } from "@oclif/core";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { optionalFlag, requiredArgument, resolveContextFlag } from "../flag-values.js";
import { fetchJson } from "../http-client.js";

type HistoryCliFlags = {
  "api-url"?: string;
  format?: string;
  limit?: string;
  "session-cookie"?: string;
};

type HistoryFlags = {
  apiUrl: string;
  limit: string | undefined;
  sessionCookie: string;
  usecaseId: string;
};

type HistoryResponse = {
  limit: number;
  revisions: Array<{
    author: string;
    change_summary?: string;
    entity_id: string;
    entity_type: string;
    revision: string;
    timestamp: string;
    version_number: number;
  }>;
  suggested_next_actions: Array<{
    command: string;
  }>;
  suppressed_count: number;
  truncated: boolean;
  usecase: {
    key: string;
  };
};

export class HistoryCommand extends Command {
  static override description = "List use case revision history.";

  static override args = {
    usecase: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    format: Flags.string(),
    limit: Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(HistoryCommand);

    await runHistory(parsed.flags, parsed.args.usecase, this.log.bind(this));
  }
}

export async function runHistory(
  flags: HistoryCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const historyFlags = historyFlagsFrom(flags, usecaseId);
  const url = new URL(
    `/v1/usecases/${historyFlags.usecaseId}/revisions`,
    historyFlags.apiUrl
  );
  setSearchParam(url, "limit", historyFlags.limit);

  const response = await fetchJson(url, {
    headers: {
      Cookie: historyFlags.sessionCookie
    }
  });
  const body = response.body as HistoryResponse;

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: body,
          context: {
            revision: body.revisions[0]?.revision ?? null
          },
          suggested_next_actions: body.suggested_next_actions
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`UseCase ${body.usecase.key}`);
  writeLine(`Limit ${String(body.limit)}`);
  writeLine(`Truncated ${String(body.truncated)}`);
  writeLine(`Suppressed ${String(body.suppressed_count)}`);
  for (const revision of body.revisions) {
    writeLine(`Revision ${revision.revision}`);
    writeLine(`Version ${String(revision.version_number)}`);
    writeLine(`Entity ${revision.entity_type} ${revision.entity_id}`);
    writeLine(`Author ${revision.author}`);
    writeLine(`Timestamp ${revision.timestamp}`);
    if (revision.change_summary !== undefined) {
      writeLine(revision.change_summary);
    }
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function historyFlagsFrom(
  flags: HistoryCliFlags,
  usecaseId: string | undefined
): HistoryFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    limit: optionalFlag(flags, "limit"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function setSearchParam(url: URL, name: string, value: string | undefined): void {
  if (value !== undefined) {
    url.searchParams.set(name, value);
  }
}
