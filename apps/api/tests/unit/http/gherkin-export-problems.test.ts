import { describe, expect, test } from "vitest";
import type { StoredUseCase } from "../../../src/domain/entities/index.js";
import {
  archivedUseCaseProblem,
  existingOutputProblem,
  outputPathProblem
} from "../../../src/http/gherkin-export-problems.js";

describe("Gherkin export problems", () => {
  test("skips archived guidance for active use cases", () => {
    expect(archivedUseCaseProblem(usecase())).toBeUndefined();
  });

  test("uses the default feature path for existing output conflicts", () => {
    expect(existingOutputProblem(usecase(), undefined, "old\n", "new\n")).toMatchObject(
      {
        diff_summary: {
          existing_lines: 1,
          path: "PAY-001.feature",
          proposed_lines: 1
        },
        title: "Output file already exists"
      }
    );
  });

  test("reports unwritable export directories", () => {
    expect(outputPathProblem("missing/features/PAY-001.feature")).toMatchObject({
      exit_code: 6,
      path: "missing/features/PAY-001.feature",
      suggested_next_actions: [
        { command: "mkdir -p missing" },
        { command: "chmod u+w missing" }
      ],
      title: "Output directory is not writable"
    });
  });

  test("skips output guidance when the directory is writable", () => {
    expect(outputPathProblem(undefined)).toBeUndefined();
    expect(outputPathProblem("features/PAY-001.feature")).toBeUndefined();
  });
});

function usecase(): StoredUseCase {
  return {
    archived_at: null,
    id: "usecase-1",
    key: "PAY-001",
    title: "Place an order"
  } as StoredUseCase;
}
