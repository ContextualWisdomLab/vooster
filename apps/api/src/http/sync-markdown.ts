import { problem } from "./signup-support.js";
export { parseStepAction } from "../application/markdown-invocations.js";

export type SyncFile = {
  content: string;
  path: string;
};

type SyncParseError = {
  line: number;
  message: string;
  path: string;
};

export function parseFileErrors(file: SyncFile): SyncParseError[] {
  if (!file.content.startsWith("---\n")) {
    return [{ line: 1, message: "Missing frontmatter", path: file.path }];
  }
  if (
    file.content.split("\n").findIndex((line, index) => index > 0 && line === "---") < 1
  ) {
    return [{ line: 1, message: "Unclosed frontmatter", path: file.path }];
  }
  return [];
}

export function parseFilesProblem(offendingFiles: SyncParseError[]) {
  return problem(
    400,
    "Sync file parse failed",
    { offending_files: offendingFiles },
    offendingFiles.map((file) => ({
      command: `vspec doctor ${file.path}`,
      reason: "Validate the local file before pushing."
    }))
  );
}

export function titleFrom(content: string) {
  const title = content.split("\n").find((line) => line.startsWith("# "));
  return title?.slice(2).trim() ?? "Untitled use case";
}

export function usecasePath(usecase: { key: string }) {
  return `specs/${usecase.key}.md`;
}
