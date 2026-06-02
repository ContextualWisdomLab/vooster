import { describe, expect, it } from "vitest";

import {
  printUsecaseShow,
  type UsecaseShowResponse
} from "../../src/commands/usecase-output.js";

describe("usecase output", () => {
  it("prints stakeholder interests and scenario steps in human show output", () => {
    const lines: string[] = [];

    printUsecaseShow(usecaseShowResponse(), (line) => lines.push(line));

    expect(lines).toEqual([
      "UseCase PAY-001",
      "Title Submit an order",
      "Status DRAFT",
      "Revision revision-1",
      "Stakeholders and Interests",
      "Product Manager: Checkout revenue is protected.",
      "Main Success Scenario",
      "1. Customer Places an order.",
      "Extensions",
      "1a. Payment is declined.",
      "1a1. Customer Uses a backup card."
    ]);
  });
});

function usecaseShowResponse(): UsecaseShowResponse {
  return {
    scenarios: [
      {
        steps: [
          {
            action: "Places an order.",
            actor: "Customer",
            implements: [],
            invokes: [],
            step_number: 1
          }
        ],
        type: "MAIN_SUCCESS"
      },
      {
        condition: "Payment is declined.",
        extension_point: "1a",
        steps: [
          {
            action: "Uses a backup card.",
            actor: "Customer",
            implements: [],
            invokes: [],
            step_number: 1
          }
        ],
        type: "EXTENSION"
      }
    ],
    stakeholder_interests: [
      {
        interest: "Checkout revenue is protected.",
        stakeholder: "Product Manager"
      }
    ],
    usecase: {
      current_revision_id: "revision-1",
      key: "PAY-001",
      status: "DRAFT",
      title: "Submit an order"
    }
  };
}
