import type {
  RevisionResponse,
  ScenarioStep
} from "./scenario-fixtures.js";
import type { TestServer } from "./server.js";

export type StepPatchResponse = {
  affected_sessions: string[];
  revision: RevisionResponse;
  step: ScenarioStep;
};

export type StepProblemResponse = {
  current_revision_id?: string;
  expires_at?: string;
  lock_holder?: string;
  lock_reason?: string;
  revision_diff?: { base_revision: string; current_revision: string };
  suggested_action?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

export async function patchStep(
  server: TestServer,
  stepId: string,
  cookie: string,
  body: { action?: string; base_revision: string; force?: boolean; notes?: string }
) {
  return server.fetch(`/v1/steps/${stepId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}
