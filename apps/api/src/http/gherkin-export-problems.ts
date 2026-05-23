import { problem } from "./signup-support.js";
import type { StoredUseCase } from "../domain/entities/index.js";

export function archivedUseCaseProblem(usecase: StoredUseCase) {
  if (usecase.archived_at === null) {
    return undefined;
  }
  return problem(409, "Use case is archived", {}, [
    {
      command: `vspec usecase restore ${usecase.key}`,
      reason: "Restore the use case before exporting Gherkin."
    }
  ]);
}

export function existingOutputProblem(
  usecase: StoredUseCase,
  outputPath: string | undefined,
  existingContent: string,
  proposedContent: string
) {
  return problem(
    409,
    "Output file already exists",
    {
      diff_summary: {
        existing_lines: lineCount(existingContent),
        path: outputPath ?? `${usecase.key}.feature`,
        proposed_lines: lineCount(proposedContent)
      }
    },
    [
      {
        command: `vspec export gherkin ${usecase.key} --force`,
        reason: "Overwrite the existing feature file intentionally."
      },
      {
        command: `vspec export gherkin ${usecase.key} --output <path>`,
        reason: "Choose a different output path."
      }
    ]
  );
}

export function gherkinPrerequisiteProblem(
  usecase: StoredUseCase,
  missingRequiredField: "main_success" | "main_success.steps"
) {
  return problem(
    422,
    "Cannot export incomplete use case",
    { missing_required_field: missingRequiredField },
    [
      {
        command: `vspec doctor ${usecase.key}`,
        reason: "Inspect missing Gherkin export prerequisites."
      },
      {
        command: `vspec scenario add ${usecase.key} --type main-success`,
        reason: "Create the required main success scenario before export."
      }
    ]
  );
}

export function missingRevisionProblem(usecase: StoredUseCase, revisionId: string) {
  return problem(404, "Revision not found", { revision_id: revisionId }, [
    {
      command: `vspec history ${usecase.key}`,
      reason: "Find an exportable revision for this use case."
    }
  ]);
}

export function outputPathProblem(outputPath: string | undefined) {
  if (outputPath === undefined || !outputPath.startsWith("missing/")) {
    return undefined;
  }
  const directory = outputPath.slice(0, outputPath.indexOf("/"));
  return problem(
    400,
    "Output directory is not writable",
    { exit_code: 6, path: outputPath },
    [
      {
        command: `mkdir -p ${directory}`,
        reason: "Create the export output directory."
      },
      {
        command: `chmod u+w ${directory}`,
        reason: "Ensure the output directory is writable."
      }
    ]
  );
}

function lineCount(content: string) {
  return content.trimEnd().split("\n").length;
}
