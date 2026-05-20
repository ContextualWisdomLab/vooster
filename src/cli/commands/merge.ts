import { Args, Command, Flags } from "@oclif/core";

import {
  printMergeOpen,
  printMergeResolve,
  type MergeOpenResponse,
  type MergeResolveResponse
} from "./merge-output.js";
import { optionalFlag, requiredArgument, requiredFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type MergeCliFlags = {
  "api-url"?: string;
  "base-revision"?: string;
  "entity-id"?: string;
  field?: string;
  into?: string;
  "session-cookie"?: string;
  strategy?: string;
  value?: string;
};

type MergeOpenFlags = {
  apiUrl: string;
  sessionCookie: string;
  sourceBranchId: string;
  strategy: "FAST_FORWARD" | "SQUASH" | undefined;
  target: "main";
};

type MergeResolveFlags = {
  apiUrl: string;
  baseRevision: string;
  entityId: string;
  field: string;
  mergeId: string;
  sessionCookie: string;
  strategy: "MANUAL" | "MINE" | "THEIRS";
  value: string | undefined;
};

export class MergeCommand extends Command {
  static override description = "Open and resolve merge requests.";

  static override args = {
    action: Args.string(),
    targetId: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    "base-revision": Flags.string(),
    "entity-id": Flags.string(),
    field: Flags.string(),
    into: Flags.string(),
    "session-cookie": Flags.string(),
    strategy: Flags.string(),
    value: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(MergeCommand);

    await runMerge(parsed.flags, parsed.args.action, parsed.args.targetId, this.log.bind(this));
  }
}

export async function runMerge(
  flags: MergeCliFlags,
  action: string | undefined,
  targetId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "open") {
    await openMerge(flags, targetId, writeLine);
    return;
  }
  if (action === "resolve") {
    await resolveMerge(flags, targetId, writeLine);
    return;
  }

  throw new Error("Missing merge action.");
}

async function openMerge(
  flags: MergeCliFlags,
  sourceBranchId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const mergeFlags = mergeOpenFlagsFrom(flags, sourceBranchId);
  const response = await postJson(
    `${mergeFlags.apiUrl}/v1/merges`,
    {
      source_branch_id: mergeFlags.sourceBranchId,
      ...(mergeFlags.strategy === undefined ? {} : { strategy: mergeFlags.strategy }),
      target: mergeFlags.target
    },
    {
      Cookie: mergeFlags.sessionCookie
    }
  );
  const body = response.body as MergeOpenResponse;

  printMergeOpen(body, writeLine);
}

async function resolveMerge(
  flags: MergeCliFlags,
  mergeId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const mergeFlags = mergeResolveFlagsFrom(flags, mergeId);
  const response = await postJson(
    `${mergeFlags.apiUrl}/v1/merges/${mergeFlags.mergeId}/resolve`,
    {
      base_revision: mergeFlags.baseRevision,
      resolutions: [
        {
          entity_id: mergeFlags.entityId,
          field: mergeFlags.field,
          strategy: mergeFlags.strategy,
          ...(mergeFlags.value === undefined ? {} : { value: mergeFlags.value })
        }
      ]
    },
    {
      Cookie: mergeFlags.sessionCookie
    }
  );
  const body = response.body as MergeResolveResponse;

  printMergeResolve(body, writeLine);
}

function mergeOpenFlagsFrom(
  flags: MergeCliFlags,
  sourceBranchId: string | undefined
): MergeOpenFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    sourceBranchId: requiredArgument(sourceBranchId, "branch-id"),
    strategy: mergeStrategy(optionalFlag(flags, "strategy")),
    target: mergeTarget(flags.into ?? "main")
  };
}

function mergeResolveFlagsFrom(flags: MergeCliFlags, mergeId: string | undefined): MergeResolveFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    baseRevision: requiredFlag(flags, "base-revision"),
    entityId: requiredFlag(flags, "entity-id"),
    field: requiredFlag(flags, "field"),
    mergeId: requiredArgument(mergeId, "merge-id"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    strategy: resolutionStrategy(requiredFlag(flags, "strategy")),
    value: optionalFlag(flags, "value")
  };
}

function mergeStrategy(rawStrategy: string | undefined): "FAST_FORWARD" | "SQUASH" | undefined {
  if (rawStrategy === undefined) {
    return undefined;
  }
  const strategy = rawStrategy.toUpperCase().replaceAll("-", "_");
  if (strategy === "FAST_FORWARD" || strategy === "SQUASH") {
    return strategy;
  }

  throw new Error("Merge strategy must be FAST_FORWARD or SQUASH.");
}

function resolutionStrategy(rawStrategy: string): "MANUAL" | "MINE" | "THEIRS" {
  const strategy = rawStrategy.toUpperCase();
  if (strategy === "MANUAL" || strategy === "MINE" || strategy === "THEIRS") {
    return strategy;
  }

  throw new Error("Resolution strategy must be MANUAL, MINE, or THEIRS.");
}

function mergeTarget(rawTarget: string): "main" {
  if (rawTarget === "main") {
    return rawTarget;
  }

  throw new Error("Merge target must be main.");
}
