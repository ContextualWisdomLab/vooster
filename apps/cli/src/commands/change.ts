import { readFile } from "node:fs/promises";
import { Args, Command, Flags } from "@oclif/core";
import {
  changeCommitRequestSchema,
  changeCommitResponseSchema,
  changePreviewRequestSchema,
  changePreviewResponseSchema,
  type SuggestedNextAction
} from "@vooster/contracts";

import { writeAgentErrorEnvelope } from "./agent-error-envelope.js";
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
  try {
    const changeFlags = changeProposeFlagsFrom(flags);
    const patch = await readJsonFile(changeFlags.patchPath);
    const requestBody = changePreviewRequestSchema.parse({
      auto_commit: changeFlags.autoCommit,
      base_revision: changeFlags.baseRevision,
      patch,
      usecase_key: changeFlags.usecaseKey
    });
    const response = await postJson(
      `${changeFlags.apiUrl}/v1/changes/preview`,
      requestBody,
      {
        Cookie: changeFlags.sessionCookie
      }
    );

    const body: ChangePreviewResponse = changePreviewResponseSchema.parse(
      response.body
    );
    if (flags.format === "agent") {
      writeLine(
        JSON.stringify(
          buildAgentEnvelope({
            data: body,
            suggested_next_actions: body.suggested_next_actions,
            warnings: body.warnings
          }),
          null,
          2
        )
      );
      return;
    }

    printChangePreview(body, writeLine);
  } catch (error: unknown) {
    if (
      flags.format === "agent" &&
      writeAgentErrorEnvelope({
        error,
        suggestedNextActions: changeProposeErrorActions(),
        validationMessage: "Invalid change patch.",
        writeLine
      })
    ) {
      return;
    }
    throw error;
  }
}

async function commitChange(
  flags: ChangeCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const changeFlags = changeCommitFlagsFrom(flags);
  const requestBody = changeCommitRequestSchema.parse({
    confirmed: true,
    preview_id: changeFlags.previewId
  });
  const response = await postJson(
    `${changeFlags.apiUrl}/v1/changes/commit`,
    requestBody,
    {
      Cookie: changeFlags.sessionCookie
    }
  );

  const body: ChangeCommitResponse = changeCommitResponseSchema.parse(response.body);
  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: body,
          context: {
            revision: body.revisions[0]?.revision_id ?? null
          },
          suggested_next_actions: body.suggested_next_actions
        }),
        null,
        2
      )
    );
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

function changeProposeErrorActions(): SuggestedNextAction[] {
  return [
    {
      command: "vspec change propose --patch <valid-patch.json>",
      reason: "Provide entity_id, entity_type USECASE, and supported fields."
    }
  ];
}
