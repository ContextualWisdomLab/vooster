import { Args, Command, Flags } from "@oclif/core";
import {
  revisionDiffQuerySchema,
  revisionDiffResponseSchema,
  type RevisionDiffFormat,
  type RevisionDiffResponse
} from "@vooster/contracts";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { requiredArgument, resolveContextFlag } from "../flag-values.js";
import { fetchJson } from "../http-client.js";

type DiffCliFlags = {
  "api-url"?: string;
  format?: string;
  "session-cookie"?: string;
};

type DiffFlags = {
  apiUrl: string;
  format: RevisionDiffFormat;
  fromRevision: string;
  sessionCookie: string;
  toRevision: string;
  usecaseId: string;
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
  const query = revisionDiffQuerySchema.parse({
    format: diffFlags.format,
    from: diffFlags.fromRevision,
    to: diffFlags.toRevision
  });
  const url = new URL(`/v1/usecases/${diffFlags.usecaseId}/diff`, diffFlags.apiUrl);
  url.searchParams.set("from", query.from);
  url.searchParams.set("to", query.to);
  url.searchParams.set("format", query.format);

  const response = await fetchJson(url, {
    headers: {
      Cookie: diffFlags.sessionCookie
    }
  });
  const body: RevisionDiffResponse = revisionDiffResponseSchema.parse(response.body);

  if (diffFlags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: body,
          context: {
            revision: diffFlags.toRevision
          },
          suggested_next_actions: body.suggested_next_actions,
          warnings: (body.warnings ?? []).map((warning) => ({
            message: `Cross-branch diff from ${warning.from_branch} to ${warning.to_branch}`
          }))
        }),
        null,
        2
      )
    );
    return;
  }

  if (diffFlags.format === "json") {
    writeLine(JSON.stringify(body, null, 2));
    return;
  }

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

function diffFormat(rawFormat: string): RevisionDiffFormat {
  const format = rawFormat.toLowerCase();
  if (format === "agent" || format === "human" || format === "json") {
    return format;
  }

  throw new Error("Diff format must be human, json, or agent.");
}
