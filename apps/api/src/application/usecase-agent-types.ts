import type { StoredUseCase } from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export type AgentWarning = { message: string; type: string };
export type UseCaseShowData = {
  invoked_by: Array<{
    key: string;
    scenario_id: string;
    step_number: number;
    title: string;
  }>;
  primary_actor: { name: string };
  scenarios: Array<{
    condition: null | string;
    extension_point: null | string;
    id: string;
    steps: Array<{
      action: string;
      actor: string;
      id: string;
      implements: string[];
      invokes: string[];
      step_number: number;
    }>;
    type: string;
  }>;
  stakeholder_interests: Array<{ interest: string; stakeholder: string }>;
  title: string;
  usecase: StoredUseCase;
};

export type AgentEnvelope = {
  context: {
    branch: "main";
    project_key: string;
    request_id: string;
    revision: string;
    session_id: null | string;
  };
  data: UseCaseShowData;
  format_version: 1;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  warnings: AgentWarning[];
};

export type UseCaseAgentDeps = {
  actorStore: ActorStore;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  scenarioStore: ScenarioStore;
  stakeholderInterestStore: StakeholderInterestStore;
  stakeholderStore: StakeholderStore;
  stepStore: StepStore;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

export type ShowUseCaseInput = {
  format: "agent" | "human" | "json";
  requestId: string;
  requestedRevision: string | undefined;
  sessionId: string | undefined;
  usecaseId: string;
  userId: string | undefined;
};

export type ShowUseCaseResult =
  | { status: "NOT_FOUND" }
  | { status: "AUTHENTICATION_REQUIRED" }
  | { data: UseCaseShowData; status: "SIMPLE"; usecase: StoredUseCase }
  | { revision: string | undefined; status: "REVISION_NOT_FOUND"; usecaseKey: string }
  | { envelope: AgentEnvelope; status: "AGENT_ENVELOPE" };
