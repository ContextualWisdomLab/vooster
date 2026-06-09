import type { SuggestedNextAction } from "../domain/envelope.js";
import type { SpecCheck } from "./verify-spec-checks.js";
import type { StructuralCheck } from "./verify-structural-checks.js";

type VerifyActionInput = {
  broken_links: Array<{
    ref: string;
    status: string;
    step_number: number;
  }>;
  spec_checks: SpecCheck[];
  structural_checks: StructuralCheck[];
  test_command: {
    command: string | null;
    status: "failed" | "not_run" | "passed";
  };
  unlinked_steps: Array<{
    action: string;
    step_number: number;
  }>;
  usecase: {
    key: string;
  };
};

export function suggestVerifyActions(result: VerifyActionInput): SuggestedNextAction[] {
  if (isClean(result)) {
    return [];
  }
  return [
    ...result.broken_links.map((link) => ({
      command: showCommand(result.usecase.key),
      reason: `Fix step ${String(link.step_number)} implementation ref ${link.ref} (${link.status}).`
    })),
    ...result.unlinked_steps.map((step) => ({
      command: showCommand(result.usecase.key),
      reason: `Add an implements ref to step ${String(step.step_number)}: ${step.action}`
    })),
    ...result.spec_checks
      .filter((check) => check.status === "fail")
      .map((check) => ({
        command: showCommand(result.usecase.key),
        reason: specReason(check)
      })),
    ...result.structural_checks
      .filter((check) => check.status === "missing")
      .map((check) => structuralAction(result.usecase.key, check)),
    ...(result.test_command.status === "failed" && result.test_command.command !== null
      ? [
          {
            command: result.test_command.command,
            reason:
              "Rerun the failing verification test command after fixing implementation drift."
          }
        ]
      : [])
  ];
}

function isClean(result: VerifyActionInput): boolean {
  return (
    result.broken_links.length === 0 &&
    result.unlinked_steps.length === 0 &&
    result.spec_checks.every((check) => check.status === "pass") &&
    result.structural_checks.every((check) => check.status === "present") &&
    result.test_command.status !== "failed"
  );
}

function showCommand(usecaseKey: string): string {
  return `vspec usecase show ${usecaseKey} --format=agent`;
}

function specReason(check: SpecCheck): string {
  return check.detail === undefined
    ? `Resolve spec check ${check.id}.`
    : `Resolve spec check ${check.id}: ${check.detail}`;
}

function structuralAction(
  usecaseKey: string,
  check: StructuralCheck
): SuggestedNextAction {
  if (check.id === "stakeholders") {
    return {
      command: `vspec usecase add-stakeholder ${usecaseKey} --stakeholder <name> --interest <interest> --format=agent`,
      reason: "Attach at least one stakeholder interest."
    };
  }
  if (check.id === "extensions") {
    return {
      command: `vspec scenario add ${usecaseKey} --type EXTENSION --extension-point 1a --condition "<condition>" --outcome FAILURE --format=agent`,
      reason:
        "Add an extension or alternate scenario, or confirm none are needed outside verify."
    };
  }
  return {
    command: showCommand(usecaseKey),
    reason: check.detail
  };
}
