import { afterEach, describe, expect, test, vi } from "vitest";

import { runStep } from "../../src/commands/step.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("step positioning commands", () => {
  test("step add --at routes the requested position", async () => {
    const requests: Array<{ body: unknown; url: string }> = [];
    stubFetch(positionedStepBody(), requests);

    await runStep(
      stepFlags({
        at: "2"
      }),
      "add",
      "scenario-1",
      () => undefined
    );

    expect(requests).toEqual([
      {
        body: {
          action: "Validates the amount.",
          actor: "Pocket",
          force: false,
          position: 2
        },
        url: "https://api.example.test/v1/scenarios/scenario-1/steps"
      }
    ]);
  });

  test("step move --to issues a reorder request", async () => {
    const requests: Array<{ body: unknown; url: string }> = [];
    stubFetch(positionedStepBody({ movedStepNumber: 1 }), requests);

    await runStep(
      stepFlags({
        to: "1"
      }),
      "move",
      "step-2",
      () => undefined
    );

    expect(requests).toEqual([
      {
        body: {
          to: 1
        },
        url: "https://api.example.test/v1/steps/step-2/move"
      }
    ]);
  });
});

function stubFetch(
  body: unknown,
  requests: Array<{ body: unknown; url: string }>
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit | undefined) => {
      requests.push({
        body:
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as unknown)
            : init?.body,
        url
      });
      return Promise.resolve({
        headers: new Headers(),
        json: () => Promise.resolve(body),
        ok: true
      } as Response);
    })
  );
}

function stepFlags(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    action: "Validates the amount.",
    actor: "Pocket",
    "api-url": "https://api.example.test",
    "session-cookie": "session-token",
    ...overrides
  };
}

function positionedStepBody(options: { movedStepNumber?: number } = {}) {
  const movedStepNumber = options.movedStepNumber ?? 2;
  return {
    revision: {
      id: "revision-2",
      severity: "NON_BREAKING",
      version_number: 5
    },
    scenario_steps: [
      {
        action: "Collects the amount.",
        id: "step-1",
        step_number: movedStepNumber === 1 ? 2 : 1
      },
      {
        action: "Validates the amount.",
        id: "step-2",
        step_number: movedStepNumber
      }
    ],
    step: {
      action: "Validates the amount.",
      id: "step-2",
      step_number: movedStepNumber
    }
  };
}
