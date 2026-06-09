import type {
  AffectedFile,
  AgentEnvelopeV2,
  EnvelopeContext,
  SuggestedNextAction
} from "../domain/envelope.js";
import { buildErrorEnvelope, buildOkEnvelope } from "../domain/envelope.js";
import { extractError, extractSuggestedNextActions } from "../domain/error-codes.js";
import { ApiError, isApiError } from "../infrastructure/http/api-error.js";
import { deleteJson, patchJson, postJson } from "../infrastructure/http/client.js";
import type { AutoExportConfig } from "./auto-export.js";
import { autoExport } from "./auto-export.js";

export type MutationMethod = "POST" | "PATCH" | "DELETE";

export type MutationInput<TData> = {
  apiUrl: string;
  cookie: string;
  method: MutationMethod;
  path: string;
  body?: unknown;
  context?: Partial<EnvelopeContext> | ((data: TData) => Partial<EnvelopeContext>);
  selectData?: (responseBody: unknown) => TData;
  successHints?: (data: TData) => SuggestedNextAction[];
  autoExport?: AutoExportConfig;
  dryRun?: boolean;
};

export type MutationResult<TData> = {
  envelope: AgentEnvelopeV2<TData | null>;
  failed: boolean;
};

export async function runMutation<TData>(
  input: MutationInput<TData>
): Promise<MutationResult<TData>> {
  try {
    const responseBody = await sendRequest(
      input.apiUrl,
      input.cookie,
      input.method,
      withDryRun(input.path, input.dryRun === true),
      input.body
    );
    const data = input.selectData
      ? input.selectData(responseBody)
      : (responseBody as TData);
    const affectedFiles: AffectedFile[] =
      input.dryRun === true || input.autoExport === undefined
        ? []
        : await autoExport(input.autoExport);
    const context =
      typeof input.context === "function" ? input.context(data) : input.context;
    const suggestedNextActions = [
      ...(input.successHints?.(data) ?? []),
      ...localRefreshHints(input)
    ];
    return {
      envelope: buildOkEnvelope({
        data,
        context,
        affectedFiles,
        dryRun: input.dryRun,
        suggestedNextActions
      }),
      failed: false
    };
  } catch (error: unknown) {
    if (!isApiError(error)) {
      throw error;
    }
    return {
      envelope: buildErrorEnvelope({
        error: extractError(error.status, error.body),
        context: typeof input.context === "function" ? undefined : input.context,
        suggestedNextActions: extractSuggestedNextActions(error.body)
      }),
      failed: true
    };
  }
}

function withDryRun(path: string, dryRun: boolean): string {
  if (!dryRun) {
    return path;
  }
  return path.includes("?") ? `${path}&dry_run=true` : `${path}?dry_run=true`;
}

async function sendRequest(
  apiUrl: string,
  cookie: string,
  method: MutationMethod,
  path: string,
  body: unknown
): Promise<unknown> {
  const url = `${apiUrl}${path}`;
  const headers = { Cookie: cookie };
  if (method === "POST") {
    return (await postJson(url, body, headers)).body;
  }
  if (method === "PATCH") {
    return (await patchJson(url, body, headers)).body;
  }
  return (await deleteJson(url, headers)).body;
}

export { ApiError };

function localRefreshHints<TData>(input: MutationInput<TData>): SuggestedNextAction[] {
  if (
    input.dryRun === true ||
    input.autoExport !== undefined ||
    !isSpecMutationPath(input.path)
  ) {
    return [];
  }

  return [
    {
      command: "vspec pull",
      reason:
        "Local spec files may be stale after this mutation; run vspec pull to refresh them."
    }
  ];
}

function isSpecMutationPath(path: string): boolean {
  return (
    path.includes("/scenarios/") ||
    path.includes("/steps/") ||
    path.includes("/usecases/")
  );
}
