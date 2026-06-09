import { apiErrorCodeSchema, type ApiErrorCode } from "@vooster/contracts";
import type { EnvelopeError, SuggestedNextAction } from "./envelope.js";

export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  REVISION_STALE: "REVISION_STALE",
  LOCK_HELD: "LOCK_HELD",
  RATE_LIMITED: "RATE_LIMITED",
  BAD_REQUEST: "BAD_REQUEST",
  SCHEMA_INVALID: "SCHEMA_INVALID",
  TITLE_NOT_VERB_PHRASE: "TITLE_NOT_VERB_PHRASE",
  PRIMARY_ACTOR_NOT_AVAILABLE: "PRIMARY_ACTOR_NOT_AVAILABLE",
  STAKEHOLDER_ALREADY_ATTACHED: "STAKEHOLDER_ALREADY_ATTACHED",
  INTERNAL: "INTERNAL"
} as const satisfies Record<string, ApiErrorCode>;

export type ErrorCodeValue = ApiErrorCode;

type ProblemBody = {
  code?: unknown;
  title?: string;
  type?: string;
  suggested_next_actions?: SuggestedNextAction[];
} & Record<string, unknown>;

export function classifyError(status: number, body: unknown): ErrorCodeValue {
  const problem = isProblemBody(body) ? body : undefined;
  const codeMatch = matchByCode(problem?.code);
  if (codeMatch !== undefined) {
    return codeMatch;
  }
  return matchByStatus(status);
}

export function extractError(status: number, body: unknown): EnvelopeError {
  const code = classifyError(status, body);
  const problem = isProblemBody(body) ? body : undefined;
  const message = problem?.title ?? `API request failed with ${String(status)}.`;
  const details = extractDetails(problem);
  return details === undefined ? { code, message } : { code, message, details };
}

export function extractSuggestedNextActions(body: unknown): SuggestedNextAction[] {
  if (!isProblemBody(body) || !Array.isArray(body.suggested_next_actions)) {
    return [];
  }
  return body.suggested_next_actions.filter(isSuggestedNextAction);
}

function matchByCode(code: unknown): ErrorCodeValue | undefined {
  const parsed = apiErrorCodeSchema.safeParse(code);
  return parsed.success ? parsed.data : undefined;
}

function matchByStatus(status: number): ErrorCodeValue {
  if (status === 401) return ErrorCode.UNAUTHORIZED;
  if (status === 403) return ErrorCode.FORBIDDEN;
  if (status === 404) return ErrorCode.NOT_FOUND;
  if (status === 409) return ErrorCode.CONFLICT;
  if (status === 412) return ErrorCode.REVISION_STALE;
  if (status === 423) return ErrorCode.LOCK_HELD;
  if (status === 429) return ErrorCode.RATE_LIMITED;
  if (status === 400) return ErrorCode.BAD_REQUEST;
  if (status === 422) return ErrorCode.SCHEMA_INVALID;
  return ErrorCode.INTERNAL;
}

function extractDetails(
  problem: ProblemBody | undefined
): Record<string, unknown> | undefined {
  if (problem === undefined) {
    return undefined;
  }
  const { code, title, type, status, suggested_next_actions, ...rest } = problem;
  void code;
  void title;
  void type;
  void status;
  void suggested_next_actions;
  return Object.keys(rest).length === 0 ? undefined : rest;
}

function isProblemBody(value: unknown): value is ProblemBody {
  return typeof value === "object" && value !== null;
}

function isSuggestedNextAction(value: unknown): value is SuggestedNextAction {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { command?: unknown }).command === "string"
  );
}
