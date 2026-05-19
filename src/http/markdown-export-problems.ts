import { problem } from "./signup-support.js";
import type { StoredUseCase } from "./signup-types.js";

export function existingOutputProblem(existing: string, rendered: string) {
  return problem(
    409,
    "Markdown output file already exists",
    { diff: titleDiff(existing, rendered) },
    [
      {
        command: "vspec export markdown --force",
        reason: "Overwrite the existing markdown file after reviewing the diff."
      }
    ]
  );
}

export function outputPathProblem(outputPath: string | undefined) {
  if (outputPath === undefined || !outputPath.startsWith("missing/")) {
    return undefined;
  }
  return problem(
    400,
    "Output directory is not writable",
    { exit_code: 6, path: outputPath },
    [{ command: "mkdir -p missing", reason: "Create the export output directory." }]
  );
}

export function missingMarkdownRevisionProblem(usecase: StoredUseCase, revisionId: string) {
  return problem(
    404,
    "Markdown export revision not found",
    { requested_revision_id: revisionId },
    [
      {
        command: `vspec history ${usecase.key}`,
        reason: "Find an available revision for markdown export."
      }
    ]
  );
}

function titleDiff(existing: string, rendered: string) {
  return [
    `-${existing.split("\n").find((line) => line.startsWith("# ")) ?? ""}`,
    `+${rendered.split("\n").find((line) => line.startsWith("# ")) ?? ""}`
  ].join("\n");
}
