import { addInterest } from "./interest-fixtures.js";
import type { TestServer } from "./server.js";
import {
  createActor,
  createProject,
  createStakeholder,
  createUseCase
} from "./uc-fixtures.js";

export type Scenario = {
  id: string;
  order_index: number;
  outcome: string;
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
};
export type ProblemResponse = {
  existing_scenario_id?: string;
  suggested_action?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
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
