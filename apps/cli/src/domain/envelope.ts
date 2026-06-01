export const ENVELOPE_FORMAT_VERSION = 1 as const;

export type EnvelopeContext = {
  project_key: string | null;
  branch: string | null;
  session_id: string | null;
  revision: string | null;
};

export type SuggestedNextAction = {
  command: string;
  reason?: string;
};

export type Warning = {
  message: string;
};

export type AffectedFile = {
  path: string;
  revision: string;
};

export type EnvelopeError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type AgentEnvelopeV2<TData> = {
  format_version: typeof ENVELOPE_FORMAT_VERSION;
  status: "ok" | "error";
  data: TData | null;
  error?: EnvelopeError;
  context: EnvelopeContext;
  affected_files: AffectedFile[];
  dry_run: boolean;
  suggested_next_actions: SuggestedNextAction[];
  warnings: Warning[];
};

export function buildOkEnvelope<TData>(input: {
  data: TData;
  context?: Partial<EnvelopeContext>;
  affectedFiles?: AffectedFile[];
  dryRun?: boolean;
  suggestedNextActions?: SuggestedNextAction[];
  warnings?: Warning[];
}): AgentEnvelopeV2<TData> {
  return {
    format_version: ENVELOPE_FORMAT_VERSION,
    status: "ok",
    data: input.data,
    context: normalizeContext(input.context),
    affected_files: input.affectedFiles ?? [],
    dry_run: input.dryRun ?? false,
    suggested_next_actions: input.suggestedNextActions ?? [],
    warnings: input.warnings ?? []
  };
}

export function buildErrorEnvelope(input: {
  error: EnvelopeError;
  context?: Partial<EnvelopeContext>;
  suggestedNextActions?: SuggestedNextAction[];
  warnings?: Warning[];
}): AgentEnvelopeV2<null> {
  return {
    format_version: ENVELOPE_FORMAT_VERSION,
    status: "error",
    data: null,
    error: input.error,
    context: normalizeContext(input.context),
    affected_files: [],
    dry_run: false,
    suggested_next_actions: input.suggestedNextActions ?? [],
    warnings: input.warnings ?? []
  };
}

function normalizeContext(partial?: Partial<EnvelopeContext>): EnvelopeContext {
  return {
    project_key: partial?.project_key ?? null,
    branch: partial?.branch ?? null,
    session_id: partial?.session_id ?? null,
    revision: partial?.revision ?? null
  };
}
