import { describe, expect, test } from "vitest";

import {
  printUsecaseShow,
  type UsecaseShowResponse
} from "../../src/commands/usecase-output.js";

describe("usecase show human extensions", () => {
  test("renders condition-only and stepped extensions with outcomes", () => {
    const lines: string[] = [];

    printUsecaseShow(usecaseWithExtensions(), (line) => lines.push(line));

    expect(lines).toContain("Extensions");
    expect(lines).toContain("2a. Title is empty. -> FAILURE");
    expect(lines).toContain("3b. Reviewer rejects payout. -> PARTIAL");
    expect(lines).toContain("3b1. System Shows the rejection reason.");
  });
});

function usecaseWithExtensions(): UsecaseShowResponse {
  return {
    scenarios: [
      {
        steps: [
          {
            action: "Submits the payout.",
            actor: "Customer",
            implements: [],
            invokes: [],
            step_number: 1
          }
        ],
        type: "MAIN_SUCCESS"
      },
      {
        condition: "Title is empty.",
        extension_point: "2a",
        outcome: "FAILURE",
        steps: [],
        type: "EXTENSION"
      },
      {
        condition: "Reviewer rejects payout.",
        extension_point: "3b",
        outcome: "PARTIAL",
        steps: [
          {
            action: "Shows the rejection reason.",
            actor: "System",
            implements: [],
            invokes: [],
            step_number: 1
          }
        ],
        type: "EXTENSION"
      }
    ],
    usecase: {
      current_revision_id: "revision-1",
      key: "PAY-001",
      status: "DRAFT",
      title: "Submits a payout"
    }
  };
}
