import type { SuggestedNextAction } from "../domain/envelope.js";
import type { EnvelopeContext } from "../domain/envelope.js";
import type { AgentEnvelopeV2 } from "../domain/envelope.js";
import type { MutationInput, MutationMethod } from "./mutation-runner.js";
import { runMutation } from "./mutation-runner.js";

export type CommonMutationContext = {
  apiUrl: string;
  branch: string;
  cookie: string;
  dryRun: boolean;
  projectId: string | null;
  root: string;
};

export type CommonContextFlags = {
  apiUrl: string;
  branch: string;
  dryRun: boolean;
  projectId: string | null;
  root: string;
  sessionCookie: string;
};

export type VerbMutation<TData> = {
  body?: unknown;
  context?: (data: TData) => Partial<EnvelopeContext>;
  method: MutationMethod;
  path: string;
  selectData?: (responseBody: unknown) => TData;
  successHints?: (data: TData) => SuggestedNextAction[];
};

export type RenderOptions<TData> = {
  format: string | undefined;
  human: (data: TData, writeLine: (message: string) => void) => void;
  writeLine: (message: string) => void;
};

export async function runMutationCommand<TData>(
  verb: VerbMutation<TData>,
  ctx: CommonMutationContext,
  render: RenderOptions<TData>
): Promise<void> {
  const input: MutationInput<TData> = {
    apiUrl: ctx.apiUrl,
    autoExport:
      ctx.projectId === null
        ? undefined
        : {
            apiUrl: ctx.apiUrl,
            branch: ctx.branch,
            cookie: ctx.cookie,
            projectId: ctx.projectId,
            root: ctx.root
          },
    body: verb.body,
    context: verb.context,
    cookie: ctx.cookie,
    dryRun: ctx.dryRun,
    method: verb.method,
    path: verb.path,
    selectData: verb.selectData,
    successHints: verb.successHints ?? extractServerHints
  };
  const result = await runMutation(input);

  if (render.format === "agent") {
    render.writeLine(JSON.stringify(result.envelope, null, 2));
    if (result.failed) {
      process.exitCode = 1;
    }
    return;
  }

  if (result.envelope.status === "error") {
    printHumanError(result.envelope, render.writeLine);
    process.exitCode = 1;
    return;
  }

  const data = result.envelope.data;
  if (data === null) {
    throw new Error("Mutation succeeded but returned no data.");
  }
  render.human(data, render.writeLine);
}

function printHumanError(
  envelope: AgentEnvelopeV2<unknown>,
  writeLine: (message: string) => void
): void {
  writeLine(`Error: ${envelope.error?.message ?? "Mutation failed."}`);
  printSuggestedTitles(envelope.error?.details?.suggested_titles, writeLine);
  if (envelope.suggested_next_actions.length === 0) {
    return;
  }
  writeLine("Next actions");
  for (const action of envelope.suggested_next_actions) {
    writeLine(`  ${action.command}${action.reason ? ` - ${action.reason}` : ""}`);
  }
}

function printSuggestedTitles(
  value: unknown,
  writeLine: (message: string) => void
): void {
  if (!Array.isArray(value) || value.length === 0) {
    return;
  }
  writeLine("Suggested titles");
  for (const title of value) {
    if (typeof title === "string") {
      writeLine(`  ${title}`);
    }
  }
}

export function commonMutationContextFrom(
  flags: CommonContextFlags
): CommonMutationContext {
  return {
    apiUrl: flags.apiUrl,
    branch: flags.branch,
    cookie: flags.sessionCookie,
    dryRun: flags.dryRun,
    projectId: flags.projectId,
    root: flags.root
  };
}

function extractServerHints(data: unknown): SuggestedNextAction[] {
  const hints = (data as { suggested_next_actions?: unknown }).suggested_next_actions;
  if (!Array.isArray(hints)) {
    return [];
  }
  return hints.filter(
    (hint): hint is SuggestedNextAction =>
      typeof hint === "object" &&
      hint !== null &&
      typeof (hint as { command?: unknown }).command === "string"
  );
}
