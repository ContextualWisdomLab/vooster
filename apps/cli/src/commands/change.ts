import { readFile } from "node:fs/promises";
import { Args, Command, Flags } from "@oclif/core";

import {
  printChangeCommit,
  printChangePreview,
  type ChangeCommitResponse,
  type ChangePreviewResponse
} from "./change-output.js";
import { buildAgentEnvelope } from "../agent-envelope.js";
import { requiredFlag, resolveContextFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type ChangeCliFlags = {
  "api-url"?: string;
  "auto-commit"?: boolean;
  "base-revision"?: string;
  format?: string;
  patch?: string;
  "preview-id"?: string;
  "session-cookie"?: string;
  usecase?: string;
};

type ChangeProposeFlags = {
  apiUrl: string;
  autoCommit: boolean;
  baseRevision: string;
  patchPath: string;
  sessionCookie: string;
  usecaseKey: string;
};

type ChangeCommitFlags = {
  apiUrl: string;
  previewId: string;
  sessionCookie: string;
};

export class ChangeCommand extends Command {
  static override description = "Preview and commit proposed changes.";

  static override args = {
    action: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    "auto-commit": Flags.boolean(),
    "base-revision": Flags.string(),
    format: Flags.string(),
    patch: Flags.string(),
    "preview-id": Flags.string(),
    "session-cookie": Flags.string(),
    usecase: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(ChangeCommand);

    await runChange(parsed.flags, parsed.args.action, this.log.bind(this));
  }
}

export async function runChange(
  flags: ChangeCliFlags,
  action: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "propose") {
    await proposeChange(flags, writeLine);
    return;
  }
  if (action === "commit") {
    await commitChange(flags, writeLine);
    return;
  }

  throw new Error("Missing change action.");
}

async function proposeChange(
  flags: ChangeCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const changeFlags = changeProposeFlagsFrom(flags);
  const patch = await readJsonFile(changeFlags.patchPath);
  const response = await postJson(
    `${changeFlags.apiUrl}/v1/changes/preview`,
    {
      auto_commit: changeFlags.autoCommit,
      base_revision: changeFlags.baseRevision,
      patch,
      usecase_key: changeFlags.usecaseKey
    },
    {
      Cookie: changeFlags.sessionCookie
    }
  );

  const body = response.body as ChangePreviewResponse;
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({
      data: body,
      suggested_next_actions: body.suggested_next_actions,
      warnings: body.warnings
    }), null, 2));
    return;
  }

  printChangePreview(body, writeLine);
}

async function commitChange(
  flags: ChangeCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const changeFlags = changeCommitFlagsFrom(flags);
  const response = await postJson(
    `${changeFlags.apiUrl}/v1/changes/commit`,
    {
      confirmed: true,
      preview_id: changeFlags.previewId
    },
    {
      Cookie: changeFlags.sessionCookie
    }
  );

  const body = response.body as ChangeCommitResponse;
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({
      data: body,
      context: {
        revision: body.revisions[0]?.revision_id ?? null
      },
      suggested_next_actions: body.suggested_next_actions
    }), null, 2));
    return;
  }

  printChangeCommit(body, writeLine);
}

function changeProposeFlagsFrom(flags: ChangeCliFlags): ChangeProposeFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    autoCommit: flags["auto-commit"] ?? false,
    baseRevision: requiredFlag(flags, "base-revision"),
    patchPath: requiredFlag(flags, "patch"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    usecaseKey: requiredFlag(flags, "usecase")
  };
}

function changeCommitFlagsFrom(flags: ChangeCliFlags): ChangeCommitFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    previewId: requiredFlag(flags, "preview-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie")
  };
}

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}
