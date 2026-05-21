import { Args, Command, Flags } from "@oclif/core";

import { requiredArgument, resolveContextFlag } from "../flag-values.js";
import { fetchJson } from "../http-client.js";

type DiffCliFlags = {
  "api-url"?: string;
  format?: string;
  "session-cookie"?: string;
};

type DiffFlags = {
  apiUrl: string;
  format: "agent" | "human" | "json";
  fromRevision: string;
  sessionCookie: string;
  toRevision: string;
  usecaseId: string;
};

type DiffResponse = {
  changes: Array<{
    change_type: string;
    entity_type: string;
    path: string;
    revision: string;
    severity: string;
    source_branch?: string;
  }>;
  cross_branch?: boolean;
  format: string;
  from_revision: string;
  note?: string;
  suggested_next_actions: Array<{
    command: string;
  }>;
  summary: {
    breaking: number;
    cosmetic: number;
    non_breaking: number;
  };
  to_revision: string;
  usecase: {
    key: string;
  };
  warnings?: Array<{
    from_branch: string;
    to_branch: string;
    type: string;
  }>;
};

export class DiffCommand extends Command {
  static override description = "Compare use case revisions.";

  static override args = {
    usecase: Args.string(),
    from: Args.string(),
    to: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    format: Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(DiffCommand);

    await runDiff(
      parsed.flags,
      parsed.args.usecase,
      parsed.args.from,
      parsed.args.to,
      this.log.bind(this)
    );
  }
}

export async function runDiff(
  flags: DiffCliFlags,
  usecaseId: string | undefined,
  fromRevision: string | undefined,
  toRevision: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const diffFlags = diffFlagsFrom(flags, usecaseId, fromRevision, toRevision);
  const url = new URL(`/v1/usecases/${diffFlags.usecaseId}/diff`, diffFlags.apiUrl);
  url.searchParams.set("from", diffFlags.fromRevision);
  url.searchParams.set("to", diffFlags.toRevision);
  url.searchParams.set("format", diffFlags.format);

  const response = await fetchJson(url, {
    headers: {
      Cookie: diffFlags.sessionCookie
    }
  });
  const body = response.body as DiffResponse;

  writeLine(`UseCase ${body.usecase.key}`);
  writeLine(`Format ${body.format}`);
  writeLine(`From ${body.from_revision}`);
  writeLine(`To ${body.to_revision}`);
  writeLine(
    `Summary breaking ${String(body.summary.breaking)} ` +
      `non_breaking ${String(body.summary.non_breaking)} ` +
      `cosmetic ${String(body.summary.cosmetic)}`
  );
  if (body.cross_branch === true) {
    writeLine("Cross branch true");
  }
  for (const warning of body.warnings ?? []) {
    writeLine(`Warning ${warning.type} ${warning.from_branch} ${warning.to_branch}`);
  }
  for (const change of body.changes) {
    writeLine(`Change ${change.change_type} ${change.entity_type} ${change.path}`);
    writeLine(`Revision ${change.revision}`);
    writeLine(`Severity ${change.severity}`);
    if (change.source_branch !== undefined) {
      writeLine(`Source branch ${change.source_branch}`);
    }
  }
  if (body.note !== undefined) {
    writeLine(body.note);
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function diffFlagsFrom(
  flags: DiffCliFlags,
  usecaseId: string | undefined,
  fromRevision: string | undefined,
  toRevision: string | undefined
): DiffFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    format: diffFormat(flags.format ?? "human"),
    fromRevision: requiredArgument(fromRevision, "from-revision"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    toRevision: requiredArgument(toRevision, "to-revision"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function diffFormat(rawFormat: string): "agent" | "human" | "json" {
  const format = rawFormat.toLowerCase();
  if (format === "agent" || format === "human" || format === "json") {
    return format;
  }

  throw new Error("Diff format must be human, json, or agent.");
}
