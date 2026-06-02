import { readFile } from "node:fs/promises";
import { Args, Command, Flags } from "@oclif/core";
import {
  impactPreviewRequestSchema,
  impactPreviewResponseSchema,
  revisionHistoryResponseSchema,
  type ImpactPreviewResponse
} from "@vooster/contracts";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { optionalFlag, requiredArgument, resolveContextFlag } from "../flag-values.js";
import { fetchJson, postJson } from "../http-client.js";

type ImpactCliFlags = {
  "api-url"?: string;
  format?: string;
  "proposed-change"?: string;
  "session-cookie"?: string;
};

type ImpactFlags = {
  apiUrl: string;
  proposedChangePath: string | undefined;
  sessionCookie: string;
  usecaseId: string;
};

export class ImpactCommand extends Command {
  static override description = "Preview impact for a proposed use case change.";

  static override args = {
    usecase: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    format: Flags.string(),
    "proposed-change": Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(ImpactCommand);

    await runImpact(parsed.flags, parsed.args.usecase, this.log.bind(this));
  }
}

export async function runImpact(
  flags: ImpactCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const impactFlags = impactFlagsFrom(flags, usecaseId);
  const history = await latestUseCaseRevision(impactFlags);
  const proposedChange = await proposedChangePayload(impactFlags.proposedChangePath);
  const requestBody = impactPreviewRequestSchema.parse({
    base_revision: history.revision,
    entity_id: impactFlags.usecaseId,
    entity_type: "USECASE",
    ...proposedChange
  });
  const response = await postJson(
    `${impactFlags.apiUrl}/v1/changes/preview`,
    requestBody,
    {
      Cookie: impactFlags.sessionCookie
    }
  );
  const body = impactPreviewResponseSchema.parse(response.body);

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: body,
          context: {
            revision: history.revision
          },
          suggested_next_actions: body.suggested_next_actions
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`Preview ${body.preview_id}`);
  writeLine(`Cached ${String(body.cached)}`);
  writeLine(`Severity ${body.impact.severity}`);
  writeLine(`Confidence ${String(body.impact.confidence)}`);
  writeLine(
    `Affected sessions ${formatAffectedSessions(body.impact.affected_sessions)}`
  );
  writeLine(`Affected branches ${body.impact.affected_branches.join(", ") || "none"}`);
  writeLine(`Affected tests ${body.impact.affected_tests.join(", ") || "none"}`);
  writeLine(`Input hash ${body.impact.input_hash}`);
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function impactFlagsFrom(
  flags: ImpactCliFlags,
  usecaseId: string | undefined
): ImpactFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    proposedChangePath: optionalFlag(flags, "proposed-change"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

async function latestUseCaseRevision(
  flags: Pick<ImpactFlags, "apiUrl" | "sessionCookie" | "usecaseId">
): Promise<{ revision: string }> {
  const url = new URL(`/v1/usecases/${flags.usecaseId}/revisions`, flags.apiUrl);
  url.searchParams.set("limit", "1");
  const response = await fetchJson(url, {
    headers: {
      Cookie: flags.sessionCookie
    }
  });
  const body = revisionHistoryResponseSchema.parse(response.body);
  const latest = body.revisions[0];
  if (latest === undefined) {
    throw new Error("Use case has no revisions.");
  }

  return { revision: latest.revision };
}

async function proposedChangePayload(
  path: string | undefined
): Promise<Record<string, string>> {
  if (path === undefined) {
    return {};
  }

  return {
    proposed_change_content: await readFile(path, "utf8"),
    proposed_change_path: path
  };
}

function formatAffectedSessions(
  sessions: ImpactPreviewResponse["impact"]["affected_sessions"]
): string {
  if (sessions.length === 0) {
    return "none";
  }

  return sessions
    .map(
      (session) =>
        `${session.id} ${session.agent_type} ${session.owner ?? ""} ${session.pinned_revision ?? ""}`
    )
    .join(", ");
}
