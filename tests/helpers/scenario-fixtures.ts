import { expect } from "vitest";
import { addInterest } from "./interest-fixtures.js";
import type { TestServer } from "./server.js";
import {
  createActor,
  createProject,
  createStakeholder,
  createUseCase
} from "./uc-fixtures.js";

export type Scenario = {
  condition: null | string;
  extension_point: null | string;
  id: string;
  order_index: number;
  outcome: string;
  parent_step_number: null | number;
  type: string;
  usecase_id: string;
};
export type ScenarioStep = {
  action: string;
  actor_id: string;
  id: string;
  scenario_id: string;
  step_number: number;
};
export type RevisionResponse = {
  change_summary: string;
  entity_id: string;
  entity_type: string;
  severity: string;
  version_number: number;
};
export type ScenarioResponse = {
  revision: RevisionResponse;
  scenario: Scenario;
  steps: ScenarioStep[];
};
export type StepResponse = {
  revision: RevisionResponse;
  scenario_steps: ScenarioStep[];
  step: ScenarioStep;
  warnings?: Array<{ message: string; type: string }>;
};
export type ProblemResponse = {
  existing_scenario_id?: string;
  existing_condition?: string;
  known_actors?: string[];
  example_extension_points?: string[];
  parent_step_number?: number;
  suggested_extension_point?: string;
  suggested_action?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
  valid_extension_point_forms?: string[];
};

export async function createMainScenario(
  server: TestServer,
  usecaseId: string,
  cookie: string
) {
  return server.fetch(`/v1/usecases/${usecaseId}/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ type: "MAIN_SUCCESS" })
  });
}

export async function createExtensionScenario(
  server: TestServer,
  usecaseId: string,
  cookie: string,
  body: { condition: string; extension_point: string; outcome?: string }
) {
  return server.fetch(`/v1/usecases/${usecaseId}/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ type: "EXTENSION", ...body })
  });
}

export async function addStep(
  server: TestServer,
  scenarioId: string,
  cookie: string,
  body: { action: string; actor: string; force?: boolean }
) {
  return server.fetch(`/v1/scenarios/${scenarioId}/steps`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}

export async function createScenarioReadyUseCase(
  server: TestServer,
  name: string,
  slug: string,
  code: string
) {
  const setup = await createProject(server, name, slug, code);
  const actor = await createActor(server, setup, "Customer");
  const usecase = await createUseCase(server, setup, "Customer", "Places an order");
  await createStakeholder(server, setup, "Product Manager");
  await addInterest(server, usecase.id, setup.cookie, {
    interest: "Checkout revenue is protected.",
    stakeholder: "Product Manager"
  });
  const response = await createMainScenario(server, usecase.id, setup.cookie);
  const scenario = (await response.json()) as ScenarioResponse;
  return { actor, scenario, setup, usecase };
}

export async function createUseCaseWithMainStep(
  server: TestServer,
  name: string,
  slug: string,
  code: string
) {
  const ready = await createScenarioReadyUseCase(server, name, slug, code);
  const response = await addStep(server, ready.scenario.scenario.id, ready.setup.cookie, {
    action: "Places an order.",
    actor: "Customer"
  });
  const body = (await response.json()) as StepResponse;
  return { ...ready, mainStep: body.step };
}

export function expectMainScenarioCreated(body: ScenarioResponse, usecaseId: string) {
  expect(body.scenario).toMatchObject({
    order_index: 0,
    outcome: "SUCCESS",
    type: "MAIN_SUCCESS",
    usecase_id: usecaseId
  });
  expect(body.revision).toMatchObject({
    change_summary: `Created main success scenario ${body.scenario.id}`,
    entity_id: usecaseId,
    entity_type: "USECASE",
    severity: "NON_BREAKING",
    version_number: 3
  });
  expect(body.steps).toEqual([]);
}
