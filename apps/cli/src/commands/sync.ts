import { resolve } from "node:path";
import { Command, Flags } from "@oclif/core";
import {
  syncPullRequestSchema,
  syncPullResponseSchema,
  syncPushRequestSchema,
  syncPushResponseSchema,
  type SyncPullResponse,
  type SyncPushFile,
  type SyncPushResponse
} from "@vooster/contracts";

import {
  applySyncResults,
  collectLocalSyncFiles,
  writeSyncFile
} from "./sync-files.js";
import { buildAgentEnvelope } from "../agent-envelope.js";
import { resolveContextFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type SyncCliFlags = {
  "api-url"?: string;
  branch?: string;
  "dry-run"?: boolean | string;
  format?: string;
  "project-id"?: string;
  root?: string;
  "session-cookie"?: string;
};

type SyncFlags = {
  apiUrl: string;
  branch: string;
  dryRun: boolean;
  projectId: string;
  root: string;
  sessionCookie: string;
};

export type { SyncPushFile, SyncPushResponse };

export class SyncCommand extends Command {
  static override description = "Synchronize local spec files.";

  static override flags = {
    "api-url": Flags.string(),
    branch: Flags.string(),
    "dry-run": Flags.boolean(),
    format: Flags.string(),
    "project-id": Flags.string(),
    root: Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(SyncCommand);

    await runSync(parsed.flags, "sync", this.log.bind(this));
  }
}

export async function runSync(
  flags: SyncCliFlags,
  action: "pull" | "push" | "sync",
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "push") {
    await pushFiles(flags, writeLine);
    return;
  }

  await pullFiles(flags, writeLine);
}

async function pullFiles(
  flags: SyncCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const syncFlags = syncFlagsFrom(flags);
  const requestBody = syncPullRequestSchema.parse({ branch: syncFlags.branch });
  const response = await postJson(
    `${syncFlags.apiUrl}/v1/projects/${syncFlags.projectId}/sync/pull`,
    requestBody,
    {
      Cookie: syncFlags.sessionCookie
    }
  );
  const body: SyncPullResponse = syncPullResponseSchema.parse(response.body);

  for (const file of body.files) {
    await writeSyncFile(syncFlags.root, file.path, file.content);
  }

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  writeLine(`Cursor ${body.cursor}`);
  for (const file of body.files) {
    writeLine(`File ${file.path}`);
    writeLine(`Revision ${file.revision}`);
  }
}

async function pushFiles(
  flags: SyncCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const syncFlags = syncFlagsFrom(flags);
  const localFiles = await collectLocalSyncFiles(syncFlags.root);
  const files = localFiles.files;
  const requestBody = syncPushRequestSchema.parse({
    branch: syncFlags.branch,
    dry_run: syncFlags.dryRun,
    files
  });
  const response = await postJson(
    `${syncFlags.apiUrl}/v1/projects/${syncFlags.projectId}/sync/push`,
    requestBody,
    {
      Cookie: syncFlags.sessionCookie
    }
  );
  const body: SyncPushResponse = syncPushResponseSchema.parse(response.body);

  await applySyncResults(syncFlags.root, files, body.results, syncFlags.dryRun);
  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: body,
          suggested_next_actions: body.suggested_next_actions,
          warnings: localFiles.warnings.map((warning) => ({
            message: warning.message
          }))
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`Results ${String(body.results.length)}`);
  for (const result of body.results) {
    writeLine(`Result ${result.path} ${result.status}`);
    writeLine(`Revision ${result.current_revision}`);
    if (result.dry_run === true) {
      writeLine("Dry run true");
    }
  }
  for (const entry of body.cache.entries) {
    writeLine(`Cache ${entry.path} ${entry.status}`);
    writeLine(`Cache revision ${entry.revision}`);
  }
  for (const warning of localFiles.warnings) {
    writeLine(`Warning ${warning.message}`);
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function syncFlagsFrom(flags: SyncCliFlags): SyncFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    branch: flags.branch ?? "main",
    dryRun: flags["dry-run"] === true || flags["dry-run"] === "true",
    projectId: resolveContextFlag(flags, "project-id"),
    root: resolve(flags.root ?? process.cwd()),
    sessionCookie: resolveContextFlag(flags, "session-cookie")
  };
}
