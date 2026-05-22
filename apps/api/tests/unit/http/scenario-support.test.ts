import { describe, expect, test } from "vitest";
import type { StoredRevision } from "../../../src/domain/entities/index.js";
import {
  appendUseCaseRevision,
  duplicateMainSuccessProblem,
  extensionPointParentStep,
  mainScenarioHasStep,
  mainSuccessScenario,
  passiveActionProblem,
  scenarioWithUseCase,
  stepCreateResponse,
  unknownStepActorProblem,
  usesPassiveVoice
} from "../../../src/http/scenario-support.js";
import {
  revisionStore,
  scenario,
  scenarioStore,
  step,
  stepStore,
  storedUseCase,
  useCaseRevision,
  useCaseStore
} from "./scenario-support-fixtures.js";

describe("scenario support", () => {
  test("delegates main success scenario lookup to the scenario store", async () => {
    const main = scenario();

    await expect(
      mainSuccessScenario(scenarioStore({ main }), "usecase-1")
    ).resolves.toBe(main);
  });

  test("parses extension point parent steps", () => {
    expect(extensionPointParentStep("12a")).toBe(12);
    expect(extensionPointParentStep("12")).toBeNull();
    expect(extensionPointParentStep("step-12a")).toBeNull();
  });

  test("checks whether the main scenario contains a numbered step", async () => {
    const main = scenario();

    await expect(
      mainScenarioHasStep(stepStore([step({ step_number: 1 })]), main, 1)
    ).resolves.toBe(true);
    await expect(
      mainScenarioHasStep(stepStore([step({ step_number: 2 })]), main, 1)
    ).resolves.toBe(false);
  });

  test("resolves a scenario with its project and use case", async () => {
    const existingScenario = scenario({ id: "scenario-1" });
    const usecase = storedUseCase();

    await expect(
      scenarioWithUseCase(
        scenarioStore({ byId: existingScenario }),
        useCaseStore(usecase),
        "scenario-1"
      )
    ).resolves.toEqual({
      projectId: "project-1",
      scenario: existingScenario,
      usecase
    });
    await expect(
      scenarioWithUseCase(scenarioStore({}), useCaseStore(usecase), "missing")
    ).resolves.toBeUndefined();
    await expect(
      scenarioWithUseCase(
        scenarioStore({ byId: existingScenario }),
        useCaseStore(undefined),
        "scenario-1"
      )
    ).resolves.toBeUndefined();
  });

  test("appends a revision snapshot for a use case change", async () => {
    const saved: StoredRevision[] = [];
    const usecase = storedUseCase();

    const revision = await appendUseCaseRevision(
      revisionStore(saved),
      usecase,
      "Added step",
      "BREAKING"
    );

    expect(revision).toMatchObject({
      change_summary: "Added step",
      entity_id: "usecase-1",
      entity_type: "USECASE",
      severity: "BREAKING",
      snapshot: usecase,
      version_number: 3
    });
    expect(revision.snapshot).not.toBe(usecase);
    expect(saved).toEqual([revision]);
  });

  test("serializes scenario authoring problems", () => {
    expect(
      duplicateMainSuccessProblem(scenario({ id: "scenario-main" }))
    ).toMatchObject({
      existing_scenario_id: "scenario-main",
      status: 409,
      title: "MAIN_SUCCESS scenario already exists"
    });
    expect(passiveActionProblem("Order is submitted.")).toMatchObject({
      status: 422,
      suggested_action: "Submits the order.",
      title: "Step action uses passive voice"
    });
    expect(unknownStepActorProblem(["Buyer", "System"])).toMatchObject({
      known_actors: ["Buyer", "System"],
      status: 422,
      title: "Step actor is not registered"
    });
  });

  test("adds overlong scenario warnings only after nine steps", () => {
    const createdStep = step();
    const revision = useCaseRevision();

    expect(
      stepCreateResponse(createdStep, revision, Array.from({ length: 9 }, step))
    ).not.toHaveProperty("warnings");
    expect(
      stepCreateResponse(createdStep, revision, Array.from({ length: 10 }, step))
    ).toMatchObject({
      warnings: [
        {
          message:
            "Scenarios over nine steps usually indicate the use case should be split.",
          type: "SCENARIO_OVER_NINE_STEPS"
        }
      ]
    });
  });

  test("detects passive voice and suggests a fallback rewrite", () => {
    expect(usesPassiveVoice("Order is submitted.")).toBe(true);
    expect(usesPassiveVoice("Buyer submits order.")).toBe(false);
    expect(passiveActionProblem("Reviewed by buyer")).toMatchObject({
      suggested_action: "Rewrite the step in active voice."
    });
  });
});
