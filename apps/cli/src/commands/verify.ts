import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Args, Command, Flags } from "@oclif/core";
import { usecaseShowResponseSchema } from "@vooster/contracts";

import { buildAgentEnvelope } from "../agent-envelope.js";
import {
  buildErrorEnvelope,
  type AgentEnvelopeV2,
  type EnvelopeError,
  type SuggestedNextAction
} from "../domain/envelope.js";
import { ErrorCode, extractError } from "../domain/error-codes.js";
import { requiredArgument, resolveContextFlag } from "../flag-values.js";
import { fetchJson, isApiError, type ApiError } from "../http-client.js";
import { suggestVerifyActions } from "./verify-next-actions.js";
import { runSpecChecks, type SpecCheck } from "./verify-spec-checks.js";
import {
  runStructuralChecks,
  type StructuralCheck
} from "./verify-structural-checks.js";

type VerifyCliFlags = {
  "api-url"?: string;
  format?: string;
  root?: string;
  "session-cookie"?: string;
  "test-cmd"?: string;
};

type VerifyFlags = {
  apiUrl: string;
  format: VerifyFormat;
  root: string;
  sessionCookie: string;
  testCommand: string | undefined;
  usecaseId: string;
};

type VerifyFormat = "agent" | "human" | "json";
type VerifyStatus =
  | "broken_links"
  | "failing_tests"
  | "pass"
  | "spec_failed"
  | "structural_failed"
  | "unlinked_steps";
type LinkStatus = "missing_file" | "missing_symbol" | "ok";

type StepRef = {
  action: string;
  ref: string;
  step_number: number;
};

type LinkCheck = StepRef & {
  path: string;
  status: LinkStatus;
  symbol?: string;
};

type VerifyResult = {
  broken_links: Array<LinkCheck & { status: Exclude<LinkStatus, "ok"> }>;
  checked_refs: LinkCheck[];
  drift: Array<
    | { kind: "broken_link"; ref: string; status: Exclude<LinkStatus, "ok"> }
    | { check: string; detail?: string; kind: "spec_check_failed" }
    | { check: string; detail: string; kind: "structural_check_missing" }
    | { action: string; kind: "unlinked_step"; step_number: number }
    | { command: string; exit_code: number; kind: "failing_test" }
  >;
  exit_code: 0 | 1 | 7;
  status: VerifyStatus;
  spec_checks: SpecCheck[];
  structural_checks: StructuralCheck[];
  suggested_next_actions: ReturnType<typeof suggestVerifyActions>;
  test_command: {
    command: string | null;
    exit_code: number | null;
    status: "failed" | "not_run" | "passed";
  };
  unlinked_steps: Array<Omit<StepRef, "ref">>;
  usecase: {
    current_revision_id?: string;
    key: string;
    title?: string;
  };
};

const implementationSurfacePaths = [
  "__tests__",
  "app",
  "apps",
  "lib",
  "src",
  "test",
  "tests"
];

export class VerifyCommand extends Command {
  static override description = "Verify spec step implementation links.";

  static override args = {
    usecase: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    format: Flags.string(),
    root: Flags.string(),
    "session-cookie": Flags.string(),
    "test-cmd": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(VerifyCommand);

    await runVerify(parsed.flags, parsed.args.usecase, this.log.bind(this));
  }
}

export async function runVerify(
  flags: VerifyCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  try {
    await runVerifyUnsafe(flags, usecaseId, writeLine);
  } catch (error: unknown) {
    if (writeVerifyError(flags, usecaseId, error, writeLine)) {
      return;
    }
    throw error;
  }
}

async function runVerifyUnsafe(
  flags: VerifyCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const verifyFlags = verifyFlagsFrom(flags, usecaseId);
  const response = await fetchJson(
    new URL(`/v1/usecases/${verifyFlags.usecaseId}`, verifyFlags.apiUrl),
    {
      headers: {
        Cookie: verifyFlags.sessionCookie
      }
    }
  );
  const body = usecaseShowResponseSchema.parse(response.body);
  const initial = resultFromUsecase(body, verifyFlags.root);
  const result =
    initial.status === "pass" && verifyFlags.testCommand !== undefined
      ? withTestResult(
          initial,
          await runTestCommand(verifyFlags.testCommand, verifyFlags.root),
          verifyFlags.testCommand
        )
      : initial;

  if (result.exit_code !== 0) {
    process.exitCode = result.exit_code;
  }

  printVerifyResult(result, verifyFlags.format, writeLine);
}

function writeVerifyError(
  flags: VerifyCliFlags,
  usecaseId: string | undefined,
  error: unknown,
  writeLine: (message: string) => void
): boolean {
  const envelope = verifyErrorEnvelope(error, usecaseId);
  if (envelope === undefined) {
    return false;
  }

  if (verifyErrorFormat(flags) === "json") {
    writeLine(JSON.stringify(envelope, null, 2));
  } else {
    printVerifyHumanError(envelope, writeLine);
  }
  process.exitCode = 1;
  return true;
}

function verifyErrorEnvelope(
  error: unknown,
  usecaseId: string | undefined
): AgentEnvelopeV2<null> | undefined {
  if (isMissingUsecaseId(error, usecaseId)) {
    return buildErrorEnvelope({
      error: {
        code: ErrorCode.BAD_REQUEST,
        message:
          "Missing usecase-id. Run vspec usecase list, then verify a specific use case key."
      },
      suggestedNextActions: usecaseVerifyRecoveryActions()
    });
  }

  if (!isApiError(error)) {
    return undefined;
  }

  return buildErrorEnvelope({
    error: verifyApiError(error, usecaseId),
    suggestedNextActions:
      error.status === 404 ? usecaseVerifyRecoveryActions() : undefined
  });
}

function verifyApiError(error: ApiError, usecaseId: string | undefined): EnvelopeError {
  const extracted = extractError(error.status, error.body);
  if (error.status !== 404 || usecaseId === undefined) {
    return extracted;
  }

  return {
    ...extracted,
    message: `Use case "${usecaseId}" was not found. Run vspec usecase list, then verify a listed key.`
  };
}

function isMissingUsecaseId(error: unknown, usecaseId: string | undefined): boolean {
  return (
    usecaseId === undefined &&
    error instanceof Error &&
    error.message === "Missing usecase-id."
  );
}

function usecaseVerifyRecoveryActions(): SuggestedNextAction[] {
  return [
    {
      command: "vspec usecase list",
      reason: "Find an existing use case key."
    },
    {
      command: "vspec usecase verify <usecase-key>",
      reason: "Retry verification with a listed use case key."
    }
  ];
}

function verifyErrorFormat(flags: VerifyCliFlags): "human" | "json" {
  const format = (flags.format ?? "human").toLowerCase();
  return format === "agent" || format === "json" ? "json" : "human";
}

function printVerifyHumanError(
  envelope: AgentEnvelopeV2<null>,
  writeLine: (message: string) => void
): void {
  writeLine(`Error: ${envelope.error?.message ?? "Verify failed."}`);
  if (envelope.suggested_next_actions.length === 0) {
    return;
  }
  writeLine("Next actions");
  for (const action of envelope.suggested_next_actions) {
    writeLine(`  ${action.command}${action.reason ? ` - ${action.reason}` : ""}`);
  }
}

function verifyFlagsFrom(
  flags: VerifyCliFlags,
  usecaseId: string | undefined
): VerifyFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    format: verifyFormat(flags.format ?? "human"),
    root: flags.root ?? process.cwd(),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    testCommand: flags["test-cmd"],
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function resultFromUsecase(
  body: ReturnType<typeof usecaseShowResponseSchema.parse>,
  root: string
): VerifyResult {
  const refs = stepRefs(body).sort(compareStepRefs);
  const checked = refs.map((stepRef) => checkRef(stepRef, root));
  const broken = checked.filter(isBrokenLink);
  const unlinked = shouldCheckUnlinkedSteps(body, root)
    ? unlinkedSteps(body).sort(compareUnlinkedSteps)
    : [];
  const specChecks = runSpecChecks(body);
  const structuralChecks = runStructuralChecks(body);
  const status = statusFrom(
    broken.length,
    unlinked.length,
    "not_run",
    specChecks,
    structuralChecks
  );
  const testCommand = { command: null, exit_code: null, status: "not_run" as const };

  return withSuggestedActions({
    broken_links: broken,
    checked_refs: checked,
    drift: driftFrom(broken, unlinked, testCommand, specChecks, structuralChecks),
    exit_code: exitCodeFrom(status),
    status,
    spec_checks: specChecks,
    structural_checks: structuralChecks,
    test_command: testCommand,
    unlinked_steps: unlinked,
    usecase: {
      current_revision_id: body.usecase.current_revision_id,
      key: body.usecase.key,
      title: body.usecase.title
    }
  });
}

function shouldCheckUnlinkedSteps(
  body: ReturnType<typeof usecaseShowResponseSchema.parse>,
  root: string
): boolean {
  return body.usecase.status !== "DRAFT" || hasImplementationSurface(root);
}

function hasImplementationSurface(root: string): boolean {
  return implementationSurfacePaths.some((path) => existsSync(resolve(root, path)));
}

function stepRefs(body: ReturnType<typeof usecaseShowResponseSchema.parse>): StepRef[] {
  return (body.scenarios ?? []).flatMap((scenario) =>
    scenario.steps.flatMap((step) =>
      step.implements.map((ref) => ({
        action: step.action,
        ref,
        step_number: step.step_number
      }))
    )
  );
}

function unlinkedSteps(
  body: ReturnType<typeof usecaseShowResponseSchema.parse>
): Array<Omit<StepRef, "ref">> {
  return (body.scenarios ?? []).flatMap((scenario) =>
    scenario.steps
      .filter((step) => step.implements.length === 0)
      .map((step) => ({
        action: step.action,
        step_number: step.step_number
      }))
  );
}

function checkRef(stepRef: StepRef, root: string): LinkCheck {
  const parsed = parseImplementationRef(stepRef.ref);
  const absolutePath = resolve(root, parsed.path);
  if (!existsSync(absolutePath)) {
    return { ...stepRef, path: parsed.path, status: "missing_file", ...parsed.symbol };
  }
  if (
    parsed.symbol !== undefined &&
    !readFileSync(absolutePath, "utf8").includes(parsed.symbol.symbol)
  ) {
    return {
      ...stepRef,
      path: parsed.path,
      status: "missing_symbol",
      symbol: parsed.symbol.symbol
    };
  }
  return { ...stepRef, path: parsed.path, status: "ok", ...parsed.symbol };
}

function parseImplementationRef(ref: string): {
  path: string;
  symbol?: { symbol: string };
} {
  const separator = ref.indexOf(":");
  return separator === -1
    ? { path: ref }
    : {
        path: ref.slice(0, separator),
        symbol: { symbol: ref.slice(separator + 1) }
      };
}

function isBrokenLink(
  check: LinkCheck
): check is LinkCheck & { status: Exclude<LinkStatus, "ok"> } {
  return check.status !== "ok";
}

function withTestResult(
  result: VerifyResult,
  exitCode: number,
  command: string
): VerifyResult {
  const testCommand = {
    command,
    exit_code: exitCode,
    status: exitCode === 0 ? ("passed" as const) : ("failed" as const)
  };
  const status = statusFrom(
    result.broken_links.length,
    result.unlinked_steps.length,
    testCommand.status,
    result.spec_checks,
    result.structural_checks
  );
  return withSuggestedActions({
    ...result,
    drift: driftFrom(
      result.broken_links,
      result.unlinked_steps,
      testCommand,
      result.spec_checks,
      result.structural_checks
    ),
    exit_code: exitCodeFrom(status),
    status,
    test_command: testCommand
  });
}

function withSuggestedActions(
  result: Omit<VerifyResult, "suggested_next_actions">
): VerifyResult {
  return {
    ...result,
    suggested_next_actions: suggestVerifyActions(result)
  };
}

function runTestCommand(command: string, root: string): Promise<number> {
  return new Promise((resolveExitCode, reject) => {
    const child = spawn(command, {
      cwd: root,
      shell: true,
      stdio: "ignore"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      resolveExitCode(code ?? 1);
    });
  });
}

function statusFrom(
  brokenCount: number,
  unlinkedCount: number,
  testStatus: VerifyResult["test_command"]["status"],
  specChecks: SpecCheck[],
  structuralChecks: StructuralCheck[]
): VerifyStatus {
  if (brokenCount > 0) {
    return "broken_links";
  }
  if (unlinkedCount > 0) {
    return "unlinked_steps";
  }
  if (structuralChecks.some((check) => check.status === "missing")) {
    return "structural_failed";
  }
  if (specChecks.some((check) => check.status === "fail")) {
    return "spec_failed";
  }
  if (testStatus === "failed") {
    return "failing_tests";
  }
  return "pass";
}

function exitCodeFrom(status: VerifyStatus): 0 | 1 | 7 {
  if (status === "pass") {
    return 0;
  }
  return status === "unlinked_steps" ? 7 : 1;
}

function driftFrom(
  broken: VerifyResult["broken_links"],
  unlinked: VerifyResult["unlinked_steps"],
  testCommand: VerifyResult["test_command"],
  specChecks: SpecCheck[],
  structuralChecks: StructuralCheck[]
): VerifyResult["drift"] {
  return [
    ...broken.map((link) => ({
      kind: "broken_link" as const,
      ref: link.ref,
      status: link.status
    })),
    ...unlinked.map((step) => ({
      action: step.action,
      kind: "unlinked_step" as const,
      step_number: step.step_number
    })),
    ...specChecks
      .filter((check) => check.status === "fail")
      .map((check) => ({
        check: check.id,
        detail: check.detail,
        kind: "spec_check_failed" as const
      })),
    ...structuralChecks
      .filter((check) => check.status === "missing")
      .map((check) => ({
        check: check.id,
        detail: check.detail,
        kind: "structural_check_missing" as const
      })),
    ...(testCommand.status === "failed" && testCommand.command !== null
      ? [
          {
            command: testCommand.command,
            exit_code: testCommand.exit_code ?? 1,
            kind: "failing_test" as const
          }
        ]
      : [])
  ];
}

function printVerifyResult(
  result: VerifyResult,
  format: VerifyFormat,
  writeLine: (message: string) => void
): void {
  if (format === "json") {
    writeLine(JSON.stringify(result, null, 2));
    return;
  }
  if (format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: result,
          context: {
            revision: result.usecase.current_revision_id ?? null
          },
          suggested_next_actions: result.suggested_next_actions
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`Verify ${result.usecase.key} ${result.status}`);
  writeLine(`Checked refs ${String(result.checked_refs.length)}`);
  writeLine(`Broken links ${String(result.broken_links.length)}`);
  writeLine(`Unlinked steps ${String(result.unlinked_steps.length)}`);
  for (const check of result.spec_checks) {
    writeLine(specCheckLine(check));
  }
  for (const check of result.structural_checks) {
    writeLine(structuralCheckLine(check));
  }
  for (const link of result.broken_links) {
    writeLine(
      `Broken ${result.usecase.key}#${String(link.step_number)} ${link.ref} ${link.status}`
    );
  }
  for (const step of result.unlinked_steps) {
    writeLine(
      `Unlinked ${result.usecase.key}#${String(step.step_number)} ${step.action}`
    );
  }
  if (result.test_command.status === "not_run") {
    writeLine("Tests not run");
  } else {
    writeLine(
      `Tests ${result.test_command.status === "passed" ? "passed" : "failed"} ${String(result.test_command.exit_code)}`
    );
  }
  if (result.suggested_next_actions.length > 0) {
    writeLine("Next actions");
    for (const action of result.suggested_next_actions) {
      writeLine(`  ${action.command}${action.reason ? ` - ${action.reason}` : ""}`);
    }
  }
}

function specCheckLine(check: SpecCheck): string {
  return check.detail === undefined
    ? `Spec ${check.id} ${check.status}`
    : `Spec ${check.id} ${check.status} - ${check.detail}`;
}

function structuralCheckLine(check: StructuralCheck): string {
  return `Structure ${check.id} ${check.status} - ${check.detail}`;
}

function verifyFormat(rawFormat: string): VerifyFormat {
  const format = rawFormat.toLowerCase();
  if (format === "agent" || format === "human" || format === "json") {
    return format;
  }

  throw new Error("Verify format must be human, json, or agent.");
}

function compareStepRefs(left: StepRef, right: StepRef): number {
  return (
    left.step_number - right.step_number ||
    left.ref.localeCompare(right.ref) ||
    left.action.localeCompare(right.action)
  );
}

function compareUnlinkedSteps(
  left: Omit<StepRef, "ref">,
  right: Omit<StepRef, "ref">
): number {
  return (
    left.step_number - right.step_number || left.action.localeCompare(right.action)
  );
}
