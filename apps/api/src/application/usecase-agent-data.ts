import type { StoredUseCase } from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import { orderScenarioStepsForDisplay } from "./scenario-step-ordering.js";
import type { UseCaseAgentDeps } from "./usecase-agent-types.js";
import { invokedBy } from "./usecase-invocations.js";

export async function agentData(
  deps: UseCaseAgentDeps,
  projectId: string,
  usecase: StoredUseCase
) {
  return {
    invoked_by: await invokedBy(deps, projectId, usecase.key),
    primary_actor: {
      name: await actorName(deps.actorStore, projectId, usecase.primary_actor_id)
    },
    scenarios: await Promise.all(
      (await deps.scenarioStore.listScenarios(usecase.id)).map(async (scenario) => ({
        condition: scenario.condition,
        extension_point: scenario.extension_point,
        id: scenario.id,
        steps: await Promise.all(
          orderScenarioStepsForDisplay(await deps.stepStore.listSteps(scenario.id)).map(
            async (step) => ({
              action: step.action,
              actor: await actorName(deps.actorStore, projectId, step.actor_id),
              id: step.id,
              implements: step.implements,
              invokes: step.invokes,
              step_number: step.step_number
            })
          )
        ),
        type: scenario.type
      }))
    ),
    stakeholder_interests: await Promise.all(
      (await deps.stakeholderInterestStore.listStakeholderInterests(usecase.id)).map(
        async (interest) => ({
          interest: interest.interest,
          stakeholder: await stakeholderName(
            deps.stakeholderStore,
            projectId,
            interest.stakeholder_id
          )
        })
      )
    ),
    title: usecase.title,
    usecase
  };
}

async function actorName(actorStore: ActorStore, projectId: string, actorId: string) {
  return (await actorStore.findActorById(projectId, actorId))?.name ?? "System";
}

async function stakeholderName(
  stakeholderStore: StakeholderStore,
  projectId: string,
  stakeholderId: string
) {
  return (
    (await stakeholderStore.findStakeholderById(projectId, stakeholderId))?.name ?? ""
  );
}
