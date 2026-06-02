import type { ApiErrorCode } from "@vooster/contracts";
import type { ZodError } from "zod";
import { problem } from "./signup-support.js";

const SCHEMA_INVALID = "SCHEMA_INVALID" satisfies ApiErrorCode;
type ValidationIssue = ZodError["issues"][number];

export function useCaseCreateValidationProblem(error: ZodError) {
  const issue = error.issues[0];
  return problem(400, "Invalid use case request", validationIssueDetails(issue), [
    {
      command: "vspec usecase create --help",
      reason: "Review required fields and allowed values."
    }
  ]);
}

function validationIssueDetails(issue: ValidationIssue | undefined) {
  if (issue === undefined) {
    return {
      code: SCHEMA_INVALID,
      field: "body"
    };
  }
  const allowedValues = allowedValuesFrom(issue);
  return {
    code: SCHEMA_INVALID,
    field: issue.path.length === 0 ? "body" : issue.path.join("."),
    ...(allowedValues === undefined ? {} : { allowed_values: allowedValues })
  };
}

function allowedValuesFrom(issue: ValidationIssue): string[] | undefined {
  if (!("values" in issue) || !Array.isArray(issue.values)) {
    return undefined;
  }
  const values = issue.values.filter((value) => typeof value === "string");
  return values.length === 0 ? undefined : values;
}
