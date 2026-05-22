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
  context?: Partial<EnvelopeContext>;
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
      input.path,
      input.body
    );
    const data = input.selectData ? input.selectData(responseBody) : (responseBody as TData);
    const affectedFiles: AffectedFile[] =
      input.dryRun === true || input.autoExport === undefined
        ? []
        : await autoExport(input.autoExport);
    return {
      envelope: buildOkEnvelope({
        data,
        context: input.context,
        affectedFiles,
        dryRun: input.dryRun,
        suggestedNextActions: input.successHints?.(data) ?? []
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
        context: input.context,
        suggestedNextActions: extractSuggestedNextActions(error.body)
      }),
      failed: true
    };
  }
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
