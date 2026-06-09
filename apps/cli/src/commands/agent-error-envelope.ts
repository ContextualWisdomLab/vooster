import { ZodError } from "zod";

import {
  ErrorCode,
  extractError,
  extractSuggestedNextActions
} from "../domain/error-codes.js";
import { buildErrorEnvelope, type SuggestedNextAction } from "../domain/envelope.js";
import { isApiError } from "../http-client.js";

type AgentErrorInput = {
  error: unknown;
  suggestedNextActions?: SuggestedNextAction[];
  validationMessage: string;
  writeLine: (message: string) => void;
};

export function writeAgentErrorEnvelope(input: AgentErrorInput): boolean {
  const envelope = agentErrorEnvelope(input);
  if (envelope === undefined) {
    return false;
  }

  input.writeLine(JSON.stringify(envelope, null, 2));
  process.exitCode = 1;
  return true;
}

function agentErrorEnvelope(input: AgentErrorInput) {
  if (isApiError(input.error)) {
    const suggestedNextActions = extractSuggestedNextActions(input.error.body);
    return buildErrorEnvelope({
      error: extractError(input.error.status, input.error.body),
      suggestedNextActions:
        suggestedNextActions.length === 0
          ? input.suggestedNextActions
          : suggestedNextActions
    });
  }

  if (input.error instanceof ZodError) {
    return buildErrorEnvelope({
      error: {
        code: ErrorCode.SCHEMA_INVALID,
        message: input.validationMessage
      },
      suggestedNextActions: input.suggestedNextActions
    });
  }

  if (input.error instanceof Error) {
    return buildErrorEnvelope({
      error: {
        code: ErrorCode.BAD_REQUEST,
        message: input.error.message
      },
      suggestedNextActions: input.suggestedNextActions
    });
  }

  return undefined;
}
